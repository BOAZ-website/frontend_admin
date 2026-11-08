import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { UserProfile } from '../src/entities/user/model/types';
import { MOCK_ROUTES } from '../src/shared/api/mock/mockRoutes';
import { createRouter } from '../src/shared/api/mock/router';
import { createDatabase, execute, queryAll } from '../src/shared/db/createDatabase';

// 동아리원 명단(회원 마스터)과 스터디·팀 생성 창의 회원 목록(GET /api/v1/users)이 맞는지(#83).

const read = (file: string) => readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
const schema = `${read('schema.sql')}\n${read('event-schema.sql')}`;
const seed = `${read('seed.sql')}\n${read('event-seed.sql')}`;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(MOCK_ROUTES);
  const call = <T>(method: Method, path: string, body?: unknown) =>
    router.dispatch(db, method, path, body) as T;
  call('PUT', '/api/v1/mock/admin-session', { accountId: 1 });
  const pickable = () => call<UserProfile[]>('GET', '/api/v1/users');
  return { db, call, pickable };
}

test('동아리원 관리에서 추가한 활동 회원이 회원 선택 목록에 나온다', async () => {
  const { call, pickable } = await setup();
  const created = call<{ id: string }>('POST', '/api/v1/club-members', {
    name: '신입회원',
    term: 28,
    track: '분석',
    email: 'new@example.com',
    phone: '010-0000-0000',
  });

  assert.ok(pickable().some((user) => user.id === created.id));
});

test('탈동·수료 회원은 회원 선택 목록에 나오지 않지만 반기 명단에는 남는다', async () => {
  const { db, pickable } = await setup();
  const statusOf = new Map(
    queryAll<{ id: string; club_status: string }>(db, 'SELECT id, club_status FROM users').map(
      (row) => [row.id, row.club_status],
    ),
  );

  assert.ok(pickable().every((user) => statusOf.get(user.id) === 'ACTIVE'));
  // 시드의 탈퇴 회원 u_27_07은 현재 반기 명단에 남아 있다(지난 출결 기록 보존).
  assert.equal(
    queryAll(
      db,
      "SELECT 1 FROM semester_members WHERE user_id = 'u_27_07' AND cohort = (SELECT cohort FROM cohorts WHERE is_current = 1)",
    ).length,
    1,
  );
});

// 활동 회원의 이름은 화면·API로 고치지 않고 DB에서 직접 고친다(백엔드 협의 2026-11-05).
// 그래서 개명은 users 표를 직접 고쳐 만들고, 다른 목록이 users의 이름을 읽는지 확인한다.
const renameInDb = (db: Awaited<ReturnType<typeof setup>>['db'], userId: string, name: string) =>
  execute(db, 'UPDATE users SET name = ? WHERE id = ?', [name, userId]);

test('회원 이름을 고치면 회원 선택 목록에도 바뀐 이름이 나온다', async () => {
  const { db, pickable } = await setup();
  renameInDb(db, 'u_28_01', '이름바꿈');

  assert.equal(pickable().find((user) => user.id === 'u_28_01')?.name, '이름바꿈');
});

test('수료 회원을 활동으로 되돌리면 회원 선택 목록에 나온다', async () => {
  const { db, call, pickable } = await setup();
  const alumni = queryAll<{ id: string }>(
    db,
    "SELECT id FROM users WHERE club_status = 'COMPLETED' LIMIT 1",
  )[0];
  // 반기 명단에 없는 수료 회원으로 만든다(수료 기수는 명단에 등록하지 않는다).
  execute(db, 'DELETE FROM semester_members WHERE user_id = ?', [alumni.id]);
  assert.ok(!pickable().some((user) => user.id === alumni.id));

  call('PATCH', `/api/v1/club-members/${alumni.id}`, { status: 'ACTIVE' });
  assert.ok(pickable().some((user) => user.id === alumni.id));

  // 다시 수료로 바꾸면 목록에서 빠진다.
  execute(db, "UPDATE users SET club_status = 'COMPLETED' WHERE id = ?", [alumni.id]);
  assert.ok(!pickable().some((user) => user.id === alumni.id));
});

test('탈동·수료 회원은 API를 직접 불러도 팀원으로 추가할 수 없다(400)', async () => {
  const { db, call } = await setup();
  const alumniId = queryAll<{ id: string }>(
    db,
    "SELECT id FROM users WHERE club_status = 'COMPLETED' AND id IN (SELECT user_id FROM semester_members) LIMIT 1",
  )[0].id;

  assert.throws(
    () => call('POST', '/api/v1/study-teams/study_c/members', { userId: alumniId }),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 400,
  );
});

/** 현재 반기 BASE 시각화 트랙에 아직 없는 활동 회원 둘. */
const freeVisMembers = (db: Awaited<ReturnType<typeof setup>>['db']) =>
  queryAll<{ id: string }>(
    db,
    `SELECT u.id FROM users u
       JOIN semester_members sm ON sm.user_id = u.id
        AND sm.cohort = (SELECT cohort FROM cohorts WHERE is_current = 1)
      WHERE u.club_status = 'ACTIVE' AND u.track = '시각화'
        AND u.id NOT IN (SELECT user_id FROM team_members WHERE team_id = 'base_27_vis')
      LIMIT 2`,
  ).map((row) => row.id);

test('팀원 명단(팀 상세)에도 고친 이름이 나온다', async () => {
  const { db, call } = await setup();
  const [memberId] = freeVisMembers(db);
  call('POST', '/api/v1/base-tracks', { track: '시각화', memberIds: [memberId] });
  renameInDb(db, memberId, '개명한이름');

  const detail = call<{ members: { userId: string; name: string }[] }>(
    'GET',
    '/api/v1/base-tracks/base_27_vis',
  );
  assert.equal(detail.members.find((member) => member.userId === memberId)?.name, '개명한이름');
});

test('개명한 팀원이 있는 BASE 트랙에 회원을 더해도 새 회원이 생기지 않고 개명한 팀원은 남는다', async () => {
  const { db, call } = await setup();
  const [renamedId, addedId] = freeVisMembers(db);
  call('POST', '/api/v1/base-tracks', { track: '시각화', memberIds: [renamedId] });
  renameInDb(db, renamedId, '개명한이름');
  const userCount = () => queryAll<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM users')[0].n;
  const before = userCount();

  call('POST', '/api/v1/base-tracks', { track: '시각화', memberIds: [addedId] });

  assert.equal(userCount(), before);
  const trackUserIds = queryAll<{ user_id: string }>(
    db,
    "SELECT user_id FROM team_members WHERE team_id = 'base_27_vis'",
  ).map((row) => row.user_id);
  assert.ok(trackUserIds.includes(renamedId));
  assert.ok(trackUserIds.includes(addedId));
});
