/**
 * 행사 참가자 한 명의 부분 저장(PATCH /api/v1/events/:eventId/attendees/:attendeeId) 본문.
 * 출결 버튼·뒤풀이 비용처럼 한 칸만 바꿀 때 바뀐 칸만 보낸다(명단 전체를 보내지 않아 다른 사람의 수정을 덮어쓰지 않는다).
 */
import type { AttendeeRecord, AttendStatus } from './types';
import { withoutKeys } from '@/shared/lib/object';

export interface AttendeePatch {
  status?: AttendStatus;
  secondStatus?: AttendStatus;
  /** 행사별 출결 전체(일반 행사형). 바뀐 행사만이 아니라 그 사람의 행사별 출결을 통째로 보낸다. */
  sessionStatuses?: Record<string, AttendStatus>;
  /** 기타 방식 출결 코드. null이면 미정(고르지 않음)으로 되돌린다. */
  customStatus?: string | null;
  checkedInAt?: string;
  /** 추가 컬럼 값 중 바뀐 키만. 서버는 기존 값에 합친다. */
  customAnswers?: Record<string, string>;
}

const sameJson = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** 두 참가자를 비교해 바뀐 칸만 담은 부분 저장 본문을 만든다. 바뀐 것이 없으면 빈 객체다. */
export function attendeePatchOf(before: AttendeeRecord, after: AttendeeRecord): AttendeePatch {
  const patch: AttendeePatch = {};
  if (before.status !== after.status) patch.status = after.status;
  if (before.secondStatus !== after.secondStatus && after.secondStatus !== undefined) {
    patch.secondStatus = after.secondStatus;
  }
  if (!sameJson(before.sessionStatuses, after.sessionStatuses)) {
    patch.sessionStatuses = after.sessionStatuses ?? {};
  }
  if (before.customStatus !== after.customStatus) patch.customStatus = after.customStatus ?? null;
  if (before.checkedInAt !== after.checkedInAt) patch.checkedInAt = after.checkedInAt;
  const beforeAnswers = before.customAnswers ?? {};
  const changedAnswers = Object.fromEntries(
    Object.entries(after.customAnswers ?? {}).filter(
      ([key, value]) => beforeAnswers[key] !== value,
    ),
  );
  if (Object.keys(changedAnswers).length > 0) patch.customAnswers = changedAnswers;
  return patch;
}

/** 부분 저장 본문을 참가자에 적용한 새 참가자. */
export function applyAttendeePatch(attendee: AttendeeRecord, patch: AttendeePatch): AttendeeRecord {
  const { customStatus, customAnswers, sessionStatuses, ...rest } = patch;
  const next: AttendeeRecord = {
    ...attendee,
    ...rest,
    ...(sessionStatuses !== undefined ? { sessionStatuses } : {}),
    ...(customAnswers
      ? { customAnswers: { ...(attendee.customAnswers ?? {}), ...customAnswers } }
      : {}),
  };
  if (customStatus === undefined) return next;
  if (customStatus === null) {
    return withoutKeys(next, 'customStatus');
  }
  return { ...next, customStatus };
}
