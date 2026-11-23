/**
 * 반기 API(/api/v1/semesters)의 요청·응답 형태.
 * 반기는 활동 기수 번호(cohort, 예: 27)와 반기 표기(semester, 예: '26-2')를 함께 가진다.
 * 회원의 기수(users.term)와는 별개이며, 둘의 관계(ADV 기수, 점수 집계 대상 기수)도 반기 데이터로 내려온다.
 */
import type { WeekStatus } from '@/entities/attendance/model/week';
import type { ClubMemberStatus } from '@/entities/club-member/model/types';

/** 반기에 등록된 출결 구분. BASE·ADV·STUDY는 그 반기의 팀, EVENT는 그 반기의 행사가 있으면 등록된 것이다. */
export type SemesterAttendanceKind = 'BASE' | 'ADV' | 'STUDY' | 'EVENT';

/** 반기 상태: 진행 예정(적용만 함, 활성화 전)·진행(현재 반기)·종료. */
export type SemesterStatus = 'PREPARING' | 'ACTIVE' | 'ENDED';

/** 상반기(H1)·하반기(H2). 반기 이름 'YY-N'의 N과 맞아야 한다(1=H1, 2=H2, 백엔드 ATT-03·04). */
export type SemesterHalf = 'H1' | 'H2';

export interface SemesterDto {
  cohort: number;
  /** 예: '26-2'. API 요청에서 반기를 가리키는 값이다. */
  semester: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  /** 진행 예정(적용만 함)·진행(현재 반기)·종료. 진행이면 isCurrent가 true다. */
  status: SemesterStatus;
  /** 이 반기에 ADV를 진행하는 회원 기수(ADV 팀의 기수). */
  advTerm: number | null;
  /** ADV 팀장이 출결 입력 탭에서 입력을 시작하는 주차(1~16). 그 앞 주차는 운영지원팀이 ADV 출결 관리에서 입력한다. */
  advLeaderEntryFromWeek: number;
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

// ───────────────────────────── 반기 관리(새 반기 시작·일정) ─────────────────────────────

/** 1주차 시작일을 따로 정하는 활동. BASE·ADV는 시작일 하나로 방학·학기 1~16주차, 스터디는 기간마다 1~8주차. */
export type SemesterActivity = 'BASE' | 'ADV' | 'STUDY_VACATION' | 'STUDY_TERM';

/** YYYY-MM-DD 기간. */
export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * 반기 공통 주차(백엔드 season_week). 방학·학기 기간을 월~일 주로 나눠 반기 전체에 이어 1주차부터 센다.
 * 방학과 학기 사이의 빈 주는 주차가 아니다. 휴강은 공통 주차 단위로 정하고 모든 활동에 적용된다(ATT-09).
 */
export interface CommonWeek {
  weekNo: number;
  periodType: 'VACATION' | 'SEMESTER';
  /** 그 주 월요일. */
  startDate: string;
  /** 그 주 일요일. */
  endDate: string;
}

export interface CommonWeekDto extends CommonWeek {
  /** 휴강 주차. */
  isVoid: boolean;
}

/** 반기 일정 조회 응답. */
export interface SemesterScheduleDto {
  /** 옛 반기처럼 정해 두지 않았으면 null. */
  vacation: DateRange | null;
  term: DateRange | null;
  activityStarts: Record<SemesterActivity, string | null>;
  /** 공통 주차와 휴강 여부. 기간이 없으면 빈 배열. */
  weeks: CommonWeekDto[];
}

/** 반기 기간·시작일 저장 요청(PUT /:semester/schedule, 진행 예정 반기만). 휴강은 공통 주차 휴강 API로 따로 바꾼다. */
export interface SaveSemesterScheduleRequest {
  vacation: DateRange;
  term: DateRange;
  activityStarts: Partial<Record<SemesterActivity, string | null>>;
}

/** BASE·ADV 기수가 아닌데 예외로 더한 사람은 EXTRA. */
export type RosterKind = 'BASE' | 'ADV' | 'EXTRA';

/** 반기 명단의 한 사람. */
export interface RosterEntryDto {
  /** 명단 등록 id·버전(ATT-18). 화면에서 더했지만 아직 저장하지 않은 사람은 없다. */
  enrollmentId?: number;
  version?: number;
  userId: string;
  name: string;
  term: number;
  track: string;
  /** 병행 부문(동아리원 명단의 값). 병행하지 않으면 null. */
  parallelTrack: string | null;
  kind: RosterKind;
  /** 동아리원 활동 상태(활동·수료·미수료·탈동). */
  memberStatus: ClubMemberStatus;
  /** 멘멘 스터디의 멘멘·친바에 참여하는지. 점수 계산이 이 명단을 기준으로 한다(백엔드 ATT-18). */
  menmenJoined: boolean;
  chinbaJoined: boolean;
  /** 병행 수료 여부. 병행하지 않거나 아직 정하지 않았으면 null. */
  isParallelCompleted: boolean | null;
  note: string | null;
  /** 이 반기에 속한 ADV 팀·스터디. */
  groups: RosterGroupDto[];
}

/** 명단의 한 사람이 속한 그룹(백엔드 ATT-18 enrollments[].groups). */
export interface RosterGroupDto {
  groupId: string;
  name: string;
  groupType: 'ADV' | 'STUDY';
  /** 스터디 종류. ADV 팀이면 null. */
  studyKind: 'MENMEN' | 'GENERAL' | null;
}
