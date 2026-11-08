import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

import type { GroupLeaderAccount } from '../src/entities/host-account/model/types';
import { ApiError } from '../src/shared/api/apiError';
import { MOCK_ROUTES } from '../src/shared/api/mock/mockRoutes';
import { createRouter } from '../src/shared/api/mock/router';
import { createDatabase, execute, queryAll } from '../src/shared/db/createDatabase';

// 그룹 계정 관리(HOST 계정): 백엔드 HOST 계정·그룹 리더 설계문서 2026-11-06판 2·3절.

// 유저 DB + 행사 DB(앱과 같은 순서로 함께 올린다. 반기 전환이 행사 표도 다룬다)
const read = (file: string) => readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
const schema = `${read('schema.sql')}\n${read('event-schema.sql')}`;
const seed = `${read('seed.sql')}\n${read('event-seed.sql')}`;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// 시드: 운영진 1번 boaz_master(u_26_01, study_a 팀장), 4번 boaz_ops_1(운영지원팀), 6번 boaz_plan_1(기획팀).
// HOST: 101 host_c(u_27_01, study_c), 102 host_adv_ana1(u_27_02, adv_t1·study_d),
// 103 host_adv_vis1(u_28_08, adv_t4), 104 host_adv_eng1(u_28_04, adv_t7·study_b·study_e).
// 계정이 없는 팀장: adv_t2(u_28_11) 등.
const MASTER_ID = 1;
const OPS_ID = 4;
const PLANNER_ID = 6;
const FAR_FUTURE = '2999-12-31';

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  // 오늘 날짜와 상관없이 현재 반기의 방학·학기 스터디가 모두 진행 중이게 한다.
  execute(db, 'UPDATE semester_periods SET end_date = ?', [FAR_FUTURE]);
  const router = createRouter(MOCK_ROUTES);
  const call = <T>(method: Method, path: string, body?: unknown) =>
    router.dispatch(db, method, path, body) as T;
  const actAs = (accountId: number) => call('PUT', '/api/v1/mock/admin-session', { accountId });
  actAs(OPS_ID);
  const rows = () => call<GroupLeaderAccount[]>('GET', '/api/v1/hosts');
  const rowOf = (teamId: string) => rows().find((row) => row.teamId === teamId);
  return { db, call, actAs, rows, rowOf };
}

const hostExists = (db: Database, username: string) =>
  queryAll(db, "SELECT 1 FROM admin WHERE username = ? AND role = 'HOST'", [username]).length > 0;

const ledGroupsOf = (db: Database, adminId: number) =>
  queryAll<{ group_id: string }>(
    db,
    'SELECT group_id FROM admin_group_leader WHERE admin_id = ? ORDER BY group_id',
    [adminId],
  ).map((row) => row.group_id);

function expectApiError(work: () => unknown, status: number, code?: string) {
  assert.throws(
    work,
    (error: unknown) =>
      error instanceof ApiError && error.status === status && (!code || error.code === code),
  );
}

// ── 표 ──────────────────────────────────────────────────────────────

test('표: 진행 중인 그룹마다 현재 팀장과 그 계정을 주고, 계정이 없으면 account가 null이다', async () => {
  const { rowOf } = await setup();

  assert.deepEqual(rowOf('adv_t1'), {
    teamId: 'adv_t1',
    groupType: 'ADV',
    leaderUserId: 'u_27_02',
    account: { id: 102, username: 'host_adv_ana1', role: 'HOST' },
  });
  assert.equal(rowOf('adv_t2')?.account, null);
});

test('표: 운영진이 팀장이면 HOST 계정 대신 운영진 계정이 보인다', async () => {
  const { rowOf } = await setup();

  assert.deepEqual(rowOf('study_a')?.account, {
    id: MASTER_ID,
    username: 'boaz_master',
    role: 'MASTER',
  });
});

test('표: 기간이 끝난 스터디와 팀장이 없는 팀은 나오지 않는다', async () => {
  const { db, rowOf } = await setup();
  // 방학 기간을 이미 끝난 날짜로 바꾼다(시작일 다음 날).
  execute(
    db,
    "UPDATE semester_periods SET end_date = date(start_date, '+1 day') WHERE period = '방학'",
  );
  execute(db, "UPDATE teams SET leader_id = NULL WHERE id = 'adv_t3'");

  assert.equal(rowOf('study_a'), undefined, 'study_a는 방학 스터디다');
  assert.ok(rowOf('study_c'), 'study_c는 학기 스터디다');
  assert.ok(rowOf('adv_t1'), 'ADV 팀은 기간이 없어 반기만 본다');
  assert.equal(rowOf('adv_t3'), undefined);
});

test('표: "HOST 계정 발급 조회" 권한이 없으면 403이다', async () => {
  const { call, actAs } = await setup();
  actAs(PLANNER_ID);

  expectApiError(() => call('GET', '/api/v1/hosts'), 403);
});

