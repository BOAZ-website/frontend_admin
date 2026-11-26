import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Lock, LogOut, PanelLeft, User } from 'lucide-react';

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
import type { TrackType } from '@/pages/recruiting-evaluation/model/types';
import { EvaluationManagePage } from '@/pages/recruiting-evaluation/ui/EvaluationManagePage';
import { RecruitmentManagePage } from '@/pages/recruiting-manage/ui/RecruitmentManagePage';
import { MemberManagementPage } from '@/pages/member-management/ui/MemberManagementPage';
import { AuditLogPage } from '@/pages/system-audit/ui/AuditLogPage';
import { SystemAccountsPage } from '@/pages/system-accounts/ui/SystemAccountsPage';
import { SemesterManagementPage } from '@/pages/system-semesters/ui/SemesterManagementPage';
import { LoginModal } from '@/widgets/login-modal/ui/LoginModal';
import { LoginScreen } from '@/widgets/login-modal/ui/LoginScreen';
import { DataLoadFailedNotice } from '@/shared/ui/DataLoadFailedNotice';
import { Dialog } from '@/shared/ui/dialog/Dialog';
import { ClearFieldButton } from '@/shared/ui/field/ClearFieldButton';
import { PasswordVisibilityButton } from '@/shared/ui/field/PasswordVisibilityButton';

import { Sidebar } from '@/widgets/sidebar/ui/Sidebar';
import boazLogo from '@/shared/assets/boaz-logo.png';
import { useAttendanceMeta } from '@/entities/attendance/model/useAttendanceMeta';
import { useCurrentTeams } from '@/entities/study-team/model/useCurrentTeams';
import { changeAdminPassword, fetchMyAccount } from '@/entities/admin-account/api/adminAccountApi';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import { SERVICE_OPERATIONS_TEAM } from '@/entities/admin-account/model/teams';
import { trackButtonClassOf } from '@/entities/user/model/trackAccent';
import { trackImageOf } from '@/entities/user/model/trackImage';
import { trackLabelOf } from '@/entities/user/model/trackLabel';
import { roleTitleOf } from '@/entities/admin-account/model/roleTitle';
import { logout, openDevDefaultSession, restoreSession } from '@/entities/auth/api/authApi';
import type { AuthSession } from '@/entities/auth/model/types';
import type { SemesterDto } from '@/entities/cohort/model/dto';
import type { WeekInfo } from '@/entities/attendance/model/week';
import { useScoreRules } from '@/entities/score-rule/model/useScoreRules';
import type { StudyTeamInfo } from '@/entities/study-team/model/types';
import type { UserRole, UserTrack } from '@/entities/user/model/types';
import type { ActivePage } from '@/shared/config/activePage';
import { isActivePage, PAGE_LABELS } from '@/shared/config/pageLabels';
import { IS_DEV_ACCOUNTS_ENABLED } from '@/shared/config/devAccounts';
import { confirmLeave } from '@/shared/lib/leaveGuard';

const NO_TEAMS: StudyTeamInfo[] = [];
const NO_SEMESTERS: SemesterDto[] = [];
const NO_TRACKS: UserTrack[] = [];

/** 내 계정 창의 메뉴 줄(비밀번호 변경, 로그아웃). 위에 구분선을 긋고 줄 전체를 누를 수 있다. */
const MY_ACCOUNT_MENU_ROW =
  'flex w-full cursor-pointer items-center gap-3 border-t border-slate-100 py-3 text-sm font-medium text-slate-700 transition-colors hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600';
/** 내 계정 창의 비밀번호 입력칸. 테두리는 세 칸을 묶은 상자가 그린다. */
const MY_PW_INPUT =
  'h-10 w-full bg-transparent py-0 pr-20 pl-3 text-sm text-slate-900 outline-none placeholder:text-slate-400';
