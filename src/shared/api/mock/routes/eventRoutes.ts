/**
 * 행사 출결 API: 행사, 행사 참가자 명단.
 * 행사는 한 건씩 만들고 고치고 지우며, 참가자 명단은 행사 단위로 순서까지 통째로 저장한다.
 * 저장은 기존 저장소 함수(persistEvents 등)를 써서 화면에서 저장하던 것과 같은 모양으로 DB에 남긴다.
 */
import type { Database } from 'sql.js';

import {
  loadEventState,
  persistAttendees,
  persistEvents,
} from '@/entities/event/api/eventRepository';
import { applyAttendeePatch, type AttendeePatch } from '@/entities/event/model/attendeePatch';
import type {
  AttendanceEvent,
  AttendeeRecord,
  EventStatusOption,
} from '@/entities/event/model/types';
import { execute, queryAll } from '@/shared/db/createDatabase';

import { notFound, resolveSemester } from '../queries';
import { ApiError, type MockRoute } from '../router';
import { optionalString, readBody, requiredString } from '../validate';
import { withoutKeys } from '@/shared/lib/object';

function semesterEventIds(db: Database, semesterLabel?: string | null): Set<string> {
  const { cohort } = resolveSemester(db, semesterLabel);
  return new Set(
    queryAll<{ id: string }>(db, 'SELECT id FROM events WHERE semester_cohort = ?', [cohort]).map(
      ({ id }) => id,
    ),
  );
}

function findEvent(db: Database, eventId: string): AttendanceEvent {
  const event = loadEventState(db).events.find((item) => item.id === eventId);
  if (!event) throw notFound('행사를 찾을 수 없습니다.');
  return event;
}

/**
 * 기타(OTHER) 방식 행사의 출결 값을 읽는다. [{code, label}] 배열이어야 한다.
 * 다른 방식의 출결 값은 프론트에 고정되어 있으므로, 기타가 아니면 보내도 저장하지 않는다.
 */
function statusOptionsOf(input: Record<string, unknown>): EventStatusOption[] | undefined {
  if (input.attendanceFormat !== 'OTHER' || input.statusOptions === undefined) return undefined;
  const raw = input.statusOptions;
  const isValid =
    Array.isArray(raw) &&
    raw.every(
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).code === 'string' &&
        typeof (item as Record<string, unknown>).label === 'string',
    );
  if (!isValid) {
    throw new ApiError(400, 'BAD_REQUEST', 'statusOptions는 {code, label} 배열이어야 합니다.');
  }
  return raw as EventStatusOption[];
}

const ATTEND_STATUSES: readonly string[] = [
  'present',
  'late',
  'earlyLeave',
  'absent',
  'excusedAbsent',
  'unexcusedLate',
  'unexcusedAbsent',
  'unmarked',
];
const PATCH_KEYS: readonly string[] = [
  'status',
  'secondStatus',
  'sessionStatuses',
  'customStatus',
  'checkedInAt',
  'customAnswers',
];

function badRequest(message: string): ApiError {
  return new ApiError(400, 'BAD_REQUEST', message);
}

const isStatus = (value: unknown) => typeof value === 'string' && ATTEND_STATUSES.includes(value);
const isStringRecord = (value: unknown, check: (v: unknown) => boolean) =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.values(value).every(check);

