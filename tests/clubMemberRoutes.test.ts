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
  const call = <T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown) =>
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

test('동아리원 등록 API는 없다(등록은 합격자 승격으로 한다)', async () => {
  const { call } = await setup();

  expectApiError(() => call('POST', '/api/v1/club-members', { name: '홍길동', term: 28 }), 405);
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
