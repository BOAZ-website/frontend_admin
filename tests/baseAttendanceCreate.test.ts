import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import {
  loadTeamState,
  persistAttendance,
  persistMembers,
  persistTeams,
} from '../src/entities/study-team/api/teamRepository';
import {
  baseTeamId,
  createAdvTeamRecords,
  createBaseAttendanceRecords,
  markWeekSubmitted,
} from '../src/entities/study-team/model/db';
import { userIdsOfTerm } from '../src/entities/user/model/lib';
import type { UserProfile } from '../src/entities/user/model/types';
import { createDatabase, queryAll } from '../src/shared/db/createDatabase';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

async function freshDb() {
  const SQL = await initSqlJs();
  return createDatabase(SQL, schema, seed);
}

const users: UserProfile[] = [
  { id: 'a', name: '가', term: 26, track: '분석' },
  { id: 'b', name: '나', term: 27, track: '분석' },
  { id: 'c', name: '다', term: 27, track: '분석' },
];

test('기수의 회원 id만 모아 주고, 회원이 없는 기수는 빈 목록이다', () => {
  assert.deepEqual(userIdsOfTerm(users, 27), ['b', 'c']);
  assert.deepEqual(userIdsOfTerm(users, 99), []);
});

test('BASE 트랙 id는 기수와 트랙으로 정해진다', () => {
  assert.equal(baseTeamId(27, '분석'), 'base_27_analysis');
  assert.equal(baseTeamId(26, '엔지니어링'), 'base_26_eng');
});

test('BASE 시드: 27기(현재)와 26기(지난 기수)의 트랙·트랙원·1~8주차 출결이 DB에 있다', async () => {
  const state = loadTeamState(await freshDb());

  assert.deepEqual(
    state.baseTeams.map((team) => [team.id, team.cohort]),
    [
      ['base_27_analysis', 27],
      ['base_27_vis', 27],
      ['base_27_eng', 27],
      ['base_26_analysis', 26],
      ['base_26_vis', 26],
      ['base_26_eng', 26],
    ],
  );
  assert.equal(state.members['base_27_analysis'].length, 6);
  assert.equal(state.members['base_27_vis'].length, 5);
  assert.equal(state.members['base_27_eng'].length, 5);

  // 27기: 1·2주차(종료)는 제출 완료, 3주차(진행 중)는 미제출·전원 미정, 그 뒤는 예정
  const memberId = state.members['base_27_analysis'][0].id;
  assert.equal(state.attendance['w1|study|base_27_analysis'].submitted, true);
  assert.notEqual(state.attendance['w1|study|base_27_analysis'].statuses[memberId], 'unmarked');
  assert.equal(state.attendance['w3|study|base_27_analysis'].submitted, false);
  assert.ok(
    Object.values(state.attendance['w3|study|base_27_analysis'].statuses).every(
      (status) => status === 'unmarked',
    ),
  );
  assert.equal(state.attendance['w9|study|base_27_analysis'], undefined);

  // 26기(지난 기수)는 8주차까지 모두 제출 완료
  for (let week = 1; week <= 8; week += 1) {
    assert.equal(state.attendance[`w${week}|study|base_26_analysis`].submitted, true);
  }
});

test('BASE에는 비대면 상태가 없다', async () => {
  const state = loadTeamState(await freshDb());
  Object.entries(state.attendance)
    .filter(([key]) => key.includes('|study|base_'))
    .forEach(([key, record]) => {
      assert.ok(!Object.values(record.statuses).includes('remote'), key);
    });
});

test('출결 생성: 기수·트랙 팀과 트랙원, 1~8주차 미정 출결이 DB에 저장되고 다시 읽힌다', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  const result = createBaseAttendanceRecords(
    { cohort: 28, track: '분석', members: users },
    before.baseTeams,
    before.members,
    before.attendance,
  );

  assert.equal(result.isNewTeam, true);
  assert.equal(result.team.id, 'base_28_analysis');
  assert.equal(result.addedMembers.length, 3);

  persistTeams(db, before.baseTeams, [...before.baseTeams, result.team], 'BASE');
  persistMembers(db, before.members, { ...before.members, [result.team.id]: result.addedMembers });
  persistAttendance(db, before.attendance, { ...before.attendance, ...result.attendance });

  const after = loadTeamState(db);
  assert.equal(after.baseTeams.find((team) => team.id === 'base_28_analysis')?.cohort, 28);
  assert.equal(after.members['base_28_analysis'].length, 3);
  for (let week = 1; week <= 8; week += 1) {
    const record = after.attendance[`w${week}|study|base_28_analysis`];
    assert.equal(Object.keys(record.statuses).length, 3);
    assert.ok(Object.values(record.statuses).every((status) => status === 'unmarked'));
  }
  // 다른 기수·트랙의 데이터는 그대로다.
  assert.equal(after.members['base_27_analysis'].length, 6);
});