/** 참가자 부분 저장 본문을 읽는다. 바꿀 수 있는 칸과 값의 모양만 받는다. */
function attendeePatchOfBody(body: unknown): AttendeePatch {
  const input = readBody(body);
  const unknownKeys = Object.keys(input).filter((key) => !PATCH_KEYS.includes(key));
  if (unknownKeys.length > 0) {
    throw badRequest(`바꿀 수 없는 칸입니다: ${unknownKeys.join(', ')}`);
  }
  if (Object.keys(input).length === 0) throw badRequest('바꿀 칸이 없습니다.');
  if (input.status !== undefined && !isStatus(input.status))
    throw badRequest('status 값이 올바르지 않습니다.');
  if (input.secondStatus !== undefined && !isStatus(input.secondStatus)) {
    throw badRequest('secondStatus 값이 올바르지 않습니다.');
  }
  if (input.sessionStatuses !== undefined && !isStringRecord(input.sessionStatuses, isStatus)) {
    throw badRequest('sessionStatuses는 행사 이름 → 출결 값 객체여야 합니다.');
  }
  if (
    input.customStatus !== undefined &&
    input.customStatus !== null &&
    typeof input.customStatus !== 'string'
  ) {
    throw badRequest('customStatus는 문자열이거나 null이어야 합니다.');
  }
  if (input.checkedInAt !== undefined && typeof input.checkedInAt !== 'string') {
    throw badRequest('checkedInAt은 문자열이어야 합니다.');
  }
  if (
    input.customAnswers !== undefined &&
    !isStringRecord(input.customAnswers, (v) => typeof v === 'string')
  ) {
    throw badRequest('customAnswers는 문자열 값 객체여야 합니다.');
  }
  return input as AttendeePatch;
}

/** 본문을 행사로 읽는다. 경로의 id가 있으면 그 값을 쓴다. */
function eventOf(body: unknown, id?: string): AttendanceEvent {
  const input = readBody(body);
  requiredString(input, 'title');
  const eventId = id ?? requiredString(input, 'id');
  const rest = withoutKeys(input as unknown as AttendanceEvent, 'statusOptions');
  const statusOptions = statusOptionsOf(input);
  return { ...rest, id: eventId, ...(statusOptions ? { statusOptions } : {}) };
}

