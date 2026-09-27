import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, KeyRound, PanelLeft, ShieldCheck, User, X } from 'lucide-react';

import { DashboardPage } from '@/pages/attendance-dashboard/ui/DashboardPage';
import { EventAttendanceManagePage } from '@/pages/attendance-events/ui/EventAttendanceManagePage';
import { HostsPage } from '@/pages/attendance-hosts/ui/HostsPage';
import { replaceTeamLeader } from '@/pages/attendance-hosts/model/teamSelection';
import { InputPage } from '@/pages/attendance-input/ui/InputPage';
import { InternalCategoryAttendancePage } from '@/pages/attendance-internal-category/ui/InternalCategoryAttendancePage';
import { RulesPage } from '@/pages/attendance-rules/ui/RulesPage';
import { ScoresPage } from '@/pages/attendance-scores/ui/ScoresPage';
import { ArchivingSection } from '@/pages/content-archive/ui/ArchivingSection';
import { CurriculumSection } from '@/pages/content-curriculum/ui/CurriculumSection';
import { FaqSection } from '@/pages/content-faq/ui/FaqSection';
import { ReviewsSection } from '@/pages/content-reviews/ui/ReviewsSection';
import { EvaluationManagePage } from '@/pages/recruiting-evaluation/ui/EvaluationManagePage';
import { RecruitmentManagePage } from '@/pages/recruiting-manage/ui/RecruitmentManagePage';
import { SystemAccountsPage } from '@/pages/system-accounts/ui/SystemAccountsPage';
import { LoginModal } from '@/widgets/login-modal/ui/LoginModal';
import { DataLoadFailedNotice } from '@/shared/ui/DataLoadFailedNotice';

import { useEventDb } from './model/useEventDb';
import { useHostDb } from './model/useHostDb';
import { useTeamDb } from './model/useTeamDb';
import { Sidebar } from '@/widgets/sidebar/ui/Sidebar';
import boazLogo from '@/shared/assets/boaz-logo.png';
import { sessionKey } from '@/entities/attendance/model/lib';
import { cohortsOf, currentCohortOf, DEFAULT_CURRENT_COHORT } from '@/entities/cohort/model/lib';
import type { AttendanceState, AttendanceStatus } from '@/entities/attendance/model/types';
import type { WeekInfo } from '@/entities/attendance/model/week';
import { INITIAL_EXCEPTIONS } from '@/entities/exception-request/model/constants';
import type { ExceptionRequest } from '@/entities/exception-request/model/types';
import type { GroupType, HostAccount } from '@/entities/host-account/model/types';
import { INITIAL_RULES } from '@/entities/score-rule/model/constants';
import { getRuleForDate } from '@/entities/score-rule/model/lib';
import type { ScoreRule } from '@/entities/score-rule/model/types';
import {
  applyAttendanceChange,
  createAdvTeamRecords,
  createBaseAttendanceRecords,
  createStudyRecords,
  describeStudyCreateError,
  markWeekSubmitted,
  type AttendanceChange,
  type CreateAdvTeamInput,
  type CreateBaseAttendanceInput,
  type CreateStudyInput,
} from '@/entities/study-team/model/db';
import type { Member, StudyTeamInfo } from '@/entities/study-team/model/types';
import type { UserRole } from '@/entities/user/model/types';
import type { ActivePage } from '@/shared/config/activePage';
import { PAGE_LABELS } from '@/shared/config/pageLabels';

const VALID_ACTIVE_PAGES = new Set<string>([
  'att-dashboard',
  'att-events',
  'att-hosts',
  'att-scores',
  'att-rules',
  'att-input',
  'att-input-adv',
  'att-input-study',
  'att-session',
  'att-adv',
  'att-study',
  'att-internal',
  'content-archive',
  'content-faq',
  'content-curriculum',
  'content-reviews',
  'content',
  'recruiting',
  'recruiting-posts',
  'recruiting-questions',
  'recruiting-preview',
  'recruiting-csv',
  'recruiting-leads',
  'evaluation',
  'evaluation-evals',
  'evaluation-applicants',
  'evaluation-promote',
  'system',
  'system-accounts',
  'system-permissions',
  'system-audit',
]);