/** 내 계정 창의 소속 배지(팀, 부문). */
const MY_ACCOUNT_BADGE =
  'shrink-0 rounded-full border border-slate-200 px-1.5 text-[11px] leading-[18px] font-medium text-slate-500';
const NO_WEEKS: WeekInfo[] = [];

/** 서류 평가 부문 메뉴의 화면 ID. 세 메뉴가 같은 평가 목록을 부문만 바꿔 보여 준다. */
const EVALUATION_TRACK_PAGES: Record<TrackType, ActivePage> = {
  ANALYSIS: 'evaluation-analysis',
  VISUALIZATION: 'evaluation-visualization',
  ENGINEERING: 'evaluation-engineering',
};
const trackOfEvaluationPage = (page: ActivePage): TrackType | undefined =>
  (Object.keys(EVALUATION_TRACK_PAGES) as TrackType[]).find(
    (track) => EVALUATION_TRACK_PAGES[track] === page,
  );

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
    // 부문 구분 없던 서류 평가 화면(evaluation-evals 등)은 부문별 메뉴로 나눴다. 예전 주소나 마지막으로 연 화면이면 첫 부문(분석)으로 연다.
    const isOldEvaluationPage = (page: string | null) =>
      page === 'evaluation-group' || page === 'evaluation-my' || page === 'evaluation-evals';
    if (isOldEvaluationPage(hash) || isOldEvaluationPage(saved)) {
      return 'evaluation-analysis';
    }
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
    return session.teamName === SERVICE_OPERATIONS_TEAM ? 'CONTENT_ADMIN' : 'TEAM';
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
    leaderTeamIds: [],
  };
}