test('출결 생성: 이미 트랙원인 회원은 건너뛰고 기존 출결 기록은 바꾸지 않는다', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  const existing = before.members['base_27_analysis'][0];
  const existingUserId = existing.id.replace('base_27_analysis_', '');
  const result = createBaseAttendanceRecords(
    {
      cohort: 27,
      track: '분석',
      members: [
        { id: existingUserId, name: existing.name, term: Number(existing.year), track: '분석' },
        users[0],
      ],
    },
    before.baseTeams,
    before.members,
    before.attendance,
  );

  assert.equal(result.isNewTeam, false);
  assert.deepEqual(
    result.addedMembers.map((member) => member.name),
    ['가'],
  );
  // 기존 사람의 1주차 상태는 그대로 유지된다.
  const week1 = result.attendance['w1|study|base_27_analysis'];
  assert.equal(
    week1.statuses[existing.id],
    before.attendance['w1|study|base_27_analysis'].statuses[existing.id],
  );
  assert.equal(week1.submitted, true);
});

test('주차 제출은 그 팀·주차의 세션만 제출 완료로 바꾸고, DB에 저장된다', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  const submittedAt = '2026-08-18T10:30:00.000Z';
  const next = markWeekSubmitted(before.attendance, 'base_27_analysis', 3, submittedAt);
  persistAttendance(db, before.attendance, next);

  const after = loadTeamState(db);
  assert.equal(after.attendance['w3|study|base_27_analysis'].submitted, true);
  assert.equal(after.attendance['w3|study|base_27_analysis'].submittedAt, submittedAt);
  assert.equal(after.attendance['w3|study|base_27_vis'].submitted, false);
  const rows = queryAll<{ submitted: number }>(
    db,
    "SELECT submitted FROM attendance_sessions WHERE team_id = 'base_27_analysis' AND week_id = 'w3'",
  );
  assert.equal(rows[0].submitted, 1);
  // 없는 세션은 그대로 돌려준다.
  assert.equal(
    markWeekSubmitted(before.attendance, 'base_27_analysis', 99, submittedAt),
    before.attendance,
  );
});

test('출결 생성은 서버가 준 주차 목록만 만든다: 9주차를 건너뛴 학기 주차(10~16)', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  const semesterWeeks = [10, 11, 12, 13, 14, 15, 16]; // 9주차는 서버 목록에 없다
  const result = createBaseAttendanceRecords(
    { cohort: 28, track: '시각화', members: users, weekNums: semesterWeeks },
    before.baseTeams,
    before.members,
    before.attendance,
  );

  assert.deepEqual(
    Object.keys(result.attendance).sort(),
    semesterWeeks.map((week) => `w${week}|study|base_28_vis`).sort(),
  );
  assert.equal(result.attendance['w9|study|base_28_vis'], undefined);
  assert.equal(result.attendance['w1|study|base_28_vis'], undefined);

  persistTeams(db, before.baseTeams, [...before.baseTeams, result.team], 'BASE');
  persistMembers(db, before.members, { ...before.members, [result.team.id]: result.addedMembers });
  persistAttendance(db, before.attendance, { ...before.attendance, ...result.attendance });

  const after = loadTeamState(db);
  semesterWeeks.forEach((week) => {
    assert.equal(Object.keys(after.attendance[`w${week}|study|base_28_vis`].statuses).length, 3);
  });
  assert.equal(after.attendance['w9|study|base_28_vis'], undefined);
});

test('ADV 팀 개설: 그 기수·부문의 다음 번호 팀이 팀원·미정 출결과 함께 DB에 저장된다', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  // 26기까지 분석 팀이 3개 있으므로 27기 분석 팀은 1팀부터 시작한다.
  const first = createAdvTeamRecords(
    { cohort: 27, track: '분석', members: users, weekNums: [1, 2, 3] },
    before.advTeams,
  );
  assert.equal(first.team.id, 'adv_27_analysis_1');
  assert.equal(first.team.teamName, '분석 1팀');
  assert.equal(first.team.cohort, 27);
  assert.deepEqual(Object.keys(first.attendance).sort(), [
    'w1|study|adv_27_analysis_1',
    'w2|study|adv_27_analysis_1',
    'w3|study|adv_27_analysis_1',
  ]);

  persistTeams(db, before.advTeams, [...before.advTeams, first.team], 'ADV');
  persistMembers(db, before.members, { ...before.members, [first.team.id]: first.members });
  persistAttendance(db, before.attendance, { ...before.attendance, ...first.attendance });

  const after = loadTeamState(db);
  assert.equal(after.advTeams.find((team) => team.id === first.team.id)?.cohort, 27);
  assert.equal(after.members[first.team.id].length, 3);
  assert.ok(
    Object.values(after.attendance['w2|study|adv_27_analysis_1'].statuses).every(
      (status) => status === 'unmarked',
    ),
  );

  // 같은 기수·부문에 또 만들면 다음 번호(2팀)가 된다.
  const second = createAdvTeamRecords(
    { cohort: 27, track: '분석', members: users.slice(0, 1) },
    after.advTeams,
  );
  assert.equal(second.team.teamName, '분석 2팀');
  // 26기의 팀·출결은 그대로다.
  assert.equal(after.advTeams.filter((team) => team.cohort === 26).length, 9);
});

test('중간 번호 ADV 팀이 삭제되어도 남은 팀 ID를 재사용하지 않는다', () => {
  const existing = [1, 3].map((number) => ({
    id: `adv_27_analysis_${number}`,
    teamName: `분석 ${number}팀`,
    cohort: 27,
    track: '분석',
  })) as Parameters<typeof createAdvTeamRecords>[1];
  const created = createAdvTeamRecords({ cohort: 27, track: '분석', members: [] }, existing);
  assert.equal(created.team.id, 'adv_27_analysis_4');
  assert.equal(created.team.teamName, '분석 4팀');
});
