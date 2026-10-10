/**
 * 출결 점수 관리 대상 기수 조회. 현재 반기의 점수 집계 대상 회원 기수(DB의 semester_member_terms)를 돌려준다
 * (예: 26-2 반기 → ['26', '27']).
 */
import { fetchAttendanceMeta } from './attendanceApi';

export async function fetchActiveAttendanceTerms(): Promise<string[]> {
  const { currentSemester } = await fetchAttendanceMeta();
  return currentSemester.memberTerms.map(String);
}
