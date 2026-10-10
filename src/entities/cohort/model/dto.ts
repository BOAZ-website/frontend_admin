/**
 * 반기 API(/api/v1/semesters)의 요청·응답 형태.
 * 반기는 활동 기수 번호(cohort, 예: 27)와 반기 표기(semester, 예: '26-2')를 함께 가진다.
 * 회원의 기수(users.term)와는 별개이며, 둘의 관계(ADV 기수, 점수 집계 대상 기수)도 반기 데이터로 내려온다.
 */
import type { WeekStatus } from '@/entities/attendance/model/week';

/** 반기에 등록된 출결 구분. BASE·ADV·STUDY는 그 반기의 팀, EVENT는 그 반기의 행사가 있으면 등록된 것이다. */
export type SemesterAttendanceKind = 'BASE' | 'ADV' | 'STUDY' | 'EVENT';

export interface SemesterDto {
  cohort: number;
  /** 예: '26-2'. API 요청에서 반기를 가리키는 값이다. */
  semester: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
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
