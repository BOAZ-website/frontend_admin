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

// 유저 DB + 행사 DB(앱과 같은 순서로 함께 올린다)
const read = (file: string) => readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
const schema = `${read('schema.sql')}\n${read('event-schema.sql')}`;
const seed = `${read('seed.sql')}\n${read('event-seed.sql')}`;

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

  // 출결 방식별 예시 행사 3개(신입 특칙형 · 컨퍼런스 1/2차형 · 일반 행사형). 모두 현재 반기(27) 목록에 보인다.
  assert.equal(state.events.length, 3);
  assert.equal(state.events.filter((event) => event.targetTerms.includes(27)).length, 3);
  assert.equal(state.templates.length, 3);
  assert.equal(state.attendees.length, 21);

  const conference = state.events.find((event) => event.id === 'evt_ex_conference');
  assert.ok(conference);
  assert.equal(conference.allowExternal, true);
  assert.deepEqual(conference.targetTerms, [27, 28]);
  assert.equal(conference.statusColumnIndex, undefined);

  // 명단은 position 순서를 유지하고, 추가 컬럼 값(JSON)이 객체로 복원된다.
  const first = state.attendees[0];
  assert.equal(first.id, 'att_ex_nc1');
  assert.equal(first.userId, 'u_28_01');
  assert.equal(first.name, '김서하');
  assert.equal(first.customAnswers?.['뒤풀이 비용'], 'O');

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

test('행사 출결 방식과 컨퍼런스 2차 출결이 저장·복원된다', async () => {
  const db = await freshDb();
  const before = loadEventState(db);

  // 시드: 예시 행사마다 출결 방식이 있고, 컨퍼런스 예시는 1차·2차를 따로 갖는다.
  assert.equal(
    before.events.find((event) => event.id === 'evt_ex_newcomer')?.attendanceFormat,
    'NEWCOMER',
  );
  assert.equal(
    before.events.find((event) => event.id === 'evt_ex_general')?.attendanceFormat,
    'GENERAL',
  );
  const seededConference = before.events.find((event) => event.id === 'evt_ex_conference');
  assert.equal(seededConference?.attendanceFormat, 'CONFERENCE');
  // 예시 데이터는 처음에 출결이 모두 미정이다(내부 참가자는 1차·2차 모두 미정).
  const internal = before.attendees.find((attendee) => attendee.id === 'att_ex_cf3');
  assert.equal(internal?.status, 'unmarked');
  assert.equal(internal?.secondStatus, 'unmarked');
  const external = before.attendees.find((attendee) => attendee.id === 'att_ex_cf7');
  assert.equal(external?.secondStatus, undefined);

  const created = newEvent({ attendanceFormat: 'CONFERENCE' });
  persistEvents(db, before.events, [created, ...before.events]);
  const attendee = newAttendee('att_round', { status: 'late', secondStatus: 'present' });
  persistAttendees(db, before.attendees, [attendee, ...before.attendees]);

  const after = loadEventState(db);
  assert.equal(
    after.events.find((event) => event.id === 'evt_new')?.attendanceFormat,
    'CONFERENCE',
  );
  const saved = after.attendees.find((record) => record.id === 'att_round');
  assert.equal(saved?.status, 'late');
  assert.equal(saved?.secondStatus, 'present');
});

test('일반 행사형의 행사 열과 행사별 출결이 저장·복원된다', async () => {
  const db = await freshDb();
  const before = loadEventState(db);

  // 시드: 일반 행사 예시는 MT·해커톤·컨퍼톡·홈커밍데이를 한 표에서 관리하고, 빈칸은 기록이 없다.
  const general = before.events.find((event) => event.id === 'evt_ex_general');
  assert.deepEqual(general?.sessionLabels, ['MT', '해커톤', '컨퍼톡', '홈커밍데이']);
  // 예시 데이터는 처음에 출결이 모두 미정이라 행사별 기록이 없다.
  const member = before.attendees.find((attendee) => attendee.id === 'att_ex_gn3');
  assert.equal(member?.sessionStatuses, undefined);
  // 다른 방식의 행사는 행사 열이 없다.
  assert.equal(
    before.events.find((event) => event.id === 'evt_ex_newcomer')?.sessionLabels,
    undefined,
  );

  const created = newEvent({ attendanceFormat: 'GENERAL', sessionLabels: ['MT', '해커톤'] });
  persistEvents(db, before.events, [created, ...before.events]);
  const attendee = newAttendee('att_session', { sessionStatuses: { MT: 'late' } });
  persistAttendees(db, before.attendees, [attendee, ...before.attendees]);

  const after = loadEventState(db);
  assert.deepEqual(after.events.find((event) => event.id === 'evt_new')?.sessionLabels, [
    'MT',
    '해커톤',
  ]);
  assert.deepEqual(after.attendees.find((record) => record.id === 'att_session')?.sessionStatuses, {
    MT: 'late',
  });
});