export const eventRoutes: MockRoute[] = [
  // ── 행사 ──
  {
    method: 'GET',
    pattern: '/api/v1/events',
    summary: '반기별 행사 목록(semester 생략 시 현재 반기, 생성 순)',
    handler: ({ db, query }) => {
      const ids = semesterEventIds(db, query.get('semester'));
      return loadEventState(db).events.filter((event) => ids.has(event.id));
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/events',
    summary:
      '행사 생성(추가 컬럼 포함). 기타 방식은 statusOptions로 출결 값을 보낼 수 있다. 같은 id가 있으면 409',
    handler: ({ db, body }) => {
      const input = readBody(body);
      const event = eventOf(input);
      const semester = resolveSemester(db, optionalString(input, 'semester'));
      const { events } = loadEventState(db);
      if (events.some((item) => item.id === event.id)) {
        throw new ApiError(409, 'CONFLICT', '이미 있는 행사 id입니다.');
      }
      persistEvents(db, events, [...events, event]);
      execute(db, 'UPDATE events SET semester_cohort = ? WHERE id = ?', [
        semester.cohort,
        event.id,
      ]);
      return findEvent(db, event.id);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/events/:eventId',
    summary: '행사 한 건(추가 컬럼·지운 기본 열 포함). 출석 명단 표 컬럼 설정 창을 열 때 읽는다',
    handler: ({ db, params }) => findEvent(db, params.eventId),
  },
  {
    method: 'PUT',
    pattern: '/api/v1/events/:eventId',
    summary: '행사 수정(본문 전체로 바꾼다. 추가 컬럼 포함)',
    handler: ({ db, params, body }) => {
      findEvent(db, params.eventId);
      const { events } = loadEventState(db);
      const event = eventOf(body, params.eventId);
      persistEvents(
        db,
        events,
        events.map((item) => (item.id === event.id ? event : item)),
      );
      return findEvent(db, event.id);
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/events/:eventId',
    summary: '행사 삭제(추가 컬럼과 참가자 명단도 함께 지워진다)',
    handler: ({ db, params }) => {
      findEvent(db, params.eventId);
      const { events } = loadEventState(db);
      persistEvents(
        db,
        events,
        events.filter((item) => item.id !== params.eventId),
      );
      return { deleted: params.eventId };
    },
  },

  // ── 참가자 ──
  {
    method: 'GET',
    pattern: '/api/v1/events/:eventId/terms',
    summary:
      '행사 참가자의 기수 목록(행사 DB 기준, 중복 없이 큰 기수부터). 기수 필터 선택지로 쓴다',
    handler: ({ db, params }) => {
      findEvent(db, params.eventId);
      return queryAll<{ term: number }>(
        db,
        `SELECT DISTINCT term FROM event_attendees
          WHERE event_id = ? AND term IS NOT NULL
          ORDER BY term DESC`,
        [params.eventId],
      ).map(({ term }) => term);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/event-attendees',
    summary: '행사 참가자 목록(eventId로 한 행사만, 명단 순서대로)',
    handler: ({ db, query }) => {
      const eventId = query.get('eventId');
      const eventIds = semesterEventIds(db, query.get('semester'));
      return loadEventState(db).attendees.filter(
        (attendee) => eventIds.has(attendee.eventId) && (!eventId || attendee.eventId === eventId),
      );
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/events/:eventId/attendees',
    summary: '행사 참가자 명단 저장(본문 배열 순서가 명단 순서. 빠진 참가자는 삭제)',
    handler: ({ db, params, body }) => {
      findEvent(db, params.eventId);
      if (!Array.isArray(body))
        throw new ApiError(400, 'BAD_REQUEST', '참가자 명단은 배열이어야 합니다.');
      const list = (body as unknown[]).map((item) => {
        const attendee = readBody(item);
        requiredString(attendee, 'id');
        requiredString(attendee, 'name');
        return { ...(attendee as unknown as AttendeeRecord), eventId: params.eventId };
      });
      const { attendees } = loadEventState(db);
      // 다른 행사 참가자는 그대로 두고, 이 행사 참가자만 본문 순서로 바꾼다.
      const next = [
        ...attendees.filter((attendee) => attendee.eventId !== params.eventId),
        ...list,
      ];
      persistAttendees(db, attendees, next);
      return loadEventState(db).attendees.filter((attendee) => attendee.eventId === params.eventId);
    },
  },

  {
    method: 'POST',
    pattern: '/api/v1/events/:eventId/attendees',
    summary:
      '행사 참가자 한 명 추가(현장에서 명단에 없는 사람을 추가). 명단 맨 앞에 넣는다. 같은 id가 있으면 409',
    handler: ({ db, params, body }) => {
      findEvent(db, params.eventId);
      const input = readBody(body);
      requiredString(input, 'id');
      requiredString(input, 'name');
      const created = { ...(input as unknown as AttendeeRecord), eventId: params.eventId };
      const { attendees } = loadEventState(db);
      if (attendees.some((attendee) => attendee.id === created.id)) {
        throw new ApiError(409, 'CONFLICT', '이미 있는 참가자 id입니다.');
      }
      persistAttendees(db, attendees, [created, ...attendees]);
      // 회원 DB에 있는 사람이면 저장하면서 회원과 연결되므로, 저장된 값을 돌려준다.
      const saved = loadEventState(db).attendees.find((attendee) => attendee.id === created.id);
      if (!saved) throw notFound('행사 참가자를 찾을 수 없습니다.');
      return saved;
    },
  },

  {
    method: 'PATCH',
    pattern: '/api/v1/events/:eventId/attendees/:attendeeId',
    summary:
      '행사 참가자 한 명의 부분 저장(출결·2차 출결·행사별 출결·기타 출결·체크인 시각·추가 컬럼 값). 바뀐 칸만 받아 지금 값에 합친다',
    handler: ({ db, params, body }) => {
      findEvent(db, params.eventId);
      const patch = attendeePatchOfBody(body);
      const { attendees } = loadEventState(db);
      const target = attendees.find(
        (attendee) => attendee.id === params.attendeeId && attendee.eventId === params.eventId,
      );
      if (!target) throw notFound('행사 참가자를 찾을 수 없습니다.');
      const updated = applyAttendeePatch(target, patch);
      persistAttendees(
        db,
        attendees,
        attendees.map((attendee) => (attendee.id === target.id ? updated : attendee)),
      );
      const saved = loadEventState(db).attendees.find((attendee) => attendee.id === target.id);
      if (!saved) throw notFound('행사 참가자를 찾을 수 없습니다.');
      return saved;
    },
  },
];
