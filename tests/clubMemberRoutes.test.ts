import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { ClubMember } from '../src/entities/club-member/model/types';
import { ApiError } from '../src/shared/api/apiError';
import { createRouter } from '../src/shared/api/mock/router';
import { clubMemberRoutes } from '../src/shared/api/mock/routes/clubMemberRoutes';
import { userRoutes } from '../src/shared/api/mock/routes/userRoutes';
import { createDatabase, queryAll } from '../src/shared/db/createDatabase';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter([...clubMemberRoutes, ...userRoutes]);
  const call = <T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) =>
    router.dispatch(db, method, path, body) as T;
  return { db, call };
}

function expectApiError(work: () => unknown, status: number) {
  assert.throws(work, (error: unknown) => error instanceof ApiError && error.status === status);
}

test('동아리원 목록은 임시 DB users 테이블 전체를 최신 기수 순으로 돌려준다', async () => {
  const { db, call } = await setup();
  const members = call<ClubMember[]>('GET', '/api/v1/club-members');
  const userCount = queryAll<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM users')[0].n;

  assert.equal(members.length, userCount);
  assert.ok(members.every((member, i) => i === 0 || members[i - 1].term >= member.term));
  assert.equal(members.find((member) => member.id === 'u_27_01')?.role, 'PRESIDENT');
  assert.ok(members.filter((member) => member.term <= 25).every((m) => m.status === 'ALUMNI'));
});

test('동아리원을 추가하면 일반 회원으로 들어가고 활동 명단(members) 행도 생긴다', async () => {
  const { db, call } = await setup();
  const created = call<ClubMember>('POST', '/api/v1/club-members', {
    name: '홍길동',
    email: 'gildong@example.com',
    phone: '010-0000-0000',
    university: '',
    major: '',
    term: 20,
    track: '시각화',
    status: 'ALUMNI',
  });

  assert.equal(created.role, 'MEMBER');
  assert.equal(created.status, 'ALUMNI');
  assert.equal(created.operatorTeam, null);
  assert.ok(call<ClubMember[]>('GET', '/api/v1/club-members').some((m) => m.id === created.id));
  assert.equal(
    queryAll<{ n: number }>(
      db,
      'SELECT COUNT(*) AS n FROM members WHERE user_id = ? AND term = 20 AND track = ?',
      [created.id, '시각화'],
    )[0].n,
    1,
  );
});

test('추가할 때 필수 값이 없거나 같은 기수에 같은 이름이 있으면 거절한다', async () => {
  const { call } = await setup();
  const base = { name: '홍길동', email: 'g@example.com', phone: '010', term: 20, track: '분석' };
  const post = (body: unknown) => () => call('POST', '/api/v1/club-members', body);

  expectApiError(post({ ...base, name: '' }), 400);
  expectApiError(post({ ...base, email: 'not-an-email' }), 400);
  expectApiError(post({ ...base, term: 0 }), 400);
  expectApiError(post({ ...base, track: 'AI' }), 400);
  expectApiError(post({ ...base, name: '김서하', term: 28 }), 409);
});

test('수정은 보낸 값만 바꾼다', async () => {
  const { call } = await setup();
  const updated = call<ClubMember>('PATCH', '/api/v1/club-members/u_28_01', {
    status: 'INACTIVE',
    role: 'OPERATOR',
  });

  assert.equal(updated.status, 'INACTIVE');
  assert.equal(updated.role, 'OPERATOR');
  assert.equal(updated.name, '김서하');
  assert.equal(updated.email, 'seoha.k@yonsei.ac.kr');
  assert.equal(updated.university, '연세대학교');
  assert.equal(updated.major, '응용통계학과');

  const renamed = call<ClubMember>('PATCH', '/api/v1/club-members/u_28_01', {
    university: '서울대학교',
    major: '',
  });
  assert.equal(renamed.university, '서울대학교');
  assert.equal(renamed.major, '');
});

