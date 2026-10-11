import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { ClubMemberCreateRequest } from '../src/entities/club-member/model/dto';
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
  const call = <T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown) =>
    router.dispatch(db, method, path, body) as T;
  return { db, call };
}

const NEW_MEMBER: ClubMemberCreateRequest = {
  name: '홍길동',
  email: 'gildong@example.com',
  phone: '010-1234-5678',
  term: 28,
  track: '분석',
  status: 'ACTIVE',
  role: 'MEMBER',
  joinedAt: '2026-07-01',
};

function expectApiError(work: () => unknown, status: number) {
  assert.throws(work, (error: unknown) => error instanceof ApiError && error.status === status);
}

test('동아리원 목록은 임시 DB users 테이블 전체를 최신 기수 순으로 돌려준다', async () => {
  const { db, call } = await setup();
  const members = call<ClubMember[]>('GET', '/api/v1/club-members');
  const userCount = queryAll<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM users')[0].n;

  assert.equal(members.length, userCount);
  assert.ok(members.every((member, i) => i === 0 || members[i - 1].term >= member.term));
  const president = members.find((member) => member.id === 'u_27_01');
  assert.equal(president?.role, 'PRESIDENT');
  assert.equal(president?.joinedAt, '2026-01-01');
  assert.ok(members.filter((member) => member.term <= 25).every((m) => m.status === 'ALUMNI'));
});

test('등록하면 users와 활동 명단(members)에 저장되고 목록에 나타난다', async () => {
  const { db, call } = await setup();
  const created = call<ClubMember>('POST', '/api/v1/club-members', NEW_MEMBER);

  assert.deepEqual({ ...created, id: undefined }, { ...NEW_MEMBER, id: undefined });
  assert.ok(call<ClubMember[]>('GET', '/api/v1/club-members').some((m) => m.id === created.id));
  assert.equal(
    queryAll(db, 'SELECT 1 FROM members WHERE user_id = ? AND term = 28 AND track = ?', [
      created.id,
      '분석',
    ]).length,
    1,
  );
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
});

test('같은 기수에 같은 이름이 있으면 409, 형식이 틀리면 400, 없는 동아리원은 404로 거절한다', async () => {
  const { call } = await setup();

  expectApiError(
    () => call('POST', '/api/v1/club-members', { ...NEW_MEMBER, name: '김서하' }),
    409,
  );
  expectApiError(() => call('POST', '/api/v1/club-members', { ...NEW_MEMBER, track: 'AI' }), 400);
  expectApiError(
    () => call('POST', '/api/v1/club-members', { ...NEW_MEMBER, email: 'not-an-email' }),
    400,
  );
  expectApiError(
    () => call('PATCH', '/api/v1/club-members/u_28_01', { joinedAt: '2026/07/01' }),
    400,
  );
  expectApiError(() => call('PATCH', '/api/v1/club-members/u_none', { role: 'MEMBER' }), 404);
});

test('기수 목록 API는 users 테이블의 기수를 큰 기수부터 돌려주고, 새 기수 등록을 반영한다', async () => {
  const { call } = await setup();

  assert.deepEqual(call<number[]>('GET', '/api/v1/users/terms'), [28, 27, 26, 25]);
  call('POST', '/api/v1/club-members', { ...NEW_MEMBER, term: 29 });
  assert.deepEqual(call<number[]>('GET', '/api/v1/users/terms'), [29, 28, 27, 26, 25]);
});
