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

export interface CustomFormField {
  id: string;
  label: string;
  type: 'TEXT' | 'SELECT' | 'PHONE' | 'EMAIL';
  options?: string[];
  isRequired: boolean;
  target: 'ALL' | 'INTERNAL_ONLY' | 'EXTERNAL_ONLY';
}

export interface FormTemplate {
  id: string;
  title: string;
  description: string;
  allowExternal: boolean;
  defaultCheckinMethod: CheckinMethod;
  customFields: CustomFormField[];
  createdAt: string;
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
  status: AttendStatus;
  checkedInAt: string;
  customAnswers?: Record<string, string>;
  memo?: string;
}