export default function App() {
  // 점수 규칙의 원본은 DB다. 목록을 API에서 읽고, 규칙 화면에서 바꾸면 다시 읽는다.
  // 점수 계산은 점수 API가 적용 중인 규칙으로 하므로, 출결 화면에 규칙을 내려주지 않는다.
  const { rules: scoreRules, reload: reloadScoreRules } = useScoreRules();

  const [activePage, setActivePage] = useState<ActivePage>(getInitialActivePage);
  // 사이드바 메뉴를 누른 횟수. 바뀌면 행사 출결·서류 평가 화면이 상세를 닫고 목록으로 돌아간다.
  const [listRequest, setListRequest] = useState(0);

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
  // 반기 선택 목록은 반기 관리 목록과 같다(같은 반기 API). 출결 기록이 없는 반기도 보인다.
  // 준비 반기는 아직 시작하지 않아 출결 화면에는 넣지 않는다(반기 API가 빼고 준다).
  const semesterCohorts = useMemo(() => semesters.map((semester) => semester.cohort), [semesters]);
  const currentCohort = currentSemester?.cohort ?? null;
  // ADV 팀의 기수는 회원 기수다. 반기마다 ADV를 진행하는 기수(advTerm)가 정해져 있다.
  const advCohorts = useMemo(
    () => semesters.flatMap((semester) => (semester.advTerm === null ? [] : [semester.advTerm])),
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
  // 반기 관리 화면에서 반기를 시작하거나 일정을 바꾸면, 출결 화면이 함께 쓰는 반기·HOST 계정·팀을 다시 읽는다.
  function handleSemesterChanged(): void {
    reloadAttendanceMeta();
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
  // 로그인 세션은 임시 API(DB의 admin)가 원본이다. 운영진 계정과 HOST 계정이 같은 표에 있다. 세션이 없으면 로그인 창만 보여 준다.
  // 브라우저에는 아이디와 로그인 여부만 남긴다. 비밀번호는 저장하지 않는다.
  // 새로고침하면 임시 DB가 새로 만들어져 세션이 사라지는데, 비밀번호 없이 세션을 되살리는 경로는 개발 모드에만 있다.
  // 그래서 개발 모드에서만 남긴 아이디(없으면 첫 운영진 계정)로 되살리고, 배포 빌드는 다시 로그인하게 한다.
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(() => {
    if (!IS_DEV_ACCOUNTS_ENABLED) return false;
    try {
      return localStorage.getItem('boaz_is_logged_in') !== 'false';
    } catch {
      return true;
    }
  });
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  // HOST 진입 화면은 로그인 세션이 알려 준 맡은 그룹(현재 반기 팀장인 팀)의 첫 팀으로 정한다.
  const loggedHostTeam = session?.leaderTeamIds[0] ?? '';
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
    await signOut();
  }

  /** 세션을 닫고 로그인 창으로 돌아간다. 확인 창 없이 쓰는 곳(비밀번호 변경 뒤)도 있어 handleLogout과 나눈다. */
  async function signOut() {
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
  /** 글자로 보이게 켠 비밀번호 칸의 id. 칸마다 따로 켜고 끈다. */
  const [visibleMyPwIds, setVisibleMyPwIds] = useState<string[]>([]);
  const [myPwError, setMyPwError] = useState('');
  const [isSavingMyPw, setIsSavingMyPw] = useState(false);
  /** 내 계정 창의 비밀번호 변경 칸을 펼쳤는지. 처음에는 접어 두고 "비밀번호 변경" 글자 버튼으로 연다. */
  const [isMyPwOpen, setIsMyPwOpen] = useState(false);
  /** 비밀번호 변경 펼침 버튼. 취소로 접으면 포커스를 이 버튼으로 돌린다. */
  const myPwToggleRef = useRef<HTMLButtonElement>(null);
  /**
   * 내 계정 창을 열 때 읽는 내 계정(GET /api/v1/admin/accounts/me). 읽는 중이면 undefined, 못 읽으면 null.
   * 권한과 부문(프로필 그림)을 여기서 얻는다. 임시 API는 HOST 세션의 /me를 403으로 답하므로 HOST 계정은 null이 된다.
   * 창을 닫을 때 undefined로 되돌려, 다른 계정으로 다시 로그인해 열어도 이전 계정의 값이 보이지 않게 한다.
   */
  const [myAccount, setMyAccount] = useState<AdminAccount | null | undefined>(undefined);
  const myPermissions =
    myAccount === undefined ? undefined : (myAccount?.effectivePermissions ?? null);
  const myTrackImage = trackImageOf(myAccount?.track);
  /** 비밀번호 "변경" 버튼 색. 프로필 캐릭터처럼 부문마다 다르다. */
  const myTrackButtonClass = trackButtonClassOf(myAccount?.track);
  /** 이름 옆 소속(서비스운영팀, 기획팀, 그룹 리더 등). 등급 코드 대신 보인다. */
  const myTitle = session ? roleTitleOf(session) : null;
  useEffect(() => {
    if (!showMyProfileModal) return;
    let isCancelled = false;
    fetchMyAccount()
      .then((me) => {
        if (!isCancelled) setMyAccount(me);
      })
      .catch(() => {
        // 권한을 못 읽으면 계정 정보는 숨기고, 비밀번호 변경 가능 여부는 서버 판정에 맡긴다.
        if (!isCancelled) setMyAccount(null);
      });
    return () => {
      isCancelled = true;
    };
  }, [showMyProfileModal]);
  /**
   * 본인 비밀번호 변경은 "본인 계정 정보 수정" 또는 "타 계정 정보 수정" 권한(백엔드 ADMIN-06).
   * 읽는 중에는 칸을 숨기고, 권한을 못 읽었으면 칸을 보이고 서버 판정에 맡긴다.
   */
  const canWriteSelf =
    myPermissions !== undefined &&
    (myPermissions === null ||
      myPermissions.includes('ADMIN_ACCOUNT_SELF_WRITE') ||
      myPermissions.includes('ADMIN_ACCOUNT_WRITE'));

  /** 팀 id 또는 팀 이름(호스트 계정에 적힌 값)으로 팀 id를 찾는다. 이름은 부문이 다르면 겹칠 수 있어 처음 일치하는 팀을 쓴다. */
  function resolveTeamId(idOrName?: string): string {
    if (!idOrName) return '';
    const teams = [...studyTeams, ...advTeams];
    return (
      (teams.find((t) => t.id === idOrName) ?? teams.find((t) => t.teamName === idOrName))?.id ?? ''
    );
  }

  /**
   * 로그인한 계정이 맡은 그룹(세션의 leaderTeamIds) 중 그 출결 입력 탭(ADV/스터디)의 팀을 고른다.
   * ADV와 스터디를 함께 맡은 계정은 탭마다 자기 팀이 열리고, 못 찾으면 맡은 그룹의 첫 팀으로 대신한다.
   */
  function resolveHostTeamFor(isAdvTab: boolean): string {
    const tabTeams = isAdvTab ? advTeams : studyTeams;
    const mine = session?.leaderTeamIds.find((id) => tabTeams.some((team) => team.id === id));
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
      const isAdvTeam = advTeams.some((team) => team.id === next.leaderTeamIds[0]);
      setActivePage(isAdvTeam ? 'att-input-adv' : 'att-input-study');
    } else if (role === 'CONTENT_ADMIN') {
      setActivePage('content-archive');
    } else if (role === 'SUPER') {
      setActivePage('recruiting');
    } else {
      setActivePage('att-study');
    }
  }

  /** 비밀번호 변경 칸을 접고 입력을 비운다(내 계정 창의 "비밀번호 변경" 접기·취소). */
  function collapseMyPassword() {
    setIsMyPwOpen(false);
    setMyCurrentPw('');
    setMyNewPw('');
    setMyConfirmPw('');
    setMyPwError('');
    setVisibleMyPwIds([]);
  }

  /** 바닥글의 취소: 비밀번호 칸을 접고, 키보드 사용자가 제자리에 있도록 펼침 버튼으로 포커스를 돌린다. */
  function cancelMyPassword() {
    collapseMyPassword();
    window.setTimeout(() => myPwToggleRef.current?.focus());
  }

  function closeMyProfile() {
    setShowMyProfileModal(false);
    setMyAccount(undefined);
    collapseMyPassword();
  }

  /**
   * 본인 비밀번호를 바꾼다(운영진·HOST 계정). 현재 비밀번호는 서버가 확인한다.
   * 바꾸면 백엔드가 그 계정의 로그인(리프레시 토큰)을 지우므로(ADMIN-06), 알린 뒤 로그아웃해 다시 로그인하게 한다.
   */
  async function handleSaveMyPassword() {
    setMyPwError('');
    if (!session) return;
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
        current_password: myCurrentPw,
        new_password: myNewPw,
      });
    } catch (error) {
      setMyPwError(error instanceof Error ? error.message : '비밀번호를 바꾸지 못했습니다.');
      setIsSavingMyPw(false);
      return;
    }
    setIsSavingMyPw(false);
    closeMyProfile();
    window.alert('비밀번호를 바꿨습니다. 새 비밀번호로 다시 로그인해 주세요.');
    await signOut();
  }

  const isRecruiting = Boolean(activePage?.startsWith('recruiting'));
  const isEvaluation = Boolean(activePage?.startsWith('evaluation'));
  const isContentPage = Boolean(activePage?.startsWith('content'));
  const isAttendancePage = Boolean(activePage?.startsWith('att-'));

  if (isRestoringSession || (!currentTeams && !teamDbError)) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        데이터를 불러오는 중...
      </div>
    );
  }

  // 로그인 전·로그아웃 뒤에는 어떤 화면도 열지 않고 로그인 화면만 둔다.
  if (!session) return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  const currentRole = userRoleOf(session);
  const handlePageChange = (page: ActivePage) => {
    // 이미 열려 있는 행사 출결·서류 평가 메뉴를 다시 누르면 목록으로 돌아가게 알린다.
    const isListPage = page === 'att-events' || page.startsWith('evaluation');
    if (page === activePage && !isListPage) return;
    const goToPage = () => {
      setListRequest((count) => count + 1);
      setActivePage(page);
    };
    // 저장하지 않은 수정 내용이 있는 화면이면 옮기기 전에 묻는다(취소하면 머문다).
    // 저장 결과를 기다리는 화면(서류 평가)은 저장에 성공한 뒤 goToPage를 부른다.
    if (confirmLeave(goToPage)) goToPage();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      <Sidebar
        activePage={activePage}
        onChange={handlePageChange}
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
          {teamDbError && isAttendancePage && (
            <DataLoadFailedNotice onRetry={() => window.location.reload()} />
          )}
          {/* 1. Recruiting Management */}
          {isRecruiting && (
            <RecruitmentManagePage
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
              listRequest={listRequest}
              initialTab={
                trackOfEvaluationPage(activePage)
                  ? 'my'
                  : activePage === 'evaluation-promote'
                    ? 'promotions'
                    : 'applicants'
              }
              track={trackOfEvaluationPage(activePage) ?? 'ANALYSIS'}
              onOpenTrack={(track) => setActivePage(EVALUATION_TRACK_PAGES[track])}
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
                cohorts={semesterCohorts}
                currentCohort={currentCohort}
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
                cohorts={semesterCohorts}
                currentCohort={currentCohort}
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
                cohorts={semesterCohorts}
                currentCohort={currentCohort}
                cohortLabels={cohortLabels}
                listRequest={listRequest}
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
              advLeaderEntryFromWeek={currentSemester?.advLeaderEntryFromWeek ?? null}
              onDataChanged={refreshTeamState}
            />
          )}
          {activePage === 'att-hosts' && <HostsPage onDataChanged={refreshTeamState} />}
          {activePage === 'att-rules' && (
            <RulesPage rules={scoreRules} onRulesChanged={reloadScoreRules} />
          )}

          {/* 5. System Section */}
          {activePage === 'system-members' && <MemberManagementPage />}
          {activePage === 'system-audit' && (
            <AuditLogPage
              onOpenMember={(userId) => {
                // 동아리원 관리는 주소 '#system-members/member/<회원 id>'로 그 사람의 행을 찾아 보여 준다.
                window.history.replaceState(
                  null,
                  '',
                  `#system-members/member/${encodeURIComponent(userId)}`,
                );
                setActivePage('system-members');
              }}
              onOpenPermissions={(userId) => {
                // 권한 관리 화면은 주소 '#system-accounts/<회원 id>'로 그 사람의 권한 편집 창을 연 채 시작한다.
                window.history.replaceState(
                  null,
                  '',
                  `#system-accounts/${encodeURIComponent(userId)}`,
                );
                setActivePage('system-accounts');
              }}
            />
          )}
          {(activePage === 'system' || activePage === 'system-accounts') && <SystemAccountsPage />}
          {activePage === 'system-semesters' && (
            <SemesterManagementPage onSemesterChanged={handleSemesterChanged} />
          )}
        </main>
      </div>

      {/* 내 계정 정보와 비밀번호 변경 */}
      {showMyProfileModal && session && (
        <Dialog
          // 제목 "내 계정"은 화면에 보이지 않게 두고 창 이름(화면 읽기 프로그램)으로만 쓴다. 계정 정보가 창 맨 위에 온다.
          title={<span className="sr-only">내 계정</span>}
          width="md"
          headerDivider={false}
          onClose={closeMyProfile}
          closeLabel="내 계정 창 닫기"
        >
          {/* 위에 누구인지(사진·이름·아이디·소속 배지), 아래에 메뉴 줄(비밀번호 변경·로그아웃). */}
          {/* 보이는 제목이 없어 빈 머리글 줄(닫기 버튼 높이)만큼 위로 당긴다. 오른쪽은 닫기 버튼 자리를 비운다. */}
          <div className="-mt-14">
            <div className="flex items-center gap-4 pr-10 pb-4">
              {/* 부문이 있으면 무조건 그 부문 캐릭터(분석·시각화·엔지니어링, trackImage.ts), 부문을 모르면(HOST 등) 이름 첫 글자. 장식이라 alt를 비운다. */}
              {myTrackImage ? (
                <img
                  src={myTrackImage}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-full border border-slate-200 bg-white object-contain p-2"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-600"
                >
                  {/* 계정을 읽는 동안은 비워 둔다. 부문이 있으면 곧 캐릭터로 바뀌므로 첫 글자를 잠깐 보이지 않게 한다. */}
                  {myAccount !== undefined && session.name.slice(0, 1)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                {/* 첫 줄은 이름과 소속 배지(팀·부문), 둘째 줄은 아이디. */}
                <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                  <span className="mr-1.5 truncate text-lg font-bold text-slate-900">
                    {session.name}
                  </span>
                  {myTitle && <span className={MY_ACCOUNT_BADGE}>{myTitle}</span>}
                  {myAccount?.track && (
                    <span className={MY_ACCOUNT_BADGE}>{trackLabelOf(myAccount.track)}</span>
                  )}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">{session.username}</p>
              </div>
            </div>

            {/* 메뉴 줄. 줄마다 위에 구분선을 긋는다. */}
            {/* HOST 계정도 admin 표에 있어 운영진 계정과 같은 API로 본인 비밀번호를 바꾼다. */}
            {!canWriteSelf && myPermissions !== undefined && (
              <p className="flex items-center gap-3 border-t border-slate-100 py-3 text-sm text-slate-400">
                <Lock size={16} aria-hidden="true" />
                본인 비밀번호를 바꿀 권한이 없습니다.
              </p>
            )}
            {canWriteSelf && (
              <button
                ref={myPwToggleRef}
                type="button"
                onClick={() => (isMyPwOpen ? cancelMyPassword() : setIsMyPwOpen(true))}
                aria-expanded={isMyPwOpen}
                aria-controls="my-password-form"
                className={MY_ACCOUNT_MENU_ROW}
              >
                <Lock size={16} aria-hidden="true" className="text-slate-500" />
                <span className="flex-1 text-left">비밀번호 변경</span>
                {/* 펼치면 화살표가 아래를 향한다. */}
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className={`text-slate-400 transition-transform ${isMyPwOpen ? 'rotate-90' : ''}`}
                />
              </button>
            )}
            {isMyPwOpen && (
              // 펼친 입력칸은 "비밀번호 변경" 글자 시작에 맞춰 들여 써서 그 줄에 딸린 것으로 보이게 한다.
              <div className="ml-7 pb-4">
                <form
                  id="my-password-form"
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSaveMyPassword();
                  }}
                >
                  {/* 세 칸을 테두리 하나로 묶고 가로선으로 나눈다. 칸 이름은 안내 글자(placeholder)로 보이고, 화면 읽기용 라벨은 숨긴다. */}
                  <div className="divide-y divide-slate-200 overflow-hidden rounded-sm border border-slate-300 bg-white transition-colors focus-within:border-slate-400">
                    {[
                      {
                        id: 'my-current-pw',
                        label: '현재 비밀번호',
                        value: myCurrentPw,
                        onChange: setMyCurrentPw,
                        autoComplete: 'current-password',
                        hint: false,
                      },
                      {
                        id: 'my-new-pw',
                        label: '새 비밀번호',
                        value: myNewPw,
                        onChange: setMyNewPw,
                        // 'new-password'면 크롬이 누르자마자 비밀번호 생성을 띄운다. 끄려고 off를 쓴다.
                        autoComplete: 'off',
                        // 백엔드 ADMIN-06의 비밀번호 규칙 안내(상자 아래 문구)를 이 칸에 연결한다. 검사는 #94에서 붙인다.
                        hint: true,
                      },
                      {
                        id: 'my-confirm-pw',
                        label: '새 비밀번호 확인',
                        value: myConfirmPw,
                        onChange: setMyConfirmPw,
                        autoComplete: 'off',
                        hint: false,
                      },
                    ].map((field) => (
                      // 칸마다 오른쪽 끝에 보기·지우기 버튼을 둔다(로그인 창과 같다).
                      // 오류가 났을 때 비어 있는 칸은 옅은 빨간 바탕으로 표시한다.
                      <div
                        key={field.id}
                        className={`relative ${myPwError && !field.value.trim() ? 'bg-red-50' : ''}`}
                      >
                        <label htmlFor={field.id} className="sr-only">
                          {field.label}
                        </label>
                        <input
                          id={field.id}
                          type={visibleMyPwIds.includes(field.id) ? 'text' : 'password'}
                          autoComplete={field.autoComplete}
                          value={field.value}
                          onChange={(event) => {
                            field.onChange(event.target.value);
                            // 다시 입력하기 시작하면 오류 표시를 지운다.
                            setMyPwError('');
                          }}
                          // 칸을 누르기만 해도 오류 표시를 지운다(고치러 들어왔다는 뜻이다).
                          onFocus={() => setMyPwError('')}
                          aria-invalid={myPwError !== '' && !field.value.trim()}
                          placeholder={field.label}
                          aria-describedby={field.hint ? 'my-new-pw-hint' : undefined}
                          // 펼치자마자 현재 비밀번호를 입력하게 첫 칸에 포커스를 둔다.
                          autoFocus={field.id === 'my-current-pw'}
                          className={MY_PW_INPUT}
                        />
                        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
                          <PasswordVisibilityButton
                            isVisible={visibleMyPwIds.includes(field.id)}
                            onToggle={() =>
                              setVisibleMyPwIds((ids) =>
                                ids.includes(field.id)
                                  ? ids.filter((id) => id !== field.id)
                                  : [...ids, field.id],
                              )
                            }
                            controls={field.id}
                          />
                          {field.value && (
                            <ClearFieldButton
                              label={`${field.label} 지우기`}
                              onClear={() => {
                                field.onChange('');
                                document.getElementById(field.id)?.focus();
                              }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 상자 아래 한 줄. 평소에는 백엔드 ADMIN-06의 비밀번호 규칙을, 오류가 나면 같은 자리에 오류 문구를 보인다.
                      줄이 늘지 않아 오류가 나도 아래 버튼이 밀리지 않는다. */}
                  {myPwError ? (
                    <p role="alert" className="text-[11px] leading-4 break-keep text-red-600">
                      {myPwError}
                    </p>
                  ) : (
                    <p
                      id="my-new-pw-hint"
                      className="text-[11px] leading-4 break-keep text-slate-400"
                    >
                      새 비밀번호는 8자 이상, 영문·숫자·특수문자(!@#$%^&*) 포함
                    </p>
                  )}
                  {/* 취소·변경 두 버튼이 위 묶음 상자와 같은 폭을 반씩 나눈다. */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={cancelMyPassword}
                      className="h-10 cursor-pointer rounded-sm bg-slate-100 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-slate-400"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingMyPw}
                      className={`h-10 cursor-pointer rounded-sm text-sm font-bold transition-colors ${myTrackButtonClass} focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      변경
                    </button>
                  </div>
                </form>
              </div>
            )}
            {/* 로그아웃(POST /api/v1/auth/logout, 백엔드는 /api/v1/auth/admin/logout). 화면 위 로그아웃과 같다. */}
            <button
              type="button"
              onClick={() => void handleLogout()}
              className={MY_ACCOUNT_MENU_ROW}
            >
              <LogOut size={16} aria-hidden="true" className="text-slate-500" />
              <span className="flex-1 text-left">로그아웃</span>
            </button>
          </div>
        </Dialog>
      )}

      {/* Login Modal */}
      {loginModalOpen && (
        <LoginModal onClose={() => setLoginModalOpen(false)} onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}
