import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, PanelLeft, User, X } from 'lucide-react';

import { EventAttendanceContainer } from '@/pages/attendance-events/ui/EventAttendanceContainer';
import { HostsPage } from '@/pages/attendance-hosts/ui/HostsPage';
import { InputPageContainer } from '@/pages/attendance-input/ui/InputPageContainer';
import { InternalCategoryAttendanceContainer } from '@/pages/attendance-internal-category/ui/InternalCategoryAttendanceContainer';
import { RulesPage } from '@/pages/attendance-rules/ui/RulesPage';
import { ScoresPage } from '@/pages/attendance-scores/ui/ScoresPage';
import { ArchivingSection } from '@/pages/content-archive/ui/ArchivingSection';
import { CurriculumSection } from '@/pages/content-curriculum/ui/CurriculumSection';
import { FaqSection } from '@/pages/content-faq/ui/FaqSection';
import { ReviewsSection } from '@/pages/content-reviews/ui/ReviewsSection';
import { EvaluationManagePage } from '@/pages/recruiting-evaluation/ui/EvaluationManagePage';
import { RecruitmentManagePage } from '@/pages/recruiting-manage/ui/RecruitmentManagePage';
import { MemberManagementPage } from '@/pages/member-management/ui/MemberManagementPage';
import { SystemAccountsPage } from '@/pages/system-accounts/ui/SystemAccountsPage';
import { LoginModal } from '@/widgets/login-modal/ui/LoginModal';
import { DataLoadFailedNotice } from '@/shared/ui/DataLoadFailedNotice';

import { Sidebar } from '@/widgets/sidebar/ui/Sidebar';
import boazLogo from '@/shared/assets/boaz-logo.png';
import { useAttendanceMeta } from '@/entities/attendance/model/useAttendanceMeta';
import { useCurrentTeams } from '@/entities/study-team/model/useCurrentTeams';
import { useHosts } from '@/entities/host-account/model/useHosts';
import { changeAdminPassword } from '@/entities/admin-account/api/adminAccountApi';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import { logout, openDevDefaultSession, restoreSession } from '@/entities/auth/api/authApi';
import type { AuthSession } from '@/entities/auth/model/types';
import type { SemesterAttendanceKind, SemesterDto } from '@/entities/cohort/model/dto';
import { createSemester, updateSemester } from '@/entities/cohort/api/semesterApi';
import type { WeekInfo } from '@/entities/attendance/model/week';
import type { HostAccount } from '@/entities/host-account/model/types';
import { useScoreRules } from '@/entities/score-rule/model/useScoreRules';
import type { StudyTeamInfo } from '@/entities/study-team/model/types';
import type { UserRole, UserTrack } from '@/entities/user/model/types';
import type { ActivePage } from '@/shared/config/activePage';
import { isActivePage, PAGE_LABELS } from '@/shared/config/pageLabels';
import { confirmLeave } from '@/shared/lib/leaveGuard';

const NO_TEAMS: StudyTeamInfo[] = [];
const NO_HOSTS: HostAccount[] = [];
const NO_SEMESTERS: SemesterDto[] = [];
const NO_TRACKS: UserTrack[] = [];
const NO_WEEKS: WeekInfo[] = [];

/**
 * 주소(#)의 화면 이름. '#system-accounts/u_26_08'처럼 '/' 뒤에 화면 안의 위치(고른 계정 등)를 붙일 수 있어,
 * '/' 앞부분만 화면 이름으로 읽는다.
 */
