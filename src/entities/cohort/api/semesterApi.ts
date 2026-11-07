/**
 * 반기 API 호출: 반기 목록·등록·수정(현재 반기 지정 포함), 반기별 주차 진행 상태와 날짜.
 * 화면은 반기 표기·현재 반기·ADV 기수·점수 집계 대상 기수를 계산하지 않고 이 응답을 그대로 쓴다.
 */
import { api, withQuery } from '@/shared/api/client';

import type {
  PrepareSemesterRequest,
  ReplaceSemesterMembersRequest,
  SaveSemesterScheduleRequest,
  SemesterDto,
  SemesterRosterDto,
  SemesterScheduleDto,
  SemesterWeekDto,
} from '../model/dto';
import type { UserProfile } from '@/entities/user/model/types';

const semesterPath = (semester: string) => `/api/v1/semesters/${encodeURIComponent(semester)}`;

/** 진행·종료 반기(큰 기수부터). shouldIncludePreparing이면 진행 예정 반기도 함께 받는다(반기 관리 화면). */
export function fetchSemesters(shouldIncludePreparing: boolean = false): Promise<SemesterDto[]> {
  return api.get(
    withQuery('/api/v1/semesters', { includePreparing: shouldIncludePreparing || undefined }),
  );
}

/** 전역 사용자 중 이 반기의 출결·점수 시스템에서 사용할 회원 명단을 등록한다. */
export function replaceSemesterMembers(
  semester: string,
  request: ReplaceSemesterMembersRequest,
): Promise<UserProfile[]> {
  return api.put(`${semesterPath(semester)}/members`, request);
}

/** 반기의 주차별 진행 상태(종료·진행 중·진행 예정)와 날짜. */
export function fetchSemesterWeeks(semester: string): Promise<SemesterWeekDto[]> {
  return api.get(`${semesterPath(semester)}/weeks`);
}

/** 진행 예정 반기 만들기: 반기·일정·무효 주차와 고른 명단을 저장한다. 진행 반기는 바뀌지 않는다. */
export function prepareSemester(request: PrepareSemesterRequest): Promise<SemesterDto> {
  return api.post('/api/v1/semesters/prepare', request);
}

/** 진행 예정 반기를 진행 반기로 만든다. 이전 진행 반기는 종료된다. */
export function activateSemester(semester: string): Promise<SemesterDto> {
  return api.post(`${semesterPath(semester)}/activate`, {});
}

/** 반기에 저장된 명단과 기수·구분별 인원. */
export function fetchSemesterRoster(semester: string): Promise<SemesterRosterDto> {
  return api.get(`${semesterPath(semester)}/roster`);
}

/** 진행 예정 반기를 지운다(soft delete). 진행 중·종료 반기는 409 SEMESTER_LOCKED. */
export function deleteSemester(semester: string): Promise<SemesterDto> {
  return api.delete(semesterPath(semester));
}

/** 반기 일정: 방학·학기 기간, 활동별 1주차 시작일과 주차 날짜, 무효 주차. */
export function fetchSemesterSchedule(semester: string): Promise<SemesterScheduleDto> {
  return api.get(`${semesterPath(semester)}/schedule`);
}

/** 반기의 방학·학기 기간, 활동별 시작일, 무효 주차를 통째로 교체한다. */
export function saveSemesterSchedule(
  semester: string,
  request: SaveSemesterScheduleRequest,
): Promise<SemesterScheduleDto> {
  return api.put(`${semesterPath(semester)}/schedule`, request);
}
