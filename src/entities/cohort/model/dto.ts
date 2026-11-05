/**
 * 반기 API(/api/v1/semesters)의 요청·응답 형태.
 * 반기는 활동 기수 번호(cohort, 예: 27)와 반기 표기(semester, 예: '26-2')를 함께 가진다.
 * 회원의 기수(users.term)와는 별개이며, 둘의 관계(ADV 기수, 점수 집계 대상 기수)도 반기 데이터로 내려온다.
 */
import type { WeekStatus } from '@/entities/attendance/model/week';

/** 반기에 등록된 출결 구분. BASE·ADV·STUDY는 그 반기의 팀, EVENT는 그 반기의 행사가 있으면 등록된 것이다. */
export type SemesterAttendanceKind = 'BASE' | 'ADV' | 'STUDY' | 'EVENT';

/** 반기 상태: 준비(저장만 함)·진행(현재 반기)·종료. */
export type SemesterStatus = 'PREPARING' | 'ACTIVE' | 'ENDED';

export interface SemesterDto {
  cohort: number;
  /** 예: '26-2'. API 요청에서 반기를 가리키는 값이다. */
  semester: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  /** 준비(저장만 함)·진행(현재 반기)·종료. 진행이면 isCurrent가 true다. */
  status: SemesterStatus;
  /** 이 반기에 ADV를 진행하는 회원 기수(ADV 팀의 기수). */
  advTerm: number | null;
  /** 출결 점수 집계 대상 회원 기수(작은 기수부터). */
  memberTerms: number[];
  /**
   * 이 반기의 지금 주차. 진행 중인 마지막 주차, 없으면 종료된 마지막 주차다.
   * 모든 주차가 진행 예정(반기 시작 전)이면 null.
   */
  currentWeekNum: number | null;
  /** 지금 주차가 속한 기간(방학·학기). 반기 시작 전이면 null. */
  currentPeriod: '방학' | '학기' | null;
  /** 이 반기에 출결이 등록된 구분. 출결 화면의 반기 선택 목록은 해당 구분이 등록된 반기만 보여 준다. */
  attendanceKinds: SemesterAttendanceKind[];
}

export interface SemesterWeekDto {
  weekNum: number;
  label: string;
  period: '방학' | '학기';
  /** 이 반기에서의 진행 상태. */
  status: WeekStatus;
  /** YYYY-MM-DD. 정하지 않았으면 null. */
  date: string | null;
  /**
   * 반기 관리에서 정한 활동별 이 주차 날짜(1주차 시작일 + 7일씩). 시작일을 정하지 않은 활동은 없다.
   * BASE·ADV·방학 스터디는 1~8주차, 학기 스터디는 9~16주차에 놓인다.
   */
  activityDates: Partial<Record<SemesterActivity, string>>;
  /** 반기 관리에서 이 주차를 휴강(무효 주차)으로 지정한 활동. */
  invalidActivities: SemesterActivity[];
}

export interface CreateSemesterRequest {
  cohort: number;
  semester: string;
  startDate: string;
  endDate: string;
  advTerm?: number | null;
  memberTerms?: number[];
}

export interface UpdateSemesterRequest {
  startDate?: string;
  endDate?: string;
  /** true로 보내면 이 반기가 현재 반기가 되고, 이전 현재 반기는 지난 반기가 된다. */
  isCurrent?: true;
  advTerm?: number | null;
  memberTerms?: number[];
}

/** 해당 반기의 출결·점수 회원 명단을 통째로 교체한다. */
export interface ReplaceSemesterMembersRequest {
  userIds: string[];
}

export interface UpdateSemesterWeekRequest {
  status?: WeekStatus;
  /** YYYY-MM-DD. null이면 날짜 삭제. */
  date?: string | null;
}

// ───────────────────────────── 반기 관리(새 반기 시작·일정) ─────────────────────────────

/** 1주차 시작일을 따로 정하는 활동. */
export type SemesterActivity = 'BASE' | 'ADV' | 'STUDY_VACATION' | 'STUDY_TERM';

/** YYYY-MM-DD 기간. */
export interface DateRange {
  startDate: string;
  endDate: string;
}

/** 무효 주차(휴강): 그 활동의 출결에서 제외되는 주차. */
export interface InvalidWeekDto {
  activity: SemesterActivity;
  /** 활동 안에서의 주차(1~8). */
  weekNum: number;
  reason: string;
}

/** 활동 하나의 주차 날짜와 휴강 여부. */
export interface SemesterActivityWeekDto {
  weekNum: number;
  /** 시작일에서 7일씩 더한 날짜. */
  date: string;
  isInvalid: boolean;
}

/** 반기 일정 조회 응답. */
export interface SemesterScheduleDto {
  /** 옛 반기처럼 정해 두지 않았으면 null. */
  vacation: DateRange | null;
  term: DateRange | null;
  activityStarts: Record<SemesterActivity, string | null>;
  invalidWeeks: InvalidWeekDto[];
  /** 시작일이 없는 활동은 빈 배열. */
  weeks: Record<SemesterActivity, SemesterActivityWeekDto[]>;
}

/** 반기 일정 통째 저장 요청(PUT /:semester/schedule). 준비 반기 만들기 요청의 schedule도 같다. */
export interface SaveSemesterScheduleRequest {
  vacation: DateRange;
  term: DateRange;
  activityStarts: Partial<Record<SemesterActivity, string | null>>;
  invalidWeeks: { activity: SemesterActivity; weekNum: number; reason?: string }[];
}

/** BASE·ADV 기수가 아닌데 예외로 더한 사람은 EXTRA. */
export type RosterKind = 'BASE' | 'ADV' | 'EXTRA';

/** 반기 명단의 한 사람. */
export interface RosterEntryDto {
  userId: string;
  name: string;
  term: number;
  track: string;
  kind: RosterKind;
}

/** 반기에 저장된 출결·점수 명단. 기수(큰 기수부터) → 부문 → 이름 순. */
export interface SemesterRosterDto {
  members: RosterEntryDto[];
}

/**
 * 준비 반기 만들기: 반기·일정·무효 주차를 저장하고, BASE·ADV 기수의 활동 중 회원으로 명단을 자동으로 만든다.
 * 반기 번호(cohort)는 BASE 기수와 같다. 활성화(POST /:semester/activate)해야 진행 반기가 된다.
 */
export interface PrepareSemesterRequest {
  /** 'YY-1' 또는 'YY-2'. */
  semester: string;
  baseTerm: number;
  /** BASE 기수보다 작아야 한다. */
  advTerm: number;
  schedule: SaveSemesterScheduleRequest;
}