test('기수·부문을 바꾸면 그 기수·부문의 활동 명단(members) 행이 생긴다', async () => {
  const { db, call } = await setup();
  call('PATCH', '/api/v1/club-members/u_28_01', { term: 29, track: '시각화' });

  assert.equal(
    queryAll(db, 'SELECT 1 FROM members WHERE user_id = ? AND term = 29 AND track = ?', [
      'u_28_01',
      '시각화',
    ]).length,
    1,
  );
});

test('같은 기수에 같은 이름이 있으면 409, 형식이 틀리면 400, 없는 동아리원은 404로 거절한다', async () => {
  const { call } = await setup();
  const patch = (body: unknown) => () => call('PATCH', '/api/v1/club-members/u_28_02', body);

  expectApiError(patch({ name: '김서하' }), 409);
  expectApiError(patch({ track: 'AI' }), 400);
  expectApiError(patch({ email: 'not-an-email' }), 400);
  expectApiError(patch({ phone: '' }), 400);
  expectApiError(() => call('PATCH', '/api/v1/club-members/u_none', { role: 'MEMBER' }), 404);
});

test('기수 목록 API는 users 테이블의 기수를 큰 기수부터 돌려주고, 기수 변경을 반영한다', async () => {
  const { call } = await setup();

  assert.deepEqual(call<number[]>('GET', '/api/v1/users/terms'), [28, 27, 26, 25]);
  call('PATCH', '/api/v1/club-members/u_25_01', { term: 29 });
  assert.deepEqual(call<number[]>('GET', '/api/v1/users/terms'), [29, 28, 27, 26, 25]);
});

test('운영진 배지는 역할만 보내 달고 떼며, 다른 정보는 그대로 둔다', async () => {
  const { call } = await setup();
  const before = call<ClubMember[]>('GET', '/api/v1/club-members').find(
    (member) => member.role === 'MEMBER',
  )!;

  const badged = call<ClubMember>('PATCH', `/api/v1/club-members/${before.id}`, {
    role: 'OPERATOR',
  });
  assert.equal(badged.role, 'OPERATOR');
  assert.deepEqual({ ...badged, role: before.role }, before);

  const removed = call<ClubMember>('PATCH', `/api/v1/club-members/${before.id}`, {
    role: 'MEMBER',
  });
  assert.equal(removed.role, 'MEMBER');
});

test('삭제하면 반기 명단·팀 소속·출결 기록이 함께 지워지고, 팀장 칸은 비워진다', async () => {
  const { db, call } = await setup();
  const count = (sql: string, id: string) => queryAll<{ n: number }>(db, sql, [id])[0].n;
  // 운영진이 아니면서 팀장인 사람을 고른다(팀 소속·출결 기록도 있는 사람).
  const target = queryAll<{ id: string }>(
    db,
    `SELECT t.leader_id AS id FROM teams t
      WHERE t.leader_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM admin a WHERE a.user_id = t.leader_id)
      LIMIT 1`,
  )[0].id;

  call('DELETE', `/api/v1/club-members/${target}`);

  assert.equal(count('SELECT COUNT(*) AS n FROM users WHERE id = ?', target), 0);
  assert.equal(count('SELECT COUNT(*) AS n FROM semester_members WHERE user_id = ?', target), 0);
  assert.equal(count('SELECT COUNT(*) AS n FROM team_members WHERE user_id = ?', target), 0);
  assert.equal(count('SELECT COUNT(*) AS n FROM teams WHERE leader_id = ?', target), 0);
  assert.equal(
    count(
      `SELECT COUNT(*) AS n FROM attendance_records r
         JOIN team_members tm ON tm.id = r.member_id WHERE tm.user_id = ?`,
      target,
    ),
    0,
  );
  expectApiError(() => call('DELETE', `/api/v1/club-members/${target}`), 404);
});

test('운영진은 삭제할 수 없다(409)', async () => {
  const { db, call } = await setup();
  const operatorId = queryAll<{ user_id: string }>(db, 'SELECT user_id FROM admin LIMIT 1')[0]
    .user_id;

  expectApiError(() => call('DELETE', `/api/v1/club-members/${operatorId}`), 409);
  assert.ok(call<ClubMember[]>('GET', '/api/v1/club-members').some((m) => m.id === operatorId));
});
