import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { AttendanceEvent, AttendeeRecord } from '../src/entities/event/model/types';
import { createDatabase } from '../src/shared/db/createDatabase';
import { createRouter } from '../src/shared/api/mock/router';
import { eventRoutes } from '../src/shared/api/mock/routes/eventRoutes';

// 유저 DB + 행사 DB(앱과 같은 순서로 함께 올린다)
const read = (file: string) => readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
const schema = `${read('schema.sql')}\n${read('event-schema.sql')}`;
const seed = `${read('seed.sql')}\n${read('event-seed.sql')}`;

async function setup() {
  const SQL = await initSqlJs();
  return { db: createDatabase(SQL, schema, seed), router: createRouter(eventRoutes) };
}

function eventBody(overrides: Partial<AttendanceEvent>): AttendanceEvent {
  return {
    id: 'evt_api',
    title: 'API 행사',
    status: 'UPCOMING',
    date: '',
    startTime: '14:00',
    endTime: '18:00',
    location: '',
    description: '',
    allowExternal: false,
    checkinMethod: 'MANUAL',
    checkinCode: '0000',
    customFields: [],
    targetTerms: [27],
    targetTracks: [],
    totalTargetCount: 0,
    internalAttendedCount: 0,
    externalAttendedCount: 0,
    createdAt: '2026-10-10',
    ...overrides,
  };
}

const OPTIONS = [
  { code: 'Y', label: '참석' },
  { code: 'N', label: '불참' },
];

test('기타 행사는 백엔드가 보낸 출결 값과 참가자가 고른 값이 저장된다', async () => {
  const { db, router } = await setup();
  const created = router.dispatch(
    db,
    'POST',
    '/api/v1/events',
    eventBody({ attendanceFormat: 'OTHER', statusOptions: OPTIONS }),
  ) as AttendanceEvent;
  assert.deepEqual(created.statusOptions, OPTIONS);

  const saved = router.dispatch(db, 'PUT', '/api/v1/events/evt_api/attendees', [
    {
      id: 'att_api',
      eventId: 'evt_api',
      isExternal: true,
      name: '외부인',
      affiliation: '',
      email: '',
      phone: '',
      status: 'unmarked',
      checkedInAt: '-',
      customStatus: 'Y',
    },
  ]) as AttendeeRecord[];
  assert.equal(saved[0].customStatus, 'Y');
});

test('기타가 아닌 방식은 출결 값이 프론트에 고정되어 있어 보내도 저장하지 않는다', async () => {
  const { db, router } = await setup();
  const created = router.dispatch(
    db,
    'POST',
    '/api/v1/events',
    eventBody({ attendanceFormat: 'GENERAL', statusOptions: OPTIONS }),
  ) as AttendanceEvent;
  assert.equal(created.statusOptions, undefined);
});

test('기타 행사의 출결 값이 {code, label} 배열이 아니면 400', async () => {
  const { db, router } = await setup();
  assert.throws(
    () =>
      router.dispatch(db, 'POST', '/api/v1/events', {
        ...eventBody({ attendanceFormat: 'OTHER' }),
        statusOptions: ['참석', '불참'],
      }),
    (error: unknown) => (error as { status?: number }).status === 400,
  );
});

test('행사 기수 목록은 행사 DB의 참가자 기수를 중복 없이 큰 기수부터 돌려준다', async () => {
  const { db, router } = await setup();
  // 컨퍼런스 예시: 28·27기(현재 활동기수 시트) + 26기(활동기수 외 회원) + 외부 참석자(기수 없음)
  assert.deepEqual(
    router.dispatch(db, 'GET', '/api/v1/events/evt_ex_conference/terms', undefined),
    [28, 27, 26],
  );
  assert.deepEqual(
    router.dispatch(db, 'GET', '/api/v1/events/evt_ex_newcomer/terms', undefined),
    [28],
  );
  // 회원 DB에 없는 이전 기수도 행사 DB에 있으면 목록에 들어간다.
  router.dispatch(db, 'PUT', '/api/v1/events/evt_ex_newcomer/attendees', [
    {
      id: 'att_old',
      eventId: 'evt_ex_newcomer',
      isExternal: false,
      name: '이수진',
      affiliation: '',
      email: '',
      phone: '',
      status: 'unmarked',
      checkedInAt: '-',
      term: 22,
    },
  ]);
  assert.deepEqual(
    router.dispatch(db, 'GET', '/api/v1/events/evt_ex_newcomer/terms', undefined),
    [22],
  );
  assert.throws(
    () => router.dispatch(db, 'GET', '/api/v1/events/evt_none/terms', undefined),
    (error: unknown) => (error as { status?: number }).status === 404,
  );
});

test('참가자 부분 저장은 그 사람의 보낸 칸만 바꾸고 다른 참가자는 건드리지 않는다', async () => {
  const { db, router } = await setup();
  const path = (id: string) => `/api/v1/events/evt_ex_newcomer/attendees/${id}`;
  const one = router.dispatch(db, 'PATCH', path('att_ex_nc1'), {
    status: 'present',
    checkedInAt: '14:00',
  }) as AttendeeRecord;
  assert.equal(one.status, 'present');
  assert.equal(one.checkedInAt, '14:00');
  // 다른 사람을 고쳐도 앞사람이 바꾼 값이 그대로 남는다(명단 전체로 덮어쓰지 않는다).
  router.dispatch(db, 'PATCH', path('att_ex_nc2'), { customAnswers: { '뒤풀이 비용': 'O' } });
  const list = router.dispatch(
    db,
    'GET',
    '/api/v1/event-attendees?eventId=evt_ex_newcomer',
    undefined,
  ) as AttendeeRecord[];
  assert.equal(list.find((a) => a.id === 'att_ex_nc1')?.status, 'present');
  const second = list.find((a) => a.id === 'att_ex_nc2');
  assert.equal(second?.customAnswers?.['뒤풀이 비용'], 'O');
  assert.equal(second?.customAnswers?.['기수'], '28기');
});

test('참가자 부분 저장은 바꿀 수 없는 칸·잘못된 값·없는 참가자를 거절한다', async () => {
  const { db, router } = await setup();
  const path = '/api/v1/events/evt_ex_newcomer/attendees/att_ex_nc1';
  const statusOf = (fn: () => unknown) => {
    try {
      fn();
      return 200;
    } catch (error) {
      return (error as { status?: number }).status;
    }
  };
  assert.equal(
    statusOf(() => router.dispatch(db, 'PATCH', path, { name: '바뀐 이름' })),
    400,
  );
  assert.equal(
    statusOf(() => router.dispatch(db, 'PATCH', path, { status: 'maybe' })),
    400,
  );
  assert.equal(
    statusOf(() => router.dispatch(db, 'PATCH', path, {})),
    400,
  );
  assert.equal(
    statusOf(() =>
      router.dispatch(db, 'PATCH', '/api/v1/events/evt_ex_newcomer/attendees/nobody', {
        status: 'present',
      }),
    ),
    404,
  );
});
