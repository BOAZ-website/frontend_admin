/**
 * 반기 API 호출: 반기 목록·등록·수정(현재 반기 지정 포함), 반기별 주차 진행 상태와 날짜.
 * 화면은 반기 표기·현재 반기·ADV 기수·점수 집계 대상 기수를 계산하지 않고 이 응답을 그대로 쓴다.
 */
import { api } from '@/shared/api/client';

import type {
  CreateSemesterRequest,
  ReplaceSemesterMembersRequest,
  SemesterDto,
  SemesterWeekDto,
  UpdateSemesterRequest,
  UpdateSemesterWeekRequest,
} from '../model/dto';
import type { UserProfile } from '@/entities/user/model/types';

const semesterPath = (semester: string) => `/api/v1/semesters/${encodeURIComponent(semester)}`;

export function fetchSemesters(): Promise<SemesterDto[]> {
  return api.get('/api/v1/semesters');
}

export function createSemester(request: CreateSemesterRequest): Promise<SemesterDto> {
  return api.post('/api/v1/semesters', request);
}

export function updateSemester(
  semester: string,
  request: UpdateSemesterRequest,
): Promise<SemesterDto> {
  return api.patch(semesterPath(semester), request);
}

/** 전역 사용자 중 이 반기의 출결·점수 시스템에서 사용할 회원 명단을 등록한다. */
export function replaceSemesterMembers(
  semester: string,
  request: ReplaceSemesterMembersRequest,
): Promise<UserProfile[]> {
  return api.put(`${semesterPath(semester)}/members`, request);
}

export function fetchSemesterWeeks(semester: string): Promise<SemesterWeekDto[]> {
  return api.get(`${semesterPath(semester)}/weeks`);
}

/** 한 주차의 진행 상태(열기·마감)나 날짜를 바꾼다. */
export function updateSemesterWeek(
  semester: string,
  weekNum: number,
  request: UpdateSemesterWeekRequest,
): Promise<SemesterWeekDto> {
  return api.patch(`${semesterPath(semester)}/weeks/${weekNum}`, request);
}

/** 반기의 주차별 날짜를 한 번에 저장한다. 본문에 없는 주차의 날짜는 지워진다. */
export function saveSemesterWeekDates(
  semester: string,
  weekDates: Readonly<Record<number, string>>,
): Promise<SemesterWeekDto[]> {
  return api.put(`${semesterPath(semester)}/week-dates`, { weekDates });
}
