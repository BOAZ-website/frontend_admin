/**
 * BASE·ADV 출결 관리 화면의 주차 출결 제출. 화면이 만든 제출 형식(WeekAttendanceSubmission)을
 * 팀 출결 제출 API(POST /api/v1/{adv-teams|base-tracks}/:teamId/weeks/:weekNum/submit) 요청으로 바꿔 보낸다.
 */
import type { WeekAttendanceSubmission, WeekSubmissionResult } from '../model/submission';

import { submitTeamWeek } from './attendanceApi';

export async function submitWeekAttendance(
  request: WeekAttendanceSubmission,
): Promise<WeekSubmissionResult> {
  if (request.records.length === 0) {
    throw new Error('제출할 출결 대상이 없습니다.');
  }

  const { submittedAt } = await submitTeamWeek(request.group, request.teamId, request.weekNum, {
    records: request.records.map((record) => ({
      memberId: record.memberId,
      status: record.status,
      memo: record.memo ?? null,
    })),
  });
  return { submittedAt };
}
