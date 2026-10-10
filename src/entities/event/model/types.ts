/** 행사 출결(컨퍼런스·해커톤·정기 세션 등)의 화면·저장소 공용 타입. */
export type EventStatus = 'UPCOMING' | 'IN_PROGRESS' | 'FINISHED';
export type CheckinMethod = 'QR_CODE' | 'CODE' | 'MANUAL' | 'OPEN_LINK';
export type AttendStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'excusedAbsent'
  | 'unexcusedLate'
  | 'unexcusedAbsent'
  | 'unmarked'
  | 'earlyLeave';

/**
 * 행사 출결 방식. 운영지원팀이 행사 종류마다 다른 양식으로 출결을 관리한다.
 * NEWCOMER: 신입 OT 등 신입 특칙형, CONFERENCE: 1차·2차로 나눠 확인하는 컨퍼런스, GENERAL: 일반 행사,
 * OTHER: 기타. 올린 명단 파일(CSV)의 열을 그대로 표로 쓰고, 출결도 그 열에 글자로 직접 입력한다.
 */
export type EventAttendanceFormat = 'NEWCOMER' | 'CONFERENCE' | 'GENERAL' | 'OTHER';

/**
 * 기타(OTHER) 방식 행사의 출결 값. 백엔드가 행사마다 정해 보낸다(code는 저장 값, label은 화면 이름).
 * 신입 특칙형·컨퍼런스·일반 행사형의 출결 값은 프론트에 고정되어 있어 이 값을 쓰지 않는다.
 */
export interface EventStatusOption {
  code: string;
  label: string;
}

/**
 * 출석 표에서 컬럼 설정으로 지울 수 있는 기본 열.
 * STATUS: 출결 열 전체(1차·2차, 행사별 열 포함), SECOND_STATUS: 컨퍼런스의 2차 출결만, MEMO: 비고.
 */
export type EventBaseColumn = 'STATUS' | 'SECOND_STATUS' | 'MEMO';

export interface CustomFormField {
  id: string;
  label: string;
  type: 'TEXT' | 'SELECT' | 'PHONE' | 'EMAIL';
  options?: string[];
  isRequired: boolean;
  target: 'ALL' | 'INTERNAL_ONLY' | 'EXTERNAL_ONLY';
}

export interface AttendanceEvent {
  id: string;
  title: string;
  status: EventStatus;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  allowExternal: boolean;
  checkinMethod: CheckinMethod;
  checkinCode: string;
  customFields: CustomFormField[];
  /** 표에서 출결 컬럼이 오는 자리: 그 앞에 오는 추가 컬럼 개수. 없으면 추가 컬럼 뒤(맨 끝)다. */
  statusColumnIndex?: number;
  /** 출결 방식. 없으면 일반 행사(GENERAL)다. */
  attendanceFormat?: EventAttendanceFormat;
  /**
   * 일반 행사형에서 한 표에 함께 관리하는 행사 이름(예: MT, 해커톤, 컨퍼톡, 홈커밍데이).
   * 행사마다 출결 열이 하나씩 생긴다. 비어 있으면 출결 열이 하나인 행사다.
   */
  sessionLabels?: string[];
  /** 기타 방식 행사의 출결 값(백엔드가 보낸다). 없으면 출결 열 없이 명단 열에 직접 입력한다. */
  statusOptions?: EventStatusOption[];
  /** 컬럼 설정에서 지운 기본 열. 같은 이름(출결·비고)으로 컬럼을 추가하면 되살아난다. */
  hiddenColumns?: EventBaseColumn[];
  targetTerms: number[];
  targetTracks: string[];
  totalTargetCount: number;
  internalAttendedCount: number;
  externalAttendedCount: number;
  createdAt: string;
}

export interface AttendeeRecord {
  id: string;
  eventId: string;
  /** BOAZ 내부 참가자의 users.id. 외부 참가자는 없다. */
  userId?: string;
  isExternal: boolean;
  name: string;
  affiliation: string;
  term?: number;
  email: string;
  phone: string;
  /** 출결. 컨퍼런스(CONFERENCE) 행사에서는 1차 출결이다. */
  status: AttendStatus;
  /** 컨퍼런스 행사의 2차 출결. 다른 방식의 행사에는 없다. */
  secondStatus?: AttendStatus;
  /** 행사 이름(sessionLabels) → 그 행사의 출결. 기록이 없는 행사는 빠져 있다. */
  sessionStatuses?: Record<string, AttendStatus>;
  /** 기타 방식 행사의 출결(행사 statusOptions의 code). 고르지 않았으면 없다. */
  customStatus?: string;
  checkedInAt: string;
  customAnswers?: Record<string, string>;
  memo?: string;
}