test('동아리 회원의 이름·기수·부문은 저장 API에서 바꿀 수 없고, 다른 정보와 외부 참가자는 고칠 수 있다', async () => {
  const db = await freshDb();
  const before = loadEventState(db);
  const member = before.attendees.find((attendee) => attendee.id === 'att_ex_cf1');
  const external = before.attendees.find((attendee) => attendee.id === 'att_ex_cf7');
  assert.ok(member && external);
  // 회원 DB 값: 김서하 · 28기 · 분석
  assert.equal(member.userId, 'u_28_01');
  assert.equal(member.customAnswers?.['기수'], '28기');
  assert.equal(member.customAnswers?.['부문'], '분석');

  const edited = before.attendees.map((attendee) => {
    if (attendee.id === member.id) {
      return {
        ...attendee,
        name: '바뀐 이름',
        term: 30,
        memo: '회원 비고',
        customAnswers: { ...attendee.customAnswers, 기수: '30기', 부문: '시각화' },
      };
    }
    return attendee.id === external.id ? { ...attendee, name: '외부 새 이름' } : attendee;
  });
  persistAttendees(db, before.attendees, edited);

  const after = loadEventState(db);
  const savedMember = after.attendees.find((attendee) => attendee.id === member.id);
  assert.equal(savedMember?.name, '김서하');
  assert.equal(savedMember?.term, 28);
  assert.equal(savedMember?.customAnswers?.['기수'], '28기');
  assert.equal(savedMember?.customAnswers?.['부문'], '분석');
  assert.equal(savedMember?.memo, '회원 비고');
  // 저장소에도 회원 DB 값으로 남는다.
  assert.deepEqual(
    queryAll(db, 'SELECT name, term FROM event_attendees WHERE id = ?', [member.id]),
    [{ name: '김서하', term: 28 }],
  );
  assert.equal(
    after.attendees.find((attendee) => attendee.id === external.id)?.name,
    '외부 새 이름',
  );
});

test('올릴 때 연결한 회원만 저장되고, 이름이 같아도 연결 없는 참가자를 회원으로 만들지 않는다', async () => {
  const db = await freshDb();
  const state = loadEventState(db);
  persistEvents(db, state.events, [newEvent(), ...state.events]);
  const usersBefore = queryAll<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM users')[0].n;

  const linked = newAttendee('att_linked', { name: '김서하', term: 28, userId: 'u_28_01' });
  // 회원과 이름·기수가 같지만 올릴 때 연결하지 않은 참가자(예: 회원 확인 실패)
  const unlinked = newAttendee('att_unlinked', { name: '정채원', term: 28 });
  const unknown = newAttendee('att_unknown', { name: '처음 보는 사람', term: 28 });
  persistAttendees(db, state.attendees, [linked, unlinked, unknown, ...state.attendees]);

  const after = loadEventState(db).attendees;
  assert.equal(after.find((a) => a.id === 'att_linked')?.userId, 'u_28_01');
  assert.equal(after.find((a) => a.id === 'att_unlinked')?.userId, undefined);
  assert.equal(after.find((a) => a.id === 'att_unknown')?.userId, undefined);
  assert.equal(queryAll<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM users')[0].n, usersBefore);
});

test('행사 참가자는 행사 DB만 읽는다(유저 DB와 조인하지 않는다)', async () => {
  const db = await freshDb();
  // 유저 DB의 회원 정보가 바뀌어도, 행사 DB에 저장된 참가자 정보로 읽는다.
  queryAll(db, "UPDATE users SET name = '바뀐 이름' WHERE id = 'u_28_01'");
  const member = loadEventState(db).attendees.find((a) => a.id === 'att_ex_cf1');
  assert.equal(member?.userId, 'u_28_01');
  assert.equal(member?.name, '김서하');
  assert.equal(member?.term, 28);
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
    state.events.filter((event) => event.id !== 'evt_ex_conference'),
  );

  const after = loadEventState(db);
  assert.equal(
    after.events.some((event) => event.id === 'evt_ex_conference'),
    false,
  );
  assert.equal(
    after.attendees.some((attendee) => attendee.eventId === 'evt_ex_conference'),
    false,
  );
  assert.equal(
    queryAll(db, 'SELECT 1 FROM event_attendees WHERE event_id = ?', ['evt_ex_conference']).length,
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
