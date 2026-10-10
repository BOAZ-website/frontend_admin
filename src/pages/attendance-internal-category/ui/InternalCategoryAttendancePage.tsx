import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Download,
  Edit3,
  Folder,
  GripVertical,
  Maximize2,
  Minimize2,
  Plus,
  Rocket,
  RotateCcw,
  Settings,
  Trash2,
  X,
  Send,
} from 'lucide-react';

import { sessionKey } from '@/entities/attendance/model/lib';
import type { AttendanceState } from '@/entities/attendance/model/types';
import {
  ADV_DIRECT_SELECT_LAST_WEEK,
  defaultWeekNum,
  isHeldWeek,
  weekStatusOf,
  type WeekInfo,
} from '@/entities/attendance/model/week';
import {
  getStudyCell,
  studyDisplayName,
  type AttendanceChange,
  type CreateAdvTeamInput,
  type CreateBaseAttendanceInput,
  type CreateStudyInput,
} from '@/entities/study-team/model/db';
import type { Member, StudyTeamInfo } from '@/entities/study-team/model/types';
import { isConcurrentBaseMember } from '@/entities/attendance/model/concurrent';

import {
  shouldShowConcurrentColumn,
  shouldShowMatrixTrack,
  sortConcurrentMembersLast,
} from '../model/baseAttendanceConcurrent';
import { buildWeekSubmission, countUnmarked, submissionKey } from '../model/weekSubmission';
import { BRAND_SELECTED, MODAL_SURFACE } from '@/shared/ui/modalStyles';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { Tooltip } from '@/shared/ui/Tooltip';
import { CreateButton } from '@/shared/ui/CreateButton';
import { PdfPreviewModal } from '@/shared/ui/PdfPreviewModal';
import { DateTextInput } from '@/shared/ui/DateTextInput';
import {
  EMPTY_MEMBER_SELECTION,
  findLeader,
  type MemberSelection,
} from '@/entities/user/model/lib';
import type { UserProfile, UserTrack } from '@/entities/user/model/types';
import { submitWeekAttendance } from '@/entities/attendance/api/submitWeekApi';
import { fetchAttendanceScores } from '@/entities/attendance/api/attendanceApi';
import type { MemberScoreDto } from '@/entities/attendance/model/dto';
import { cohortLabelOf, cohortsOf, isPastCohort } from '@/entities/cohort/model/lib';
import type { SemesterDto } from '@/entities/cohort/model/dto';
import { buildStudyView } from '../model/studyView';
import { buildBaseTrackTeams } from '../model/baseAttendanceCreate';
import { BaseAttendanceCreateModal } from './BaseAttendanceCreateModal';
import { CohortSelect } from './CohortSelect';
import { StudyMemberPicker } from './StudyMemberPicker';

export type InternalCategory = 'SESSION' | 'STUDY' | 'ADV';

/** 낱말 뒤에 붙는 '로'·'으로'. 받침이 있으면(ㄹ 받침 제외) '으로'다. */
function withRoParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  const isRieul = code % 28 === 8;
  return `${word}${hasFinal && !isRieul ? '으로' : '로'}`;
}

/**
 * 수정 모드에서 출결을 바꾸기 전에 무엇을 무엇으로 바꾸는지 한 번 더 묻는다.
 * 같은 값을 다시 고르면 묻지 않고 바꾸지도 않는다.
 */
function confirmStatusEdit(target: string, from: AttendStatus, to: AttendStatus): boolean {
  if (from === to) return false;
  const labelOf = (status: AttendStatus) => ATTEND_STATUS_CFG[status]?.label || status;
  return window.confirm(
    `${target} 출결을 '${labelOf(from)}'에서 '${withRoParticle(labelOf(to))}' 수정할까요?`,
  );
}

/** 점수 API 결과를 찾는 키: 팀 · 팀원 · 멘멘 스터디 줄 구분(일반 팀은 빈 문자열). */
function memberScoreKey(teamId: string, memberId: string, subType: string): string {
  return `${teamId}|${memberId}|${subType}`;
}
export type AttendStatus =
  | 'present'
  | 'late'
  | 'earlyLeave'
  | 'absent'
  | 'excusedAbsent'
  | 'remote'
  | 'unexcusedLate'
  | 'unexcusedAbsent'
  | 'unmarked';

export interface TeamMeta {
  id: string;
  name: string;
  leader: string;
  description: string;
  memberCount: number;
  track?: '분석' | '시각화' | '엔지니어링' | string;
  studyKind?: 'MENTORING' | 'GENERAL';
  termPeriod?: 'VACATION' | 'SEMESTER';
  /** 활동 기수. 없으면 기본(현재) 기수의 목 데이터로 본다. */
  cohort?: number;
}

export interface InternalAttendee {
  id: string;
  originalId?: string;
  eventId: string;
  teamId: string;
  teamName: string;
  name: string;
  term: number;
  track: string;
  status: AttendStatus;
  checkedInAt: string;
  memo?: string;
  weekNum?: number;
  weekLabel?: string;
  /** 활동 기수. 없으면 기본(현재) 기수의 목 데이터로 본다. */
  cohort?: number;
}

const NO_WEEKS: readonly WeekInfo[] = [];
const SUBMIT_TOAST_DURATION_MS = 3000;
const NO_WEEK_DATES: Readonly<Record<number, string>> = {};

const CATEGORY_CONFIG: Record<
  InternalCategory,
  {
    title: string;
    subTitle: string;
    icon: any;
    themeColor: string;
    badgeBg: string;
    badgeBorder: string;
    teamLabel: string;
    teams: TeamMeta[];
    initialAttendees: InternalAttendee[];
  }
> = {
  SESSION: {
    title: 'BASE Term 출결 관리',
    subTitle: '분석, 시각화, 엔지니어링 3개 트랙별 BASE 출석 현황을 실시간으로 관리합니다.',
    icon: Calendar,
    themeColor: '#0f172a',
    badgeBg: '#f8fafc',
    badgeBorder: '#e2e8f0',
    teamLabel: '트랙',
    // 트랙과 트랙원·출결은 DB(teams/team_members/attendance_*)에서 온다.
    teams: [],
    initialAttendees: [],
  },
  STUDY: {
    title: '스터디 출결 관리',
    subTitle: '멘멘 스터디와 일반 스터디의 주차별 출석 및 인증 내역을 관리합니다.',
    icon: BookOpen,
    themeColor: '#0f172a',
    badgeBg: '#f8fafc',
    badgeBorder: '#e2e8f0',
    teamLabel: '스터디 팀',
    // 스터디 팀·명단은 임시 DB(db/seed.sql)에서 내려받은 값으로 채운다.
    teams: [],
    initialAttendees: [],
  },
  ADV: {
    title: 'ADV Term 출결 관리',
    subTitle: '산학 연계 및 실무 프로젝트 어드브 팀별 마일스톤 및 멘토링 출결을 관리합니다.',
    icon: Rocket,
    themeColor: '#0f172a',
    badgeBg: '#f8fafc',
    badgeBorder: '#e2e8f0',
    teamLabel: '프로젝트 팀',
    // 팀·팀원·출결은 DB(teams/team_members/attendance_*)에서 온다.
    teams: [],
    initialAttendees: [],
  },
};

const ATTEND_STATUS_CFG: Record<
  AttendStatus,
  { label: string; code: string; color: string; bg: string; border: string }