// ── 발급 ────────────────────────────────────────────────────────────

test('발급: 팀의 현재 팀장에게 HOST 계정이 생기고, 그 팀장이 맡은 그룹에 바로 연결된다', async () => {
  const { db, call, rowOf } = await setup();

  const issued = call<{ id: number; userId: string; username: string }>('POST', '/api/v1/hosts', {
    teamId: 'adv_t2',
    username: 'host_adv_ana2',
    password: 'boaz2026!new',
  });

  assert.equal(issued.userId, 'u_28_11');
  assert.equal(issued.username, 'host_adv_ana2');
  assert.ok(!('password' in issued), '응답에는 비밀번호를 담지 않는다');
  assert.deepEqual(rowOf('adv_t2')?.account, {
    id: issued.id,
    username: 'host_adv_ana2',
    role: 'HOST',
  });
  assert.deepEqual(ledGroupsOf(db, issued.id), ['adv_t2']);
});

test('발급: 아이디 형식이 맞지 않으면 400 INVALID_INPUT_VALUE', async () => {
  const { call } = await setup();
  const issue = (username: string) =>
    call('POST', '/api/v1/hosts', { teamId: 'adv_t2', username, password: 'pw' });

  for (const username of ['abc', 'Host_A2', 'host-a2', 'a'.repeat(21)]) {
    expectApiError(() => issue(username), 400, 'INVALID_INPUT_VALUE');
  }
});

test('발급: 이미 계정이 있는 팀장(운영진·HOST)은 409 DUPLICATE_MEMBER_ACCOUNT', async () => {
  const { call } = await setup();
  const issue = (teamId: string) =>
    call('POST', '/api/v1/hosts', { teamId, username: 'host_extra', password: 'pw' });

  expectApiError(() => issue('adv_t1'), 409, 'DUPLICATE_MEMBER_ACCOUNT');
  expectApiError(() => issue('study_a'), 409, 'DUPLICATE_MEMBER_ACCOUNT');
});

test('발급: 진행 중이 아닌 그룹은 409 GROUP_NOT_IN_PROGRESS, 탈퇴한 팀장은 409 MEMBER_WITHDRAWN', async () => {
  const { db, call } = await setup();
  execute(
    db,
    "UPDATE semester_periods SET end_date = date(start_date, '+1 day') WHERE period = '방학'",
  );
  execute(db, "UPDATE teams SET leader_id = 'u_28_05' WHERE id = 'study_b'");
  expectApiError(
    () => call('POST', '/api/v1/hosts', { teamId: 'study_b', username: 'host_b2', password: 'pw' }),
    409,
    'GROUP_NOT_IN_PROGRESS',
  );

  execute(db, "UPDATE users SET club_status = 'WITHDRAWN' WHERE id = 'u_28_11'");
  expectApiError(
    () => call('POST', '/api/v1/hosts', { teamId: 'adv_t2', username: 'host_a2', password: 'pw' }),
    409,
    'MEMBER_WITHDRAWN',
  );
});

test('발급: "HOST 계정 발급 CUD" 권한이 없으면 403이다', async () => {
  const { call, actAs } = await setup();
  actAs(PLANNER_ID);

  expectApiError(
    () => call('POST', '/api/v1/hosts', { teamId: 'adv_t2', username: 'host_a2', password: 'pw' }),
    403,
  );
});

// ── 팀장 지정·변경과 계정 정리 ──────────────────────────────────────

test('팀장 변경: 새 팀장에게 계정이 있으면 바로 그 팀이 맡은 그룹이 된다(권한 추가 단계 없음)', async () => {
  const { db, call } = await setup();
  // study_c 팀원 u_28_08은 adv_t4 팀장이라 host_adv_vis1(103)이 있다.
  call('PATCH', '/api/v1/study-teams/study_c', { leaderId: 'u_28_08' });

  assert.deepEqual(ledGroupsOf(db, 103), ['adv_t4', 'study_c']);
});

test('팀장 변경: 다른 그룹이 없는 예전 팀장의 HOST 계정은 지우고, 다른 그룹이 있으면 남긴다', async () => {
  const { db, call } = await setup();
  call('PATCH', '/api/v1/study-teams/study_c', { leaderId: 'u_28_08' });
  assert.equal(hostExists(db, 'host_c'), false);

  // host_adv_eng1은 adv_t7 말고도 study_b·study_e를 맡는다.
  const member = queryAll<{ user_id: string }>(
    db,
    "SELECT user_id FROM team_members WHERE team_id = 'adv_t7' AND user_id <> 'u_28_04' LIMIT 1",
  )[0].user_id;
  call('PATCH', '/api/v1/adv-teams/adv_t7', { leaderId: member });
  assert.equal(hostExists(db, 'host_adv_eng1'), true);
  assert.deepEqual(ledGroupsOf(db, 104), ['study_b', 'study_e']);
});

