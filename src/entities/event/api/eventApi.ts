/**
 * 행사 출결 API 호출: 행사, 행사 참가자 명단.
 * 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 */
import { api, withQuery } from '@/shared/api/client';

import type { AttendeePatch } from '../model/attendeePatch';
import type { AttendanceEvent, AttendeeRecord } from '../model/types';

const eventPath = (eventId: string) => `/api/v1/events/${encodeURIComponent(eventId)}`;

export function fetchEvents(): Promise<AttendanceEvent[]> {
  return api.get('/api/v1/events');
}

/** 행사 한 건(추가 컬럼·지운 기본 열 포함). */
export function fetchEvent(eventId: string): Promise<AttendanceEvent> {
  return api.get(eventPath(eventId));
}

export function createEvent(event: AttendanceEvent): Promise<AttendanceEvent> {
  return api.post('/api/v1/events', event);
}

/** 행사 수정. 본문 전체(추가 컬럼 포함)로 바꾼다. */
export function updateEvent(event: AttendanceEvent): Promise<AttendanceEvent> {
  return api.put(eventPath(event.id), event);
}

/** 행사 삭제. 추가 컬럼과 참가자 명단도 함께 지워진다. */
export function deleteEvent(eventId: string): Promise<{ deleted: string }> {
  return api.delete(eventPath(eventId));
}

/** 행사 참가자의 기수 목록(행사 DB 기준, 큰 기수부터). 출석 표의 기수 필터 선택지다. */
export function fetchEventTerms(eventId: string): Promise<number[]> {
  return api.get(`${eventPath(eventId)}/terms`);
}

/** 행사 참가자. eventId를 주면 그 행사만. */
export function fetchEventAttendees(eventId?: string): Promise<AttendeeRecord[]> {
  return api.get(withQuery('/api/v1/event-attendees', { eventId }));
}

/** 참가자 한 명을 명단 맨 앞에 추가한다(현장 참가자 추가). 회원과 연결된 저장 결과를 돌려준다. */
export function createEventAttendee(
  eventId: string,
  attendee: AttendeeRecord,
): Promise<AttendeeRecord> {
  return api.post(`${eventPath(eventId)}/attendees`, attendee);
}

/** 참가자 한 명의 바뀐 칸만 저장한다(출결 버튼·뒤풀이 비용 등). 다른 참가자는 건드리지 않는다. */
export function patchEventAttendee(
  eventId: string,
  attendeeId: string,
  patch: AttendeePatch,
): Promise<AttendeeRecord> {
  return api.patch(`${eventPath(eventId)}/attendees/${encodeURIComponent(attendeeId)}`, patch);
}

/** 한 행사의 참가자 명단을 순서까지 통째로 저장한다. 빠진 참가자는 지워진다. */
export function saveEventAttendees(
  eventId: string,
  attendees: readonly AttendeeRecord[],
): Promise<AttendeeRecord[]> {
  return api.put(`${eventPath(eventId)}/attendees`, attendees);
}
