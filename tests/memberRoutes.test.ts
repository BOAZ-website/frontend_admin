/** 회원 임시 API(MEM-01 GET /api/v1/admin/members). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { MemberListItem } from '../src/entities/club-member/model/memberDto';
import { ApiError } from '../src/shared/api/apiError';
import { MOCK_ROUTES } from '../src/shared/api/mock/mockRoutes';
import { createRouter } from '../src/shared/api/mock/router';
import { createDatabase } from '../src/shared/db/createDatabase';

const read = (file: string) => readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
const schema = `${read('schema.sql')}
${read('event-schema.sql')}`;
const seed = `${read('seed.sql')}
${read('event-seed.sql')}`;

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(MOCK_ROUTES);
  const list = (query: string) =>
    (router.dispatch(db, 'GET', `/api/v1/admin/members${query}`) as { data: MemberListItem[] })
      .data;
  return { router, db, list };
}

function expectApiError(work: () => unknown, status: number, code: string) {
  assert.throws(
    work,
    (error: unknown) => error instanceof ApiError && error.status === status && error.code === code,
  );
}

test('요청한 상태(반복·쉼표 모두)의 회원만 부문 → 이름 순으로 돌려준다', async () => {
  const { list } = await setup();
  const repeated = list('?status=ACTIVE&status=COMPLETED');
  const comma = list('?status=ACTIVE,COMPLETED');

  assert.ok(repeated.length > 0);
  assert.deepEqual(comma, repeated);
  assert.ok(repeated.every((m) => m.status === 'ACTIVE' || m.status === 'COMPLETED'));
  const rank = { ANALYSIS: 0, VISUALIZATION: 1, ENGINEERING: 2 };
  repeated.slice(1).forEach((m, i) => {
    const prev = repeated[i];
    assert.ok(
      rank[prev.track] < rank[m.track] ||
        (prev.track === m.track && prev.name.localeCompare(m.name, 'ko') <= 0),
    );
  });
});

test('term·track으로 거른다', async () => {
  const { list } = await setup();
  const members = list('?status=ACTIVE,COMPLETED&term=26&track=ANALYSIS');

  assert.ok(members.length > 0);
  assert.ok(members.every((m) => m.term === 26 && m.track === 'ANALYSIS'));
});

test('status가 없으면 400 MISSING_PARAMETER, 모르는 값이면 400 INVALID_PARAMETER_TYPE', async () => {
  const { list } = await setup();

  expectApiError(() => list(''), 400, 'MISSING_PARAMETER');
  expectApiError(() => list('?status=ALL'), 400, 'INVALID_PARAMETER_TYPE');
  expectApiError(() => list('?status=ACTIVE&track=ALL'), 400, 'INVALID_PARAMETER_TYPE');
  expectApiError(() => list('?status=ACTIVE&term=0'), 400, 'INVALID_PARAMETER_TYPE');
});

test('MEM-01로 받은 member_id를 반기 명단 등록(ATT-19)에 보내면 반기 명단 조회(ATT-18)에 나온다', async () => {
  const { router, db, list } = await setup();
  const BASE = '/api/v1/admin/attendance';
  const call = <T>(method: 'GET' | 'POST', path: string, body?: unknown) =>
    (router.dispatch(db, method, path, body) as { data: T }).data;
  router.dispatch(db, 'PUT', '/api/v1/mock/admin-session', { accountId: 1 });
  // 진행 예정 27-1(BASE 28, ADV 27): 25기 수료 회원은 자동 명단에 없다.
  const { id } = call<{ id: number }>('POST', `${BASE}/seasons`, {
    name: '27-1',
    half: 'H1',
    base_term: 28,
    adv_term: 27,
    score_rule_set_id: 1,
    periods: [
      { period_type: 'VACATION', start_date: '2026-12-28', end_date: '2027-02-28' },
      { period_type: 'SEMESTER', start_date: '2027-03-01', end_date: '2027-06-27' },
    ],
    base_start_on: '2027-01-04',
    adv_start_on: '2027-01-04',
    vacation_study_start_on: '2027-01-04',
    semester_study_start_on: '2027-03-01',
  });
  const rosterIds = () =>
    call<{ enrollments: { member_id: string }[] }>(
      'GET',
      `${BASE}/seasons/${id}/enrollments`,
    ).enrollments.map((row) => row.member_id);
  const picked = list('?status=COMPLETED&term=25')[0];
  assert.ok(!rosterIds().includes(picked.member_id));

  call('POST', `${BASE}/seasons/${id}/enrollments`, {
    member_id: picked.member_id,
    season_role: 'COMPLETED',
  });

  assert.ok(rosterIds().includes(picked.member_id));
});
