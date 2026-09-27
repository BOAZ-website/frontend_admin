import type {
  SubmissionGroup,
  WeekAttendanceRecord,
  WeekAttendanceSubmission,
} from '@/entities/attendance/model/submission';

import type { InternalAttendee } from '../ui/InternalCategoryAttendancePage';

/** 제출 대상 화면에 보이는 한 사람의 값(주차별 상태·비고)만 골라 서버 요청 형태로 만든다. */
export function buildWeekSubmission(
  group: SubmissionGroup,
  cohort: number,
  weekNum: number,
  teamId: string,
  attendees: readonly InternalAttendee[],
): WeekAttendanceSubmission {
  const records: WeekAttendanceRecord[] = attendees
    .filter((attendee) => attendee.teamId === teamId && attendee.weekNum === weekNum)
    .map((attendee) => ({
      memberId: attendee.originalId ?? attendee.id,
      name: attendee.name,
      term: attendee.term,
      track: attendee.track,
      status: attendee.status,
      ...(attendee.memo ? { memo: attendee.memo } : {}),
    }));
  return { group, cohort, teamId, weekNum, records };
}

export function countUnmarked(submission: WeekAttendanceSubmission): number {
  return submission.records.filter((record) => record.status === 'unmarked').length;
}

/** 제출 여부를 기억하는 키. 기수·팀·주차가 같으면 같은 제출이다. */
export function submissionKey(cohort: number, teamId: string, weekNum: number): string {
  return `${cohort}|${teamId}|${weekNum}`;
}