const NO_TEAMS: StudyTeamInfo[] = [];
const NO_HOSTS: HostAccount[] = [];
const NO_MEMBERS: Record<string, Member[]> = {};
const NO_ATTENDANCE: AttendanceState = {};
const NO_WEEKS: WeekInfo[] = [];
const NO_WEEK_DATES: Record<number, Record<number, string>> = {};

function getInitialActivePage(): ActivePage {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && VALID_ACTIVE_PAGES.has(hash)) {
      return hash as ActivePage;
    }
    const saved = localStorage.getItem('boaz_active_page');
    if (saved && VALID_ACTIVE_PAGES.has(saved)) {
      return saved as ActivePage;
    }
  } catch {
    // ignore
  }
  return 'recruiting-posts';
}

export default function App() {
  const [scoreRules, setScoreRules] = useState<ScoreRule[]>(() => {
    try {
      const saved = localStorage.getItem('boaz_score_rules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r, idx) => {
            const fallbackTerm = r.term ?? 27 - idx;
            return {
              ...r,
              term: fallbackTerm,
              name: r.name ?? `${fallbackTerm}기 점수 규칙`,
              startDate:
                r.startDate ??
                (fallbackTerm === 27
                  ? '2026-07-01'
                  : fallbackTerm === 26
                    ? '2026-01-01'
                    : '2025-07-01'),
              endDate:
                r.endDate !== undefined
                  ? r.endDate
                  : fallbackTerm === 27
                    ? '2026-12-31'
                    : fallbackTerm === 26
                      ? '2026-06-30'
                      : '2025-12-31',
              status: r.status ?? (idx === 0 ? 'ACTIVE' : 'INACTIVE'),
            };
          });
        }
      }
    } catch (e) {
      // ignore malformed localStorage data, fall back to defaults
    }
    return INITIAL_RULES;
  });

  const handleUpdateScoreRules = (newRules: ScoreRule[]) => {
    setScoreRules(newRules);
    try {
      localStorage.setItem('boaz_score_rules', JSON.stringify(newRules));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      // ignore localStorage write failures (e.g. quota exceeded, private mode)
    }
  };

  const [activePage, setActivePage] = useState<ActivePage>(getInitialActivePage);

  useEffect(() => {
    try {
      localStorage.setItem('boaz_active_page', activePage);
      if (window.location.hash.replace(/^#/, '') !== activePage) {
        window.history.replaceState(null, '', `#${activePage}`);
      }
    } catch {
      // ignore
    }
  }, [activePage]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, '');
      if (hash && VALID_ACTIVE_PAGES.has(hash)) {
        setActivePage(hash as ActivePage);
      }
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
  // 스터디·ADV 팀, 팀원, 출결은 임시 DB(db/*.sql)가 원본이다. 값을 바꾸면 DB에 바로 저장된다.
  const {
    state: teamDb,
    error: teamDbError,
    setStudyTeams,
    setAdvTeams,
    setBaseTeams,
    setWeekDates,
    setMembers: setMembersMap,
    setAttendance,
  } = useTeamDb();
  const eventDb = useEventDb();
  // DB에는 지난 기수의 팀도 남아 있다. 출결 입력·점수·대시보드 같은 "지금" 화면은 현재 기수의 팀만 쓰고,
  // 스터디 출결 관리만 전체 팀을 받아 기수 드롭다운으로 지난 기수를 조회한다.
  const allAdvTeams = teamDb?.advTeams ?? NO_TEAMS;
  const allStudyTeams = teamDb?.studyTeams ?? NO_TEAMS;
  const allBaseTeams = teamDb?.baseTeams ?? NO_TEAMS;
  const cohorts = useMemo(
    () =>
      cohortsOf([
        ...(teamDb?.cohorts ?? []),
        ...[...allStudyTeams, ...allAdvTeams, ...allBaseTeams].map((team) => team.cohort),
      ]),
    [teamDb?.cohorts, allStudyTeams, allAdvTeams, allBaseTeams],
  );
  const currentCohort = currentCohortOf(cohorts);
  // ADV 팀은 기수가 스터디·BASE보다 하나 늦다(만들어진 가장 큰 ADV 기수가 ADV의 현재 기수).
  const advCohorts = useMemo(
    () => cohortsOf(allAdvTeams.map((team) => team.cohort)),
    [allAdvTeams],
  );
  const advCurrentCohort = currentCohortOf(advCohorts);
  const advTeams = useMemo(
    () =>
      allAdvTeams.filter((team) => (team.cohort ?? DEFAULT_CURRENT_COHORT) === advCurrentCohort),
    [allAdvTeams, advCurrentCohort],
  );
  const studyTeams = useMemo(
    () => allStudyTeams.filter((team) => (team.cohort ?? DEFAULT_CURRENT_COHORT) === currentCohort),
    [allStudyTeams, currentCohort],
  );
  const membersMap = teamDb?.members ?? NO_MEMBERS;
  const attendance = teamDb?.attendance ?? NO_ATTENDANCE;
  const weeks = teamDb?.weeks ?? NO_WEEKS;
  // HOST 계정도 임시 DB가 원본이다. 발급·삭제하면 DB에 바로 저장된다.
  const { hosts: hostRows, error: hostDbError, setHosts } = useHostDb();
  const hosts = hostRows ?? NO_HOSTS;
  const [exceptions, setExceptions] = useState<ExceptionRequest[]>(INITIAL_EXCEPTIONS);
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem('boaz_user_role');
      if (saved && ['TEAM', 'HOST', 'CONTENT_ADMIN', 'SUPER'].includes(saved)) {
        return saved as UserRole;
      }
    } catch {}
    return 'SUPER';
  });

  const [loggedHostTeam, setLoggedHostTeam] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('boaz_host_team');
      if (saved) return saved;
    } catch {}
    return '';
  });

  const [loggedUsername, setLoggedUsername] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('boaz_username');
      if (saved) return saved;
    } catch {}
    return 'super';
  });

  useEffect(() => {
    try {
      localStorage.setItem('boaz_user_role', currentRole);
    } catch {}
  }, [currentRole]);

  useEffect(() => {
    try {
      localStorage.setItem('boaz_host_team', loggedHostTeam);
    } catch {}
  }, [loggedHostTeam]);

  useEffect(() => {
    try {
      localStorage.setItem('boaz_username', loggedUsername);
    } catch {}
  }, [loggedUsername]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('boaz_is_logged_in') !== 'false';
    } catch {
      return true;
    }
  });

  const displayName = useMemo(() => {
    if (currentRole === 'HOST') {
      return loggedUsername || `${loggedHostTeam} 팀장`;
    }
    return '남민서';
  }, [currentRole, loggedHostTeam, loggedUsername]);

  function handleLogout() {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      setIsLoggedIn(false);
      try {
        localStorage.setItem('boaz_is_logged_in', 'false');
      } catch {}
      setLoginModalOpen(true);
    }
  }

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [showMyProfileModal, setShowMyProfileModal] = useState(false);
  const [myCurrentPw, setMyCurrentPw] = useState('');
  const [myNewPw, setMyNewPw] = useState('');
  const [myConfirmPw, setMyConfirmPw] = useState('');
  const [masterPassword, setMasterPassword] = useState('super1234');
  const [myPwError, setMyPwError] = useState('');

  /** 스터디 출결 관리에서 만든 스터디를 공용 스터디 저장소(팀·부원·출결)에 등록한다. */
  /**
   * 이름 중복 같은 입력 검증은 화면에서 하지 않고 저장소(DB)의 제약에 맡긴다.
   * 저장에 실패하면 화면 상태는 바뀌지 않고, 실패 사유를 문자열로 돌려준다(성공이면 null).
   */
  function handleCreateStudyFromAttendance(input: CreateStudyInput): string | null {
    try {
      const { team, members, attendance: records } = createStudyRecords(input);
      setStudyTeams((prev) => [...prev, team]);
      setMembersMap((prev) => ({ ...prev, [team.id]: members }));
      setAttendance((prev) => ({ ...prev, ...records }));
      return null;
    } catch (error) {
      return describeStudyCreateError(error);
    }
  }

  /**
   * BASE 출결 생성: 그 기수·트랙 팀이 없으면 만들고, 고른 회원을 트랙원으로 넣어 1~8주차 미정 출결을 만든다.
   * 만들 수 없으면 사유를, 만들었으면 null을 돌려준다.
   */
  function handleCreateBaseAttendance(input: CreateBaseAttendanceInput): string | null {
    try {
      const result = createBaseAttendanceRecords(input, allBaseTeams, membersMap, attendance);
      if (result.addedMembers.length === 0) {
        return '선택한 회원은 이미 모두 등록되어 있습니다.';
      }
      if (result.isNewTeam) setBaseTeams((prev) => [...prev, result.team]);
      setMembersMap((prev) => ({
        ...prev,
        [result.team.id]: [...(prev[result.team.id] ?? []), ...result.addedMembers],
      }));
      setAttendance((prev) => ({ ...prev, ...result.attendance }));
      if (input.weekDates && Object.keys(input.weekDates).length > 0) {
        handleSaveWeekDates(input.cohort, {
          ...(teamDb?.weekDates[input.cohort] ?? {}),
          ...input.weekDates,
        });
      }
      return null;
    } catch (error) {
      return `출결을 만들지 못했습니다. (${error instanceof Error ? error.message : String(error)})`;
    }
  }

  /** 기수의 주차 날짜 매핑을 DB에 저장한다(그 기수의 이전 매핑을 통째로 바꾼다). */
  function handleSaveWeekDates(cohort: number, dates: Record<number, string>) {
    setWeekDates((prev) => ({ ...prev, [cohort]: dates }));
  }

  /**
   * ADV 팀 개설: 그 기수·부문의 다음 번호 팀과 팀원, 주차별 미정 출결을 DB에 만든다.
   * 만들 수 없으면 사유를, 만들었으면 null을 돌려준다.
   */
  function handleCreateAdvTeam(input: CreateAdvTeamInput): string | null {
    try {
      if (input.members.length === 0) return '팀원을 한 명 이상 선택해 주세요.';
      const result = createAdvTeamRecords(input, allAdvTeams);
      setAdvTeams((prev) => [...prev, result.team]);
      setMembersMap((prev) => ({ ...prev, [result.team.id]: result.members }));
      setAttendance((prev) => ({ ...prev, ...result.attendance }));
      if (input.weekDates && Object.keys(input.weekDates).length > 0) {
        handleSaveWeekDates(input.cohort, {
          ...(teamDb?.weekDates[input.cohort] ?? {}),
          ...input.weekDates,
        });
      }
      return null;
    } catch (error) {
      return `ADV 팀을 개설하지 못했습니다. (${error instanceof Error ? error.message : String(error)})`;
    }
  }

  function handleChangeTeamLeader(groupType: GroupType, teamId: string, leaderName: string) {
    const setTeams = groupType === 'ADV' ? setAdvTeams : setStudyTeams;
    const leaderId = teamDb?.users.find((user) => user.name === leaderName)?.id;
    setTeams((prev) => replaceTeamLeader(prev, teamId, leaderName, leaderId));
  }

  /** BASE·ADV 주차 제출: 서버 제출이 성공한 팀·주차를 제출 완료로 표시해 DB에 저장한다. */
  function handleSubmitWeek(teamId: string, weekNum: number, submittedAt: string) {
    setAttendance((prev) => markWeekSubmitted(prev, teamId, weekNum, submittedAt));
  }

  /** 스터디 명단에서 팀원을 뺀다. 팀 소속과 그 팀원의 출결 기록은 DB에서 함께 지워진다. */
  function handleRemoveStudyMember(teamId: string, memberId: string) {
    const team = [...studyTeams, ...allAdvTeams, ...allBaseTeams].find((t) => t.id === teamId);
    if (!team) return;
    setMembersMap((prev) => ({
      ...prev,
      [team.id]: (prev[team.id] ?? []).filter((m) => m.id !== memberId),
    }));
  }

  /** 스터디 출결 관리에서 바꾼 상태·비고를 공용 출결 저장소에 반영한다. */
  function handleStudyAttendanceChange(change: AttendanceChange) {
    setAttendance((prev) => applyAttendanceChange(prev, change));
  }

  function approveException(id: string) {
    const ex = exceptions.find((e) => e.id === id);
    if (ex) {
      const weekNum = ex.week.replace(/[^0-9]/g, '');
      const wId = `w${weekNum}`;
      const actId = 'study';
      const key = sessionKey(wId, actId, ex.team); // ex.team은 팀 id
      const members = membersMap[ex.team] ?? [];
      const mem = members.find((m) => m.name === ex.memberName);
      if (mem && attendance[key]) {
        setAttendance((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            statuses: { ...prev[key].statuses, [mem.id]: ex.to },
          },
        }));
      }
    }
    setExceptions((prev) => prev.filter((e) => e.id !== id));
  }

  function rejectException(id: string) {
    setExceptions((prev) => prev.filter((e) => e.id !== id));
  }

  function handleRequestException(
    team: string,
    week: string,
    memberName: string,
    from: AttendanceStatus,
    to: AttendanceStatus,
    reason: string,
  ) {
    setExceptions((prev) => [
      {
        id: `e_${Date.now()}`,
        team,
        week,
        memberName,
        from,
        to,
        reason,
      },
      ...prev,
    ]);
  }

  function handleDirectEdit(
    w: string,
    a: string,
    t: string,
    memberId: string,
    to: AttendanceStatus,
    reason: string,
  ) {
    const key = sessionKey(w, a, t);
    setAttendance((prev) => {
      const cur = prev[key];
      if (!cur) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          ...cur,
          statuses: { ...cur.statuses, [memberId]: to },
          memos: { ...(cur.memos ?? {}), [memberId]: `[운영지원팀 수정] ${reason}` },
        },
      };
    });
  }

  function handleConfirmAdmin(w: string, a: string, t: string) {
    const key = sessionKey(w, a, t);
    setAttendance((prev) => {
      const cur = prev[key];
      if (!cur) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          ...cur,
          confirmedByAdmin: true,
        },
      };
    });
  }

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

  function handleToggleRole() {
    if (currentRole === 'SUPER') {
      setCurrentRole('TEAM');
      setLoggedUsername('admin');
      setActivePage('att-dashboard');
    } else if (currentRole === 'TEAM') {
      setCurrentRole('HOST');
      setLoggedHostTeam(studyTeams[0]?.id ?? '');
      setLoggedUsername('host_a');
      setActivePage('att-input');
    } else if (currentRole === 'HOST') {
      setCurrentRole('CONTENT_ADMIN');
      setLoggedUsername('content');
      setActivePage('content-archive');
    } else {
      setCurrentRole('SUPER');
      setLoggedUsername('super');
      setActivePage('recruiting');
    }
  }

  function handleLoginSuccess(role: UserRole, hostTeam?: string, username?: string) {
    setIsLoggedIn(true);
    try {
      localStorage.setItem('boaz_is_logged_in', 'true');
    } catch {}
    setCurrentRole(role);
    if (role === 'HOST') {
      const chosenTeamId = resolveTeamId(hostTeam) || studyTeams[0]?.id || '';
      setLoggedHostTeam(chosenTeamId);
      setLoggedUsername(username || 'host_a');
      const isAdvTeam = advTeams.some((team) => team.id === chosenTeamId);
      setActivePage(isAdvTeam ? 'att-input-adv' : 'att-input-study');
    } else if (role === 'CONTENT_ADMIN') {
      setLoggedUsername('content');
      setActivePage('content-archive');
    } else if (role === 'SUPER') {
      setLoggedUsername('super');
      setActivePage('recruiting');
    } else {
      setLoggedUsername('admin');
      setActivePage('att-dashboard');
    }
  }

  function handleSaveMyPassword() {
    setMyPwError('');

    if (!myCurrentPw.trim() || !myNewPw.trim() || !myConfirmPw.trim()) {
      setMyPwError('모든 항목을 입력해 주세요.');
      return;
    }
    if (myCurrentPw !== masterPassword) {
      setMyPwError('현재 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (myNewPw !== myConfirmPw) {
      setMyPwError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setMasterPassword(myNewPw);
    setMyCurrentPw('');
    setMyNewPw('');
    setMyConfirmPw('');
    setShowMyProfileModal(false);
  }

  const isRecruiting = Boolean(activePage?.startsWith('recruiting'));
  const isEvaluation = Boolean(activePage?.startsWith('evaluation'));
  const isContentPage = Boolean(activePage?.startsWith('content'));
  const isAttendancePage = Boolean(activePage?.startsWith('att-'));

  if ((!teamDb && !teamDbError) || (!hostRows && !hostDbError)) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500">
        데이터를 불러오는 중...
      </div>
    );
  }

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
        onChange={setActivePage}
        open={sidebarOpen}
        onClose={() => {
          setSidebarOpen(false);
          try {
            localStorage.setItem('boaz_sidebar_open_v2', 'false');
          } catch {}
        }}
        currentRole={currentRole}
        onToggleRole={handleToggleRole}
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
            {isLoggedIn ? (
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
            ) : (
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <User size={14} className="text-slate-700 fill-slate-700" />
                <span>로그인</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Main Body */}
        <main className="flex-1 overflow-y-auto px-8 py-7" style={{ scrollbarWidth: 'none' }}>
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
          {activePage === 'att-session' && (
            <InternalCategoryAttendancePage
              category="SESSION"
              activeScoreRule={getRuleForDate(scoreRules)}
              attendance={attendance}
              studyTeams={allBaseTeams}
              studyMembers={membersMap}
              weeks={weeks}
              cohorts={cohorts}
              currentCohort={currentCohort}
              onStudyAttendanceChange={handleStudyAttendanceChange}
              weekDates={teamDb?.weekDates ?? NO_WEEK_DATES}
              onCreateBaseAttendance={handleCreateBaseAttendance}
              onSubmitWeek={handleSubmitWeek}
            />
          )}
          {activePage === 'att-adv' && (
            <InternalCategoryAttendancePage
              category="ADV"
              activeScoreRule={getRuleForDate(scoreRules)}
              attendance={attendance}
              studyTeams={allAdvTeams}
              studyMembers={membersMap}
              onStudyAttendanceChange={handleStudyAttendanceChange}
              onCreateAdvTeam={handleCreateAdvTeam}
              onSubmitWeek={handleSubmitWeek}
              weekDates={teamDb?.weekDates ?? NO_WEEK_DATES}
              weeks={weeks}
              cohorts={cohorts.filter((cohort) => cohort <= advCurrentCohort)}
              currentCohort={advCurrentCohort}
            />
          )}
          {activePage === 'att-study' && (
            <InternalCategoryAttendancePage
              category="STUDY"
              activeScoreRule={getRuleForDate(scoreRules)}
              attendance={attendance}
              studyTeams={allStudyTeams}
              studyMembers={membersMap}
              weeks={weeks}
              cohorts={cohorts}
              currentCohort={currentCohort}
              onCreateStudy={handleCreateStudyFromAttendance}
              onStudyAttendanceChange={handleStudyAttendanceChange}
              onRemoveStudyMember={handleRemoveStudyMember}
            />
          )}
          {activePage === 'att-events' &&
            (eventDb.error ? (
              <DataLoadFailedNotice onRetry={() => window.location.reload()} />
            ) : (
              eventDb.state && (
                <EventAttendanceManagePage
                  events={eventDb.state.events}
                  setEvents={eventDb.setEvents}
                  attendees={eventDb.state.attendees}
                  setAttendees={eventDb.setAttendees}
                  templates={eventDb.state.templates}
                  setTemplates={eventDb.setTemplates}
                />
              )
            ))}
          {activePage === 'att-scores' && (
            <ScoresPage
              attendance={attendance}
              studyTeams={studyTeams}
              advTeams={advTeams}
              membersMap={membersMap}
              scoreRules={scoreRules}
            />
          )}
          {(activePage === 'att-input' ||
            activePage === 'att-input-adv' ||
            activePage === 'att-input-study') && (
            <InputPage
              pageTitle={
                activePage === 'att-input-study' ? '스터디 출결 입력' : 'ADV Term 출결 입력'
              }
              attendance={attendance}
              setAttendance={setAttendance}
              onRequestException={handleRequestException}
              currentHostTeam={resolveHostTeamFor(activePage !== 'att-input-study')}
              advTeams={advTeams}
              studyTeams={studyTeams}
              membersMap={membersMap}
              setMembersMap={setMembersMap}
              currentRole={currentRole}
              weeks={weeks}
            />
          )}
          {activePage === 'att-hosts' && (
            <HostsPage
              hosts={hosts}
              setHosts={setHosts}
              advTeams={advTeams}
              studyTeams={studyTeams}
              membersMap={membersMap}
              users={teamDb?.users ?? []}
              onChangeTeamLeader={handleChangeTeamLeader}
            />
          )}
          {activePage === 'att-rules' && (
            <RulesPage rules={scoreRules} onUpdateRules={handleUpdateScoreRules} />
          )}
          {activePage === 'att-dashboard' && (
            <DashboardPage
              attendance={attendance}
              exceptions={exceptions}
              studyTeams={studyTeams}
              advTeams={advTeams}
              membersMap={membersMap}
              onApprove={approveException}
              onReject={rejectException}
              onDirectEdit={handleDirectEdit}
              onConfirmAdmin={handleConfirmAdmin}
              onOpenAddStudy={() => setActivePage('att-hosts')}
            />
          )}

          {/* 5. System Section */}
          {(activePage.startsWith('system') || activePage === 'system') && (
            <SystemAccountsPage
              initialSubTab={
                activePage === 'system-permissions'
                  ? 'permissions'
                  : activePage === 'system-audit'
                    ? 'audit'
                    : 'accounts'
              }
            />
          )}
        </main>
      </div>

      {/* Global My Profile & Password Change Modal */}
      {showMyProfileModal && (
        <div className="fixed inset-0 bg-black/85 z-90 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-purple-400" />
                <h3 className="text-base font-bold text-foreground">
                  내 계정 정보 & 비밀번호 변경
                </h3>
              </div>
              <button
                onClick={() => setShowMyProfileModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-100 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">로그인 아이디:</span>
                <span className="text-foreground font-bold">@boaz_service_lead</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">성명 / 역할:</span>
                <span className="text-purple-300 font-sans font-bold">
                  남민서 (MASTER · 서비스운영팀장)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">소속 트랙 / 기수:</span>
                <span className="text-[#8ba5ff]">ANALYSIS · 28기</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <KeyRound size={13} className="text-[#8ba5ff]" />
                <span>비밀번호 변경 (PATCH /api/v1/admin/accounts/{'{id}'}/password)</span>
              </p>

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  현재 비밀번호 (current_password) <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={myCurrentPw}
                  onChange={(e) => setMyCurrentPw(e.target.value)}
                  placeholder="현재 사용 중인 비밀번호"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  새 비밀번호 (new_password) <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={myNewPw}
                  onChange={(e) => setMyNewPw(e.target.value)}
                  placeholder="8자 이상 + 영문/숫자/특수문자(!@#$%^&*)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  새 비밀번호 확인 <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={myConfirmPw}
                  onChange={(e) => setMyConfirmPw(e.target.value)}
                  placeholder="새 비밀번호 다시 입력"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                />
              </div>

              {myPwError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-600">
                  {myPwError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowMyProfileModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-100 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSaveMyPassword}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer shadow-lg shadow-purple-950/40"
              >
                비밀번호 변경 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {loginModalOpen && (
        <LoginModal
          onClose={() => setLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          hosts={hosts}
          studyTeams={studyTeams}
        />
      )}
    </div>
  );
}