> = {
  present: { label: '출석', code: '0', color: '#0f5132', bg: '#def2e6', border: '#b6e3c9' },
  late: { label: '지각', code: '1', color: '#7c4a03', bg: '#fceed2', border: '#f5d5a4' },
  earlyLeave: { label: '조퇴', code: '1E', color: '#7c4a03', bg: '#fef3c7', border: '#fde68a' },
  absent: { label: '결석', code: '2', color: '#8a1c32', bg: '#fce4e6', border: '#f8b4bc' },
  excusedAbsent: {
    label: '인정결석',
    code: '3',
    color: '#1e40af',
    bg: '#eff6ff',
    border: '#bfdbfe',
  },
  remote: { label: '비대면', code: 'ON', color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
  unexcusedLate: {
    label: '무단지각',
    code: '4',
    color: '#c2410c',
    bg: '#fff7ed',
    border: '#fed7aa',
  },
  unexcusedAbsent: {
    label: '무단결석',
    code: '5',
    color: '#991b1b',
    bg: '#fee2e2',
    border: '#fca5a5',
  },
  unmarked: { label: '미정', code: '-', color: '#334155', bg: '#e9eef4', border: '#cbd5e1' },
};

const ATTEND_STATUS_STYLES: Record<AttendStatus, { active: string; inactive: string }> = {
  present: {
    active: 'bg-[#def2e6] text-[#0f5132] font-bold border border-[#b6e3c9] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#0f5132] hover:bg-white/60 border border-transparent font-medium',
  },
  late: {
    active: 'bg-[#fceed2] text-[#7c4a03] font-bold border border-[#f5d5a4] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#7c4a03] hover:bg-white/60 border border-transparent font-medium',
  },
  earlyLeave: {
    active: 'bg-[#fef3c7] text-[#7c4a03] font-bold border border-[#fde68a] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#7c4a03] hover:bg-white/60 border border-transparent font-medium',
  },
  absent: {
    active: 'bg-[#fce4e6] text-[#8a1c32] font-bold border border-[#f8b4bc] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#8a1c32] hover:bg-white/60 border border-transparent font-medium',
  },
  excusedAbsent: {
    active: 'bg-[#eff6ff] text-[#1e40af] font-bold border border-[#bfdbfe] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#1e40af] hover:bg-white/60 border border-transparent font-medium',
  },
  remote: {
    active: 'bg-[#eef2ff] text-[#4338ca] font-bold border border-[#c7d2fe] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#4338ca] hover:bg-white/60 border border-transparent font-medium',
  },
  unexcusedLate: {
    active: 'bg-[#fff7ed] text-[#c2410c] font-bold border border-[#fed7aa] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#c2410c] hover:bg-white/60 border border-transparent font-medium',
  },
  unexcusedAbsent: {
    active: 'bg-[#fee2e2] text-[#991b1b] font-bold border border-[#fca5a5] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#991b1b] hover:bg-white/60 border border-transparent font-medium',
  },
  unmarked: {
    active: 'bg-[#e9eef4] text-slate-800 font-bold border border-slate-300 shadow-2xs',
    inactive:
      'text-slate-400 hover:text-slate-700 hover:bg-white/60 border border-transparent font-medium',
  },
};

// CSV 추출 및 미리보기용 출결 상태 코드 매핑 (출석:1, 지각:2, 조퇴:3, 결석:4, 인정결석:5, 비대면:6, 무단지각:0, 무단결석:X)
export const EXPORT_ATTEND_STATUS_CODE: Record<AttendStatus, string> = {
  present: '1',
  late: '2',
  earlyLeave: '3',
  absent: '4',
  excusedAbsent: '5',
  remote: '6',
  unexcusedLate: '0',
  unexcusedAbsent: 'X',
  unmarked: '-',
};

export const EXPORT_ATTEND_STATUS_STYLE: Record<AttendStatus, string> = {
  present: 'text-slate-800 font-medium',
  late: 'text-slate-800 font-medium',
  earlyLeave: 'text-slate-800 font-medium',
  absent: 'text-slate-800 font-medium',
  excusedAbsent: 'text-slate-800 font-medium',
  remote: 'text-slate-800 font-medium',
  unexcusedLate: 'text-slate-800 font-medium',
  unexcusedAbsent: 'text-slate-800 font-medium',
  unmarked: 'text-slate-300 font-normal',
};

export interface ExportColumnConfig {
  id:
    | 'term'
    | 'name'
    | 'week'
    | 'absence'
    | 'unexcusedAbsence'
    | 'lateEarlyLeave'
    | 'remote'
    | 'totalScore'
    | 'track'
    | 'teamName'
    | 'status'
    | 'checkedInAt'
    | 'memo';
  label: string;
  enabled: boolean;
}

export interface ModalColItem {
  id: string;
  label: string;
  subLabel?: string;
  renderCell: (row: any) => React.ReactNode;
  exportValue: (row: any) => string;
}

const DEFAULT_EXPORT_COLUMNS: ExportColumnConfig[] = [
  { id: 'term', label: '기수', enabled: true },
  { id: 'name', label: '이름', enabled: true },
  { id: 'week', label: '날짜', enabled: true },
  { id: 'absence', label: '결석', enabled: true },
  { id: 'unexcusedAbsence', label: '무단결석', enabled: true },
  { id: 'lateEarlyLeave', label: '지각조퇴', enabled: true },
  { id: 'remote', label: '비대면 횟수', enabled: true },
  { id: 'totalScore', label: '총점', enabled: true },
];

/** 팀 생성 결과: 서버가 만든 팀 id, 또는 사용자에게 보여줄 실패 사유. */
export type CreateTeamResult = { teamId: string } | { error: string };

export interface InternalCategoryAttendancePageProps {
  category: InternalCategory;
  attendance?: AttendanceState;
  /** 공용 저장소(DB)의 팀·팀원(스터디 화면은 스터디 팀, BASE 화면은 BASE 트랙). 이 화면은 이 값에서 파생해 조회한다. */
  studyTeams?: readonly StudyTeamInfo[];
  studyMembers?: Readonly<Record<string, readonly Member[]>>;
  users?: readonly UserProfile[];
  membershipBaseTeams?: readonly StudyTeamInfo[];
  membershipOtherTeams?: readonly StudyTeamInfo[];
  /** 주차와 활성 상태(DB의 weeks). 진행 예정 주차는 미정으로 보이고, 종료·진행 중 주차만 기록을 보여준다. */
  weeks?: readonly WeekInfo[];
  /** 반기 API의 기수 목록과 현재 기수. 현재보다 작은 기수는 지난 기수로 조회만 할 수 있다. ADV 화면은 ADV 기수다. */
  cohorts?: readonly number[];
  currentCohort: number;
  canCreateNextSemester: boolean;
  onAdvanceSemester: () => Promise<void>;
  /** 기수 → 반기 표기(반기 API 응답). */
  cohortLabels: Readonly<Record<number, string>>;
  /** 부문 목록(반기 API 응답). */
  tracks: readonly UserTrack[];
  /** 서버가 만든 팀 id 또는 사용자에게 보여줄 실패 사유를 돌려준다. */
  onCreateStudy?: (input: CreateStudyInput) => Promise<CreateTeamResult>;
  onStudyAttendanceChange?: (change: AttendanceChange) => void;
  /** 기수별 주차 날짜 매핑(DB). 출결 생성 창에서 정한 날짜를 BASE 표 머리와 CSV가 읽어서 쓴다. */
  weekDates?: Readonly<Record<number, Readonly<Record<number, string>>>>;
  /** 기수별 주차 진행 상태(반기 주차 API). 고른 기수의 반기 상태로 입력 가능 주차를 정한다. 없으면 weeks를 쓴다. */
  weeksByCohort?: Readonly<Record<number, readonly WeekInfo[]>>;
  /** 기수별 반기(반기 API). 지금 주차와 기간(방학·학기)을 이 값에서 읽는다. */
  semesterByCohort?: Readonly<Record<number, SemesterDto>>;
  /** ADV 팀 개설: 그 기수·부문의 다음 번호 팀과 팀원, 주차별 미정 출결을 만든다. */
  onCreateAdvTeam?: (input: CreateAdvTeamInput) => Promise<CreateTeamResult>;
  /** BASE 출결 생성: 그 기수·트랙 팀과 트랙원, 주차별 미정 출결을 만든다. */
  onCreateBaseAttendance?: (input: CreateBaseAttendanceInput) => Promise<CreateTeamResult>;
  /** BASE·ADV 주차 제출이 서버에서 성공하면 그 팀·주차를 DB에 제출 완료로 저장한다. */
  onSubmitWeek?: (teamId: string, weekNum: number, submittedAt: string) => void;
  /** 스터디 명단에서 팀원을 빼면 DB의 팀 소속과 그 팀원의 출결 기록도 함께 지운다. */
  onRemoveStudyMember?: (teamId: string, memberId: string) => void;
  /** 팀 삭제(팀 카드의 휴지통 아이콘). 성공하면 true. */
  onDeleteTeam?: (teamId: string) => Promise<boolean>;
  /** 팀 설정 변경 창의 팀명·팀장 변경. 누르는 즉시 API로 저장한다. 성공하면 true. */
  onUpdateStudyTeam?: (teamId: string, changes: TeamInfoChanges) => Promise<boolean>;
  onAddStudyMember?: (teamId: string, userId: string) => void | Promise<void>;
}

/** 팀 설정 창에서 저장하는 값. 바뀐 항목만 보낸다. leaderId는 팀원의 users.id이며 null이면 팀장 해제. */
export interface TeamInfoChanges {
  teamName?: string;
  /** ADV 프로젝트 이름. ADV는 팀 이름(분석 1팀)이 번호로 정해져 있어 이 값을 바꾼다. */
  studyName?: string;
  leaderId?: string | null;
}

export function InternalCategoryAttendancePage({
  category,
  attendance,
  studyTeams,
  studyMembers,
  users = [],
  membershipBaseTeams = [],
  membershipOtherTeams = [],
  weeks: weeksProp = NO_WEEKS,
  cohorts,
  currentCohort,
  canCreateNextSemester,
  onAdvanceSemester,
  cohortLabels,
  tracks,
  onCreateStudy,
  onStudyAttendanceChange,
  onRemoveStudyMember,
  onDeleteTeam,
  onUpdateStudyTeam,
  onAddStudyMember,
  weekDates: weekDatesProp,
  weeksByCohort,
  semesterByCohort,
  onCreateAdvTeam,
  onCreateBaseAttendance,
  onSubmitWeek,
}: InternalCategoryAttendancePageProps) {
  // 현재 기수는 반기 API가 정한다(DB의 현재 반기). 더 작은 기수는 지난 기수(아카이브)다.
  const cohortOptions = useMemo(
    () => cohortsOf([...(cohorts ?? []), currentCohort]),
    [cohorts, currentCohort],
  );
  // 고른 기수는 다른 화면 상태처럼 기억해 두되, 목록에 없는 기수면 현재 기수로 돌아간다.
  const [chosenCohort, setChosenCohort] = useState<number | null>(() => {
    try {
      const saved = Number(localStorage.getItem(`boaz_${category}_cohort`));
      return Number.isInteger(saved) && saved > 0 ? saved : null;
    } catch {
      return null;
    }
  });
  const viewCohort =
    chosenCohort !== null && cohortOptions.includes(chosenCohort) ? chosenCohort : currentCohort;

  // 직접 고른 기수만 저장한다(고르지 않았으면 항상 현재 기수를 따라간다).
  useEffect(() => {
    try {
      if (chosenCohort === null) localStorage.removeItem(`boaz_${category}_cohort`);
      else localStorage.setItem(`boaz_${category}_cohort`, String(chosenCohort));
    } catch {}
  }, [category, chosenCohort]);
  const isArchivedView = isPastCohort(viewCohort, currentCohort);

  // BASE 주차 출결 제출: 제출 여부는 DB의 출결 세션(submitted)에 저장되고, 제출한 주차는 수정 모드가 아니면 고를 수 없다.
  const [isSubmittingWeek, setIsSubmittingWeek] = useState(false);
  // 제출한 주차를 다시 고칠 때 켜지는 수정 모드(비고 옆 수정 아이콘). 수정 완료 시 다시 제출한다.
  const [editingWeekKey, setEditingWeekKey] = useState<string | null>(null);
  const [submitToast, setSubmitToast] = useState<{ message: string; isError: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (!submitToast) return;
    const timer = window.setTimeout(() => setSubmitToast(null), SUBMIT_TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [submitToast]);

  // 주차 진행 상태는 고른 기수의 반기 값(DB)을 따른다. 지난 기수는 모든 주차가 끝난 상태로 보여 주고 수정할 수 없다.
  const viewWeeks = weeksByCohort?.[viewCohort] ?? weeksProp;
  // 지금 주차와 기간(방학·학기)은 반기 API가 정한다.
  const viewSemester = semesterByCohort?.[viewCohort] ?? null;
  const weeks = useMemo<readonly WeekInfo[]>(
    () =>
      isArchivedView
        ? viewWeeks.map((week) => ({ ...week, status: 'CLOSED' as const }))
        : viewWeeks,
    [viewWeeks, isArchivedView],
  );

  // 스터디·BASE·ADV는 화면 안 목 데이터가 아니라 DB(공용 저장소)에서 팀·명단·출결을 읽고 쓴다.
  const isDbCategory = category === 'STUDY' || category === 'SESSION' || category === 'ADV';
  const studyView = useMemo(
    () =>
      buildStudyView(
        (studyTeams ?? []).filter((team) => team.cohort === viewCohort),
        studyMembers ?? {},
        '',
      ),
    [studyTeams, studyMembers, viewCohort],
  );
  const config = useMemo(
    () =>
      isDbCategory
        ? {
            ...CATEGORY_CONFIG[category],
            teams: studyView.teams,
            initialAttendees: studyView.attendees,
          }
        : CATEGORY_CONFIG[category],
    [category, isDbCategory, studyView],
  );

  // 스터디는 방학/학기 모두 1~8주차, 그 외 카테고리는 학기에 9~16주차를 사용.
  // 처음 여는 탭은 반기 API가 알려 주는 지금 기간이다.
  const [termPeriod, setTermPeriod] = useState<'VACATION' | 'SEMESTER'>(() =>
    viewSemester?.currentPeriod === '학기' ? 'SEMESTER' : 'VACATION',
  );
  const usesOneToEightWeeks = termPeriod === 'VACATION';
  const vacationWeeks = useMemo(() => weeks.filter((w) => w.weekNum <= 8), [weeks]);
  const semesterWeeks = useMemo(() => weeks.filter((w) => w.weekNum > 8), [weeks]);
  const weekList = usesOneToEightWeeks ? vacationWeeks : semesterWeeks;
  /** 처음·기본으로 다루는 주차: 반기 API의 지금 주차. 보고 있는 기간 밖이면 그 기간의 기본 주차. */
  const apiCurrentWeekNum = viewSemester?.currentWeekNum ?? null;
  const latestWeekNum =
    apiCurrentWeekNum !== null && weekList.some((w) => w.weekNum === apiCurrentWeekNum)
      ? apiCurrentWeekNum
      : defaultWeekNum(weekList);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(`boaz_${category}_selected_team`);
      if (saved) return saved;
    } catch {}
    return category === 'ADV' || category === 'STUDY' ? 'ALL' : config.teams[0]?.id || '';
  });

  // 방학과 학기 주차 선택을 완전히 분리하여 독립 관리 (기본값: 전체 주차 0)
  const [selectedWeekVacation, setSelectedWeekVacation] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`boaz_${category}_week_vacation`);
      if (saved !== null && !isNaN(Number(saved))) return Number(saved);
    } catch {}
    return 0;
  });
  const [selectedWeekSemester, setSelectedWeekSemester] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`boaz_${category}_week_semester`);
      if (saved !== null && !isNaN(Number(saved))) return Number(saved);
    } catch {}
    return 0;
  });
  useEffect(() => {
    if (category === 'STUDY' && selectedWeekSemester > 8) {
      setSelectedWeekSemester(0);
    }
  }, [category, selectedWeekSemester]);
  const selectedWeek = termPeriod === 'VACATION' ? selectedWeekVacation : selectedWeekSemester;
  const setSelectedWeek = (week: number) => {
    if (week !== 0) {
      setIsTableEditMode(false);
    }
    if (termPeriod === 'VACATION') {
      setSelectedWeekVacation(week);
    } else {
      setSelectedWeekSemester(week);
    }
  };

  const moveToSemester = () => {
    setTermPeriod('SEMESTER');
    setSelectedWeekSemester(0);
  };

  const handleSelectSemesterTab = () => {
    if (termPeriod === 'SEMESTER') return;
    // 스터디도 방학 동안에는 학기 출결 데이터가 없으므로 같은 확인을 받는다.
    // 지금이 방학이면 브라우저 확인 창으로 한 번 묻는다(학기 주차는 아직 시작 전).
    if (
      viewSemester?.currentPeriod !== '학기' &&
      !window.confirm(
        '학기는 아직 시작 전입니다\n아직 방학 기간이라 학기 출결 데이터가 없습니다. 학기로 이동할까요?',
      )
    ) {
      return;
    }
    moveToSemester();
  };

  // 미래 주차(진행 예정)로 옮기기 전에 브라우저 확인 창으로 한 번 묻는다.
  const confirmFutureWeek = (targetWeek: number) =>
    window.confirm(
      `${targetWeek}주차 세션 미오픈\n아직 진행되지 않은 주차입니다. 해당 주차 화면으로 이동하시겠습니까?`,
    );

  const isFutureWeekNum = (wNum: number) => {
    if (wNum === 0) return false;
    return weekStatusOf(weeks, wNum) === 'UPCOMING';
  };

  const handleSelectWeek = (targetWeek: number) => {
    if (targetWeek === selectedWeek) return;
    if (targetWeek !== 0 && isFutureWeekNum(targetWeek)) {
      if (!confirmFutureWeek(targetWeek)) return;
    }
    setSelectedWeek(targetWeek);
  };

  useEffect(() => {
    try {
      localStorage.setItem(`boaz_${category}_selected_team`, selectedTeamId);
    } catch {}
  }, [category, selectedTeamId]);

  useEffect(() => {
    try {
      localStorage.setItem(`boaz_${category}_week_vacation`, String(selectedWeekVacation));
    } catch {}
  }, [category, selectedWeekVacation]);

  useEffect(() => {
    try {
      localStorage.setItem(`boaz_${category}_week_semester`, String(selectedWeekSemester));
    } catch {}
  }, [category, selectedWeekSemester]);

  const [isPeekOpen, setIsPeekOpen] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Horizontal Week Scroll State
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkWeekScroll = () => {
    if (weekScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = weekScrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    }
  };

  useEffect(() => {
    checkWeekScroll();
    const handleResize = () => checkWeekScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [category, weekList]);

  const handleScrollWeeks = (direction: 'left' | 'right') => {
    if (weekScrollRef.current) {
      const offset = direction === 'left' ? -240 : 240;
      weekScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkWeekScroll, 300);
    }
  };

  // Draggable Split Pane State
  const [splitRatio, setSplitRatio] = useState<number>(23); // 23% left, 77% right
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Events and Attendees
  // 명단은 DB에서 기수별로 이미 걸러진 값을 그대로 쓴다.
  const attendees = studyView.attendees;
  const availableTeams = useMemo(
    () =>
      category === 'STUDY'
        ? config.teams.filter((team) => team.termPeriod === termPeriod)
        : category === 'ADV'
          ? config.teams
          : buildBaseTrackTeams(config.teams, viewCohort, tracks),
    [category, config.teams, termPeriod, viewCohort, tracks],
  );
  const studyTeamGroups = [
    {
      label: '멘멘 스터디',
      teams: availableTeams.filter(
        (team) => termPeriod === 'VACATION' && team.studyKind === 'MENTORING',
      ),
    },
    {
      label: '일반 스터디',
      teams: availableTeams.filter(
        (team) => termPeriod === 'SEMESTER' || team.studyKind !== 'MENTORING',
      ),
    },
  ];
  const mentoringStudyTrackGroups = [
    {
      label: '분석',
      teams: availableTeams.filter(
        (team) => team.studyKind === 'MENTORING' && team.track === '분석',
      ),
    },
    {
      label: '시각화',
      teams: availableTeams.filter(
        (team) => team.studyKind === 'MENTORING' && team.track === '시각화',
      ),
    },
    {
      label: '엔지',
      teams: availableTeams.filter(
        (team) =>
          team.studyKind === 'MENTORING' && (team.track === '엔지니어링' || team.track === '엔지'),
      ),
    },
  ];

  // Controls in Peek
  const [attendeeSearch] = useState('');
  const [attendStatusFilter] = useState<'ALL' | AttendStatus>('ALL');
  const [isTableEditMode, setIsTableEditMode] = useState(false);
  // 단일 팀 표의 관리(삭제) 열. 수정 모드가 아니어도 자리를 잡아 둔다(ADV는 삭제가 없다).
  const showsManageColumn = category !== 'ADV' && !isArchivedView;
  const [activeStudyEditCell, setActiveStudyEditCell] = useState<{
    rowId: string;
    weekNum: number;
  } | null>(null);

  // Modals
  /** 크게 보기 창에 띄울 사진. 썸네일과 같은 사진(그 팀·주차의 DB 사진)과 그 주차 이름을 담는다. */
  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; weekLabel: string } | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; name: string } | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [teamSettingsTeamId, setTeamSettingsTeamId] = useState<string | null>(null);
  const [teamNameDraft, setTeamNameDraft] = useState('');
  // 팀 설정 변경 창의 팀장은 API가 돌려준 팀 정보(leaderId)를 그대로 쓴다. 바꾸면 바로 저장하고 다시 읽는다.
  const teamSettingsLeaderId =
    (studyTeams ?? []).find((info) => info.id === teamSettingsTeamId)?.leaderId ?? null;
  // 팀 이름 칸은 저장 버튼(또는 Enter)으로 저장한다. ADV는 화면 제목인 study_name을, 스터디는 team_name을 고친다.
  const teamSettingsNameKey = category === 'ADV' ? 'studyName' : 'teamName';
  const teamSettingsSavedName =
    (studyTeams ?? []).find((info) => info.id === teamSettingsTeamId)?.[teamSettingsNameKey] ?? '';
  const isTeamNameChanged =
    teamNameDraft.trim() !== '' && teamNameDraft.trim() !== teamSettingsSavedName;
  const saveTeamName = () => {
    if (!teamSettingsTeamId || !isTeamNameChanged) return;
    if (!window.confirm('팀 이름을 바꾸시겠습니까?')) return;
    void onUpdateStudyTeam?.(teamSettingsTeamId, {
      [teamSettingsNameKey]: teamNameDraft.trim(),
    });
  };
  // 팀장 지정. 이미 팀장이 있으면(팀장 변경) 예전 팀장은 팀원으로 남고, 예전 팀장 계정의 이 팀 출결 권한은
  // 회수되어 이 팀에 연결된 계정이 없어진다. 새 팀장 계정은 그룹 계정 관리에서 발급한다(BASE는 HOST 계정이 없다).
  const handleChangeLeader = async (teamId: string, userId: string, name: string) => {
    const isLeaderChange = category !== 'SESSION' && teamSettingsLeaderId !== null;
    const confirmMessage = isLeaderChange
      ? `${name}님을 팀장으로 바꿀까요?\n예전 팀장은 팀원으로 바뀌고, 예전 팀장 계정의 이 팀 출결 권한은 회수됩니다.\n${name}님의 계정은 그룹 계정 관리에서 발급해 주세요.`
      : `${name}님을 팀장으로 바꿀까요?`;
    if (!window.confirm(confirmMessage)) return;
    await onUpdateStudyTeam?.(teamId, { leaderId: userId });
  };
  // 팀장 해제. 팀장은 팀원으로 남고, 팀장 변경과 같이 그 계정의 이 팀 출결 권한은 회수된다(BASE는 HOST 계정이 없다).
  const handleReleaseLeader = async (teamId: string, name: string) => {
    const confirmMessage =
      category === 'SESSION'
        ? `${name}님의 팀장 지정을 해제할까요?`
        : `${name}님의 팀장 지정을 해제할까요?\n${name}님은 팀원으로 바뀌고, ${name}님 계정의 이 팀 출결 권한은 회수됩니다.`;
    if (!window.confirm(confirmMessage)) return;
    await onUpdateStudyTeam?.(teamId, { leaderId: null });
  };
  const [newMemberName, setNewMemberName] = useState('');
  const [teamSettingsMessage, setTeamSettingsMessage] = useState('');

  useEffect(() => {
    if (!teamSettingsMessage) return;
    const timer = window.setTimeout(() => setTeamSettingsMessage(''), 2500);
    return () => window.clearTimeout(timer);
  }, [teamSettingsMessage]);
  const [showCreateStudyModal, setShowCreateStudyModal] = useState(false);
  const [showCreateAttendanceModal, setShowCreateAttendanceModal] = useState(false);
  const [showCreateAdvModal, setShowCreateAdvModal] = useState(false);
  const notifyCreated = (cohort: number, what: string) => {
    setSubmitToast({
      message: `${cohortLabelOf(cohortLabels, cohort)} 반기에 ${what}을 만들었습니다.`,
      isError: false,
    });
  };

  // 현재(진행 중) 주차 제출: 그 팀·주차의 상태값을 서버로 보내고, 성공하면 제출 완료로 바꾼다.
  const handleSubmitWeek = async () => {
    if (isSubmittingWeek || !showsSubmitControl(selectedWeek) || isAllSelected) return;
    const submission = buildWeekSubmission(
      category === 'ADV' ? 'ADV' : 'BASE',
      viewCohort,
      selectedWeek,
      selectedTeam.id,
      currentTeamAttendees,
    );
    const unmarked = countUnmarked(submission);
    if (
      unmarked > 0 &&
      !window.confirm(`출결이 미정인 인원이 ${unmarked}명 있습니다.\n그대로 제출하시겠습니까?`)
    ) {
      return;
    }
    const key = submissionKey(viewCohort, selectedTeam.id, selectedWeek);
    const wasEditing = editingWeekKey === key;
    setIsSubmittingWeek(true);
    try {
      const result = await submitWeekAttendance(submission);
      onSubmitWeek?.(selectedTeam.id, selectedWeek, result.submittedAt);
      setEditingWeekKey(null);
      setSubmitToast({
        message: wasEditing
          ? `${selectedWeek}주차 수정 내용이 제출되었습니다.`
          : `${selectedWeek}주차 출결이 제출되었습니다.`,
        isError: false,
      });
    } catch {
      setSubmitToast({
        message: '출결을 제출하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        isError: true,
      });
    } finally {
      setIsSubmittingWeek(false);
    }
  };

  // ADV 팀 개설: 현재 반기에 등록된 명단으로 팀을 만든다.
  const handleCreateAdvTeam = async (
    cohort: number,
    track: UserTrack,
    picked: UserProfile[],
    dates: Record<number, string>,
    leaderId: string | null,
    teamName: string | null,
  ) => {
    const leaderName = picked.find((user) => user.id === leaderId)?.name ?? null;
    const result = await onCreateAdvTeam?.({
      cohort,
      track,
      members: picked,
      weekDates: dates,
      weekNums: weekList.map((week) => week.weekNum),
      leaderName,
      teamName,
    });
    if (!result) return;
    if ('error' in result) {
      alert(result.error);
      return;
    }
    setShowCreateAdvModal(false);
    notifyCreated(cohort, teamName ?? `${track} ADV 팀`);
  };

  // 기수를 바꾸면 그 기수의 출결 화면으로 이동한다(선택 팀은 초기화).
  const handleChangeCohort = (next: number) => {
    setEditingWeekKey(null);
    setChosenCohort(next);
    // BASE는 트랙 팀이 기수마다 따로 있어서, 비워 두면 그 기수의 첫 트랙이 자동으로 선택된다.
    setSelectedTeamId(category === 'ADV' || category === 'STUDY' ? 'ALL' : '');
    setIsPeekOpen(false);
  };

  const handleCreateBaseAttendance = async (
    cohort: number,
    track: UserTrack,
    picked: UserProfile[],
    dates: Record<number, string>,
  ) => {
    const result = await onCreateBaseAttendance?.({
      cohort,
      track,
      members: picked,
      weekDates: dates,
      weekNums: weekList.map((week) => week.weekNum),
    });
    if (!result) return;
    if ('error' in result) {
      alert(result.error);
      return;
    }
    setShowCreateAttendanceModal(false);
    notifyCreated(cohort, `${track} BASE 출결`);
  };
  const [newStudyName, setNewStudyName] = useState('');
  const [newStudySelection, setNewStudySelection] =
    useState<MemberSelection>(EMPTY_MEMBER_SELECTION);
  const [newStudyKind, setNewStudyKind] = useState<'MENTORING' | 'GENERAL'>('GENERAL');
  const [newStudyTrack, setNewStudyTrack] = useState<'분석' | '시각화' | '엔지니어링'>('분석');
  const [newStudyWeekDates, setNewStudyWeekDates] = useState<Record<number, string>>({});
  const canSelectStudyTrack = termPeriod === 'VACATION' && newStudyKind === 'MENTORING';

  const openCreateStudyModal = () => {
    setNewStudyName('');
    setNewStudySelection(EMPTY_MEMBER_SELECTION);
    setNewStudyKind('GENERAL');
    setNewStudyTrack('분석');
    setNewStudyWeekDates({});
    setShowCreateStudyModal(true);
  };

  const handleCreateStudy = async () => {
    const name = newStudyName.trim();
    if (!name) {
      alert('스터디명을 입력해 주세요.');
      return;
    }

    const leader = findLeader(newStudySelection);
    const id = `study_${Date.now()}`;
    const isVacation = termPeriod === 'VACATION';

    const result = await onCreateStudy?.({
      id,
      name,
      studyKind: isVacation ? newStudyKind : 'GENERAL',
      track: newStudyTrack,
      isVacation,
      cohort: currentCohort,
      leaderName: leader?.name ?? null,
      members: newStudySelection.members,
      // 주차별 날짜는 멘멘스터디에서만 입력받는다. 일반 스터디는 날짜를 보내지 않는다.
      weekDates: canSelectStudyTrack
        ? Object.fromEntries(Object.entries(newStudyWeekDates).filter(([, date]) => date))
        : undefined,
    });
    if (!result) return;
    if ('error' in result) {
      alert(result.error);
      return;
    }
    setSelectedTeamId(result.teamId);
    setIsPeekOpen(true);
    setShowCreateStudyModal(false);
  };

  // Track Filter State
  const TRACK_FILTER_OPTIONS = [
    { id: 'ALL', label: '전체' },
    { id: '분석', label: '분석' },
    { id: '시각화', label: '시각화' },
    { id: '엔지니어링', label: '엔지' },
  ];
  const [selectedTrackFilter, setSelectedTrackFilter] = useState<string>('ALL');
  const [termFilter] = useState<string>('ALL'); // "ALL" | "28" | "27" | "26"
  const [sortOption] = useState<'DEFAULT' | 'TERM_ASC' | 'TERM_DESC' | 'NAME_ASC'>('TERM_ASC');

  // Settings: Committed/Saved State vs Modal Draft State
  // 주차 날짜는 DB 값(weekDates)으로 채운다. 아래 효과가 기수별 DB 매핑을 넣기 전까지는 비어 있다.
  const [savedWeekDateMapping, setSavedWeekDateMapping] = useState<Record<number, string>>({});
  const [savedExportColumns, setSavedExportColumns] =
    useState<ExportColumnConfig[]>(DEFAULT_EXPORT_COLUMNS);
  const [savedCustomColOrder, setSavedCustomColOrder] = useState<string[] | null>(null);

  const [exportColumns, setExportColumns] = useState<ExportColumnConfig[]>(DEFAULT_EXPORT_COLUMNS);
  const [customColOrder, setCustomColOrder] = useState<string[] | null>(null);

  // BASE·ADV는 주차 날짜가 DB의 기수별 매핑이다. 기수를 바꾸거나 DB 값이 바뀌면 화면 매핑도 그 값으로 맞춘다.
  const dbWeekDates = weekDatesProp ? (weekDatesProp[viewCohort] ?? NO_WEEK_DATES) : null;
  useEffect(() => {
    if (!dbWeekDates) return;
    setSavedWeekDateMapping({ ...dbWeekDates });
  }, [dbWeekDates]);

  const handleOpenSettingsModal = () => {
    setExportColumns(savedExportColumns.map((c) => ({ ...c })));
    setCustomColOrder(savedCustomColOrder ? [...savedCustomColOrder] : null);
    setDraggedColIdx(null);
    setDropTarget(null);
    setShowSettingsModal(true);
  };

  const handleCloseOrCancelSettings = () => {
    setExportColumns(savedExportColumns.map((c) => ({ ...c })));
    setCustomColOrder(savedCustomColOrder ? [...savedCustomColOrder] : null);
    setDraggedColIdx(null);
    setDropTarget(null);
    setShowSettingsModal(false);
  };

  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  const handleSaveSettings = () => {
    setSavedExportColumns(exportColumns.map((c) => ({ ...c })));
    setSavedCustomColOrder(customColOrder ? [...customColOrder] : null);
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2000);
  };

  const handleSaveAndExportCsv = () => {
    setSavedExportColumns(exportColumns.map((c) => ({ ...c })));
    setSavedCustomColOrder(customColOrder ? [...customColOrder] : null);
    handleExportCsv();
    setShowSettingsModal(false);
  };

  // Table Column Resizing State
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    week: 80,
    track: 80,
    teamName: 160,
    name: 100,
    term: 70,
    status: 445,
    memo: 240,
    matrix_index: 42,
    matrix_term: 52,
    matrix_name: 80,
    matrix_track: 72,
    matrix_team: 100,
    matrix_w_1: 92,
    matrix_w_2: 92,
    matrix_w_3: 92,
    matrix_w_4: 92,
    matrix_w_5: 92,
    matrix_w_6: 92,
    matrix_w_7: 92,
    matrix_w_8: 92,
    matrix_w_9: 92,
    matrix_w_10: 92,
    matrix_w_11: 92,
    matrix_w_12: 92,
    matrix_w_13: 92,
    matrix_w_14: 92,
    matrix_w_15: 92,
    matrix_w_16: 92,
    matrix_absence: 55,
    matrix_unexcusedAbsence: 68,
    matrix_late: 68,
    matrix_remote: 80,
    matrix_total: 70,
  });

  useEffect(() => {
    setColWidths((prev) => ({
      ...prev,
      status: category === 'SESSION' ? 360 : 110,
    }));
  }, [category, config.teams]);

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const resizingCol = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const [activeHoverCol, setActiveHoverCol] = useState<string | null>(null);
  const [resizingColKey, setResizingColKey] = useState<string | null>(null);
  const [guidelineX, setGuidelineX] = useState<number | null>(null);
  const activeThRef = useRef<HTMLElement | null>(null);

  const updateGuidelinePos = (targetEl?: HTMLElement | null) => {
    const cell = targetEl
      ? ((targetEl.closest('th') || targetEl.closest('td')) as HTMLElement | null)
      : activeThRef.current;
    if (!cell || !tableContainerRef.current) {
      return;
    }
    activeThRef.current = cell;
    const containerRect = tableContainerRef.current.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const scrollLeft = tableContainerRef.current.scrollLeft;
    const x = cellRect.right - containerRect.left + scrollLeft;
    setGuidelineX(x);
  };

  const handleResizeStart = (e: React.MouseEvent<HTMLElement>, key: string, minWidth = 50) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = (e.currentTarget.closest('th') ||
      e.currentTarget.closest('td')) as HTMLElement | null;
    activeThRef.current = cell;
    const startX = e.clientX;
    const startWidth = cell ? cell.offsetWidth : colWidths[key] || minWidth;
    resizingCol.current = { key, startX, startWidth };
    setResizingColKey(key);
    updateGuidelinePos(e.currentTarget);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingCol.current) {
        return;
      }
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - resizingCol.current.startX;
      const targetWidth = Math.max(minWidth, resizingCol.current.startWidth + deltaX);
      const activeKey = resizingCol.current.key;
      setColWidths((prev) => ({ ...prev, [activeKey]: targetWidth }));
      if (activeThRef.current) {
        updateGuidelinePos(activeThRef.current);
      }
    };

    const handleMouseUp = () => {
      resizingCol.current = null;
      setResizingColKey(null);
      setGuidelineX(null);
      activeThRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Column Drag & Drop State with | indicator between columns
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: 'left' | 'right';
  } | null>(null);

  const handleColDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleColDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedColIdx === null) {
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const position: 'left' | 'right' = mouseX < rect.width / 2 ? 'left' : 'right';
    setDropTarget({ index, position });
  };

  const handleColDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedColIdx === null || dropTarget === null) {
      setDraggedColIdx(null);
      setDropTarget(null);
      return;
    }

    let insertIndex = dropTarget.position === 'left' ? dropTarget.index : dropTarget.index + 1;
    if (draggedColIdx < insertIndex) {
      insertIndex--;
    }

    if (draggedColIdx !== insertIndex && insertIndex >= 0 && insertIndex < activeModalCols.length) {
      const newCols = [...activeModalCols];
      const [removed] = newCols.splice(draggedColIdx, 1);
      newCols.splice(insertIndex, 0, removed);
      setCustomColOrder(newCols.map((c) => c.id));
    }

    setDraggedColIdx(null);
    setDropTarget(null);
  };

  const handleColDragEnd = () => {
    setDraggedColIdx(null);
    setDropTarget(null);
  };

  // Keep state synced when switching category prop
  useEffect(() => {
    setSelectedTeamId(
      category === 'ADV' || category === 'STUDY' ? 'ALL' : config.teams[0]?.id || '',
    );
    setIsPeekOpen(true);
    setIsFullScreen(false);
  }, [category]);

  // Drag handler
  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function handlePointerMove(e: MouseEvent | TouchEvent) {
      if (!containerRef.current) {
        return;
      }
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const rect = containerRef.current.getBoundingClientRect();
      const rawRatio = ((clientX - rect.left) / rect.width) * 100;
      const clampedRatio = Math.min(Math.max(rawRatio, 15), 65);
      setSplitRatio(clampedRatio);
    }

    function handlePointerUp() {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  const isAllSelected = selectedTeamId === 'ALL';
  const shouldApplyTrackFilter = category !== 'ADV' || isAllSelected;
  const effectiveTrackFilter = shouldApplyTrackFilter ? selectedTrackFilter : 'ALL';

  useEffect(() => {
    if (
      category === 'ADV' &&
      !isAllSelected &&
      termPeriod === 'VACATION' &&
      selectedWeekVacation >= 1 &&
      selectedWeekVacation <= ADV_DIRECT_SELECT_LAST_WEEK
    ) {
      setSelectedWeekVacation(ADV_DIRECT_SELECT_LAST_WEEK + 1);
    }
  }, [category, isAllSelected, selectedWeekVacation, termPeriod]);
  const selectedTeam: TeamMeta = useMemo(
    () =>
      isAllSelected
        ? {
            id: 'ALL',
            name: '전체 통합 출결 현황',
            leader: '',
            description: '전체 트랙 및 소속 팀 통합 명단',
            memberCount: attendees.length,
          }
        : availableTeams.find((t) => t.id === selectedTeamId) ||
          availableTeams[0] || {
            id: '',
            name: '선택된 팀',
            leader: '',
            description: '',
            memberCount: 0,
          },
    [attendees, availableTeams, isAllSelected, selectedTeamId],
  );
  const isMentoringStudy =
    category === 'STUDY' && termPeriod === 'VACATION' && selectedTeam.studyKind === 'MENTORING';

  // 선택한 팀·주차의 출결 명단
  const baseAttendees = isAllSelected
    ? attendees
    : attendees.filter((a) => a.teamId === (selectedTeam?.id || ''));

  const activeSubmittedWeeks = weekList.filter((w) => isHeldWeek(weeks, w.weekNum));

  // 점수는 화면에서 계산하지 않고 점수 API에서 받는다(API가 적용 중인 점수 규칙으로 계산한다).
  // 출결 기록(attendance)이 바뀌면 다시 읽어, 저장한 출결이 점수에 바로 반영된다.
  const scoreGroup = category === 'STUDY' ? 'STUDY' : category === 'ADV' ? 'ADV' : 'BASE';
  const scorePeriod = usesOneToEightWeeks ? '방학' : '학기';
  const [memberScores, setMemberScores] = useState<ReadonlyMap<string, MemberScoreDto>>(
    () => new Map(),
  );
  useEffect(() => {
    if (!isDbCategory) return;
    let isCancelled = false;
    fetchAttendanceScores({
      semester: viewSemester?.semester,
      group: scoreGroup,
      period: scorePeriod,
    })
      .then((response) => {
        if (isCancelled) return;
        setMemberScores(
          new Map(
            response.teams.flatMap((team) =>
              team.members.map((row) => [
                memberScoreKey(team.teamId, row.memberId, row.subType),
                row,
              ]),
            ),
          ),
        );
      })
      .catch(() => {
        if (!isCancelled) setMemberScores(new Map());
      });
    return () => {
      isCancelled = true;
    };
  }, [attendance, isDbCategory, scoreGroup, scorePeriod, viewSemester?.semester]);
  /** 회원 한 줄의 API 점수. 멘멘 스터디는 줄 구분(멘멘·친바)이 있고, 구분을 모르면 멘멘 줄을 쓴다. */
  const apiScoreOf = useCallback(
    (teamId: string, memberId: string, subType?: '멘멘' | '친바' | null) =>
      memberScores.get(memberScoreKey(teamId, memberId, subType ?? '')) ??
      (subType ? undefined : memberScores.get(memberScoreKey(teamId, memberId, '멘멘'))),
    [memberScores],
  );

  // 주차별 상태·비고는 화면에서 만들지 않고 DB의 출결 기록(주차별 세션)에서 그대로 읽는다.
  // 그래서 ADV 출결 입력 탭이나 이 화면에서 바꾼 값이 그대로 보인다.
  const resolveStudyCell = useCallback(
    (
      teamId: string,
      weekNum: number,
      memberId: string,
      typeLabel?: '멘멘' | '친바',
    ): { status: AttendStatus; memo?: string } | undefined => {
      if (!isDbCategory || !attendance) return undefined;
      const team = studyTeams?.find((candidate) => candidate.id === teamId);
      if (!team) return undefined;
      const cell = getStudyCell(
        attendance,
        team.id,
        weekNum,
        typeLabel ? `${memberId}:${typeLabel}` : memberId,
      );
      if (!cell || !typeLabel) return cell;
      return {
        status: cell.status,
        memo: getStudyCell(attendance, team.id, weekNum, memberId)?.memo ?? cell.memo,
      };
    },
    [attendance, isDbCategory, studyTeams],
  );

  const toWeekAttendee = (
    attendee: InternalAttendee,
    weekNum: number,
    weekLabel: string,
    idWithWeek: boolean,
  ): InternalAttendee => {
    const cell = resolveStudyCell(attendee.teamId, weekNum, attendee.id);
    return {
      ...attendee,
      id: idWithWeek ? `${attendee.id}_w${weekNum}` : attendee.id,
      originalId: attendee.id,
      weekNum,
      weekLabel,
      status: (cell?.status ?? 'unmarked') as AttendStatus,
      checkedInAt: '-',
      memo: cell?.memo,
    };
  };

  const derivedTeamAttendees: InternalAttendee[] =
    selectedWeek === 0
      ? activeSubmittedWeeks.flatMap((w) =>
          baseAttendees.map((a) => toWeekAttendee(a, w.weekNum, w.label, true)),
        )
      : baseAttendees.map((a) => toWeekAttendee(a, selectedWeek, `${selectedWeek}주차`, false));

  const currentTeamAttendees: InternalAttendee[] = derivedTeamAttendees;

  const filteredAttendees = useMemo(() => {
    let list = currentTeamAttendees.filter((a) => {
      if (effectiveTrackFilter !== 'ALL') {
        const matchesTrack = (t: string) => {
          if (effectiveTrackFilter === '엔지니어링' || effectiveTrackFilter === '엔지') {
            return t === '엔지니어링' || t === '엔지' || t.includes('엔지');
          }
          return t === effectiveTrackFilter;
        };
        if (!matchesTrack(a.track || '')) {
          return false;
        }
      }
      if (termFilter !== 'ALL') {
        if (`${a.term}` !== termFilter) {
          return false;
        }
      }
      if (attendStatusFilter !== 'ALL' && a.status !== attendStatusFilter) {
        return false;
      }
      if (attendeeSearch.trim()) {
        const q = attendeeSearch.toLowerCase();
        const matchName = (a.name || '').toLowerCase().includes(q);
        const matchMemo = (a.memo || '').toLowerCase().includes(q);
        const matchTrack = (a.track || '').toLowerCase().includes(q);
        const matchTeam = (a.teamName || '').toLowerCase().includes(q);
        if (!matchName && !matchMemo && !matchTrack && !matchTeam) {
          return false;
        }
      }
      return true;
    });

    if (sortOption === 'TERM_ASC') {
      list = [...list].sort(
        (a, b) => (a.term || 0) - (b.term || 0) || a.name.localeCompare(b.name, 'ko'),
      );
    } else if (sortOption === 'TERM_DESC') {
      list = [...list].sort(
        (a, b) => (b.term || 0) - (a.term || 0) || a.name.localeCompare(b.name, 'ko'),
      );
    } else if (sortOption === 'NAME_ASC') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }

    return list;
  }, [
    currentTeamAttendees,
    effectiveTrackFilter,
    termFilter,
    attendStatusFilter,
    attendeeSearch,
    sortOption,
  ]);

  // ADV Overall Matrix Rows calculation & BASE Term (전체 주차) Matrix calculation
  const isMatrixMode =
    (category === 'ADV' && (isAllSelected || selectedWeek === 0)) ||
    (category === 'SESSION' && selectedWeek === 0);

  const distinctMembers = useMemo(() => {
    const map = new Map<string, InternalAttendee>();
    baseAttendees.forEach((a) => {
      const safeId = String(a.id || '');
      const baseId = a.originalId || (safeId.includes('_w') ? safeId.split('_w')[0] : safeId);
      if (!map.has(baseId)) {
        map.set(baseId, { ...a, id: baseId, originalId: baseId });
      }
    });
    return Array.from(map.values());
  }, [baseAttendees]);

  const currentTermWeeks = weekList;

  // 주차 선택 시 매트릭스 표에서 해당 주차 컬럼만 필터링 (0주차는 전체 8주차 표시)
  const displayedMatrixWeeks = useMemo(() => {
    if (selectedWeek === 0) {
      return currentTermWeeks;
    }
    return currentTermWeeks.filter((w) => w.weekNum === selectedWeek);
  }, [currentTermWeeks, selectedWeek]);

  // 진행된(종료·진행 중) 주차만 직접 출결 선택 가능.
  // BASE는 진행 중(OPEN)인 주차만 고를 수 있고, 지난(CLOSED) 주차는 선택된 상태값으로 확정돼 보이기만 한다.
  const isWeekDirectEditable = useCallback(
    (weekNum: number) => {
      // ADV: 진행 중인 주차가 3주차까지일 때만 이 화면에서 직접 고른다. 지난 주차는 결과만 보이고,
      // 4주차부터는 ADV 출결 입력 탭에서 팀이 작성한 값이 그대로 보인다.
      if (category === 'ADV') {
        return (
          !isArchivedView &&
          weekNum <= ADV_DIRECT_SELECT_LAST_WEEK &&
          weekStatusOf(weeks, weekNum) === 'OPEN'
        );
      }
      // BASE: 지난 주차만 잠기고, 진행 중·아직 오지 않은 주차는 이 화면에서 버튼으로 입력한다.
      if (category === 'SESSION')
        return !isArchivedView && weekStatusOf(weeks, weekNum) !== 'CLOSED';
      return !isArchivedView && usesOneToEightWeeks && isHeldWeek(weeks, weekNum);
    },
    [category, isArchivedView, usesOneToEightWeeks, weeks],
  );

  /** 이 화면에서 제출·수정할 수 있는 주차인가: BASE는 진행 중인 주차, ADV는 진행 중이면서 3주차까지. */
  const isSubmittableWeek = (weekNum: number) => {
    if (isArchivedView || weekNum === 0 || weekStatusOf(weeks, weekNum) !== 'OPEN') return false;
    if (category === 'SESSION') return true;
    return category === 'ADV' && weekNum <= ADV_DIRECT_SELECT_LAST_WEEK;
  };

  /**
   * 제출 버튼(제출했으면 "제출 완료")이 보이는 주차: BASE는 진행 중인 주차, ADV는 3주차까지 모든 주차.
   * ADV의 지난 주차는 입력은 잠겨 있고 제출 여부만 보인다.
   */
  const showsSubmitControl = (weekNum: number) => {
    if (isArchivedView || weekNum === 0) return false;
    if (category === 'ADV') return weekNum <= ADV_DIRECT_SELECT_LAST_WEEK;
    return isSubmittableWeek(weekNum);
  };

  /** DB의 출결 세션에서 그 팀·주차의 제출 여부를 읽는다. */
  const isWeekSubmittedInDb = (teamId: string, weekNum: number) =>
    Boolean(attendance?.[sessionKey(`w${weekNum}`, 'study', teamId)]?.submitted);

  // BASE 단일 팀 표: 지난(CLOSED) 주차가 아니면(진행 중·아직 오지 않은 주차 모두) 이 탭에서 버튼으로 상태·비고를 입력한다.
  // 지난 주차는 선택된 값이 확정돼 보이기만 한다.
  // weekNum이 없으면 지금 선택한 주차를 본다.
  // ADV: 3주차까지 진행 중인 주차만 이 탭에서 입력하고, 제출하면 수정 모드가 아닌 동안 잠긴다.
  const isBaseWeekSelectable = (weekNum?: number, teamId?: string) => {
    if (category !== 'SESSION' && category !== 'ADV') return false;
    // ADV 전체 주차 화면은 주차별 행이 섞여 있어(직접 입력 주차 행만 버튼이 나오는 어색함) 보기 전용이다. 주차를 골라 입력한다.
    if (category === 'ADV' && selectedWeek === 0) return false;
    const week = weekNum ?? selectedWeek;
    if (category === 'ADV' ? !isWeekDirectEditable(week) : weekStatusOf(weeks, week) === 'CLOSED') {
      return false;
    }
    const id = teamId ?? selectedTeam.id;
    return !isWeekSubmittedInDb(id, week) || editingWeekKey === submissionKey(viewCohort, id, week);
  };
  // 전체 주차 화면은 주차별 행이 섞여 있어 열 너비는 선택 가능한 폭으로 유지한다.
  const isBaseStatusColumnWide =
    category === 'SESSION'
      ? selectedWeek === 0 || isBaseWeekSelectable()
      : category === 'ADV' && !isAllSelected && selectedWeek !== 0 && isBaseWeekSelectable();

  // 매트릭스 표 최소 너비 계산 (각 컬럼이 찌그러지지 않도록 합산)
  const matrixTableMinWidth = useMemo(() => {
    let sum =
      (colWidths.matrix_index || 42) +
      (colWidths.matrix_term || 52) +
      (colWidths.matrix_name || 80) +
      (shouldShowMatrixTrack(category, effectiveTrackFilter) ? colWidths.matrix_track || 72 : 0) +
      (colWidths.matrix_total || 75) +
      (shouldShowConcurrentColumn(category) ? colWidths.matrix_concurrent || 82 : 0);

    if (selectedWeek === 0) {
      sum +=
        (colWidths.matrix_absence || 60) +
        (colWidths.matrix_unexcusedAbsence || 68) +
        (colWidths.matrix_late || 68) +
        (category === 'ADV' ? colWidths.matrix_remote || 80 : 0);
    }

    displayedMatrixWeeks.forEach((w) => {
      const isEditable = isWeekDirectEditable(w.weekNum) && selectedWeek !== 0;
      const colKey = `matrix_w_${w.weekNum}`;
      const minColWidth = isEditable ? 435 : 92;
      const defaultColWidth = isEditable ? 445 : 92;
      const effectiveWidth = Math.max(colWidths[colKey] || defaultColWidth, minColWidth);
      sum += effectiveWidth;
    });

    return Math.max(
      sum,
      selectedWeek === 0
        ? effectiveTrackFilter === 'ALL'
          ? 850
          : 750
        : effectiveTrackFilter === 'ALL'
          ? 550
          : 490,
    );
  }, [
    category,
    colWidths,
    displayedMatrixWeeks,
    selectedWeek,
    effectiveTrackFilter,
    termPeriod,
    savedWeekDateMapping,
    isWeekDirectEditable,
  ]);

  // 단일 팀 표 최소 너비 계산
  const singleTeamTableMinWidth = useMemo(() => {
    const isSingleTeamEditable =
      (category === 'SESSION' &&
        (selectedWeek === 0 || weekStatusOf(weeks, selectedWeek) !== 'CLOSED')) ||
      (category === 'ADV' && isWeekDirectEditable(selectedWeek) && selectedWeek !== 0);
    // 좁은 출결 열도 수정 모드의 드롭다운(76px)이 들어가는 폭이다(보기·수정 모드 너비가 같다).
    const statusMinWidth = isSingleTeamEditable ? 435 : 92;
    const statusDefaultWidth = isSingleTeamEditable ? 445 : 92;
    const statusEffectiveWidth = isSingleTeamEditable
      ? Math.max(colWidths.status || statusDefaultWidth, statusMinWidth)
      : colWidths.status && colWidths.status < 200
        ? Math.max(colWidths.status, statusMinWidth)
        : statusDefaultWidth;

    let sum =
      (colWidths.name || 70) +
      (colWidths.term || 50) +
      statusEffectiveWidth +
      (colWidths.memo || 240);
    if (selectedWeek === 0) {
      sum += colWidths.week || 60;
    }
    if (category !== 'SESSION' && isAllSelected) {
      sum += colWidths.track || 60;
    }
    if (isAllSelected && category !== 'SESSION') {
      sum += colWidths.teamName || 90;
    }
    if (category !== 'SESSION' && !isAllSelected) {
      sum += colWidths.track || 60;
    }
    // 관리 열은 수정 모드가 아니어도 자리를 잡아 둔다(수정을 눌러도 열이 다시 배치되지 않게).
    if (showsManageColumn) {
      sum += 40;
    }
    return Math.max(sum, 690);
  }, [
    category,
    selectedWeek,
    isAllSelected,
    showsManageColumn,
    colWidths,
    termPeriod,
    isWeekDirectEditable,
    weeks,
  ]);

  // 전체 스터디 표 최소 너비 계산 (각 컬럼이 정확히 합산되어 테이블 우측 여백이 남지 않도록)
  const studyAllTableMinWidth = useMemo(() => {
    let sum =
      (colWidths.study_all_index || 42) +
      (colWidths.study_all_term || 55) +
      (colWidths.study_all_track || 65) +
      (colWidths.study_all_name || 80) +
      (colWidths.study_all_score || 70);

    config.teams.forEach((team) => {
      const colKey = `study_all_col_${team.id}`;
      const defaultWidth = 160;
      const minWidth = 100;
      sum += Math.max(colWidths[colKey] || defaultWidth, minWidth);
    });

    return Math.max(sum, 780);
  }, [colWidths, config.teams]);

  // 각 스터디별 표 최소 너비 계산 (각 컬럼이 정확히 합산되어 테이블 우측 여백이 남지 않도록)
  const studyTeamTableMinWidth = useMemo(() => {
    let sum =
      (colWidths.study_team_index || 42) +
      (colWidths.study_team_term || 55) +
      (colWidths.study_team_name || 80) +
      (isMentoringStudy ? colWidths.study_team_type || 72 : 0) +
      (colWidths.study_team_attended || 85) +
      (colWidths.study_team_leader || 85) +
      (colWidths.study_team_score || 80);

    displayedMatrixWeeks.forEach((w) => {
      const rawDate = savedWeekDateMapping[w.weekNum]?.trim();
      const hasDate = Boolean(rawDate && rawDate !== '-');
      const colKey = `study_w_${w.weekNum}`;
      const minColWidth = hasDate ? 92 : 55;
      const defaultColWidth = hasDate ? 92 : 72;
      sum += Math.max(colWidths[colKey] || defaultColWidth, minColWidth);
    });

    return Math.max(sum, 720);
  }, [colWidths, displayedMatrixWeeks, savedWeekDateMapping, isMentoringStudy]);

  const matrixRows = useMemo(() => {
    return distinctMembers.map((member) => {
      const weekData: Record<
        number,
        { status: AttendStatus; memo?: string; checkedInAt?: string }
      > = {};
      let absenceCount = 0;
      let unexcusedAbsenceCount = 0;
      let lateEarlyLeaveCount = 0;
      let remoteCount = 0;

      currentTermWeeks.forEach((w) => {
        const currentWeekNum = w.weekNum;
        const cell = resolveStudyCell(member.teamId ?? '', currentWeekNum, member.id);
        const status: AttendStatus = cell?.status ?? 'unmarked';
        const memo: string | undefined = cell?.memo;
        const checkedInAt: string | undefined = '-';

        weekData[currentWeekNum] = { status, memo, checkedInAt };

        if (status === 'absent') {
          absenceCount++;
        } else if (status === 'unexcusedAbsent') {
          unexcusedAbsenceCount++;
        } else if (status === 'late' || status === 'earlyLeave' || status === 'unexcusedLate') {
          lateEarlyLeaveCount++;
        } else if (
          status === 'remote' ||
          (memo?.includes('비대면') ?? false) ||
          (memo?.includes('온라인') ?? false)
        ) {
          remoteCount++;
        }
      });

      // 총점은 점수 API가 계산한 값이다(스터디: 개근·수료·감점 + 팀장 가점, BASE·ADV: 감점 + 무단지각 3회 환산).
      const totalScore = apiScoreOf(member.teamId, member.id)?.totalScore ?? 0;

      return {
        id: member.id,
        name: member.name,
        term: member.term,
        track: member.track,
        teamId: member.teamId || '',
        teamName: member.teamName || '',
        weekData,
        absenceCount,
        unexcusedAbsenceCount,
        lateEarlyLeaveCount,
        remoteCount,
        totalScore,
        isConcurrent:
          shouldShowConcurrentColumn(category) &&
          isConcurrentBaseMember(
            member.originalId ?? member.id,
            member.teamId,
            member.cohort ?? viewCohort,
            membershipBaseTeams,
            membershipOtherTeams,
            studyMembers ?? {},
          ),
      };
    });
  }, [
    category,
    termPeriod,
    distinctMembers,
    membershipBaseTeams,
    membershipOtherTeams,
    studyMembers,
    viewCohort,
    currentTermWeeks,
    attendance,
    studyTeams,
    resolveStudyCell,
    apiScoreOf,
  ]);

  const filteredMatrixRows = useMemo(() => {
    let rows = matrixRows.filter((row) => {
      if (category !== 'STUDY' && effectiveTrackFilter !== 'ALL') {
        const matchesTrack = (t: string) => {
          if (effectiveTrackFilter === '엔지니어링' || effectiveTrackFilter === '엔지') {
            return t === '엔지니어링' || t === '엔지' || t.includes('엔지');
          }
          return t === effectiveTrackFilter;
        };
        if (!matchesTrack(row.track || '')) {
          return false;
        }
      }
      if (termFilter !== 'ALL') {
        if (`${row.term}` !== termFilter) {
          return false;
        }
      }
      if (attendeeSearch.trim()) {
        const q = attendeeSearch.toLowerCase();
        const match =
          (row.name || '').toLowerCase().includes(q) ||
          (row.track || '').toLowerCase().includes(q) ||
          (row.teamName || '').toLowerCase().includes(q) ||
          `${row.term || ''}`.includes(q);
        if (!match) {
          return false;
        }
      }
      if (attendStatusFilter !== 'ALL') {
        const hasStatus = displayedMatrixWeeks.some(
          (w) => row.weekData[w.weekNum]?.status === attendStatusFilter,
        );
        if (!hasStatus) {
          return false;
        }
      }
      return true;
    });

    if (category === 'STUDY') {
      rows = [...rows].sort((a, b) => {
        if ((a.term || 0) !== (b.term || 0)) {
          return (a.term || 0) - (b.term || 0);
        }
        return a.name.localeCompare(b.name, 'ko');
      });
    } else {
      if (sortOption === 'TERM_ASC') {
        rows = [...rows].sort(
          (a, b) => (a.term || 0) - (b.term || 0) || a.name.localeCompare(b.name, 'ko'),
        );
      } else if (sortOption === 'TERM_DESC') {
        rows = [...rows].sort(
          (a, b) => (b.term || 0) - (a.term || 0) || a.name.localeCompare(b.name, 'ko'),
        );
      } else if (sortOption === 'NAME_ASC') {
        rows = [...rows].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      }
    }

    if (category === 'SESSION') {
      rows = sortConcurrentMembersLast(rows);
    }

    return rows;
  }, [
    category,
    matrixRows,
    effectiveTrackFilter,
    termFilter,
    attendeeSearch,
    attendStatusFilter,
    displayedMatrixWeeks,
    sortOption,
  ]);

  const studyTeamRows = useMemo(() => {
    if (category !== 'STUDY') {
      return [];
    }
    if (isAllSelected) {
      return filteredMatrixRows;
    }
    const teamMembers = filteredMatrixRows.filter((r) => r.teamId === (selectedTeam?.id || ''));
    return [...teamMembers].sort((a, b) => {
      if ((a.term || 0) !== (b.term || 0)) {
        return (a.term || 0) - (b.term || 0);
      }
      return a.name.localeCompare(b.name, 'ko');
    });
  }, [category, isAllSelected, filteredMatrixRows, selectedTeam]);

  const displayedStudyTeamRows = useMemo(() => {
    if (!isMentoringStudy) {
      return studyTeamRows.map((row) => ({
        ...row,
        studyTypeLabel: null as '멘멘' | '친바' | null,
        studyTypeIndex: 0,
      }));
    }

    return studyTeamRows.flatMap((row) =>
      (['멘멘', '친바'] as const).map((studyTypeLabel, studyTypeIndex) => {
        const typedRowId = `${row.id}:${studyTypeLabel}`;
        const weekData = { ...row.weekData };

        currentTermWeeks.forEach((week) => {
          const synced = resolveStudyCell(row.teamId, week.weekNum, row.id, studyTypeLabel);
          if (synced) {
            weekData[week.weekNum] = { ...weekData[week.weekNum], ...synced };
            return;
          }
        });

        return {
          ...row,
          id: typedRowId,
          weekData,
          studyTypeLabel,
          studyTypeIndex,
          totalScore: apiScoreOf(row.teamId, row.id, studyTypeLabel)?.totalScore ?? row.totalScore,
        };
      }),
    );
  }, [
    category,
    currentTermWeeks,
    isMentoringStudy,
    studyTeamRows,
    termPeriod,
    attendance,
    studyTeams,
    resolveStudyCell,
    apiScoreOf,
  ]);

  /** 이 화면에서 바꾼 상태·비고를 공용 저장소(DB)에 저장한다. rawId는 멤버ID 또는 "멤버ID:멘멘"/"멤버ID:친바". */
  function reportStudyChange(rawId: string, weekNum: number, change: Partial<AttendanceChange>) {
    if (!isDbCategory || isArchivedView) return;
    const [memberId] = rawId.split(':');
    const teamId = attendees.find((a) => a.id === memberId)?.teamId;
    const team = studyTeams?.find((t) => t.id === teamId);
    if (!team) return;
    // 비고는 유형(멘멘/친바)과 관계없이 팀원 ID 하나에 저장한다.
    const isMemoOnly = change.memo !== undefined && change.status === undefined;
    onStudyAttendanceChange?.({
      teamId: team.id,
      weekNum,
      memberKey: isMemoOnly ? memberId : rawId,
      ...change,
    });
  }

  function handleStatusChange(attendeeId: string, newStatus: AttendStatus, targetWeekNum?: number) {
    if (isArchivedView) return;
    const rawId = attendeeId.includes('_w') ? attendeeId.split('_w')[0] : attendeeId;
    const targetWeek = targetWeekNum || (selectedWeek === 0 ? latestWeekNum : selectedWeek);
    reportStudyChange(rawId, targetWeek, { status: newStatus });
  }

  function handleMemoChange(attendeeId: string, memo: string, targetWeekNum?: number) {
    const targetWeek = targetWeekNum || (selectedWeek === 0 ? latestWeekNum : selectedWeek);
    reportStudyChange(attendeeId, targetWeek, { memo });
  }

  function handleDeleteAttendee(attendeeId: string) {
    if (!window.confirm('정말 이 부원을 명단에서 제외하시겠습니까?')) {
      return;
    }
    const memberId = attendeeId.split('_w')[0];
    const teamId = attendees.find((a) => a.id === memberId)?.teamId;
    if (teamId) onRemoveStudyMember?.(teamId, memberId);
  }

  const { defaultModalCols, previewRows, defaultExportFilename } = useMemo(() => {
    const periodLabel = termPeriod === 'VACATION' ? '방학' : '학기';

    if (category === 'STUDY') {
      if (!isAllSelected) {
        const teamNameClean = (selectedTeam?.name || '개별스터디').replace(/[^\w가-힣]/g, '_');
        const cols: ModalColItem[] = [
          {
            id: 'term',
            label: '기수',
            renderCell: (row) => (
              <span className="font-mono text-slate-600 text-xs px-3 whitespace-nowrap">
                {row?.term ?? 28}기
              </span>
            ),
            exportValue: (row) => `${row?.term ?? 28}기`,
          },
          {
            id: 'name',
            label: '이름',
            renderCell: (row) => (
              <span className="font-bold text-slate-900 text-xs px-4 whitespace-nowrap">
                {row?.name ?? ''}
              </span>
            ),
            exportValue: (row) => row?.name ?? '',
          },
          ...displayedMatrixWeeks.map((w) => {
            const rawDate = (savedWeekDateMapping[w.weekNum] || '')?.trim();
            const hasDate = Boolean(rawDate && rawDate !== '-');
            return {
              id: `w_${w.weekNum}`,
              label: hasDate ? rawDate : w.label,
              renderCell: (row: any) => {
                const cell = row?.weekData ? row.weekData[w.weekNum] : undefined;
                const st: AttendStatus = cell?.status || 'unmarked';
                const code = EXPORT_ATTEND_STATUS_CODE[st] || '-';
                const styleClass = EXPORT_ATTEND_STATUS_STYLE[st] || 'text-slate-300';
                return (
                  <span className={`font-mono text-xs whitespace-nowrap ${styleClass}`}>
                    {code}
                  </span>
                );
              },
              exportValue: (row: any) => {
                const st: AttendStatus = row?.weekData?.[w.weekNum]?.status || 'unmarked';
                return EXPORT_ATTEND_STATUS_CODE[st] || '-';
              },
            };
          }),
          {
            id: 'attendedCount',
            label: '참여 횟수',
            renderCell: (row) => (
              <span className="font-mono text-xs text-slate-800 font-bold whitespace-nowrap">
                {row?.attendedCount ?? 0}회
              </span>
            ),
            exportValue: (row) => `${row?.attendedCount ?? 0}회`,
          },
          {
            id: 'isLeader',
            label: '스터디장',
            renderCell: (row) => {
              const isLeader = row?.isLeader || row?.name === selectedTeam?.leader;
              return (
                <span
                  className={`text-xs font-bold font-mono whitespace-nowrap ${isLeader ? 'text-slate-900' : 'text-slate-300 font-normal'}`}
                >
                  {isLeader ? '1' : '-'}
                </span>
              );
            },
            exportValue: (row) => {
              const isLeader = row?.isLeader || row?.name === selectedTeam?.leader;
              return isLeader ? '1' : '-';
            },
          },
          {
            id: 'totalScore',
            label: '점수',
            renderCell: (row) => {
              const score = row?.totalScore ?? 0;
              return (
                <span
                  className={`font-bold font-mono whitespace-nowrap ${
                    score === 0
                      ? 'text-slate-400 font-medium'
                      : score < 0
                        ? 'text-rose-600'
                        : 'text-emerald-700'
                  }`}
                >
                  {score}
                </span>
              );
            },
            exportValue: (row) => String(row?.totalScore ?? 0),
          },
        ];
        return {
          defaultModalCols: cols,
          previewRows: studyTeamRows || [],
          defaultExportFilename: `BOAZ_스터디_${teamNameClean}_출결_${periodLabel}.csv`,
        };
      } else {
        const cols: ModalColItem[] = [
          {
            id: 'term',
            label: '기수',
            renderCell: (row) => (
              <span className="font-mono text-slate-600 text-xs px-3 whitespace-nowrap">
                {row?.term ?? 28}기
              </span>
            ),
            exportValue: (row) => `${row?.term ?? 28}기`,
          },
          {
            id: 'track',
            label: '부문',
            renderCell: (row) => (
              <span className="text-slate-600 text-xs px-3 whitespace-nowrap">
                {row?.track ?? ''}
              </span>
            ),
            exportValue: (row) => row?.track ?? '',
          },
          {
            id: 'name',
            label: '이름',
            renderCell: (row) => (
              <span className="font-bold text-slate-900 text-xs px-4 whitespace-nowrap">
                {row?.name ?? ''}
              </span>
            ),
            exportValue: (row) => row?.name ?? '',
          },
          ...(config.teams || []).map((team) => ({
            id: `team_${team.id}`,
            label: team.name,
            renderCell: (row: any) => {
              const isMember = row?.teamId === team.id;
              if (!isMember) {
                return <span className="text-slate-300 whitespace-nowrap">-</span>;
              }
              const sc = row?.totalScore ?? 0;
              return (
                <span
                  className={`font-bold font-mono whitespace-nowrap ${
                    sc === 0
                      ? 'text-slate-400 font-medium'
                      : sc < 0
                        ? 'text-rose-600'
                        : 'text-emerald-700'
                  }`}
                >
                  {sc}
                </span>
              );
            },
            exportValue: (row: any) => {
              const isMember = row?.teamId === team.id;
              if (!isMember) {
                return '-';
              }
              return String(row?.totalScore ?? 0);
            },
          })),
          {
            id: 'totalScore',
            label: '총점',
            renderCell: (row) => {
              const score = row?.totalScore ?? 0;
              return (
                <span
                  className={`font-bold font-mono whitespace-nowrap ${
                    score === 0
                      ? 'text-slate-400 font-medium'
                      : score < 0
                        ? 'text-rose-600'
                        : 'text-emerald-700'
                  }`}
                >
                  {score}
                </span>
              );
            },
            exportValue: (row) => String(row?.totalScore ?? 0),
          },
        ];
        return {
          defaultModalCols: cols,
          previewRows: filteredMatrixRows || [],
          defaultExportFilename: `BOAZ_스터디_전체통합_출결_${periodLabel}.csv`,
        };
      }
    } else if (category === 'ADV') {
      const cols: ModalColItem[] = [
        {
          id: 'term',
          label: '기수',
          renderCell: (row) => (
            <span className="font-mono text-slate-600 text-xs px-2 whitespace-nowrap">
              {row?.term ?? 28}기
            </span>
          ),
          exportValue: (row) => `${row?.term ?? 28}기`,
        },
        {
          id: 'name',
          label: '이름',
          renderCell: (row) => (
            <span className="font-bold text-slate-900 text-xs px-3 whitespace-nowrap">
              {row?.name ?? ''}
            </span>
          ),
          exportValue: (row) => row?.name ?? '',
        },
        {
          id: 'track',
          label: '부문',
          renderCell: (row) => (
            <span className="text-slate-600 text-xs px-2.5 whitespace-nowrap">
              {row?.track ?? ''}
            </span>
          ),
          exportValue: (row) => row?.track ?? '',
        },
        ...displayedMatrixWeeks.map((w) => {
          const rawDate = (savedWeekDateMapping[w.weekNum] || '')?.trim();
          const hasDate = Boolean(rawDate && rawDate !== '-');
          return {
            id: `w_${w.weekNum}`,
            label: hasDate ? rawDate : w.label,
            renderCell: (row: any) => {
              const cell = row?.weekData ? row.weekData[w.weekNum] : undefined;
              const st: AttendStatus = cell?.status || 'unmarked';
              const code = EXPORT_ATTEND_STATUS_CODE[st] || '-';
              const styleClass = EXPORT_ATTEND_STATUS_STYLE[st] || 'text-slate-300';
              return (
                <span className={`font-mono text-xs whitespace-nowrap ${styleClass}`}>{code}</span>
              );
            },
            exportValue: (row: any) => {
              const st: AttendStatus = row?.weekData?.[w.weekNum]?.status || 'unmarked';
              return EXPORT_ATTEND_STATUS_CODE[st] || '-';
            },
          };
        }),
        {
          id: 'absence',
          label: '결석',
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">{row?.absenceCount ?? 0}</span>
          ),
          exportValue: (row) => String(row?.absenceCount ?? 0),
        },
        {
          id: 'unexcusedAbsence',
          label: '무단결석',
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">
              {row?.unexcusedAbsenceCount ?? 0}
            </span>
          ),
          exportValue: (row) => String(row?.unexcusedAbsenceCount ?? 0),
        },
        {
          id: 'lateEarlyLeave',
          label: '지각조퇴',
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">
              {row?.lateEarlyLeaveCount ?? 0}
            </span>
          ),
          exportValue: (row) => String(row?.lateEarlyLeaveCount ?? 0),
        },
        {
          id: 'remote',
          label: '비대면 횟수',
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">{row?.remoteCount ?? 0}</span>
          ),
          exportValue: (row) => String(row?.remoteCount ?? 0),
        },
        {
          id: 'totalScore',
          label: '총점',
          renderCell: (row) => {
            const score = row?.totalScore ?? 0;
            return (
              <span
                className={`font-bold font-mono whitespace-nowrap ${
                  score === 0
                    ? 'text-slate-400 font-medium'
                    : score < 0
                      ? 'text-rose-600'
                      : 'text-emerald-700'
                }`}
              >
                {score}
              </span>
            );
          },
          exportValue: (row) => String(row?.totalScore ?? 0),
        },
        {
          id: 'concurrent',
          label: '병행 여부',
          renderCell: (row) => (
            <span
              className={`text-xs font-bold whitespace-nowrap ${
                row?.isConcurrent ? 'text-indigo-700' : 'text-slate-400'
              }`}
            >
              {row?.isConcurrent ? '병행' : '비병행'}
            </span>
          ),
          exportValue: (row) => (row?.isConcurrent ? '병행' : '비병행'),
        },
      ];
      return {
        defaultModalCols: cols,
        previewRows: filteredMatrixRows || [],
        defaultExportFilename: `BOAZ_ADV_출결통합집계_${periodLabel}.csv`,
      };
    } else {
      const trackNameClean = (selectedTeam?.name || '분석').replace(/[^\w가-힣]/g, '_');
      const cols: ModalColItem[] = [
        {
          id: 'term',
          label: '기수',
          renderCell: (row) => (
            <span className="font-mono text-slate-600 text-xs px-3 whitespace-nowrap">
              {row?.term ?? 28}기
            </span>
          ),
          exportValue: (row) => `${row?.term ?? 28}기`,
        },
        {
          id: 'track',
          label: '부문',
          renderCell: (row) => (
            <span className="px-3 text-xs font-medium whitespace-nowrap text-slate-600">
              {row?.track ?? '-'}
            </span>
          ),
          exportValue: (row) => row?.track ?? '-',
        },
        {
          id: 'name',
          label: '이름',
          renderCell: (row) => (
            <span className="font-bold text-slate-900 text-xs px-4 whitespace-nowrap">
              {row?.name ?? ''}
            </span>
          ),
          exportValue: (row) => row?.name ?? '',
        },
        ...displayedMatrixWeeks.map((w) => {
          const rawDate = (savedWeekDateMapping[w.weekNum] || '')?.trim();
          const hasDate = Boolean(rawDate && rawDate !== '-');
          return {
            id: `w_${w.weekNum}`,
            label: hasDate ? rawDate : w.label,
            renderCell: (row: any) => {
              const cell = row?.weekData ? row.weekData[w.weekNum] : undefined;
              const st: AttendStatus = cell?.status || 'unmarked';
              const code = EXPORT_ATTEND_STATUS_CODE[st] || '-';
              const styleClass = EXPORT_ATTEND_STATUS_STYLE[st] || 'text-slate-300';
              return (
                <span className={`font-mono text-xs whitespace-nowrap ${styleClass}`}>{code}</span>
              );
            },
            exportValue: (row: any) => {
              const st: AttendStatus = row?.weekData?.[w.weekNum]?.status || 'unmarked';
              return EXPORT_ATTEND_STATUS_CODE[st] || '-';
            },
          };
        }),
        {
          id: 'absence',
          label: '결석',
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">{row?.absenceCount ?? 0}</span>
          ),
          exportValue: (row) => String(row?.absenceCount ?? 0),
        },
        {
          id: 'unexcusedAbsence',
          label: '무단결석',
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">
              {row?.unexcusedAbsenceCount ?? 0}
            </span>
          ),
          exportValue: (row) => String(row?.unexcusedAbsenceCount ?? 0),
        },
        {
          id: 'lateEarlyLeave',
          label: '지각조퇴',
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">
              {row?.lateEarlyLeaveCount ?? 0}
            </span>
          ),
          exportValue: (row) => String(row?.lateEarlyLeaveCount ?? 0),
        },
        {
          id: 'totalScore',
          label: '총점',
          renderCell: (row) => {
            const score = row?.totalScore ?? 0;
            return (
              <span
                className={`font-bold font-mono whitespace-nowrap ${
                  score === 0
                    ? 'text-slate-400 font-medium'
                    : score < 0
                      ? 'text-rose-600'
                      : 'text-emerald-700'
                }`}
              >
                {score}
              </span>
            );
          },
          exportValue: (row) => String(row?.totalScore ?? 0),
        },
        ...(category === 'SESSION'
          ? [
              {
                id: 'concurrent',
                label: '병행 여부',
                renderCell: (row: { isConcurrent?: boolean }) => (
                  <span
                    className={`text-xs font-bold whitespace-nowrap ${
                      row?.isConcurrent ? 'text-indigo-700' : 'text-slate-400'
                    }`}
                  >
                    {row?.isConcurrent ? '병행' : '비병행'}
                  </span>
                ),
                exportValue: (row: { isConcurrent?: boolean }) =>
                  row?.isConcurrent ? '병행' : '비병행',
              },
            ]
          : []),
      ];
      return {
        defaultModalCols: cols,
        previewRows: filteredMatrixRows || [],
        defaultExportFilename: `BOAZ_BASE_${trackNameClean}_출결집계_${periodLabel}.csv`,
      };
    }
  }, [
    category,
    isAllSelected,
    displayedMatrixWeeks,
    savedWeekDateMapping,
    studyTeamRows,
    filteredMatrixRows,
    selectedTeam,
    termPeriod,
    config.teams,
  ]);

  const activeModalCols = useMemo(() => {
    if (!customColOrder) {
      return defaultModalCols;
    }
    const map = new Map(defaultModalCols.map((c) => [c.id, c]));
    const concurrentColumn = map.get('concurrent');
    map.delete('concurrent');
    const ordered: ModalColItem[] = [];
    customColOrder.forEach((id) => {
      if (id === 'concurrent') return;
      const item = map.get(id);
      if (item) {
        ordered.push(item);
        map.delete(id);
      }
    });
    map.forEach((item) => ordered.push(item));
    if (concurrentColumn) ordered.push(concurrentColumn);
    return ordered;
  }, [defaultModalCols, customColOrder]);

  function handleExportCsv() {
    const headers = activeModalCols.map((col) => col.label);
    const exportData = previewRows.map((row) => activeModalCols.map((col) => col.exportValue(row)));
    const csvContent =
      '\uFEFF' +
      [
        headers.join(','),
        ...exportData.map((row) => row.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')),
      ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', defaultExportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /** 팀 설정 변경 창을 연다. 팀 이름 칸은 화면 제목을 고친다(ADV는 study_name, 스터디는 team_name). */
  const openTeamSettings = (teamId: string) => {
    const info = (studyTeams ?? []).find((item) => item.id === teamId);
    setTeamSettingsTeamId(teamId);
    setTeamNameDraft((category === 'ADV' ? info?.studyName : info?.teamName) ?? '');
    setTeamSettingsMessage('');
  };

  /** 팀 카드의 휴지통 아이콘: 브라우저 확인 창으로 한 번 더 묻고 팀을 지운다. */
  const confirmAndDeleteTeam = async (teamId: string) => {
    if (!onDeleteTeam) return;
    const team = (studyTeams ?? []).find((info) => info.id === teamId);
    const confirmed = window.confirm(
      `${team ? `'${studyDisplayName(team)}'` : '이'} 팀을 정말 삭제할까요?
` + '출결 기록과 팀장 계정도 함께 삭제되며 되돌릴 수 없습니다.',
    );
    if (!confirmed || !(await onDeleteTeam(teamId))) return;
    if (selectedTeamId === teamId) {
      setSelectedTeamId('ALL');
      setIsPeekOpen(false);
    }
  };

  const teamSettingsButton = (team: TeamMeta) => (
    <div className="flex shrink-0 items-center">
      <Tooltip label="팀 설정" align="end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openTeamSettings(team.id);
          }}
          className="rounded-sm p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
          aria-label={`${team.name} 팀 설정`}
        >
          <Settings size={14} />
        </button>
      </Tooltip>
      {onDeleteTeam && (
        <Tooltip label="팀 삭제" align="end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void confirmAndDeleteTeam(team.id);
            }}
            className="rounded-sm p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
            aria-label={`${team.name} 팀 삭제`}
          >
            <Trash2 size={14} />
          </button>
        </Tooltip>
      )}
    </div>
  );

  const renderStudyTeamCard = (team: TeamMeta) => {
    const isSelected = selectedTeamId === team.id && isPeekOpen;

    return (
      <div
        key={team.id}
        onClick={() => {
          setSelectedTeamId(team.id);
          setIsPeekOpen(true);
        }}
        className={`relative rounded-2xl border transition-all cursor-pointer p-4 group select-none ${
          isSelected
            ? 'bg-slate-100/80 border-slate-300 shadow-2xs'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <h4
              className={`text-sm font-bold truncate ${
                isSelected
                  ? 'text-slate-950 font-bold'
                  : 'text-slate-900 group-hover:text-slate-950'
              }`}
            >
              {team.name}
            </h4>
            {team.leader && (
              <p className="text-[11px] text-slate-500 font-medium">스터디장: {team.leader}</p>
            )}
          </div>
          {category === 'STUDY' && !isArchivedView && teamSettingsButton(team)}
        </div>
      </div>
    );
  };

  // 보여줄 출결 기록이 하나도 없으면 표 없이 안내 글자만 보여 준다.
  const isTableEmpty =
    category === 'STUDY'
      ? isAllSelected
        ? filteredMatrixRows.length === 0
        : displayedStudyTeamRows.length === 0
      : isMatrixMode
        ? filteredMatrixRows.length === 0
        : filteredAttendees.length === 0;

  return (
    <div
      className="flex flex-col flex-1 h-full min-h-0 space-y-3 w-full"
      style={{
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      {/* ─── 1. Top Header & Global Actions ─── */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          <h2 className="text-slate-950 font-black text-lg sm:text-xl tracking-tight">
            {config.title}
          </h2>

          {/* 방학 / 학기 토글 버튼 (Segmented Control) */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs font-semibold select-none">
            <button
              type="button"
              onClick={() => {
                setTermPeriod('VACATION');
                setSelectedWeekVacation(0);
              }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                termPeriod === 'VACATION'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              방학
            </button>
            <button
              type="button"
              onClick={handleSelectSemesterTab}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                termPeriod === 'SEMESTER'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              학기
            </button>
          </div>
        </div>

        {/* 활동 기수 (맨 오른쪽): 기수를 고르면 그 기수의 출결만 보인다 */}
        <div className="flex items-center gap-2">
          <CohortSelect
            value={viewCohort}
            cohorts={cohortOptions}
            labels={cohortLabels}
            onChange={handleChangeCohort}
            canCreateNextSemester={canCreateNextSemester}
            onAdvanceSemester={onAdvanceSemester}
          />
        </div>
      </div>

      {/* ─── 2. 주차 선택 토글 바 (수평 스크롤 & 위치 완전 고정) ─── */}
      <div className="relative flex items-center shrink-0 w-full pt-0.5 pb-2.5">
        {/* Left Scroll Arrow Button */}
        {canScrollLeft && (
          <div className="absolute left-0 z-20 flex items-center h-full pr-4 bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={() => handleScrollWeeks('left')}
              className="pointer-events-auto w-6 h-6 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-50 transition-colors cursor-pointer"
              title="이전 주차 보기"
            >
              <ChevronLeft size={13} />
            </button>
          </div>
        )}

        {/* Scrollable Buttons Container: 버튼 너비 및 테두리 완전 고정 */}
        <div
          ref={weekScrollRef}
          onScroll={checkWeekScroll}
          className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 w-full flex-nowrap"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <button
            type="button"
            onClick={() => setSelectedWeek(0)}
            className={`w-[74px] h-[34px] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0 select-none ${
              selectedWeek === 0
                ? BRAND_SELECTED
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-white border border-slate-200/90 shadow-2xs'
            }`}
          >
            <span>전체 주차</span>
          </button>
          {weekList.map((w) => {
            const isActive = selectedWeek === w.weekNum;
            const isWeekFuture = isFutureWeekNum(w.weekNum);
            const isDisabledBeforeAdvTeamCreation =
              category === 'ADV' && !isAllSelected && w.weekNum <= ADV_DIRECT_SELECT_LAST_WEEK;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => handleSelectWeek(w.weekNum)}
                disabled={isDisabledBeforeAdvTeamCreation}
                title={
                  isDisabledBeforeAdvTeamCreation
                    ? 'ADV 팀 개설 전 주차는 팀별 출결을 조회할 수 없습니다.'
                    : undefined
                }
                className={`w-[58px] h-[34px] rounded-xl text-xs font-bold transition-colors flex items-center justify-center shrink-0 select-none ${
                  isDisabledBeforeAdvTeamCreation
                    ? 'cursor-not-allowed border border-slate-200/60 bg-slate-100/60 text-slate-300'
                    : isActive
                      ? BRAND_SELECTED
                      : isWeekFuture
                        ? 'cursor-pointer text-slate-400 hover:text-slate-700 bg-slate-50/70 border border-slate-200/70'
                        : 'cursor-pointer text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-white border border-slate-200/90 shadow-2xs'
                }`}
              >
                <span>{w.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Scroll Arrow Button */}
        {canScrollRight && (
          <div className="absolute right-0 z-20 flex items-center h-full pl-4 bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={() => handleScrollWeeks('right')}
              className="pointer-events-auto w-6 h-6 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-50 transition-colors cursor-pointer"
              title="다음 주차 보기"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {category === 'STUDY' && !isArchivedView && (
        <div className="flex shrink-0 items-center justify-end px-1">
          <CreateButton
            label="스터디"
            aria-label={`${termPeriod === 'VACATION' ? '방학' : '학기'} 스터디 생성`}
            onClick={openCreateStudyModal}
          />
        </div>
      )}

      {category === 'SESSION' && !isArchivedView && (
        <div className="flex shrink-0 items-center justify-end px-1">
          <CreateButton
            label="BASE"
            aria-label="BASE 출결 생성"
            onClick={() => setShowCreateAttendanceModal(true)}
          />
        </div>
      )}

      {category === 'ADV' && !isArchivedView && (
        <div className="flex shrink-0 items-center justify-end px-1">
          <CreateButton
            label="ADV"
            aria-label="ADV 팀 개설"
            onClick={() => setShowCreateAdvModal(true)}
          />
        </div>
      )}

      {/* ─── 3. Team-Centric Notion Split View ─── */}
      <div
        ref={containerRef}
        className={`relative w-full flex-1 min-h-0 transition-all ${
          isPeekOpen
            ? isFullScreen
              ? 'block h-full'
              : 'flex flex-row gap-0 h-full min-w-0'
            : 'block h-full'
        }`}
      >
        {/* ─── LEFT PANE: 팀별 목록 (Team List) ─── */}
        {(!isFullScreen || !isPeekOpen) && (
          <div
            style={{
              width: isPeekOpen ? `${splitRatio}%` : '100%',
              minWidth: isPeekOpen ? '200px' : undefined,
            }}
            className={`space-y-2.5 shrink-0 h-full overflow-y-auto ${isPeekOpen ? 'pr-1.5' : 'w-full'}`}
          >
            {/* Master '전체' 통합 Card (ADV 전용, STUDY는 일반 스터디 그룹에 표시) */}
            {category === 'ADV' && (
              <div
                onClick={() => {
                  setSelectedTeamId('ALL');
                  setIsPeekOpen(true);
                }}
                className={`relative rounded-2xl border transition-all cursor-pointer p-4 group select-none ${
                  isAllSelected && isPeekOpen
                    ? 'bg-slate-100/80 border-slate-300 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <h4
                      className={`text-sm font-bold truncate ${
                        isAllSelected && isPeekOpen
                          ? 'text-slate-950 font-bold'
                          : 'text-slate-900 group-hover:text-slate-800'
                      }`}
                    >
                      전체
                    </h4>
                  </div>

                  <ChevronRight
                    size={16}
                    className={`shrink-0 transition-transform ${
                      isAllSelected && isPeekOpen
                        ? 'text-slate-500 translate-x-0.5'
                        : 'text-slate-300 group-hover:text-slate-500'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Team Cards List */}
            {category === 'ADV' ? (
              <div className="space-y-4">
                {(['분석', '시각화', '엔지니어링'] as const).map((trackName) => {
                  const trackTeams = config.teams.filter((t) => t.track === trackName);

                  return (
                    <div key={trackName} className="space-y-2">
                      <div className="px-1 text-[11px] font-bold text-slate-400 select-none">
                        {trackName} 트랙
                      </div>

                      {trackTeams.length === 0 ? (
                        <p className="px-1 py-1 text-[11px] text-slate-400">
                          등록된 팀이 없습니다.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {trackTeams.map((team) => {
                            const isSelected = selectedTeamId === team.id && isPeekOpen;

                            return (
                              <div
                                key={team.id}
                                onClick={() => {
                                  setSelectedTeamId(team.id);
                                  setIsPeekOpen(true);
                                }}
                                className={`relative rounded-2xl border transition-all cursor-pointer p-3.5 group select-none ${
                                  isSelected
                                    ? 'bg-slate-100/80 border-slate-300 shadow-2xs'
                                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="space-y-1 min-w-0 flex-1">
                                    <h4
                                      className={`text-sm font-bold truncate ${
                                        isSelected
                                          ? 'text-slate-950 font-bold'
                                          : 'text-slate-900 group-hover:text-slate-950'
                                      }`}
                                    >
                                      {team.name}
                                    </h4>

                                    {team.leader && (
                                      <p className="text-[11px] text-slate-500 font-medium">
                                        팀장: {team.leader}
                                      </p>
                                    )}
                                  </div>

                                  {/* 지난 반기는 고칠 수 없어 설정 버튼 대신 이동 표시만 둔다. */}
                                  {isArchivedView ? (
                                    <ChevronRight
                                      size={16}
                                      className={`shrink-0 transition-transform ${
                                        isSelected
                                          ? 'text-slate-500 translate-x-0.5'
                                          : 'text-slate-300 group-hover:text-slate-500'
                                      }`}
                                    />
                                  ) : (
                                    teamSettingsButton(team)
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : category === 'STUDY' ? (
              <div className="space-y-5">
                {studyTeamGroups
                  .filter((group) => group.label !== '멘멘 스터디' || termPeriod === 'VACATION')
                  .map((group) => (
                    <section key={group.label} className="space-y-2.5">
                      <h3 className="px-1 text-[11px] font-bold text-slate-400 select-none">
                        {group.label}
                      </h3>
                      {group.label === '일반 스터디' && (
                        <div
                          onClick={() => {
                            setSelectedTeamId('ALL');
                            setIsPeekOpen(true);
                          }}
                          className={`relative rounded-2xl border transition-all cursor-pointer p-4 group select-none ${
                            isAllSelected && isPeekOpen
                              ? 'bg-slate-100/80 border-slate-300 shadow-2xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <h4
                              className={`min-w-0 flex-1 truncate text-sm font-bold ${
                                isAllSelected && isPeekOpen
                                  ? 'text-slate-950'
                                  : 'text-slate-900 group-hover:text-slate-800'
                              }`}
                            >
                              전체 스터디
                            </h4>
                            <ChevronRight
                              size={16}
                              className={`shrink-0 transition-transform ${
                                isAllSelected && isPeekOpen
                                  ? 'text-slate-500 translate-x-0.5'
                                  : 'text-slate-300 group-hover:text-slate-500'
                              }`}
                            />
                          </div>
                        </div>
                      )}
                      {group.label === '멘멘 스터디' ? (
                        <div className="space-y-4 pl-2">
                          {mentoringStudyTrackGroups.map((trackGroup) => (
                            <div key={trackGroup.label} className="space-y-2">
                              <h4 className="px-1 text-[11px] font-bold text-slate-500 select-none">
                                {trackGroup.label}
                              </h4>
                              {trackGroup.teams.length === 0 ? (
                                <p className="px-1 py-1 text-[11px] text-slate-400">
                                  등록된 스터디가 없습니다.
                                </p>
                              ) : (
                                <div className="space-y-2.5">
                                  {trackGroup.teams.map(renderStudyTeamCard)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : group.teams.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-center text-[11px] text-slate-400">
                          등록된 {group.label}가 없습니다.
                        </div>
                      ) : (
                        <div className="space-y-2.5">{group.teams.map(renderStudyTeamCard)}</div>
                      )}
                    </section>
                  ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {availableTeams.map((team) => {
                  const isSelected = selectedTeamId === team.id && isPeekOpen;

                  return (
                    <div
                      key={team.id}
                      onClick={() => {
                        setSelectedTeamId(team.id);
                        setIsPeekOpen(true);
                      }}
                      className={`relative rounded-2xl border transition-all cursor-pointer p-4 group select-none ${
                        isSelected
                          ? 'bg-slate-100/80 border-slate-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <h4
                            className={`text-sm font-bold truncate ${
                              isSelected
                                ? 'text-slate-950 font-bold'
                                : 'text-slate-900 group-hover:text-slate-950'
                            }`}
                          >
                            {team.name}
                          </h4>

                          {category !== 'SESSION' && team.leader && (
                            <p className="text-[11px] text-slate-500 font-medium">
                              {category === 'STUDY' ? '스터디장' : '팀장'}: {team.leader}
                            </p>
                          )}
                        </div>

                        <ChevronRight
                          size={16}
                          className={`shrink-0 transition-transform ${
                            isSelected
                              ? 'text-slate-500 translate-x-0.5'
                              : 'text-slate-300 group-hover:text-slate-500'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── RESIZABLE DRAGGER / DIVIDER BAR ─── */}
        {isPeekOpen && !isFullScreen && (
          <div
            onMouseDown={handleDividerMouseDown}
            onTouchStart={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            className={`flex w-4 shrink-0 -mx-0.5 items-center justify-center cursor-col-resize group self-stretch z-20 select-none py-12 transition-colors ${
              isDragging ? 'bg-slate-200/50' : 'hover:bg-slate-100/80'
            }`}
            title="마우스로 드래그하여 패널 너비 조절"
          >
            <div
              className={`w-1 h-14 rounded-full transition-all flex flex-col items-center justify-center ${
                isDragging
                  ? 'bg-slate-700 h-20'
                  : 'bg-slate-300 group-hover:bg-slate-500 group-hover:h-16'
              }`}
            >
              <GripVertical
                size={10}
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        )}

        {/* ─── RIGHT PANE: 인원 목록 & 활동 사진 (Side Peek Detail) ─── */}
        {isPeekOpen && (
          <div
            style={{
              width: isFullScreen ? '100%' : `${100 - splitRatio}%`,
              minWidth: isFullScreen ? undefined : '340px',
            }}
            className="rounded-md border border-slate-200/90 bg-white p-6 lg:p-7 shadow-sm space-y-4 animate-in slide-in-from-right duration-150 min-w-0 flex-1 h-full overflow-y-auto [scrollbar-gutter:stable]"
          >
            {/* Peek Detail Header */}
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-snug truncate">
                  {selectedTeam.name}
                </h3>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer hidden sm:flex items-center gap-0.5 text-xs font-semibold"
                  title={isFullScreen ? '분할 뷰로 축소' : '전체 화면으로 확장'}
                >
                  {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPeekOpen(false);
                    setIsFullScreen(false);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-0.5 text-xs font-semibold"
                  title="사이드 패널 닫기"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>

            {/* Photo Section: 원래처럼 사진만 깔끔하게 노출 */}
            {(() => {
              const studyTeamId = selectedTeam.id;
              const currentWeekKey = selectedWeek === 0 ? latestWeekNum : selectedWeek;
              const teamUploadedPhoto =
                category === 'STUDY' || category === 'ADV'
                  ? attendance?.[sessionKey(`w${currentWeekKey}`, 'study', studyTeamId)]?.photoUrl
                  : undefined;
              const currentDisplayPhoto = teamUploadedPhoto || '';

              if (selectedWeek === 0 || isAllSelected || category === 'SESSION') {
                return null;
              }

              if (!currentDisplayPhoto) {
                return (
                  <div className="flex w-full justify-center py-1">
                    <div className="flex h-24 w-full max-w-[540px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-sm font-medium text-slate-400">
                      등록된 사진이 없습니다.
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex justify-center w-full py-1">
                  <div
                    onClick={() =>
                      setZoomPhoto({ url: currentDisplayPhoto, weekLabel: `${currentWeekKey}주차` })
                    }
                    className="relative group w-fit max-w-[480px] sm:max-w-[540px] rounded-md overflow-hidden border border-slate-200/90 bg-white shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-300 cursor-zoom-in select-none"
                    title="클릭하여 원본 사진 크게 보기"
                  >
                    <img
                      src={currentDisplayPhoto}
                      alt={`${selectedTeam.name} ${selectedWeek === 0 ? '활동' : `${selectedWeek}주차`} 사진`}
                      className="w-full h-auto max-h-56 sm:max-h-64 object-contain block transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                    />
                  </div>
                </div>
              );
            })()}

            {/* 멘멘 스터디: 해당 주차에 첨부된 PDF 자료 */}
            {(() => {
              if (
                category !== 'STUDY' ||
                selectedWeek === 0 ||
                isAllSelected ||
                selectedTeam.studyKind !== 'MENTORING'
              ) {
                return null;
              }
              const record = attendance?.[sessionKey(`w${selectedWeek}`, 'study', selectedTeam.id)];
              return (
                <div className="flex w-full justify-center py-1">
                  {record?.pdfUrl ? (
                    <div className="flex h-14 w-full max-w-[540px] items-center gap-3 rounded-sm border border-slate-200 bg-white px-4 shadow-2xs">
                      <Folder
                        size={20}
                        strokeWidth={1.3}
                        className="shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPdfPreview({
                            url: record.pdfUrl ?? '',
                            name: record.pdfName ?? 'PDF 자료',
                          })
                        }
                        className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-slate-800 hover:underline"
                        title={`${record.pdfName ?? 'PDF 자료'}${record.pdfSize ? ` (${record.pdfSize})` : ''} 미리보기`}
                      >
                        {record.pdfName ?? 'PDF 자료'}
                      </button>
                      <Check
                        size={20}
                        strokeWidth={2.4}
                        className="shrink-0 text-emerald-500"
                        aria-label="업로드 완료"
                      />
                    </div>
                  ) : (
                    <div className="flex h-14 w-full max-w-[540px] items-center gap-3 rounded-sm border border-dashed border-slate-300 bg-white px-4">
                      <Folder
                        size={20}
                        strokeWidth={1.3}
                        className="shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-500">
                        등록된 파일이 없습니다
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 출결 기록이 없으면 제목·필터·CSV 버튼도 함께 숨긴다 */}
            {!isTableEmpty && (
              <>
                {/* Table Header Summary: 자연스러운 여백 및 트랙 필터 / 기수 필터 / 정렬 / CSV 추출 버튼 */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5 pb-1 px-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">
                      {category === 'STUDY'
                        ? isAllSelected
                          ? termPeriod === 'VACATION'
                            ? selectedWeek === 0
                              ? '방학 전체 스터디 명단'
                              : `방학 ${selectedWeek}주차 스터디 명단`
                            : selectedWeek === 0
                              ? '학기 전체 스터디 명단'
                              : `학기 ${selectedWeek}주차 스터디 명단`
                          : `${selectedTeam?.name || '스터디'} (${
                              termPeriod === 'VACATION'
                                ? selectedWeek === 0
                                  ? '방학 전체'
                                  : `방학 ${selectedWeek}주차`
                                : selectedWeek === 0
                                  ? '학기 전체'
                                  : `학기 ${selectedWeek}주차`
                            }) 출결 명단`
                        : termPeriod === 'VACATION'
                          ? selectedWeek === 0
                            ? '방학 전체 (1~8주차)'
                            : `방학 ${selectedWeek}주차`
                          : selectedWeek === 0
                            ? '학기 전체 (9~16주차)'
                            : `학기 ${selectedWeek}주차`}{' '}
                      {category !== 'STUDY' && '출결 명단'}
                    </h4>

                    {/* Track Filter Pill Buttons (스터디 및 BASE 출결에서는 숨김) */}
                    {category !== 'STUDY' && category !== 'SESSION' && shouldApplyTrackFilter && (
                      <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold select-none shadow-2xs">
                        {TRACK_FILTER_OPTIONS.map((tf) => {
                          const isSelected = selectedTrackFilter === tf.id;
                          return (
                            <button
                              key={tf.id}
                              type="button"
                              onClick={() => setSelectedTrackFilter(tf.id)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-white text-slate-950 shadow-xs border border-slate-200/60'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {tf.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* CSV 추출 버튼: 전체 주차일 때 표시 (단, ADV 팀별 탭은 제외) */}
                    {selectedWeek === 0 && !(category === 'ADV' && !isAllSelected) && (
                      // 아이콘만 있는 버튼(옆의 연필 버튼과 같은 모양). 마우스를 올리면 바로 'CSV 추출'이 뜬다.
                      <Tooltip label="CSV 추출">
                        <button
                          type="button"
                          onClick={handleOpenSettingsModal}
                          className="inline-flex size-8 cursor-pointer items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                          aria-label="CSV 추출"
                        >
                          <Download size={14} aria-hidden="true" />
                        </button>
                      </Tooltip>
                    )}

                    {/* 수정 버튼: BASE·ADV 팀별 탭 & 스터디 개별 탭에서 전체 주차일 때 표시 */}
                    {!isAllSelected &&
                      !isArchivedView &&
                      selectedWeek === 0 &&
                      (category === 'SESSION' || category === 'ADV' || category === 'STUDY') && (
                        <Tooltip label={isTableEditMode ? '적용' : '전체 수정'}>
                          <button
                            type="button"
                            onClick={() => setIsTableEditMode((prev) => !prev)}
                            // 아이콘만 있는 버튼: 평소에는 연필(전체 수정), 수정 중에는 체크(적용).
                            // 마우스를 올리면 하는 일이 바로 글자로 뜬다. 두 상태의 크기는 같다.
                            aria-pressed={isTableEditMode}
                            aria-label={isTableEditMode ? '적용' : '전체 수정'}
                            className={`inline-flex size-8 cursor-pointer items-center justify-center rounded-sm transition-colors ${
                              isTableEditMode
                                ? 'bg-slate-100 text-slate-800 hover:bg-slate-200/70'
                                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
                            }`}
                          >
                            {isTableEditMode ? (
                              <Check size={15} strokeWidth={2} aria-hidden="true" />
                            ) : (
                              <Edit3 size={14} aria-hidden="true" />
                            )}
                          </button>
                        </Tooltip>
                      )}

                    {/* 주차 제출 버튼: BASE는 진행 중인 주차, ADV는 3주차까지(지난 주차는 제출 완료 표시)의 팀별 화면 */}
                    {!isAllSelected &&
                      showsSubmitControl(selectedWeek) &&
                      (isWeekSubmittedInDb(selectedTeam.id, selectedWeek) ? (
                        <span className="text-xs font-medium text-slate-500 select-none">
                          {editingWeekKey ===
                          submissionKey(viewCohort, selectedTeam.id, selectedWeek)
                            ? '수정 중'
                            : '제출 완료'}
                        </span>
                      ) : (
                        // 제출: 종이비행기 아이콘 버튼(다른 아이콘 버튼처럼 배경 없음, 아이콘은 조금 더 진하게).
                        <Tooltip label={isSubmittingWeek ? '제출 중' : '제출'} align="end">
                          <button
                            type="button"
                            disabled={isSubmittingWeek}
                            onClick={handleSubmitWeek}
                            aria-label={isSubmittingWeek ? '제출 중' : '제출'}
                            className="inline-flex size-8 cursor-pointer items-center justify-center rounded-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-wait disabled:opacity-60"
                          >
                            <Send size={14} aria-hidden="true" />
                          </button>
                        </Tooltip>
                      ))}
                  </div>
                </div>
              </>
            )}

            {/* Table Container: 상단 모서리 깨짐 없는 깔끔한 솔리드 라운드 박스 */}
            {isTableEmpty ? (
              <div className="flex min-h-[50vh] items-center justify-center">
                <p className="text-center text-sm font-medium text-slate-400">
                  등록된 출결 기록이 없습니다
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div ref={tableContainerRef} className="overflow-x-auto select-none relative">
                  {category === 'STUDY' ? (
                    isAllSelected ? (
                      /* ─── 전체 스터디 테이블 ─── */
                      /* 컬럼: 기수, 부문, 이름, 각 스터디명 컬럼들 (누적 점수 표시), 총점 */
                      <table
                        className="w-full text-xs table-fixed border-collapse"
                        style={{ minWidth: `${studyAllTableMinWidth}px` }}
                      >
                        <thead className="bg-slate-50/80 select-none">
                          <tr className="border-b border-slate-200 divide-x divide-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                            <th
                              style={{ width: `${colWidths.study_all_index || 42}px` }}
                              className="relative text-center px-1 py-1 text-slate-500 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">#</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'study_all_index', 35)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('study_all_index');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                            <th
                              style={{ width: `${colWidths.study_all_term || 55}px` }}
                              className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">기수</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'study_all_term', 45)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('study_all_term');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                            <th
                              style={{ width: `${colWidths.study_all_track || 65}px` }}
                              className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">부문</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'study_all_track', 55)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('study_all_track');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                            <th
                              style={{ width: `${colWidths.study_all_name || 80}px` }}
                              className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">이름</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'study_all_name', 60)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('study_all_name');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                            {config.teams.map((team) => {
                              const colKey = `study_all_col_${team.id}`;
                              const defaultWidth = 160;
                              const minWidth = 100;
                              const effectiveWidth = Math.max(
                                colWidths[colKey] || defaultWidth,
                                minWidth,
                              );

                              return (
                                <th
                                  key={team.id}
                                  style={{ width: `${effectiveWidth}px` }}
                                  className="relative text-center px-2 py-1 text-slate-800 font-bold bg-slate-50/80"
                                >
                                  <div className="h-9 flex flex-col items-center justify-center px-1">
                                    <span
                                      className="font-bold text-xs truncate max-w-full"
                                      title={team.name}
                                    >
                                      {team.name}
                                    </span>
                                  </div>
                                  <div
                                    onMouseDown={(e) => handleResizeStart(e, colKey, minWidth)}
                                    onMouseEnter={(e) => {
                                      if (!resizingColKey) {
                                        setActiveHoverCol(colKey);
                                        updateGuidelinePos(e.currentTarget);
                                      }
                                    }}
                                    onMouseLeave={() => {
                                      if (!resizingColKey) {
                                        setActiveHoverCol(null);
                                        setGuidelineX(null);
                                      }
                                    }}
                                    className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                    title="열 너비 조절"
                                  />
                                </th>
                              );
                            })}
                            <th
                              style={{ width: `${colWidths.study_all_score || 70}px` }}
                              className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center font-bold text-xs">
                                총점
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'study_all_score', 55)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('study_all_score');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {filteredMatrixRows.map((row, idx) => (
                            <tr
                              key={row.id}
                              className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-200 h-[46px]"
                            >
                              <td className="relative px-1 py-1.5 text-center text-slate-400 text-[11px]">
                                <div className="h-8 flex items-center justify-center">
                                  {idx + 1}
                                </div>
                              </td>
                              <td className="relative px-1.5 py-1.5 text-center text-slate-600 text-xs">
                                <div className="h-8 flex items-center justify-center">
                                  {row.term}기
                                </div>
                              </td>
                              <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs font-sans font-medium">
                                <div className="h-8 flex items-center justify-center">
                                  {row.track}
                                </div>
                              </td>
                              <td className="relative px-2 py-1.5 text-center font-bold text-slate-900 text-xs font-sans">
                                <div className="h-8 flex items-center justify-center">
                                  {row.name}
                                </div>
                              </td>
                              {config.teams.map((team) => {
                                const isMember = row.teamId === team.id;

                                return (
                                  <td
                                    key={team.id}
                                    className="relative text-center px-1.5 py-1.5 font-mono bg-white"
                                  >
                                    <div className="h-8 flex items-center justify-center">
                                      {isMember ? (
                                        <span
                                          className={`text-xs font-bold ${
                                            row.totalScore === 0
                                              ? 'text-slate-400 font-medium'
                                              : row.totalScore < 0
                                                ? 'text-rose-600 font-bold'
                                                : 'text-emerald-700 font-bold'
                                          }`}
                                        >
                                          {row.totalScore > 0
                                            ? `+${row.totalScore}점`
                                            : `${row.totalScore}점`}
                                        </span>
                                      ) : (
                                        <span className="text-slate-200 font-mono">-</span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="relative text-center px-2 py-1.5 font-bold font-mono bg-slate-50/60">
                                <div className="h-8 flex items-center justify-center">
                                  <span
                                    className={`text-xs font-bold ${
                                      row.totalScore === 0
                                        ? 'text-slate-400 font-medium'
                                        : row.totalScore < 0
                                          ? 'text-rose-600 font-bold'
                                          : 'text-emerald-700 font-bold'
                                    }`}
                                  >
                                    {row.totalScore > 0
                                      ? `+${row.totalScore}점`
                                      : `${row.totalScore}점`}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      /* ─── 각 스터디별 테이블 ─── */
                      /* 컬럼: 기수, 이름, 1주차~8주차, 참여 횟수, 스터디장, 점수 */
                      <table
                        className="w-full text-xs table-fixed border-collapse"
                        style={{ minWidth: `${studyTeamTableMinWidth}px` }}
                      >
                        <thead className="bg-slate-50/80 select-none">
                          <tr className="border-b border-slate-200 divide-x divide-slate-50 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                            <th
                              style={{ width: `${colWidths.study_team_index || 42}px` }}
                              className="relative text-center px-1 py-1 text-slate-500 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">#</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'study_team_index', 35)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('study_team_index');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                            <th
                              style={{ width: `${colWidths.study_team_term || 55}px` }}
                              className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">기수</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'study_team_term', 45)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('study_team_term');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                            <th
                              style={{ width: `${colWidths.study_team_name || 80}px` }}
                              className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">이름</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'study_team_name', 60)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('study_team_name');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                            {isMentoringStudy && (
                              <th
                                style={{ width: `${colWidths.study_team_type || 72}px` }}
                                className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                              >
                                <div className="h-9 flex items-center justify-center">유형</div>
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, 'study_team_type', 60)}
                                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                  title="열 너비 조절"
                                />
                              </th>
                            )}
                            {displayedMatrixWeeks.map((w) => {
                              const rawDate = savedWeekDateMapping[w.weekNum]?.trim();
                              const hasDate = Boolean(rawDate && rawDate !== '-');
                              const colKey = `study_w_${w.weekNum}`;
                              const minColWidth = hasDate ? 92 : 55;
                              const defaultColWidth = hasDate ? 92 : 72;
                              const effectiveColWidth = Math.max(
                                colWidths[colKey] || defaultColWidth,
                                minColWidth,
                              );
                              return (
                                <th
                                  key={w.id}
                                  style={{ width: `${effectiveColWidth}px` }}
                                  className="relative text-center px-1.5 py-1 text-slate-900 font-bold bg-slate-50/80"
                                >
                                  <div className="h-9 flex flex-col items-center justify-center">
                                    {hasDate ? (
                                      <>
                                        <div className="font-mono font-bold text-slate-900 text-xs leading-none">
                                          {rawDate}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                                          {w.label}
                                        </div>
                                      </>
                                    ) : (
                                      <div className="font-bold text-slate-900 text-xs leading-none">
                                        {w.label}
                                      </div>
                                    )}
                                  </div>
                                  <div
                                    onMouseDown={(e) => handleResizeStart(e, colKey, minColWidth)}
                                    onMouseEnter={(e) => {
                                      if (!resizingColKey) {
                                        setActiveHoverCol(colKey);
                                        updateGuidelinePos(e.currentTarget);
                                      }
                                    }}
                                    onMouseLeave={() => {
                                      if (!resizingColKey) {
                                        setActiveHoverCol(null);
                                        setGuidelineX(null);
                                      }
                                    }}
                                    className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                    title="열 너비 조절"
                                  />
                                </th>
                              );
                            })}
                            <th
                              style={{ width: `${colWidths.study_team_attended || 85}px` }}
                              className="relative text-center px-2 py-1 text-slate-700 font-semibold bg-slate-50/80"
                            >
                              <div className="h-9 flex items-center justify-center">참여 횟수</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'study_team_attended', 60)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('study_team_attended');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                            <th
                              style={{ width: `${colWidths.study_team_leader || 85}px` }}
                              className="relative text-center px-2 py-1 text-slate-700 font-semibold bg-slate-50/80"
                            >
                              <div className="h-9 flex items-center justify-center">스터디장</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'study_team_leader', 60)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('study_team_leader');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                            <th
                              style={{ width: `${colWidths.study_team_score || 80}px` }}
                              className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">점수</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'study_team_score', 60)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('study_team_score');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {displayedStudyTeamRows.map((row, idx) => {
                            const isLeader =
                              row.name === selectedTeam?.leader &&
                              (!isMentoringStudy || row.studyTypeIndex === 0);
                            const attendedCount = currentTermWeeks.filter(
                              (w) => row.weekData[w.weekNum]?.status === 'present',
                            ).length;
                            // 주차를 고르면 그 주차의 점수(점수 API의 주차별 점수)를 보여 준다.
                            const effectiveScore =
                              selectedWeek === 0
                                ? row.totalScore
                                : (apiScoreOf(
                                    row.teamId,
                                    row.id.split(':')[0],
                                    row.studyTypeLabel,
                                  )?.weeks.find((week) => week.weekNum === selectedWeek)?.points ??
                                  0);

                            const isFirstTypeRow = !isMentoringStudy || row.studyTypeIndex === 0;
                            const isLastTypeRow = isMentoringStudy && row.studyTypeIndex === 1;

                            return (
                              <tr
                                key={row.id}
                                className={`hover:bg-slate-50/70 transition-colors divide-x divide-slate-50 h-[46px] ${
                                  isLastTypeRow ? '[&>td]:border-b [&>td]:border-b-slate-300' : ''
                                }`}
                              >
                                {isFirstTypeRow && (
                                  <>
                                    <td
                                      rowSpan={isMentoringStudy ? 2 : 1}
                                      className={`relative px-1 py-1.5 text-center text-slate-400 text-[11px] bg-white ${
                                        isMentoringStudy ? 'border-b border-b-slate-300' : ''
                                      }`}
                                    >
                                      <div className="h-8 flex items-center justify-center">
                                        {isMentoringStudy ? Math.floor(idx / 2) + 1 : idx + 1}
                                      </div>
                                    </td>
                                    <td
                                      rowSpan={isMentoringStudy ? 2 : 1}
                                      className={`relative px-1.5 py-1.5 text-center text-slate-600 text-xs bg-white ${
                                        isMentoringStudy ? 'border-b border-b-slate-300' : ''
                                      }`}
                                    >
                                      <div className="h-8 flex items-center justify-center">
                                        {row.term}기
                                      </div>
                                    </td>
                                    <td
                                      rowSpan={isMentoringStudy ? 2 : 1}
                                      className={`relative px-2 py-1.5 text-center font-bold text-slate-900 text-xs font-sans bg-white ${
                                        isMentoringStudy ? 'border-b border-b-slate-300' : ''
                                      }`}
                                    >
                                      <div className="h-8 flex items-center justify-center">
                                        {row.name}
                                      </div>
                                    </td>
                                  </>
                                )}
                                {isMentoringStudy && (
                                  <td className="relative px-2 py-1.5 text-center font-bold text-slate-700 text-xs font-sans">
                                    {row.studyTypeLabel}
                                  </td>
                                )}
                                {displayedMatrixWeeks.map((w) => {
                                  const cell = row.weekData[w.weekNum];
                                  const st = cell?.status || 'unmarked';
                                  const cfg = ATTEND_STATUS_CFG[st] || ATTEND_STATUS_CFG.unmarked;
                                  const rawDate = savedWeekDateMapping[w.weekNum]?.trim();
                                  const hasDate = Boolean(rawDate && rawDate !== '-');

                                  return (
                                    <td
                                      key={w.id}
                                      className="relative text-center px-1 py-1.5 font-sans"
                                    >
                                      <div className="h-8 flex items-center justify-center w-full">
                                        {isTableEditMode && st !== 'unmarked' ? (
                                          (() => {
                                            const isOpen =
                                              activeStudyEditCell?.rowId === row.id &&
                                              activeStudyEditCell?.weekNum === w.weekNum;
                                            const isRightEdge = w.weekNum >= 7;
                                            const isLastRow =
                                              idx >= displayedStudyTeamRows.length - 1;
                                            const isFirstRow = idx === 0;
                                            const vAlignClass = isLastRow
                                              ? 'bottom-0'
                                              : isFirstRow
                                                ? 'top-0'
                                                : 'top-1/2 -translate-y-1/2';

                                            return (
                                              <div className="relative flex items-center justify-center">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setActiveStudyEditCell(
                                                      isOpen
                                                        ? null
                                                        : { rowId: row.id, weekNum: w.weekNum },
                                                    )
                                                  }
                                                  className={`w-[56px] h-[26px] rounded-md text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center justify-between px-1.5 border ${
                                                    isOpen
                                                      ? 'bg-white border-slate-800 ring-2 ring-slate-200 shadow-xs'
                                                      : 'bg-white border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                                                  }`}
                                                >
                                                  <span
                                                    className={
                                                      st === 'present'
                                                        ? 'text-emerald-700'
                                                        : 'text-rose-600'
                                                    }
                                                  >
                                                    {st === 'present' ? '출석' : '결석'}
                                                  </span>
                                                  <ChevronRight
                                                    size={10}
                                                    className={`text-slate-400 transition-transform duration-150 ${isOpen ? 'text-slate-800' : ''}`}
                                                  />
                                                </button>

                                                {isOpen && (
                                                  <>
                                                    {/* Backdrop to close on click outside */}
                                                    <div
                                                      className="fixed inset-0 z-40"
                                                      onClick={() => setActiveStudyEditCell(null)}
                                                    />
                                                    {/* Modern Compact Popover Dropdown (Right-aligned) */}
                                                    <div
                                                      className={`absolute ${isRightEdge ? 'right-full mr-1' : 'left-full ml-1'} ${vAlignClass} w-[78px] bg-white rounded-md shadow-lg border border-slate-200 p-0.5 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans`}
                                                    >
                                                      <div className="space-y-0.5">
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            if (
                                                              confirmStatusEdit(
                                                                `${row.name} ${w.label}`,
                                                                st,
                                                                'present',
                                                              )
                                                            ) {
                                                              handleStatusChange(
                                                                row.id,
                                                                'present',
                                                                w.weekNum,
                                                              );
                                                            }
                                                            setActiveStudyEditCell(null);
                                                          }}
                                                          className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                                                            st === 'present'
                                                              ? 'bg-emerald-50 text-emerald-700 font-bold'
                                                              : 'text-slate-700 font-medium hover:bg-slate-50 hover:text-emerald-700'
                                                          }`}
                                                        >
                                                          <span>출석</span>
                                                          {st === 'present' && (
                                                            <Check
                                                              size={11}
                                                              className="text-emerald-600 stroke-[2.5]"
                                                            />
                                                          )}
                                                        </button>

                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            if (
                                                              confirmStatusEdit(
                                                                `${row.name} ${w.label}`,
                                                                st,
                                                                'absent',
                                                              )
                                                            ) {
                                                              handleStatusChange(
                                                                row.id,
                                                                'absent',
                                                                w.weekNum,
                                                              );
                                                            }
                                                            setActiveStudyEditCell(null);
                                                          }}
                                                          className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                                                            st === 'absent'
                                                              ? 'bg-rose-50 text-rose-600 font-bold'
                                                              : 'text-slate-700 font-medium hover:bg-slate-50 hover:text-rose-600'
                                                          }`}
                                                        >
                                                          <span>결석</span>
                                                          {st === 'absent' && (
                                                            <Check
                                                              size={11}
                                                              className="text-rose-600 stroke-[2.5]"
                                                            />
                                                          )}
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            );
                                          })()
                                        ) : (
                                          <div className="relative w-[66px] h-[30px] flex items-center justify-center">
                                            <span
                                              title={`${row.name} - ${w.label}${hasDate ? ` (${rawDate})` : ''}: ${cfg.label}${cell?.memo ? `\n비고: ${cell.memo}` : ''}`}
                                              className={`text-xs whitespace-nowrap select-none font-bold ${
                                                st === 'present'
                                                  ? 'text-emerald-700'
                                                  : st === 'late' || st === 'earlyLeave'
                                                    ? 'text-amber-700'
                                                    : st === 'absent'
                                                      ? 'text-rose-600'
                                                      : st === 'excusedAbsent'
                                                        ? 'text-blue-700'
                                                        : st === 'remote'
                                                          ? 'text-indigo-700'
                                                          : st === 'unexcusedLate'
                                                            ? 'text-orange-700'
                                                            : st === 'unexcusedAbsent'
                                                              ? 'text-red-700'
                                                              : 'text-slate-400 font-medium'
                                              }`}
                                            >
                                              {cfg.label}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                                <td className="relative px-2 py-1.5 text-center text-xs font-sans font-bold text-slate-800">
                                  <div className="h-8 flex items-center justify-center font-mono">
                                    {attendedCount}회
                                  </div>
                                </td>
                                {isFirstTypeRow && (
                                  <>
                                    <td
                                      rowSpan={isMentoringStudy ? 2 : 1}
                                      className={`relative border-l border-slate-50 px-2 py-1.5 text-center text-xs font-sans bg-white ${
                                        isMentoringStudy ? 'border-b border-b-slate-300' : ''
                                      }`}
                                    >
                                      <div className="h-8 flex items-center justify-center font-mono">
                                        {isLeader ? (
                                          <span className="text-xs font-bold text-slate-900">
                                            O
                                          </span>
                                        ) : (
                                          <span className="text-slate-200">-</span>
                                        )}
                                      </div>
                                    </td>
                                    <td
                                      rowSpan={isMentoringStudy ? 2 : 1}
                                      className={`relative border-l border-slate-50 text-center px-1.5 py-1.5 font-mono bg-slate-50/60 ${
                                        isMentoringStudy ? 'border-b border-b-slate-300' : ''
                                      }`}
                                    >
                                      <div className="h-8 flex items-center justify-center">
                                        <span
                                          className={`text-xs font-bold ${
                                            effectiveScore === 0
                                              ? 'text-slate-400 font-medium'
                                              : effectiveScore < 0
                                                ? 'text-rose-600 font-bold'
                                                : 'text-emerald-700 font-bold'
                                          }`}
                                        >
                                          {effectiveScore > 0
                                            ? `+${effectiveScore}점`
                                            : `${effectiveScore}점`}
                                        </span>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )
                  ) : isMatrixMode ? (
                    <table
                      className="w-full text-xs table-fixed border-collapse"
                      style={{ minWidth: `${matrixTableMinWidth}px` }}
                    >
                      <thead className="bg-slate-50/80 select-none">
                        <tr className="border-b border-slate-200 divide-x divide-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                          <th
                            style={{ width: `${colWidths.matrix_index || 42}px` }}
                            className="relative text-center px-1 py-1 text-slate-500 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">#</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, 'matrix_index', 35)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol('matrix_index');
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </th>
                          <th
                            style={{ width: `${colWidths.matrix_term || 52}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">기수</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, 'matrix_term', 45)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol('matrix_term');
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </th>
                          {shouldShowConcurrentColumn(category) && (
                            <th
                              style={{ width: `${colWidths.matrix_track || 72}px` }}
                              className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">부문</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'matrix_track', 72)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('matrix_track');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                          )}
                          <th
                            style={{ width: `${colWidths.matrix_name || 80}px` }}
                            className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">이름</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, 'matrix_name', 60)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol('matrix_name');
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </th>
                          {category !== 'SESSION' &&
                            shouldShowMatrixTrack(category, effectiveTrackFilter) && (
                              <th
                                style={{ width: `${colWidths.matrix_track || 72}px` }}
                                className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                              >
                                <div className="h-9 flex items-center justify-center">부문</div>
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, 'matrix_track', 72)}
                                  onMouseEnter={(e) => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol('matrix_track');
                                      updateGuidelinePos(e.currentTarget);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol(null);
                                      setGuidelineX(null);
                                    }
                                  }}
                                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                  title="열 너비 조절"
                                />
                              </th>
                            )}
                          {displayedMatrixWeeks.map((w) => {
                            const isEditable =
                              isWeekDirectEditable(w.weekNum) && selectedWeek !== 0;
                            const rawDate = savedWeekDateMapping[w.weekNum]?.trim();
                            const hasDate = Boolean(rawDate && rawDate !== '-');
                            const colKey = `matrix_w_${w.weekNum}`;
                            const minColWidth = isEditable ? 435 : 92;
                            const defaultColWidth = isEditable ? 445 : 92;
                            const effectiveColWidth = Math.max(
                              colWidths[colKey] || defaultColWidth,
                              minColWidth,
                            );
                            return (
                              <th
                                key={w.id}
                                style={{ width: `${effectiveColWidth}px` }}
                                className="relative text-center px-1.5 py-1 text-slate-900 font-bold"
                              >
                                <div className="h-9 flex flex-col items-center justify-center">
                                  {hasDate ? (
                                    <>
                                      <div className="font-mono font-bold text-slate-900 text-xs leading-none">
                                        {rawDate}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                                        {w.label}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="font-bold text-slate-900 text-xs leading-none">
                                      {w.label}
                                    </div>
                                  )}
                                </div>
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, colKey, minColWidth)}
                                  onMouseEnter={(e) => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol(colKey);
                                      updateGuidelinePos(e.currentTarget);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol(null);
                                      setGuidelineX(null);
                                    }
                                  }}
                                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                  title="열 너비 조절"
                                />
                              </th>
                            );
                          })}
                          {selectedWeek === 0 && (
                            <>
                              <th
                                style={{ width: `${colWidths.matrix_absence || 60}px` }}
                                className="relative text-center px-2 py-1 text-slate-800 font-bold bg-pink-100/90"
                              >
                                <div className="h-9 flex items-center justify-center">결석</div>
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, 'matrix_absence', 48)}
                                  onMouseEnter={(e) => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol('matrix_absence');
                                      updateGuidelinePos(e.currentTarget);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol(null);
                                      setGuidelineX(null);
                                    }
                                  }}
                                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                  title="열 너비 조절"
                                />
                              </th>
                              <th
                                style={{ width: `${colWidths.matrix_unexcusedAbsence || 68}px` }}
                                className="relative text-center px-2 py-1 text-slate-900 font-bold bg-red-200/90"
                              >
                                <div className="h-9 flex items-center justify-center">무단결석</div>
                                <div
                                  onMouseDown={(e) =>
                                    handleResizeStart(e, 'matrix_unexcusedAbsence', 68)
                                  }
                                  onMouseEnter={(e) => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol('matrix_unexcusedAbsence');
                                      updateGuidelinePos(e.currentTarget);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol(null);
                                      setGuidelineX(null);
                                    }
                                  }}
                                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                  title="열 너비 조절"
                                />
                              </th>
                              <th
                                style={{ width: `${colWidths.matrix_late || 68}px` }}
                                className="relative text-center px-2 py-1 text-slate-800 font-bold bg-amber-100"
                              >
                                <div className="h-9 flex items-center justify-center">지각조퇴</div>
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, 'matrix_late', 68)}
                                  onMouseEnter={(e) => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol('matrix_late');
                                      updateGuidelinePos(e.currentTarget);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol(null);
                                      setGuidelineX(null);
                                    }
                                  }}
                                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                  title="열 너비 조절"
                                />
                              </th>
                              {category === 'ADV' && (
                                <th
                                  style={{ width: `${colWidths.matrix_remote || 80}px` }}
                                  className="relative text-center px-2 py-1 text-slate-800 font-bold bg-indigo-100"
                                >
                                  <div className="h-9 flex items-center justify-center">
                                    비대면 횟수
                                  </div>
                                  <div
                                    onMouseDown={(e) => handleResizeStart(e, 'matrix_remote', 80)}
                                    onMouseEnter={(e) => {
                                      if (!resizingColKey) {
                                        setActiveHoverCol('matrix_remote');
                                        updateGuidelinePos(e.currentTarget);
                                      }
                                    }}
                                    onMouseLeave={() => {
                                      if (!resizingColKey) {
                                        setActiveHoverCol(null);
                                        setGuidelineX(null);
                                      }
                                    }}
                                    className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                    title="열 너비 조절"
                                  />
                                </th>
                              )}
                            </>
                          )}
                          <th
                            style={{ width: `${colWidths.matrix_total || 75}px` }}
                            className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">
                              {selectedWeek === 0 ? '총점' : '점수'}
                            </div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, 'matrix_total', 55)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol('matrix_total');
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </th>
                          {shouldShowConcurrentColumn(category) && (
                            <th
                              style={{ width: `${colWidths.matrix_concurrent || 82}px` }}
                              className="relative bg-indigo-50 px-2 py-1 text-center font-bold text-slate-900"
                            >
                              <div className="flex h-9 items-center justify-center">병행 여부</div>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {filteredMatrixRows.map((row, idx) => {
                          const availableStatuses: AttendStatus[] = [
                            'present',
                            'late',
                            'earlyLeave',
                            'absent',
                            'excusedAbsent',
                            'unexcusedLate',
                            'unexcusedAbsent',
                            'unmarked',
                          ];

                          const editDropdownStatuses: AttendStatus[] =
                            category === 'SESSION'
                              ? availableStatuses
                              : [
                                  'present',
                                  'late',
                                  'earlyLeave',
                                  'absent',
                                  'excusedAbsent',
                                  'remote',
                                  'unexcusedLate',
                                  'unexcusedAbsent',
                                  'unmarked',
                                ];
                          const editStatusOptions = editDropdownStatuses.map((status) => ({
                            value: status,
                            label: ATTEND_STATUS_CFG[status]?.label || status,
                          }));

                          // 주차를 고르면 그 주차의 점수(점수 API의 주차별 점수)를 보여 준다.
                          const effectiveScore =
                            selectedWeek === 0
                              ? row.totalScore
                              : (apiScoreOf(row.teamId, row.id)?.weeks.find(
                                  (week) => week.weekNum === selectedWeek,
                                )?.points ?? 0);

                          return (
                            <tr
                              key={row.id}
                              className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-200 h-[46px]"
                            >
                              <td className="relative px-1 py-1.5 text-center text-slate-400 text-[11px]">
                                <div className="h-8 flex items-center justify-center">
                                  {idx + 1}
                                </div>
                              </td>
                              <td className="relative px-1.5 py-1.5 text-center text-slate-600 text-xs">
                                <div className="h-8 flex items-center justify-center">
                                  {row.term}기
                                </div>
                              </td>
                              {shouldShowConcurrentColumn(category) && (
                                <td className="relative px-1.5 py-1.5 text-center text-slate-600 text-xs font-sans">
                                  <div className="h-8 flex items-center justify-center font-medium">
                                    {row.track}
                                  </div>
                                </td>
                              )}
                              <td className="relative px-2 py-1.5 text-center font-bold text-slate-900 text-xs font-sans">
                                <div className="h-8 flex items-center justify-center">
                                  {row.name}
                                </div>
                              </td>
                              {category !== 'SESSION' &&
                                shouldShowMatrixTrack(category, effectiveTrackFilter) && (
                                  <td className="relative px-1.5 py-1.5 text-center text-slate-600 text-xs font-sans">
                                    <div className="h-8 flex items-center justify-center font-medium">
                                      {row.track}
                                    </div>
                                  </td>
                                )}
                              {displayedMatrixWeeks.map((w) => {
                                const isEditableDirect =
                                  isWeekDirectEditable(w.weekNum) && selectedWeek !== 0;
                                const cell = row.weekData[w.weekNum];
                                const st = cell?.status || 'unmarked';
                                const cfg = ATTEND_STATUS_CFG[st] || ATTEND_STATUS_CFG.unmarked;
                                const rawDate = savedWeekDateMapping[w.weekNum]?.trim();
                                const hasDate = Boolean(rawDate && rawDate !== '-');

                                if (isEditableDirect && !isTableEditMode) {
                                  return (
                                    <td key={w.id} className="relative px-2 py-1.5 text-center">
                                      <div className="flex items-center justify-center w-full px-1">
                                        <div className="grid grid-cols-8 w-full max-w-[445px] min-w-[425px] p-0.5 rounded-lg bg-slate-100/90 border border-slate-200/60 font-sans select-none gap-0.5 shadow-2xs">
                                          {availableStatuses.map((s) => {
                                            const active = st === s;
                                            return (
                                              <button
                                                key={s}
                                                type="button"
                                                onClick={() =>
                                                  handleStatusChange(row.id, s, w.weekNum)
                                                }
                                                className={`py-1 text-[10.5px] font-semibold rounded transition-all cursor-pointer text-center whitespace-nowrap px-0.5 ${
                                                  active
                                                    ? ATTEND_STATUS_STYLES[s].active
                                                    : ATTEND_STATUS_STYLES[s].inactive
                                                }`}
                                              >
                                                {ATTEND_STATUS_CFG[s].label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </td>
                                  );
                                }

                                return (
                                  <td
                                    key={w.id}
                                    className={`relative text-center px-1 py-1.5 font-sans transition-colors ${isTableEditMode ? 'bg-slate-100/50' : ''}`}
                                  >
                                    <div className="h-8 flex items-center justify-center w-full">
                                      {isTableEditMode ? (
                                        // 행사 출결의 기수 드롭다운과 같은 모양의 선택 드롭다운
                                        <div className="w-[76px]">
                                          <SelectDropdown
                                            ariaLabel={`${row.name} ${w.label} 출결`}
                                            value={st}
                                            options={editStatusOptions}
                                            onChange={(next) => {
                                              if (
                                                confirmStatusEdit(
                                                  `${row.name} ${w.label}`,
                                                  st,
                                                  next,
                                                )
                                              ) {
                                                handleStatusChange(row.id, next, w.weekNum);
                                              }
                                            }}
                                            buttonClassName="h-[30px] w-full text-left"
                                          />
                                        </div>
                                      ) : (
                                        <div className="relative w-[66px] h-[30px] flex items-center justify-center">
                                          <span
                                            title={`${row.name} - ${w.label}${hasDate ? ` (${rawDate})` : ''}: ${cfg.label}${cell?.memo ? `\n비고: ${cell.memo}` : ''}`}
                                            className={`text-xs whitespace-nowrap select-none font-bold ${
                                              st === 'present'
                                                ? 'text-emerald-700'
                                                : st === 'late' || st === 'earlyLeave'
                                                  ? 'text-amber-700'
                                                  : st === 'absent'
                                                    ? 'text-rose-600'
                                                    : st === 'excusedAbsent'
                                                      ? 'text-blue-700'
                                                      : st === 'remote'
                                                        ? 'text-indigo-700'
                                                        : st === 'unexcusedLate'
                                                          ? 'text-orange-700'
                                                          : st === 'unexcusedAbsent'
                                                            ? 'text-red-700'
                                                            : 'text-slate-400 font-medium'
                                            }`}
                                          >
                                            {cfg.label}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              {selectedWeek === 0 && (
                                <>
                                  {/* 결석 카운트 */}
                                  <td className="relative text-center px-1.5 py-1.5 font-mono bg-pink-50/80">
                                    <div className="h-8 flex items-center justify-center">
                                      {row.absenceCount > 0 ? (
                                        <span className="text-xs font-bold text-slate-800">
                                          {row.absenceCount}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300 font-medium">0</span>
                                      )}
                                    </div>
                                  </td>
                                  {/* 무단결석 카운트 */}
                                  <td className="relative text-center px-1.5 py-1.5 font-mono bg-red-100/70">
                                    <div className="h-8 flex items-center justify-center">
                                      {row.unexcusedAbsenceCount > 0 ? (
                                        <span className="text-xs font-bold text-slate-800">
                                          {row.unexcusedAbsenceCount}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300 font-medium">0</span>
                                      )}
                                    </div>
                                  </td>
                                  {/* 지각조퇴 카운트 */}
                                  <td className="relative text-center px-1.5 py-1.5 font-mono bg-amber-50/80">
                                    <div className="h-8 flex items-center justify-center">
                                      {row.lateEarlyLeaveCount > 0 ? (
                                        <span className="text-xs font-bold text-slate-800">
                                          {row.lateEarlyLeaveCount}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300 font-medium">0</span>
                                      )}
                                    </div>
                                  </td>
                                  {/* 비대면 카운트 (ADV 전용) */}
                                  {category === 'ADV' && (
                                    <td className="relative text-center px-1.5 py-1.5 font-mono bg-indigo-50/80">
                                      <div className="h-8 flex items-center justify-center">
                                        {row.remoteCount > 0 ? (
                                          <span className="text-xs font-bold text-slate-800">
                                            {row.remoteCount}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300 font-medium">0</span>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </>
                              )}
                              {/* 총점/점수 집계 */}
                              <td className="relative text-center px-1.5 py-1.5 font-mono bg-slate-50/60">
                                <div className="h-8 flex items-center justify-center">
                                  <span
                                    className={`text-xs font-bold ${
                                      effectiveScore === 0
                                        ? 'text-slate-400 font-medium'
                                        : effectiveScore < 0
                                          ? 'text-rose-600 font-bold'
                                          : 'text-emerald-700 font-bold'
                                    }`}
                                  >
                                    {effectiveScore > 0
                                      ? `+${effectiveScore}점`
                                      : `${effectiveScore}점`}
                                  </span>
                                </div>
                              </td>
                              {shouldShowConcurrentColumn(category) && (
                                <td className="relative bg-indigo-50/60 px-2 py-1.5 text-center font-sans">
                                  <div className="flex h-8 items-center justify-center">
                                    <span
                                      className={`text-[11px] font-bold ${
                                        row.isConcurrent ? 'text-indigo-700' : 'text-slate-500'
                                      }`}
                                    >
                                      {row.isConcurrent ? '병행' : '비병행'}
                                    </span>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <table
                      className="w-full text-xs table-fixed border-collapse"
                      style={{ minWidth: `${singleTeamTableMinWidth}px` }}
                    >
                      <thead className="bg-slate-50/80 select-none">
                        <tr className="border-b border-slate-200 divide-x divide-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                          {selectedWeek === 0 && (
                            <th
                              style={{ width: `${colWidths.week}px` }}
                              className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">주차</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'week', 60)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('week');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                          )}
                          {category !== 'SESSION' &&
                            isAllSelected &&
                            effectiveTrackFilter === 'ALL' && (
                              <th
                                style={{ width: `${colWidths.track}px` }}
                                className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                              >
                                <div className="h-9 flex items-center justify-center">부문</div>
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, 'track', 72)}
                                  onMouseEnter={(e) => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol('track');
                                      updateGuidelinePos(e.currentTarget);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol(null);
                                      setGuidelineX(null);
                                    }
                                  }}
                                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                  title="열 너비 조절"
                                />
                              </th>
                            )}
                          {isAllSelected && category !== 'SESSION' && (
                            <th
                              style={{ width: `${colWidths.teamName}px` }}
                              className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">소속 팀</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, 'teamName', 90)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol('teamName');
                                    updateGuidelinePos(e.currentTarget);
                                  }
                                }}
                                onMouseLeave={() => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol(null);
                                    setGuidelineX(null);
                                  }
                                }}
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                title="열 너비 조절"
                              />
                            </th>
                          )}
                          <th
                            style={{ width: `${colWidths.name}px` }}
                            className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">이름</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, 'name', 70)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol('name');
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </th>
                          <th
                            style={{ width: `${colWidths.term}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">기수</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, 'term', 50)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol('term');
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </th>
                          {category !== 'SESSION' &&
                            !isAllSelected &&
                            effectiveTrackFilter === 'ALL' && (
                              <th
                                style={{ width: `${colWidths.track}px` }}
                                className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                              >
                                <div className="h-9 flex items-center justify-center">부문</div>
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, 'track', 72)}
                                  onMouseEnter={(e) => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol('track');
                                      updateGuidelinePos(e.currentTarget);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol(null);
                                      setGuidelineX(null);
                                    }
                                  }}
                                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                  title="열 너비 조절"
                                />
                              </th>
                            )}
                          {(() => {
                            const isSingleTeamEditable = isBaseStatusColumnWide;
                            const statusMinWidth = isSingleTeamEditable ? 435 : 92;
                            const statusDefaultWidth = isSingleTeamEditable ? 445 : 92;
                            const effectiveStatusWidth = isSingleTeamEditable
                              ? Math.max(colWidths.status || statusDefaultWidth, statusMinWidth)
                              : colWidths.status && colWidths.status < 200
                                ? Math.max(colWidths.status, statusMinWidth)
                                : statusDefaultWidth;

                            return (
                              <th
                                style={{
                                  width: `${effectiveStatusWidth}px`,
                                  minWidth: `${statusMinWidth}px`,
                                }}
                                className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-50/80"
                              >
                                <div className="h-9 flex items-center justify-center">출결</div>
                                <div
                                  onMouseDown={(e) =>
                                    handleResizeStart(e, 'status', statusMinWidth)
                                  }
                                  onMouseEnter={(e) => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol('status');
                                      updateGuidelinePos(e.currentTarget);
                                    }
                                  }}
                                  onMouseLeave={() => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol(null);
                                      setGuidelineX(null);
                                    }
                                  }}
                                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                  title="열 너비 조절"
                                />
                              </th>
                            );
                          })()}
                          <th
                            style={{ width: `${colWidths.memo || 240}px`, minWidth: '220px' }}
                            className="relative text-center px-3 py-1 text-slate-700 font-semibold"
                          >
                            <div className="h-9 flex items-center justify-center">비고</div>
                            {!isAllSelected &&
                              selectedWeek !== 0 &&
                              !isArchivedView &&
                              weekStatusOf(weeks, selectedWeek) !== 'UPCOMING' &&
                              (() => {
                                const key = submissionKey(
                                  viewCohort,
                                  selectedTeam.id,
                                  selectedWeek,
                                );
                                const isSubmitted = isWeekSubmittedInDb(
                                  selectedTeam.id,
                                  selectedWeek,
                                );
                                const usesSubmissionEdit =
                                  isSubmittableWeek(selectedWeek) && isSubmitted;

                                if (category !== 'ADV' && !usesSubmissionEdit) {
                                  return null;
                                }

                                const isEditingThisWeek = editingWeekKey === key || isTableEditMode;
                                const completeEdit = () => {
                                  if (editingWeekKey === key) {
                                    void handleSubmitWeek();
                                    return;
                                  }
                                  setIsTableEditMode(false);
                                };
                                const startEdit = () => {
                                  if (usesSubmissionEdit) {
                                    setEditingWeekKey(key);
                                    return;
                                  }
                                  setIsTableEditMode(true);
                                };

                                return (
                                  <button
                                    type="button"
                                    disabled={isSubmittingWeek}
                                    onClick={isEditingThisWeek ? completeEdit : startEdit}
                                    className="absolute right-2 top-1/2 z-10 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition-[background-color,color,transform] duration-150 hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 active:scale-95 disabled:cursor-wait disabled:opacity-60"
                                    title={
                                      isEditingThisWeek
                                        ? usesSubmissionEdit
                                          ? '수정 완료 (변경 내용을 다시 제출)'
                                          : '수정 완료'
                                        : '이 주차 출결 전체 수정'
                                    }
                                    aria-label={isEditingThisWeek ? '수정 완료' : '출결 전체 수정'}
                                  >
                                    {isEditingThisWeek ? (
                                      <Check size={15} strokeWidth={2} aria-hidden="true" />
                                    ) : (
                                      <Edit3 size={14} aria-hidden="true" />
                                    )}
                                  </button>
                                );
                              })()}
                          </th>
                          {showsManageColumn && (
                            <th
                              style={{ width: '40px' }}
                              className="text-center px-1 py-1 text-slate-400 font-semibold w-10"
                            >
                              <div className="h-9 flex items-center justify-center">
                                {isTableEditMode ? '관리' : ''}
                              </div>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {filteredAttendees.map((att) => {
                          const availableStatuses: AttendStatus[] = [
                            'present',
                            'late',
                            'earlyLeave',
                            'absent',
                            'excusedAbsent',
                            'unexcusedLate',
                            'unexcusedAbsent',
                            'unmarked',
                          ];

                          const editDropdownStatuses: AttendStatus[] =
                            category === 'ADV'
                              ? [
                                  'present',
                                  'late',
                                  'earlyLeave',
                                  'absent',
                                  'excusedAbsent',
                                  'remote',
                                  'unexcusedLate',
                                  'unexcusedAbsent',
                                  'unmarked',
                                ]
                              : [
                                  'present',
                                  'late',
                                  'earlyLeave',
                                  'absent',
                                  'excusedAbsent',
                                  'unexcusedLate',
                                  'unexcusedAbsent',
                                  'unmarked',
                                ];
                          const editStatusOptions = editDropdownStatuses.map((status) => ({
                            value: status,
                            label: ATTEND_STATUS_CFG[status]?.label || status,
                          }));

                          const isDirectEditable = isBaseWeekSelectable(att.weekNum, att.teamId);

                          return (
                            <tr
                              key={att.id}
                              className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-200 h-[42px]"
                            >
                              {selectedWeek === 0 && (
                                <td className="relative text-center px-2 py-1.5 whitespace-nowrap">
                                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                                    {att.weekLabel || `${att.weekNum}주차`}
                                  </span>
                                </td>
                              )}
                              {category !== 'SESSION' &&
                                isAllSelected &&
                                effectiveTrackFilter === 'ALL' && (
                                  <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs font-sans whitespace-nowrap">
                                    {att.track || '-'}
                                  </td>
                                )}
                              {isAllSelected && category !== 'SESSION' && (
                                <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs font-sans truncate whitespace-nowrap">
                                  {att.teamName || '-'}
                                </td>
                              )}
                              <td className="relative px-2 py-1.5 text-center font-bold text-slate-900 text-xs font-sans whitespace-nowrap">
                                {att.name}
                              </td>
                              <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs whitespace-nowrap">
                                {att.term}기
                              </td>
                              {category !== 'SESSION' &&
                                !isAllSelected &&
                                effectiveTrackFilter === 'ALL' && (
                                  <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs font-sans whitespace-nowrap">
                                    {att.track || '-'}
                                  </td>
                                )}

                              {isDirectEditable && !isTableEditMode ? (
                                <td className="relative px-2 py-1.5 text-center">
                                  <div className="flex items-center justify-center w-full px-1">
                                    <div className="grid grid-cols-8 w-full max-w-[445px] min-w-[425px] p-0.5 rounded-lg bg-slate-100/90 border border-slate-200/60 font-sans select-none gap-0.5 shadow-2xs">
                                      {availableStatuses.map((s) => {
                                        const active = att.status === s;
                                        return (
                                          <button
                                            key={s}
                                            type="button"
                                            onClick={() =>
                                              handleStatusChange(
                                                att.originalId || att.id,
                                                s,
                                                att.weekNum,
                                              )
                                            }
                                            className={`py-1 text-[10.5px] font-semibold rounded transition-all cursor-pointer text-center whitespace-nowrap px-0.5 ${
                                              active
                                                ? ATTEND_STATUS_STYLES[s].active
                                                : ATTEND_STATUS_STYLES[s].inactive
                                            }`}
                                          >
                                            {ATTEND_STATUS_CFG[s].label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              ) : isTableEditMode ? (
                                <td className="relative px-2 py-1.5 text-center whitespace-nowrap bg-slate-100/50">
                                  <div className="flex items-center justify-center w-full">
                                    {/* 행사 출결의 기수 드롭다운과 같은 모양의 선택 드롭다운 */}
                                    <div className="w-[76px]">
                                      <SelectDropdown
                                        ariaLabel={`${att.name} 출결`}
                                        value={att.status || 'unmarked'}
                                        options={editStatusOptions}
                                        onChange={(next) => {
                                          const weekLabel =
                                            weekList.find((week) => week.weekNum === att.weekNum)
                                              ?.label ?? '';
                                          if (
                                            confirmStatusEdit(
                                              `${att.name} ${weekLabel}`.trim(),
                                              att.status || 'unmarked',
                                              next,
                                            )
                                          ) {
                                            handleStatusChange(
                                              att.originalId || att.id,
                                              next,
                                              att.weekNum,
                                            );
                                          }
                                        }}
                                        buttonClassName="h-[30px] w-full text-left"
                                      />
                                    </div>
                                  </div>
                                </td>
                              ) : (
                                <td className="relative px-2 py-1.5 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center w-full">
                                    <div className="relative w-[70px] h-[30px] flex items-center justify-center">
                                      <span
                                        className={`text-xs font-bold font-sans ${
                                          att.status === 'present'
                                            ? 'text-emerald-700 font-bold'
                                            : att.status === 'late' || att.status === 'earlyLeave'
                                              ? 'text-amber-700 font-bold'
                                              : att.status === 'absent'
                                                ? 'text-rose-700 font-bold'
                                                : att.status === 'excusedAbsent'
                                                  ? 'text-blue-700 font-bold'
                                                  : att.status === 'remote'
                                                    ? 'text-indigo-700 font-bold'
                                                    : att.status === 'unexcusedLate'
                                                      ? 'text-orange-700 font-bold'
                                                      : att.status === 'unexcusedAbsent'
                                                        ? 'text-red-700 font-bold'
                                                        : 'text-slate-300 font-normal font-mono'
                                        }`}
                                      >
                                        {att.status === 'unmarked'
                                          ? ATTEND_STATUS_CFG.unmarked.label
                                          : ATTEND_STATUS_CFG[att.status]?.label || att.status}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              )}

                              {category !== 'ADV' &&
                              isBaseWeekSelectable(att.weekNum, att.teamId) ? (
                                <td className="relative px-3 py-2 text-center">
                                  <div className="h-8 flex items-center justify-center">
                                    <input
                                      type="text"
                                      value={att.memo || ''}
                                      onChange={(e) =>
                                        handleMemoChange(
                                          att.originalId || att.id,
                                          e.target.value,
                                          att.weekNum,
                                        )
                                      }
                                      placeholder="—"
                                      className="w-full h-8 text-center px-3 text-xs font-sans text-slate-700 placeholder:text-slate-300 placeholder:font-mono rounded-lg bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-200 outline-none transition-all shadow-2xs"
                                    />
                                  </div>
                                </td>
                              ) : (
                                <td
                                  className="relative px-3 py-2 text-center text-slate-600 text-xs font-sans truncate"
                                  title={att.memo}
                                >
                                  <div className="h-8 flex items-center justify-center">
                                    {att.memo || (
                                      <span className="text-slate-300 font-mono">-</span>
                                    )}
                                  </div>
                                </td>
                              )}
                              {showsManageColumn && (
                                <td className="px-2 py-1.5 text-center">
                                  {isTableEditMode && (
                                    <button
                                      onClick={() => handleDeleteAttendee(att.id)}
                                      className="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                      title="명단에서 삭제"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* Seamless Full-Height Guideline Overlay */}
                  {(resizingColKey || activeHoverCol) && guidelineX !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-slate-400 pointer-events-none z-30 -translate-x-1/2"
                      style={{ left: `${guidelineX}px` }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {submitToast && (
        <div
          role="status"
          className={`fixed right-6 top-20 z-70 flex max-w-sm items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium text-white shadow-xl ${
            submitToast.isError ? 'border-rose-700 bg-rose-900' : 'border-slate-700 bg-slate-900'
          }`}
        >
          {!submitToast.isError && (
            <Check
              size={15}
              strokeWidth={2.5}
              className="shrink-0 text-emerald-300"
              aria-hidden="true"
            />
          )}
          <span>{submitToast.message}</span>
        </div>
      )}

      {/* ─── Modal: BASE 출결 생성 (트랙 선택 → DB 회원 선택) ─── */}
      {showCreateAttendanceModal && category === 'SESSION' && (
        <BaseAttendanceCreateModal
          titleLabel="출결 생성"
          submitLabel="출결 생성"
          cohort={currentCohort}
          cohortLabel={cohortLabelOf(cohortLabels, currentCohort)}
          tracks={tracks}
          weekNums={weekList.map((week) => week.weekNum)}
          onClose={() => setShowCreateAttendanceModal(false)}
          onCreate={handleCreateBaseAttendance}
        />
      )}

      {/* ─── Modal: ADV 팀 개설 (부문 → 팀원 선택 + 주차별 날짜) ─── */}
      {showCreateAdvModal && category === 'ADV' && (
        <BaseAttendanceCreateModal
          titleLabel="ADV 팀 개설"
          submitLabel="팀 개설"
          cohort={currentCohort}
          cohortLabel={cohortLabelOf(cohortLabels, currentCohort)}
          tracks={tracks}
          weekNums={weekList.map((week) => week.weekNum)}
          withLeader
          withTeamName
          onClose={() => setShowCreateAdvModal(false)}
          onCreate={handleCreateAdvTeam}
        />
      )}

      {/* ─── Modal: 스터디 생성 ─── */}
      {showCreateStudyModal && category === 'STUDY' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 px-4 pb-4 pt-[15vh] backdrop-blur-xs">
          <div
            className={`w-full ${canSelectStudyTrack ? 'max-w-5xl' : 'max-w-lg'} space-y-5 overflow-hidden rounded-lg p-6 animate-in fade-in zoom-in-95 duration-150 ${MODAL_SURFACE}`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {termPeriod === 'VACATION' ? '방학' : '학기'} 스터디 생성
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateStudyModal(false)}
                className="cursor-pointer rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="스터디 생성 창 닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div
              className={`grid gap-5 text-xs ${canSelectStudyTrack ? 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]' : ''}`}
            >
              <div className="space-y-4">
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">
                      스터디명 <span className="text-red-500">*</span>
                    </label>
                    {termPeriod === 'VACATION' && (
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={newStudyKind === 'MENTORING'}
                        onClick={() =>
                          setNewStudyKind((kind) =>
                            kind === 'MENTORING' ? 'GENERAL' : 'MENTORING',
                          )
                        }
                        className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-[11px] font-semibold text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border text-[9px] ${
                            newStudyKind === 'MENTORING'
                              ? 'border-slate-400 bg-slate-300 text-slate-900'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {newStudyKind === 'MENTORING' ? '✓' : ''}
                        </span>
                        멘멘스터디
                      </button>
                    )}
                  </div>
                  <input
                    value={newStudyName}
                    onChange={(event) => setNewStudyName(event.target.value)}
                    placeholder="예: 추천 시스템 논문 스터디"
                    autoFocus
                    className="w-full rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 outline-none transition-colors focus:border-slate-400 focus:bg-white"
                  />
                </div>

                <StudyMemberPicker
                  value={newStudySelection}
                  onChange={setNewStudySelection}
                  trackOptions={tracks}
                />
              </div>

              {/* 부문과 주차별 날짜는 멘멘스터디일 때만 보인다(일반 스터디는 둘 다 받지 않는다) */}
              {canSelectStudyTrack && (
                <div className="flex min-w-0 flex-col">
                  <div className="mb-4">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">부문</span>
                    <div
                      role="radiogroup"
                      aria-label="멘멘스터디 배치 부문"
                      className="grid grid-cols-3 overflow-hidden rounded-sm bg-slate-100"
                    >
                      {(['분석', '시각화', '엔지니어링'] as const).map((track) => (
                        <button
                          key={track}
                          type="button"
                          role="radio"
                          aria-checked={newStudyTrack === track}
                          onClick={() => setNewStudyTrack(track)}
                          className={`px-2 py-2.5 text-xs font-semibold transition-colors ${
                            newStudyTrack === track
                              ? 'bg-[#1E6F94] text-white'
                              : 'cursor-pointer text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {track}
                        </button>
                      ))}
                    </div>
                  </div>
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                    주차별 날짜
                  </span>
                  <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-2 rounded-sm border border-slate-200 bg-slate-50 p-2.5">
                    {weekList.map((week) => (
                      <div
                        key={week.id}
                        className="flex flex-col gap-1 rounded-lg border border-slate-200/90 bg-white px-2 pb-2 pt-3"
                      >
                        <span className="px-0.5 text-[11px] font-bold text-slate-700">
                          {week.label}
                        </span>
                        <div className="flex flex-1 items-center">
                          <DateTextInput
                            value={newStudyWeekDates[week.weekNum] ?? ''}
                            onChange={(date) =>
                              setNewStudyWeekDates((prev) => ({
                                ...prev,
                                [week.weekNum]: date,
                              }))
                            }
                            ariaLabel={`${week.label} 날짜`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateStudyModal(false)}
                className="cursor-pointer rounded-sm px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreateStudy}
                className="cursor-pointer rounded-sm border border-slate-300 bg-transparent px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
              >
                스터디 생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 새 회차 생성 ─── */}

      {/* ─── Modal: 활동/스터디 사진 크게 보기 (Zoom Modal) ─── */}
      {zoomPhoto && (
        <div
          onClick={() => setZoomPhoto(null)}
          className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 p-2"
          >
            <button
              onClick={() => setZoomPhoto(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            <img
              src={zoomPhoto.url}
              alt={selectedTeam.name}
              className="w-full h-auto max-h-[80vh] object-contain rounded-md"
            />
            <div className="p-3 text-white flex items-center justify-between text-xs font-medium">
              <span className="font-bold">{selectedTeam.name}</span>
              <span className="text-slate-400">{zoomPhoto.weekLabel}</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 주차 매핑 및 CSV 열 순서 드래그 설정 (Settings Modal) ─── */}
      {teamSettingsTeamId && (category === 'STUDY' || category === 'ADV') && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setTeamSettingsTeamId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="팀 설정 변경"
            className={`relative w-full max-w-md rounded-lg p-6 space-y-5 ${MODAL_SURFACE}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">팀 설정 변경</h3>
              <button
                type="button"
                onClick={() => setTeamSettingsTeamId(null)}
                aria-label="팀 설정 변경 닫기"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="team-settings-name"
                  className="text-[11px] font-semibold text-slate-500"
                >
                  팀 이름
                </label>
              </div>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="team-settings-name"
                  value={teamNameDraft}
                  onChange={(e) => setTeamNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTeamName();
                  }}
                  className="h-10 min-w-0 flex-1 rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={saveTeamName}
                  disabled={!isTeamNameChanged}
                  className="h-10 shrink-0 rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-default disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white cursor-pointer"
                >
                  저장
                </button>
              </div>
            </div>

            <section aria-label="팀원">
              <p className="mb-1.5 text-[11px] font-semibold text-slate-500">
                팀원{' '}
                <span className="font-medium text-slate-400">
                  {(studyMembers?.[teamSettingsTeamId] ?? []).length}명
                </span>
              </p>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <form
                  className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const name = newMemberName.trim();
                    if (!name || !onAddStudyMember) return;
                    const user = users.find((candidate) => candidate.name === name);
                    if (!user) {
                      setTeamSettingsMessage('명단에 없는 이름입니다.');
                      return;
                    }
                    if (
                      !window.confirm(
                        `${user.name}님(${user.term}기 ${user.track})을 팀원으로 추가할까요?`,
                      )
                    ) {
                      return;
                    }
                    await onAddStudyMember(teamSettingsTeamId, user.id);
                    setNewMemberName('');
                    setTeamSettingsMessage('');
                  }}
                >
                  <Plus size={14} className="shrink-0 text-slate-400" aria-hidden />
                  <input
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    placeholder="이름을 입력해 팀원 추가"
                    aria-label="추가할 팀원 이름"
                    className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    disabled={!newMemberName.trim()}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200/70 disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent cursor-pointer"
                  >
                    추가
                  </button>
                </form>
                {teamSettingsMessage && (
                  <p
                    role="alert"
                    className="border-b border-slate-100 px-3 py-1.5 text-[11px] text-rose-600"
                  >
                    {teamSettingsMessage}
                  </p>
                )}
                <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">
                  {(studyMembers?.[teamSettingsTeamId] ?? []).length === 0 && (
                    <li className="px-3 py-6 text-center text-xs text-slate-400">
                      팀원이 없습니다.
                    </li>
                  )}
                  {/* 팀장은 맨 위에 두고 글자를 진하게 한다. 창 안에서 팀장을 바꾸면 바로 올라간다. */}
                  {[...(studyMembers?.[teamSettingsTeamId] ?? [])]
                    .sort(
                      (a, b) =>
                        Number(b.userId === teamSettingsLeaderId) -
                        Number(a.userId === teamSettingsLeaderId),
                    )
                    .map((member) => {
                      const isLeader =
                        member.userId !== undefined && member.userId === teamSettingsLeaderId;
                      return (
                        <li
                          key={member.id}
                          className="group flex items-center justify-between gap-2 px-3 py-2.5 transition-colors hover:bg-slate-50"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={`truncate text-sm ${isLeader ? 'font-bold text-slate-900' : 'font-normal text-slate-800'}`}
                            >
                              {member.name}
                            </span>
                            <span
                              className={`shrink-0 text-[11px] ${isLeader ? 'text-slate-600' : 'text-slate-400'}`}
                            >
                              {member.year}기 {member.track ?? ''}
                            </span>
                            {isLeader && <span className="sr-only">팀장</span>}
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            {/* 팀장 줄에는 팀장 해제, 다른 팀원 줄에는 팀장 지정 버튼을 둔다. */}
                            {isLeader && (
                              <button
                                type="button"
                                aria-label={`${member.name} 팀장 해제`}
                                onClick={() =>
                                  void handleReleaseLeader(teamSettingsTeamId, member.name)
                                }
                                className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:text-black cursor-pointer"
                              >
                                팀장 해제
                              </button>
                            )}
                            {member.userId && !isLeader && (
                              <button
                                type="button"
                                aria-label={`${member.name} 팀장 지정`}
                                onClick={() => {
                                  if (member.userId) {
                                    void handleChangeLeader(
                                      teamSettingsTeamId,
                                      member.userId,
                                      member.name,
                                    );
                                  }
                                }}
                                className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 transition-colors hover:text-black cursor-pointer"
                              >
                                팀장 지정
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async (event) => {
                                event.stopPropagation();
                                if (
                                  !window.confirm(
                                    `${member.name}님을 팀에서 정말 삭제할까요?\n이 팀원의 출결 기록도 함께 삭제되며 되돌릴 수 없습니다.`,
                                  )
                                ) {
                                  return;
                                }
                                await onRemoveStudyMember?.(teamSettingsTeamId, member.id);
                              }}
                              aria-label={`${member.name} 삭제`}
                              className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </div>
            </section>

            {/* 팀장 지정·팀원 추가·삭제·이름 변경은 그때그때 저장되므로 완료는 창만 닫는다. */}
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setTeamSettingsTeamId(null)}
                className="h-9 rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 cursor-pointer"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-6xl max-h-[92vh] flex flex-col rounded-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${MODAL_SURFACE}`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Settings size={18} className="text-slate-700" />
                  <span>CSV 추출 및 열 순서 설정</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseOrCancelSettings}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="닫기"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 min-h-0 text-xs">
              {/* 표 구성 미리보기 */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">표 구성 미리보기</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomColOrder(null);
                      setExportColumns(DEFAULT_EXPORT_COLUMNS);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 font-medium cursor-pointer transition-colors"
                  >
                    <RotateCcw size={12} />
                    <span>순서 초기화</span>
                  </button>
                </div>

                {/* Status Mapping Legend */}
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-slate-500 px-0.5">
                  <span>
                    출석 <strong className="text-slate-900 font-bold font-mono">1</strong>
                  </span>
                  <span>
                    지각 <strong className="text-slate-900 font-bold font-mono">2</strong>
                  </span>
                  <span>
                    조퇴 <strong className="text-slate-900 font-bold font-mono">3</strong>
                  </span>
                  <span>
                    결석 <strong className="text-slate-900 font-bold font-mono">4</strong>
                  </span>
                  <span>
                    인정결석 <strong className="text-slate-900 font-bold font-mono">5</strong>
                  </span>
                  <span>
                    비대면 <strong className="text-slate-900 font-bold font-mono">6</strong>
                  </span>
                  <span className="text-slate-300 font-normal">|</span>
                  <span>
                    무단지각 <strong className="text-slate-900 font-bold font-mono">0</strong>
                  </span>
                  <span>
                    무단결석 <strong className="text-slate-900 font-bold font-mono">X</strong>
                  </span>
                </div>

                {/* Table Container with Horizontal Scroll and min-width */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-2xs">
                  <table
                    className="w-full text-xs border-collapse table-auto whitespace-nowrap"
                    style={{ minWidth: '1150px' }}
                  >
                    <thead className="select-none divide-x divide-slate-200 border-b border-slate-200">
                      <tr className="h-10">
                        <th className="w-10 text-center py-2 px-1 text-slate-400 font-mono font-medium bg-slate-50">
                          #
                        </th>
                        {activeModalCols.map((col, idx) => {
                          const isBeingDragged = draggedColIdx === idx;
                          const isDropLeft =
                            dropTarget?.index === idx && dropTarget?.position === 'left';
                          const isDropRight =
                            dropTarget?.index === idx && dropTarget?.position === 'right';

                          const headerBg =
                            col.id === 'absence'
                              ? 'bg-pink-100/90 text-slate-800'
                              : col.id === 'unexcusedAbsence'
                                ? 'bg-red-200/90 text-slate-900'
                                : col.id === 'lateEarlyLeave'
                                  ? 'bg-amber-100 text-slate-800'
                                  : col.id === 'remote'
                                    ? 'bg-indigo-100 text-slate-800'
                                    : col.id === 'totalScore'
                                      ? 'bg-slate-100/90 text-slate-900'
                                      : 'bg-slate-50 text-slate-800';

                          return (
                            <th
                              key={col.id}
                              draggable={true}
                              onDragStart={(e) => handleColDragStart(e, idx)}
                              onDragOver={(e) => handleColDragOver(e, idx)}
                              onDrop={handleColDrop}
                              onDragEnd={handleColDragEnd}
                              className={`relative px-2.5 py-2 text-center text-xs font-bold transition-all select-none cursor-grab active:cursor-grabbing ${headerBg} ${
                                isBeingDragged ? 'opacity-20 bg-slate-200' : 'hover:brightness-95'
                              }`}
                              title="마우스로 드래그하여 순서 변경"
                            >
                              {isDropLeft && (
                                <div className="absolute top-0 bottom-0 left-0 w-1 bg-slate-800 z-30 pointer-events-none rounded-full -ml-0.5" />
                              )}
                              {isDropRight && (
                                <div className="absolute top-0 bottom-0 right-0 w-1 bg-slate-800 z-30 pointer-events-none rounded-full -mr-0.5" />
                              )}
                              <div className="flex items-center justify-center">
                                <span className="font-bold text-xs leading-none whitespace-nowrap">
                                  {col.label}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans text-xs">
                      {previewRows.slice(0, 5).map((row: any, rIdx: number) => (
                        <tr
                          key={row.id || rIdx}
                          className="h-9 hover:bg-slate-50/70 transition-colors divide-x divide-slate-100"
                        >
                          <td className="text-center text-slate-400 font-mono text-xs px-1">
                            {rIdx + 1}
                          </td>
                          {activeModalCols.map((col) => (
                            <td
                              key={col.id}
                              className={`text-center px-2.5 py-1.5 whitespace-nowrap ${col.id === 'totalScore' ? 'bg-slate-50/50 font-bold' : ''}`}
                            >
                              {col.renderCell(row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium">
                * 상위 5개 행 데이터 미리보기
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-4 py-2 rounded-sm text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  {isSavedFeedback ? '저장 완료 ✓' : '설정 저장'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndExportCsv}
                  // 검정 채움 대신, 옆 설정 저장 버튼과 같은 흰 바탕에 테두리만 조금 진하게 해 주 버튼임을 보인다.
                  className="px-4 py-2 rounded-sm text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={13} />
                  <span>CSV 다운로드</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pdfPreview && (
        <PdfPreviewModal
          url={pdfPreview.url}
          name={pdfPreview.name}
          onClose={() => setPdfPreview(null)}
        />
      )}
    </div>
  );
}