test('팀장 변경: 예전 팀장이 운영진이면 계정은 남고 맡은 그룹만 빠진다', async () => {
  const { db, call } = await setup();
  call('PATCH', '/api/v1/study-teams/study_a', { leaderId: 'u_28_01' });

  assert.equal(queryAll(db, 'SELECT 1 FROM admin WHERE id = ?', [MASTER_ID]).length, 1);
  assert.deepEqual(ledGroupsOf(db, MASTER_ID), []);
});

test('팀 삭제: 다른 그룹이 없는 팀장의 HOST 계정을 지운다', async () => {
  const { db, call } = await setup();
  const result = call<{ deletedHostIds: number[] }>('DELETE', '/api/v1/study-teams/study_c');

  assert.deepEqual(result.deletedHostIds, [101]);
  assert.equal(hostExists(db, 'host_c'), false);
});

test('팀원 삭제로 팀장이 해제되면 다른 그룹이 없는 HOST 계정을 지운다', async () => {
  const { db, call } = await setup();
  const memberId = queryAll<{ id: string }>(
    db,
    "SELECT id FROM team_members WHERE team_id = 'study_c' AND user_id = 'u_27_01'",
  )[0].id;
  call('DELETE', `/api/v1/study-teams/study_c/members/${memberId}`);

  assert.equal(hostExists(db, 'host_c'), false);
});

test('반기 전환: 지난 반기 그룹만 맡던 HOST 계정은 지우고, 다음 반기 팀장 계정은 남긴다', async () => {
  const { db, call } = await setup();
  call('POST', '/api/v1/semesters', {
    cohort: 28,
    semester: '27-1',
    startDate: '2027-01-01',
    endDate: '2027-06-30',
  });
  // study_c를 다음 반기 팀으로 옮긴다(host_c는 다음 반기 팀장).
  execute(db, "UPDATE teams SET semester_cohort = 28 WHERE id = 'study_c'");

  call('PATCH', '/api/v1/semesters/27-1', { isCurrent: true });

  assert.equal(hostExists(db, 'host_c'), true);
  assert.equal(hostExists(db, 'host_adv_ana1'), false);
  assert.deepEqual(ledGroupsOf(db, 101), ['study_c']);
});

// ── 비밀번호 초기화(설계 3.5) ─────────────────────────────────────────

test('비밀번호 초기화: 운영지원팀은 HOST 계정만 초기화하고, 운영진 계정이면 403이다', async () => {
  const { call } = await setup();

  call('PATCH', '/api/v1/admin/accounts/101/password', { newPassword: 'Reset!2027' });
  const session = call<{ accountId: number }>('POST', '/api/v1/auth/login', {
    username: 'host_c',
    password: 'Reset!2027',
  });
  assert.equal(session.accountId, 101);

  call('PUT', '/api/v1/mock/admin-session', { accountId: OPS_ID });
  expectApiError(
    () => call('PATCH', `/api/v1/admin/accounts/${PLANNER_ID}/password`, { newPassword: 'x' }),
    403,
  );
});

test('비밀번호 초기화: 운영지원팀에게는 없는 계정도 운영진 계정과 같은 403이다', async () => {
  const { call } = await setup();

  expectApiError(
    () => call('PATCH', '/api/v1/admin/accounts/9999/password', { newPassword: 'x' }),
    403,
    'FORBIDDEN',
  );
});

test('HOST 계정의 역할·부서는 계정 수정으로 바꿀 수 없다(400)', async () => {
  const { call, actAs } = await setup();
  actAs(MASTER_ID);

  expectApiError(
    () => call('PATCH', '/api/v1/admin/accounts/101', { role: 'TEAM', teamName: '기획팀' }),
    400,
    'HOST_ACCOUNT_NOT_EDITABLE',
  );
});

test('비밀번호 초기화: 두 권한이 모두 없으면 HOST 계정도 403이다', async () => {
  const { call, actAs } = await setup();
  actAs(PLANNER_ID);

  expectApiError(
    () => call('PATCH', '/api/v1/admin/accounts/101/password', { newPassword: 'x' }),
    403,
  );
});

// ── 회원 한 명에 계정 하나 ────────────────────────────────────────────

test('HOST 계정이 있는 회원은 운영진으로 지정할 수 없다(409 DUPLICATE_MEMBER_ACCOUNT)', async () => {
  const { call, actAs } = await setup();
  actAs(MASTER_ID);

  expectApiError(
    () =>
      call('PUT', '/api/v1/admin/operators/u_27_02', {
        teamName: '기획팀',
        username: 'boaz_plan_9',
        password: 'pw',
      }),
    409,
    'DUPLICATE_MEMBER_ACCOUNT',
  );
});
