import type { AttendanceStatus } from './types';

/** 한 팀의 한 주차 출결을 제출할 때 서버로 보내는 한 사람 분량의 상태값. */
export interface WeekAttendanceRecord {
  memberId: string;
  name: string;
  /** 회원의 기수(가입 기수). 활동 기수(cohort)와는 별개다. */
  term: number;
  track: string;
  status: AttendanceStatus;
  memo?: string;
}

/** 주차 출결 제출 요청. 활동 기수·팀·주차와 그 주차의 모든 팀원 상태값을 담는다. */
export type SubmissionGroup = 'BASE' | 'ADV';

export interface WeekAttendanceSubmission {
  /** 어느 출결 관리에서 제출하는지. */
  group: SubmissionGroup;
  cohort: number;
  teamId: string;
  weekNum: number;
  records: WeekAttendanceRecord[];
}

export interface WeekSubmissionResult {
  /** 서버가 기록한 제출 시각(ISO 8601). */
  submittedAt: string;
  /** API 미연결 개발 모드에서 서버 확인 없이 로컬에만 기록한 경우. */
  simulated?: boolean;
}
