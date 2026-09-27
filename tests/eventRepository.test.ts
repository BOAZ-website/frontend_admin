import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

import {
  loadEventState,
  persistAttendees,
  persistEvents,
  persistTemplates,
} from '../src/entities/event/api/eventRepository';
import type { AttendanceEvent, AttendeeRecord } from '../src/entities/event/model/types';
import { createDatabase, queryAll } from '../src/shared/db/createDatabase';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

async function freshDb(): Promise<Database> {
  const SQL = await initSqlJs();
  return createDatabase(SQL, schema, seed);
}

function newEvent(overrides: Partial<AttendanceEvent> = {}): AttendanceEvent {
  return {
    id: 'evt_new',
    title: '새 행사',
    status: 'UPCOMING',
    date: '2026-09-01',
    startTime: '14:00',
    endTime: '18:00',
    location: '서울',
    description: '',
    allowExternal: true,
    checkinMethod: 'QR_CODE',
    checkinCode: '1234',
    customFields: [],
    targetTerms: [28],
    targetTracks: ['ANALYSIS'],
    totalTargetCount: 0,
    internalAttendedCount: 0,
    externalAttendedCount: 0,
    createdAt: '2026-09-01',
    ...overrides,
  };
}

function newAttendee(id: string, overrides: Partial<AttendeeRecord> = {}): AttendeeRecord {
  return {
    id,
    eventId: 'evt_new',
    isExternal: false,
    name: id,
    affiliation: '28기 분석',
    email: '',
    phone: '',
    status: 'unmarked',
    checkedInAt: '-',
    customAnswers: {},
    ...overrides,
  };
}

test('시드의 행사·참가자·템플릿이 DB에서 그대로 읽힌다', async () => {
  const state = loadEventState(await freshDb());

  assert.equal(state.events.length, 3);
  assert.equal(state.templates.length, 3);
  assert.equal(state.attendees.length, 26);

  const conference = state.events.find((event) => event.id === 'evt_conf_28');
  assert.ok(conference);
  assert.equal(conference.allowExternal, true);
  assert.deepEqual(conference.targetTerms, [27, 28]);
  assert.equal(conference.statusColumnIndex, undefined);

  // 명단은 position 순서를 유지하고, 추가 컬럼 값(JSON)이 객체로 복원된다.
  const first = state.attendees[0];
  assert.equal(first.id, 'att_h1');
  assert.equal(first.userId, 'u_28_01');
  assert.equal(first.name, '김서하');
  assert.equal(first.customAnswers?.['배정 팀명'], '1조 RAG마스터');

  const internalWithoutUser = queryAll<{ id: string }>(
    await freshDb(),
    'SELECT id FROM event_attendees WHERE is_external = 0 AND user_id IS NULL',
  );
  assert.deepEqual(internalWithoutUser, []);
});

test('새 행사와 추가 컬럼, 출결 컬럼 위치가 저장·복원된다', async () => {
  const db = await freshDb();
  const before = loadEventState(db);
  const created = newEvent({
    customFields: [
      { id: 'c1', label: '소속', type: 'TEXT', isRequired: false, target: 'ALL' },
      { id: 'c2', label: '학교', type: 'TEXT', isRequired: false, target: 'ALL' },
    ],
    statusColumnIndex: 1,
  });

  persistEvents(db, before.events, [created, ...before.events]);
  const after = loadEventState(db);
  const saved = after.events.find((event) => event.id === 'evt_new');

  assert.ok(saved);
  assert.deepEqual(
    saved.customFields.map((field) => field.label),
    ['소속', '학교'],
  );
  assert.equal(saved.statusColumnIndex, 1);
});

test('참가자를 앞에 추가하면 순서가 유지되고 상태·비고 수정이 저장된다', async () => {
  const db = await freshDb();
  const events = loadEventState(db).events;
  persistEvents(db, events, [newEvent(), ...events]);

  const start = loadEventState(db);
  const added = [newAttendee('a1'), newAttendee('a2', { term: 28, memo: '메모' })];
  persistAttendees(db, start.attendees, [...added, ...start.attendees]);

  const afterAdd = loadEventState(db);
  assert.deepEqual(
    afterAdd.attendees.slice(0, 2).map((attendee) => attendee.id),
    ['a1', 'a2'],
  );
  assert.equal(afterAdd.attendees[1].term, 28);
  assert.equal(afterAdd.attendees[1].memo, '메모');

  persistAttendees(
    db,
    afterAdd.attendees,
    afterAdd.attendees.map((attendee) =>
      attendee.id === 'a1' ? { ...attendee, status: 'present', checkedInAt: '09:00' } : attendee,
    ),
  );
  const updated = loadEventState(db).attendees.find((attendee) => attendee.id === 'a1');
  assert.equal(updated?.status, 'present');
  assert.equal(updated?.checkedInAt, '09:00');
});

test('행사를 지우면 그 행사의 참가자와 추가 컬럼도 함께 지워진다', async () => {
  const db = await freshDb();
  const state = loadEventState(db);

  persistEvents(
    db,
    state.events,
    state.events.filter((event) => event.id !== 'evt_conf_28'),
  );

  const after = loadEventState(db);
  assert.equal(after.events.some((event) => event.id === 'evt_conf_28'), false);
  assert.equal(after.attendees.some((attendee) => attendee.eventId === 'evt_conf_28'), false);
  assert.equal(
    queryAll(db, 'SELECT 1 FROM event_attendees WHERE event_id = ?', ['evt_conf_28']).length,
    0,
  );
});

test('저장되지 않은 행사의 참가자는 저장하지 않는다', async () => {
  const db = await freshDb();
  const state = loadEventState(db);

  persistAttendees(db, state.attendees, [
    newAttendee('orphan', { eventId: 'evt_none' }),
    ...state.attendees,
  ]);

  assert.equal(
    loadEventState(db).attendees.some((attendee) => attendee.id === 'orphan'),
    false,
  );
});

test('템플릿을 추가·수정·삭제할 수 있다', async () => {
  const db = await freshDb();
  const state = loadEventState(db);
  const template = {
    id: 'tmpl_new',
    title: '새 양식',
    description: '',
    allowExternal: false,
    defaultCheckinMethod: 'CODE' as const,
    createdAt: '2026-09-01',
    customFields: [
      {
        id: 'f1',
        label: '구분',
        type: 'SELECT' as const,
        options: ['부원', '외부인'],
        isRequired: true,
        target: 'ALL' as const,
      },
    ],
  };

  persistTemplates(db, state.templates, [...state.templates, template]);
  const created = loadEventState(db).templates.find((item) => item.id === 'tmpl_new');
  assert.deepEqual(created?.customFields[0].options, ['부원', '외부인']);
  assert.equal(created?.customFields[0].isRequired, true);

  const withNew = loadEventState(db).templates;
  persistTemplates(
    db,
    withNew,
    withNew.map((item) => (item.id === 'tmpl_new' ? { ...item, title: '수정한 양식' } : item)),
  );
  assert.equal(
    loadEventState(db).templates.find((item) => item.id === 'tmpl_new')?.title,
    '수정한 양식',
  );

  const edited = loadEventState(db).templates;
  persistTemplates(
    db,
    edited,
    edited.filter((item) => item.id !== 'tmpl_new'),
  );
  assert.equal(loadEventState(db).templates.length, 3);
});