const pageOfHash = (): string => window.location.hash.replace(/^#/, '').split('/')[0];

function getInitialActivePage(): ActivePage {
  try {
    const hash = pageOfHash();
    // 권한 설정 화면은 권한 관리 화면의 권한 편집 창으로 합쳤다. 예전 주소는 같은 사람을 연 채 권한 관리로 옮긴다.
    if (hash === 'system-permissions') {
      window.history.replaceState(
        null,
        '',
        window.location.hash.replace(/^#system-permissions/, '#system-accounts'),
      );
      return 'system-accounts';
    }
    if (isActivePage(hash)) return hash;
    const saved = localStorage.getItem('boaz_active_page');
    if (saved && isActivePage(saved)) return saved;
  } catch {
    // ignore
  }
  return 'recruiting-posts';
}

/** 브라우저에 남기는 로그인 아이디(새로고침 뒤 세션을 되살리는 데만 쓴다). */
const USERNAME_KEY = 'boaz_username';

/** 로그인 세션의 등급을 화면 진입 역할로 바꾼다. 서비스운영팀 운영진은 콘텐츠 화면으로 들어간다. */
function userRoleOf(session: AuthSession): UserRole {
  if (session.role === 'HOST') return 'HOST';
  if (session.role === 'TEAM')
    return session.teamName === '서비스운영팀' ? 'CONTENT_ADMIN' : 'TEAM';
  return 'SUPER';
}

/** 개발 모드에서 저장한 아이디 없이 처음 열었을 때 받은 첫 운영진 계정을 로그인 세션 모양으로 바꾼다. */
function sessionOfAccount(account: AdminAccount): AuthSession {
  return {
    kind: 'ADMIN',
    name: account.name,
    username: account.username ?? '',
    role: account.role,
    teamName: account.teamName,
    accountId: account.id,
    hostId: null,
    hostTeamId: null,
  };
}

export default function App() {
  // 점수 규칙의 원본은 DB다. 목록을 API에서 읽고, 규칙 화면에서 바꾸면 다시 읽는다.
  // 점수 계산은 점수 API가 적용 중인 규칙으로 하므로, 출결 화면에 규칙을 내려주지 않는다.
  const { rules: scoreRules, reload: reloadScoreRules } = useScoreRules();

  const [activePage, setActivePage] = useState<ActivePage>(getInitialActivePage);
  // 행사 출결 메뉴를 다시 누른 횟수. 바뀌면 행사 출결 화면이 행사 목록으로 돌아간다.
  const [eventListRequest, setEventListRequest] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem('boaz_active_page', activePage);
      if (pageOfHash() !== activePage) {
        window.history.replaceState(null, '', `#${activePage}`);
      }
    } catch {
      // ignore
    }
  }, [activePage]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = pageOfHash();
      if (isActivePage(hash)) setActivePage(hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('boaz_sidebar_open_v2');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('boaz_sidebar_open_v2', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Notion-style Ctrl+\ (or Cmd+\) shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  // 각 출결 탭은 열릴 때 자기 데이터를 API로 읽는다. App은 로그인한 HOST의 담당 팀을 찾는 데 쓰는
  // 현재 반기의 스터디·ADV 팀만 API로 읽고, 다른 탭에서 저장하면 다시 읽는다.
  const { teams: currentTeams, error: teamDbError, reload: refreshTeamState } = useCurrentTeams();
  // 반기(현재·다음 반기, 반기 표기, ADV 기수)와 주차 진행 상태는 화면이 계산하지 않고 반기 API에서 받는다.
  const {
    meta: attendanceMeta,
    error: attendanceMetaError,
    reload: reloadAttendanceMeta,
  } = useAttendanceMeta();
  const semesters = attendanceMeta?.semesters ?? NO_SEMESTERS;
  const currentSemester = attendanceMeta?.currentSemester ?? null;
  const nextSemester = attendanceMeta?.nextSemester ?? null;
  // 반기 선택 목록은 그 화면의 출결이 등록된 반기만 보여 준다(반기 API의 attendanceKinds 기준).
  // 현재 반기는 출결을 새로 만들 수 있어야 하므로 비어 있어도 늘 넣는다.
  const cohortsWith = useCallback(
    (kind: SemesterAttendanceKind) =>
      semesters
        .filter((semester) => semester.isCurrent || semester.attendanceKinds.includes(kind))
        .map((semester) => semester.cohort),
    [semesters],
  );
  const baseCohorts = useMemo(() => cohortsWith('BASE'), [cohortsWith]);
  const studyCohorts = useMemo(() => cohortsWith('STUDY'), [cohortsWith]);
  const eventCohorts = useMemo(() => cohortsWith('EVENT'), [cohortsWith]);
  const currentCohort = currentSemester?.cohort ?? null;
  // ADV 팀의 기수는 회원 기수다. 반기마다 ADV를 진행하는 기수(advTerm)가 정해져 있다.
  const advCohorts = useMemo(
    () =>
      semesters.flatMap((semester) =>
        semester.advTerm === null ||
        !(semester.isCurrent || semester.attendanceKinds.includes('ADV'))
          ? []
          : [semester.advTerm],
      ),
    [semesters],
  );
  const advCurrentCohort = currentSemester?.advTerm ?? null;
  /** 활동 기수 → 반기 표기, ADV 기수 → 그 기수가 ADV를 진행하는 반기 표기 */
  // 반기 선택 목록(semesters)에는 다음 반기가 없으므로, 출결 생성 창이 쓰는 다음 반기 표기를 함께 넣는다.
  const labeledSemesters = useMemo(
    () => (nextSemester ? [...semesters, nextSemester] : semesters),
    [semesters, nextSemester],
  );
  const cohortLabels = useMemo(
    () =>
      Object.fromEntries(labeledSemesters.map((semester) => [semester.cohort, semester.semester])),
    [labeledSemesters],
  );
  const advCohortLabels = useMemo(
    () =>
      Object.fromEntries(
        labeledSemesters.flatMap((semester) =>
          semester.advTerm === null ? [] : [[semester.advTerm, semester.semester]],
        ),
      ),
    [labeledSemesters],
  );
  const advTeams = currentTeams?.adv ?? NO_TEAMS;
  const studyTeams = currentTeams?.study ?? NO_TEAMS;
  const tracks = attendanceMeta?.tracks ?? NO_TRACKS;
  async function handleAdvanceSemester(): Promise<void> {
    if (!nextSemester || !attendanceMeta) throw new Error('다음 반기 정보를 불러오지 못했습니다.');
    if (attendanceMeta.canCreateNextSemester) {
      await createSemester({
        cohort: nextSemester.cohort,
        semester: nextSemester.semester,
        startDate: nextSemester.startDate,
        endDate: nextSemester.endDate,
        advTerm: nextSemester.advTerm,
        memberTerms: nextSemester.memberTerms,
      });
    }
    await updateSemester(nextSemester.semester, { isCurrent: true });
    reloadAttendanceMeta();
    reloadHosts();
    refreshTeamState();
  }
  // 현재 반기의 주차와 진행 상태(semester_weeks). 화면이 쓰는 주차 모양(WeekInfo)으로만 바꾼다.
  const weeks = useMemo<WeekInfo[]>(
    () =>
      attendanceMeta?.weeks.map((week) => ({
        id: `w${week.weekNum}`,
        weekNum: week.weekNum,
        period: week.period,
        label: week.label,
        status: week.status,
      })) ?? NO_WEEKS,
    [attendanceMeta],
  );
  /** 반기 정보를 아직 못 받았을 때 출결 관리 화면 대신 보여줄 안내. */
  const semesterNotice = attendanceMetaError ? (
    <DataLoadFailedNotice onRetry={() => window.location.reload()} />
  ) : (
    <p className="py-8 text-center text-xs text-slate-400">반기 정보를 불러오는 중입니다.</p>
  );
  // HOST 계정도 임시 DB가 원본이다. 발급·삭제하면 DB에 바로 저장된다.
  // 로그인할 때 담당 팀을 찾는 데 쓰는 HOST 계정 목록(API). HOST 관리 화면은 자기 데이터를 따로 읽는다.
  const { hosts: hostRows, error: hostDbError, reload: reloadHosts } = useHosts();
  const hosts = hostRows ?? NO_HOSTS;
  // 로그인 세션은 임시 API(DB의 admin·host_accounts)가 원본이다. 세션이 없으면 로그인 창만 보여 준다.
  // 브라우저에는 아이디와 로그인 여부만 남긴다. 비밀번호는 저장하지 않는다.
  // 새로고침하면 임시 DB가 새로 만들어져 세션이 사라지는데, 비밀번호 없이 세션을 되살리는 경로는 개발 모드에만 있다.
  // 그래서 개발 모드에서만 남긴 아이디(없으면 첫 운영진 계정)로 되살리고, 배포 빌드는 다시 로그인하게 한다.
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() => {
    if (!import.meta.env.DEV) return false;
    try {
      return localStorage.getItem('boaz_is_logged_in') !== 'false';
    } catch {
      return true;
    }
  });
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const loggedHostTeam = session?.hostTeamId ?? '';
  const loggedUsername = session?.username ?? '';
  const displayName = session?.name ?? '';

  useEffect(() => {
    if (!isRestoringSession) return;
    let isCancelled = false;
    let savedUsername: string | null = null;
    try {
      savedUsername = localStorage.getItem(USERNAME_KEY);
    } catch {
      // 저장소를 못 읽으면 첫 운영진 계정으로 연다.
    }
    const load = savedUsername
      ? restoreSession(savedUsername)
      : openDevDefaultSession().then(sessionOfAccount);
    load
      .then((restored) => {
        if (!isCancelled) setSession(restored);
      })
      .catch(() => {
        if (isCancelled) return;
        // 저장한 아이디의 계정이 없어졌다(삭제·회수, 또는 새로고침으로 임시 DB가 시드 상태로 돌아가
        // 화면에서 만든 계정이 사라짐). 임시 세션과 저장한 아이디를 지워 다음 새로고침부터는 같은 실패를
        // 되풀이하지 않게 하고, 다시 로그인하게 한다.
        void logout().catch(() => {});
        try {
          localStorage.setItem('boaz_is_logged_in', 'false');
          localStorage.removeItem(USERNAME_KEY);
        } catch {
          // 저장소를 못 쓰면 다음 새로고침 때 다시 묻는다.
        }
      })
      .finally(() => {
        if (!isCancelled) setIsRestoringSession(false);
      });
    return () => {
      isCancelled = true;
    };
    // 처음 한 번만 되살린다. 로그인·로그아웃은 아래 함수가 세션을 직접 바꾼다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    if (!window.confirm('로그아웃 하시겠습니까?')) return;
    try {
      await logout();
    } catch {
      // 임시 API 세션 정리에 실패해도 화면은 로그아웃한다.
    }
    setSession(null);
    try {
      localStorage.setItem('boaz_is_logged_in', 'false');
      localStorage.removeItem(USERNAME_KEY);
    } catch {}
    setShowMyProfileModal(false);
  }

  const [showMyProfileModal, setShowMyProfileModal] = useState(false);
  const [myCurrentPw, setMyCurrentPw] = useState('');
  const [myNewPw, setMyNewPw] = useState('');
  const [myConfirmPw, setMyConfirmPw] = useState('');
  const [myPwError, setMyPwError] = useState('');
  const [isSavingMyPw, setIsSavingMyPw] = useState(false);

  /** 팀 id 또는 팀 이름(호스트 계정에 적힌 값)으로 팀 id를 찾는다. 이름은 부문이 다르면 겹칠 수 있어 처음 일치하는 팀을 쓴다. */
  function resolveTeamId(idOrName?: string): string {
    if (!idOrName) return '';
    const teams = [...studyTeams, ...advTeams];
    return (
      (teams.find((t) => t.id === idOrName) ?? teams.find((t) => t.teamName === idOrName))?.id ?? ''
    );
  }

  /**
   * 로그인한 HOST 계정이 맡은 팀(DB의 host_accounts·host_assigned_groups) 중 그 출결 입력 탭(ADV/스터디)의 팀을 고른다.
   * ADV와 스터디를 함께 맡은 계정은 탭마다 자기 팀이 열리고, 못 찾으면 로그인 때 넘어온 팀으로 대신한다.
   */
  function resolveHostTeamFor(isAdvTab: boolean): string {
    const tabTeams = isAdvTab ? advTeams : studyTeams;
    const host = hosts.find((account) => account.username === loggedUsername);
    const ownedIds = [host?.teamId, ...(host?.assignedGroups ?? []).map((group) => group.teamId)];
    const mine = ownedIds.find((id) => id && tabTeams.some((team) => team.id === id));
    return mine ?? resolveTeamId(loggedHostTeam);
  }

  function handleLoginSuccess(next: AuthSession) {
    setSession(next);
    try {
      localStorage.setItem('boaz_is_logged_in', 'true');
      localStorage.setItem(USERNAME_KEY, next.username);
    } catch {}
    const role = userRoleOf(next);
    if (role === 'HOST') {
      const isAdvTeam = advTeams.some((team) => team.id === next.hostTeamId);
      setActivePage(isAdvTeam ? 'att-input-adv' : 'att-input-study');
    } else if (role === 'CONTENT_ADMIN') {
      setActivePage('content-archive');
    } else if (role === 'SUPER') {
      setActivePage('recruiting');
    } else {
      setActivePage('att-study');
    }
  }

  function closeMyProfile() {
    setShowMyProfileModal(false);
    setMyCurrentPw('');
    setMyNewPw('');
    setMyConfirmPw('');
    setMyPwError('');
  }

  /** 본인 비밀번호를 바꾼다(운영진 계정만). 현재 비밀번호는 서버가 확인한다. */
  async function handleSaveMyPassword() {
    setMyPwError('');
    if (!session?.accountId) return;
    if (!myCurrentPw.trim() || !myNewPw.trim() || !myConfirmPw.trim()) {
      setMyPwError('모든 항목을 입력해 주세요.');
      return;
    }
    if (myNewPw !== myConfirmPw) {
      setMyPwError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setIsSavingMyPw(true);
    try {
      await changeAdminPassword(session.accountId, {
        currentPassword: myCurrentPw,
        newPassword: myNewPw,
      });
      closeMyProfile();
    } catch (error) {
      setMyPwError(error instanceof Error ? error.message : '비밀번호를 바꾸지 못했습니다.');
    } finally {
      setIsSavingMyPw(false);
    }
  }

  const isRecruiting = Boolean(activePage?.startsWith('recruiting'));
  const isEvaluation = Boolean(activePage?.startsWith('evaluation'));
  const isContentPage = Boolean(activePage?.startsWith('content'));
  const isAttendancePage = Boolean(activePage?.startsWith('att-'));

  if (isRestoringSession || (!currentTeams && !teamDbError) || (!hostRows && !hostDbError)) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        데이터를 불러오는 중...
      </div>
    );
  }

  // 로그인 전·로그아웃 뒤에는 어떤 화면도 열지 않고 로그인 창만 둔다(닫을 수 없다).
  if (!session) {
    return (
      <div className="h-screen bg-[#f8fafc]">
        <LoginModal onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }
  const currentRole = userRoleOf(session);

  return (
    <div
      className="flex h-screen overflow-hidden bg-[#f8fafc]"
      style={{
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      <Sidebar
        activePage={activePage}
        onChange={(page) => {
          // 이미 열려 있는 행사 출결 메뉴를 다시 누르면 행사 목록으로 돌아가게 알린다.
          if (page === activePage && page === 'att-events') {
            setEventListRequest((count) => count + 1);
            return;
          }
          // 저장하지 않은 수정 내용이 있는 화면이면 옮기기 전에 묻는다(취소하면 머문다).
          if (page !== activePage && !confirmLeave()) return;
          setActivePage(page);
        }}
        open={sidebarOpen}
        onClose={() => {
          setSidebarOpen(false);
          try {
            localStorage.setItem('boaz_sidebar_open_v2', 'false');
          } catch {}
        }}
        currentRole={currentRole}
        onOpenLogin={() => setLoginModalOpen(true)}
        loggedHostTeam={loggedHostTeam}
        loggedUsername={loggedUsername}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc]">
        {/* Topbar */}
        <header className="h-14 shrink-0 flex items-center justify-between px-6 bg-white border-b border-slate-200/80 select-none z-10">
          <div className="flex items-center gap-2.5">
            {!sidebarOpen ? (
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-0.5 rounded-full hover:ring-2 hover:ring-slate-200 transition-all cursor-pointer select-none shrink-0"
                title="사이드바 열기"
              >
                <img
                  src={boazLogo}
                  alt="bigdata BOAZ"
                  className="w-7 h-7 rounded-full object-contain select-none border border-slate-100 shadow-2xs"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                title="사이드바 접기"
              >
                <PanelLeft size={16} />
              </button>
            )}

            {!sidebarOpen && (
              <>
                <div className="w-[1px] h-3.5 bg-slate-200" />

                <div className="flex items-center gap-1.5 text-xs">
                  {isRecruiting && (
                    <>
                      <span className="font-medium text-slate-500">리크루팅</span>
                      <ChevronRight size={12} className="text-slate-400 stroke-[2]" />
                    </>
                  )}
                  {isEvaluation && (
                    <>
                      <span className="font-medium text-slate-500">서류 평가</span>
                      <ChevronRight size={12} className="text-slate-400 stroke-[2]" />
                    </>
                  )}
                  {isContentPage && (
                    <>
                      <span className="font-medium text-slate-500">콘텐츠 관리</span>
                      <ChevronRight size={12} className="text-slate-400 stroke-[2]" />
                    </>
                  )}
                  {isAttendancePage && (
                    <>
                      <span className="font-medium text-slate-500">출결 관리</span>
                      <ChevronRight size={12} className="text-slate-400 stroke-[2]" />
                    </>
                  )}
                  <span className="text-slate-900 font-semibold tracking-tight">
                    {PAGE_LABELS[activePage] || '관리자 콘솔'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Right User Auth Area (media_1789198942116 style) */}
          <div className="flex items-center">
            <div className="flex items-center gap-4 text-sm select-none">
              <button
                type="button"
                onClick={() => setShowMyProfileModal(true)}
                className="flex items-center gap-1.5 font-semibold text-slate-900 hover:text-slate-700 transition-colors cursor-pointer group"
                title="내 프로필 정보 확인"
              >
                <User
                  size={14}
                  className="text-slate-800 fill-slate-800 group-hover:text-slate-950 group-hover:fill-slate-950 transition-colors"
                />
                <span>{displayName}</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="text-sm text-slate-500 hover:text-slate-900 font-normal transition-colors cursor-pointer"
              >
                로그아웃
              </button>
            </div>
          </div>
        </header>

        {/* Content Main Body */}
        <main
          className="flex-1 overflow-y-auto overscroll-y-none px-8 py-7"
          style={{ scrollbarWidth: 'none' }}
        >
          {(teamDbError || hostDbError) && isAttendancePage && (
            <DataLoadFailedNotice onRetry={() => window.location.reload()} />
          )}
          {/* 1. Recruiting Management */}
          {isRecruiting && (
            <RecruitmentManagePage
              key={activePage}
              initialTab={
                activePage === 'recruiting-questions'
                  ? 'questions'
                  : activePage === 'recruiting-preview'
                    ? 'preview'
                    : activePage === 'recruiting-csv'
                      ? 'csv'
                      : activePage === 'recruiting-leads'
                        ? 'leads'
                        : 'posts'
              }
              onTabChange={(pageId) => setActivePage(pageId as ActivePage)}
            />
          )}

          {/* 2. Evaluation Management */}
          {isEvaluation && (
            <EvaluationManagePage
              initialTab={
                activePage === 'evaluation-applicants'
                  ? 'applicants'
                  : activePage === 'evaluation-promote'
                    ? 'promotions'
                    : 'evaluations'
              }
            />
          )}

          {/* 3. Content Management */}
          {(activePage === 'content-archive' || activePage === 'content') && <ArchivingSection />}
          {activePage === 'content-faq' && <FaqSection />}
          {activePage === 'content-curriculum' && <CurriculumSection />}
          {activePage === 'content-reviews' && <ReviewsSection />}

          {/* 4. Attendance Management */}
          {activePage === 'att-session' &&
            (currentCohort === null ? (
              semesterNotice
            ) : (
              <InternalCategoryAttendanceContainer
                category="SESSION"
                semesters={semesters}
                weeks={weeks}
                cohorts={baseCohorts}
                currentCohort={currentCohort}
                canCreateNextSemester={attendanceMeta?.canCreateNextSemester ?? false}
                onAdvanceSemester={handleAdvanceSemester}
                cohortLabels={cohortLabels}
                tracks={tracks}
                onDataChanged={refreshTeamState}
              />
            ))}
          {activePage === 'att-adv' &&
            (advCurrentCohort === null ? (
              semesterNotice
            ) : (
              <InternalCategoryAttendanceContainer
                category="ADV"
                semesters={semesters}
                weeks={weeks}
                cohorts={advCohorts}
                currentCohort={advCurrentCohort}
                canCreateNextSemester={attendanceMeta?.canCreateNextSemester ?? false}
                onAdvanceSemester={handleAdvanceSemester}
                cohortLabels={advCohortLabels}
                tracks={tracks}
                onDataChanged={refreshTeamState}
              />
            ))}
          {activePage === 'att-study' &&
            (currentCohort === null ? (
              semesterNotice
            ) : (
              <InternalCategoryAttendanceContainer
                category="STUDY"
                semesters={semesters}
                weeks={weeks}
                cohorts={studyCohorts}
                currentCohort={currentCohort}
                canCreateNextSemester={attendanceMeta?.canCreateNextSemester ?? false}
                onAdvanceSemester={handleAdvanceSemester}
                cohortLabels={cohortLabels}
                tracks={tracks}
                onDataChanged={refreshTeamState}
              />
            ))}
          {activePage === 'att-events' &&
            (currentCohort === null ? (
              semesterNotice
            ) : (
              <EventAttendanceContainer
                cohorts={eventCohorts}
                currentCohort={currentCohort}
                cohortLabels={cohortLabels}
                canCreateNextSemester={attendanceMeta?.canCreateNextSemester ?? false}
                onAdvanceSemester={handleAdvanceSemester}
                listRequest={eventListRequest}
              />
            ))}
          {activePage === 'att-scores' && <ScoresPage />}
          {(activePage === 'att-input' ||
            activePage === 'att-input-adv' ||
            activePage === 'att-input-study') && (
            <InputPageContainer
              key={activePage}
              pageTitle={
                activePage === 'att-input-study' ? '스터디 출결 입력' : 'ADV Term 출결 입력'
              }
              currentHostTeam={resolveHostTeamFor(activePage !== 'att-input-study')}
              currentRole={currentRole}
              weeks={weeks}
              currentWeekNum={currentSemester?.currentWeekNum ?? null}
              currentPeriod={currentSemester?.currentPeriod ?? null}
              onDataChanged={refreshTeamState}
            />
          )}
          {activePage === 'att-hosts' && (
            <HostsPage
              onDataChanged={() => {
                reloadHosts();
                refreshTeamState();
              }}
            />
          )}
          {activePage === 'att-rules' && (
            <RulesPage rules={scoreRules} onRulesChanged={reloadScoreRules} />
          )}

          {/* 5. System Section */}
          {activePage === 'system-members' && <MemberManagementPage />}
          {(activePage === 'system' || activePage === 'system-accounts') && <SystemAccountsPage />}
        </main>
      </div>

      {/* 내 계정 정보와 비밀번호 변경 */}
      {showMyProfileModal && session && (
        <div
          className="fixed inset-0 z-90 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeMyProfile();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-profile-title"
            className="w-full max-w-sm rounded-lg bg-white shadow-lg"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 id="my-profile-title" className="text-base font-bold text-slate-900">
                  내 계정
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {session.name} · {session.username}
                </p>
              </div>
              <button
                type="button"
                onClick={closeMyProfile}
                aria-label="닫기"
                className="cursor-pointer rounded-sm p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-4">
              <dl className="space-y-2 text-sm">
                <div className="flex gap-4">
                  <dt className="w-20 shrink-0 text-xs leading-5 text-slate-500">등급</dt>
                  <dd className="leading-5 text-slate-900">{session.role}</dd>
                </div>
                {session.teamName && (
                  <div className="flex gap-4">
                    <dt className="w-20 shrink-0 text-xs leading-5 text-slate-500">팀</dt>
                    <dd className="leading-5 text-slate-900">{session.teamName}</dd>
                  </div>
                )}
              </dl>

              {session.kind === 'HOST' ? (
                <p className="border-t border-slate-200 pt-4 text-xs text-slate-500">
                  그룹 리더(HOST) 계정의 비밀번호는 출결의 HOST 화면에서 바꿉니다.
                </p>
              ) : (
                <form
                  className="space-y-3 border-t border-slate-200 pt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSaveMyPassword();
                  }}
                >
                  {[
                    {
                      id: 'my-current-pw',
                      label: '현재 비밀번호',
                      value: myCurrentPw,
                      onChange: setMyCurrentPw,
                      autoComplete: 'current-password',
                    },
                    {
                      id: 'my-new-pw',
                      label: '새 비밀번호',
                      value: myNewPw,
                      onChange: setMyNewPw,
                      autoComplete: 'new-password',
                    },
                    {
                      id: 'my-confirm-pw',
                      label: '새 비밀번호 확인',
                      value: myConfirmPw,
                      onChange: setMyConfirmPw,
                      autoComplete: 'new-password',
                    },
                  ].map((field) => (
                    <div key={field.id}>
                      <label htmlFor={field.id} className="mb-1 block text-xs text-slate-500">
                        {field.label}
                      </label>
                      <input
                        id={field.id}
                        type="password"
                        autoComplete={field.autoComplete}
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                        className="h-10 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none hover:border-slate-300 focus:border-slate-400"
                      />
                    </div>
                  ))}
                  {myPwError && (
                    <p role="alert" className="text-xs text-red-600">
                      {myPwError}
                    </p>
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={closeMyProfile}
                      className="h-9 cursor-pointer rounded-sm px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingMyPw}
                      className="h-9 cursor-pointer rounded-sm bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      비밀번호 변경
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {loginModalOpen && (
        <LoginModal onClose={() => setLoginModalOpen(false)} onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}
