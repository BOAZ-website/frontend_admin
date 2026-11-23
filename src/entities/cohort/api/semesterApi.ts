/**
 * 출결 화면이 쓰는 반기 API 호출: 반기 목록, 반기별 주차 진행 상태와 날짜.
 * 반기 관리 화면은 백엔드 명세 경로의 api/seasonApi.ts를 쓴다.
 */
import { api, withQuery } from '@/shared/api/client';

import type { SemesterDto, SemesterWeekDto } from '../model/dto';

const semesterPath = (semester: string) => `/api/v1/semesters/${encodeURIComponent(semester)}`;

/** 진행·종료 반기(큰 기수부터). shouldIncludePreparing이면 진행 예정 반기도 함께 받는다(반기 관리 화면). */
export function fetchSemesters(shouldIncludePreparing: boolean = false): Promise<SemesterDto[]> {
  return api.get(
    withQuery('/api/v1/semesters', { includePreparing: shouldIncludePreparing || undefined }),
  );
}

/** 반기의 주차별 진행 상태(종료·진행 중·진행 예정)와 날짜. */
export function fetchSemesterWeeks(semester: string): Promise<SemesterWeekDto[]> {
  return api.get(`${semesterPath(semester)}/weeks`);
}
