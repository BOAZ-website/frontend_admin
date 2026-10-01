/**
 * 주차 출결 제출. 그 주차의 팀원별 상태값을 서버로 보낸다.
 *
 * 계약(백엔드와 맞출 부분):
 *   POST {VITE_API_BASE_URL}/api/v1/admin/attendance/{base|adv}/weeks/{weekNum}/submit
 *   요청 본문: WeekAttendanceSubmission (group, cohort, teamId, weekNum, records[])
 *   응답 본문: { submittedAt: string }  — 실패하면 2xx가 아닌 상태 코드
 * VITE_API_BASE_URL이 없으면 서버 없이 화면을 확인할 수 있도록 성공으로 응답하는 임시 구현을 쓴다.
 */
import type { WeekAttendanceSubmission, WeekSubmissionResult } from '../model/submission';

const MOCK_LATENCY_MS = 400;

export async function submitWeekAttendance(
  request: WeekAttendanceSubmission,
): Promise<WeekSubmissionResult> {
  if (request.records.length === 0) {
    throw new Error('제출할 출결 대상이 없습니다.');
  }

  const baseUrl = import.meta.env?.VITE_API_BASE_URL as string | undefined;
  if (!baseUrl) {
    await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
    return { submittedAt: new Date().toISOString(), simulated: true };
  }

  const response = await fetch(
    `${baseUrl}/api/v1/admin/attendance/${request.group.toLowerCase()}/weeks/${request.weekNum}/submit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`출결 제출에 실패했습니다. (${response.status})`);
  }
  return (await response.json()) as WeekSubmissionResult;
}
