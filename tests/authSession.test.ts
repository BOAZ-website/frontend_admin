import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { ClubMember, ClubMemberTermPage } from '../src/entities/club-member/model/types';
import { AUDIT_CATEGORIES } from '../src/entities/audit-log/model/types';
import { ApiError } from '../src/shared/api/apiError';
import { recordWrite } from '../src/shared/api/mock/audit';
import { MOCK_ROUTES } from '../src/shared/api/mock/mockRoutes';
import { createRouter } from '../src/shared/api/mock/router';
import { createDatabase, execute, queryAll } from '../src/shared/db/createDatabase';

// 2026-10-22 "시스템 및 계정 정리 계약"의 로그인·세션·역할 동기화·부문 순서·감사 로그 필터 시험.

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** 계약의 AuthSession 응답 모양. */
interface AuthSession {
  kind: 'ADMIN' | 'HOST';
  name: string;
  username: string;
  role: 'MASTER' | 'SUPER' | 'TEAM' | 'HOST';
  teamName: string | null;
  accountId: number | null;
  hostId: string | null;
  hostTeamId: string | null;
}

interface AuditFilters {
  categories: {
    key: string;
    label: string;
    permissions: { key: string; label: string }[];
  }[];
}

interface AuditRow {
  actor_admin_id: number | null;
  actor_user_id: string | null;
  actor_role: string | null;
  action: string;
  detail: string | null;
}

// 시드 값. 운영진 6번은 기획팀 팀장 김민정(u_26_17), HOST host_a는 남민서(u_26_01)의 study_a 계정.
const PLANNER = { username: 'boaz_plan_1', password: 'Boaz!2026', id: 6, userId: 'u_26_17' };
const HOST_A = { username: 'host_a', password: 'boaz2026!a', id: 'h1', userId: 'u_26_01' };
const HOST_C = { username: 'host_c', password: 'boaz2026!c', id: 'h3', userId: 'u_27_01' };

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(MOCK_ROUTES, { aroundWrite: recordWrite });
  const call = <T>(method: Method, path: string, body?: unknown) =>
    router.dispatch(db, method, path, body) as T;
  const login = (username: string, password: string) =>
    call<AuthSession>('POST', '/api/v1/auth/login', { username, password });
  const logCount = () => queryAll<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM audit_log')[0].n;
  const latestRow = () =>
    queryAll<AuditRow>(
      db,
      'SELECT actor_admin_id, actor_user_id, actor_role, action, detail FROM audit_log ORDER BY id DESC LIMIT 1',
    )[0];
  /** 감사 기록을 남기는 평범한 쓰기 요청(동아리원 전공 수정). */
  const write = (major: string) => call('PATCH', '/api/v1/club-members/u_28_01', { major });
  return { db, call, login, logCount, latestRow, write };
}

function expectApiError(work: () => unknown, status: number, code?: string) {
  assert.throws(
    work,
    (error: unknown) =>
      error instanceof ApiError && error.status === status && (!code || error.code === code),
  );
}

// ── 로그인 ──────────────────────────────────────────────────────────────

test('로그인: 운영진 아이디·비밀번호가 맞으면 운영진 세션을 준다', async () => {
  const { login } = await setup();
  const session = login(PLANNER.username, PLANNER.password);

  assert.deepEqual(session, {
    kind: 'ADMIN',
    name: '김민정',
    username: PLANNER.username,
    role: 'TEAM',
    teamName: '기획팀',
    accountId: PLANNER.id,
    hostId: null,
    hostTeamId: null,
  });

  const master = login('boaz_master', 'Boaz!2026');
  assert.equal(master.role, 'MASTER');
  assert.equal(master.name, '남민서');
  assert.equal(master.teamName, '서비스운영팀');
  assert.equal(master.accountId, 1);
});

test('로그인: 비밀번호가 틀리거나 없는 아이디면 401 INVALID_CREDENTIALS', async () => {
  const { login } = await setup();

  expectApiError(() => login(PLANNER.username, 'wrong-password'), 401, 'INVALID_CREDENTIALS');
  expectApiError(() => login('no_such_user', 'Boaz!2026'), 401, 'INVALID_CREDENTIALS');
  // 운영진 비밀번호로 HOST 아이디에, HOST 비밀번호로 운영진 아이디에 들어갈 수 없다.
  expectApiError(() => login(HOST_A.username, PLANNER.password), 401, 'INVALID_CREDENTIALS');
  expectApiError(() => login(PLANNER.username, HOST_A.password), 401, 'INVALID_CREDENTIALS');
});

test('로그인: HOST 계정이 맞으면 HOST 세션과 맡은 첫 그룹의 팀 id를 준다', async () => {
  const { login } = await setup();
  const session = login(HOST_A.username, HOST_A.password);

  assert.equal(session.kind, 'HOST');
  assert.equal(session.role, 'HOST');
  assert.equal(session.username, HOST_A.username);
  assert.equal(session.name, '남민서');
  assert.equal(session.hostId, HOST_A.id);
  assert.equal(session.hostTeamId, 'study_a');
  assert.equal(session.accountId, null);
  assert.ok(session.teamName === null || typeof session.teamName === 'string');
});

test('로그인: 운영진 지정 때 정한 아이디·초기 비밀번호로 로그인된다', async () => {
  const { call, login } = await setup();
  call('PUT', '/api/v1/admin/operators/u_28_11', {
    teamName: '기획팀',
    username: 'boaz_plan_7',
    password: 'Assigned!2027',
  });

  const session = login('boaz_plan_7', 'Assigned!2027');
  assert.equal(session.kind, 'ADMIN');
  assert.equal(session.username, 'boaz_plan_7');
  assert.equal(session.name, '박지훈');
  assert.equal(session.role, 'TEAM');
  assert.equal(session.teamName, '기획팀');
  expectApiError(() => login('boaz_plan_7', 'Boaz!2026'), 401, 'INVALID_CREDENTIALS');
});

test('로그인: 이미 운영진의 비밀번호만 바꾸면 새 비밀번호로 로그인되고 옛 비밀번호는 401이다', async () => {
  const { call, login } = await setup();
  call('PUT', `/api/v1/admin/operators/${PLANNER.userId}`, {
    teamName: '기획팀',
    password: 'Changed!2027',
  });

  const session = login(PLANNER.username, 'Changed!2027');
  assert.equal(session.accountId, PLANNER.id);
  assert.equal(session.teamName, '기획팀');
  expectApiError(() => login(PLANNER.username, PLANNER.password), 401, 'INVALID_CREDENTIALS');
});

test('로그인: 이미 운영진의 팀·아이디·비밀번호를 함께 바꾸면 새 아이디·비밀번호로만 로그인된다', async () => {
  const { call, login } = await setup();
  call('PUT', `/api/v1/admin/operators/${PLANNER.userId}`, {
    teamName: '디자인팀',
    username: 'boaz_design_9',
    password: 'Changed!2027',
  });

  const session = login('boaz_design_9', 'Changed!2027');
  assert.equal(session.accountId, PLANNER.id);
  assert.equal(session.teamName, '디자인팀');
  expectApiError(() => login(PLANNER.username, PLANNER.password), 401, 'INVALID_CREDENTIALS');
  expectApiError(() => login(PLANNER.username, 'Changed!2027'), 401, 'INVALID_CREDENTIALS');
  expectApiError(() => login('boaz_design_9', PLANNER.password), 401, 'INVALID_CREDENTIALS');
});

test('로그인: 같은 팀·같은 아이디만 보내면 비밀번호는 그대로다', async () => {
  const { call, login } = await setup();
  call('PUT', `/api/v1/admin/operators/${PLANNER.userId}`, {
    teamName: '기획팀',
    username: PLANNER.username,
  });
  assert.equal(login(PLANNER.username, PLANNER.password).accountId, PLANNER.id);
});

test('로그인: 시드 35~40번 운영진도 받은 아이디와 Boaz!2026으로 로그인된다', async () => {
  const { login } = await setup();
  const usernames = [
    'boaz_design_4',
    'boaz_design_5',
    'boaz_design_6',
    'boaz_plan_4',
    'boaz_plan_5',
    'boaz_plan_6',
  ];
  assert.deepEqual(
    usernames.map((username) => login(username, 'Boaz!2026').accountId),
    [35, 36, 37, 38, 39, 40],
  );
});

test('로그인: 회수된(사용 중이 아닌) HOST 계정은 403 ACCOUNT_LOCKED', async () => {
  const { call, login } = await setup();
  call('PATCH', `/api/v1/hosts/${HOST_C.id}`, { active: false });

  expectApiError(() => login(HOST_C.username, HOST_C.password), 403, 'ACCOUNT_LOCKED');
});

// ── 세션과 감사 기록 수행자 ─────────────────────────────────────────────

test('세션: 로그인한 운영진이 쓰면 감사 기록 수행자가 그 사람이다(1번 계정이 아니다)', async () => {
  const { login, latestRow, write } = await setup();
  login(PLANNER.username, PLANNER.password);
  write('통계학과');
  const row = latestRow();

  assert.equal(row.actor_admin_id, PLANNER.id);
  assert.notEqual(row.actor_admin_id, 1);
  assert.equal(row.actor_user_id, PLANNER.userId);
  assert.equal(row.actor_role, 'TEAM');
});

test('세션: HOST 세션의 쓰기는 actor_admin_id가 null, actor_user_id가 계정 주인, actor_role이 HOST다', async () => {
  const { login, latestRow, write } = await setup();
  login(HOST_C.username, HOST_C.password);
  write('통계학과');
  const row = latestRow();

  assert.equal(row.actor_admin_id, null);
  assert.equal(row.actor_user_id, HOST_C.userId);
  assert.equal(row.actor_role, 'HOST');
});

test('세션: HOST 세션에서 /admin/accounts/me는 403', async () => {
  const { call, login } = await setup();
  login(HOST_A.username, HOST_A.password);

  expectApiError(() => call('GET', '/api/v1/admin/accounts/me'), 403);
});

test('로그아웃하면 세션이 지워져 1번 계정으로 보고, admin-session {username}으로 세션을 되살린다', async () => {
  const { call, login, latestRow, write } = await setup();
  login(PLANNER.username, PLANNER.password);
  call('POST', '/api/v1/auth/logout');

  write('통계학과');
  assert.equal(latestRow().actor_admin_id, 1);

  call('PUT', '/api/v1/mock/admin-session', { username: PLANNER.username });
  write('경영학과');
  assert.equal(latestRow().actor_admin_id, PLANNER.id);
  assert.equal(latestRow().actor_user_id, PLANNER.userId);

  // 예전처럼 accountId로도 된다.
  call('PUT', '/api/v1/mock/admin-session', { accountId: 1 });
  write('수학과');
  assert.equal(latestRow().actor_admin_id, 1);
});

test('로그인·로그아웃 요청은 감사 기록을 남기지 않는다', async () => {
  const { call, login, logCount } = await setup();
  const before = logCount();

  login(PLANNER.username, PLANNER.password);
  login(HOST_A.username, HOST_A.password);
  expectApiError(() => login(PLANNER.username, 'wrong-password'), 401);
  call('POST', '/api/v1/auth/logout');

  assert.equal(logCount(), before);
});

test('감사 기록 어디에도 비밀번호가 남지 않는다(로그인·계정 발급·비밀번호 변경 포함)', async () => {
  const { db, call, login } = await setup();
  const secrets = [
    'Boaz!2026',
    'wrong-pass-1',
    'Issued!2027',
    'Changed!2027',
    'Assigned!2027',
    'Moved!2027',
    HOST_A.password,
  ];

  login(PLANNER.username, PLANNER.password);
  expectApiError(() => login(PLANNER.username, 'wrong-pass-1'), 401);
  login(HOST_A.username, HOST_A.password);
  call('POST', '/api/v1/auth/logout');
  call('POST', '/api/v1/admin/accounts', {
    userId: 'u_28_11',
    username: 'boaz_new_1',
    password: 'Issued!2027',
    role: 'TEAM',
    teamName: '기획팀',
  });
  call('PATCH', '/api/v1/admin/accounts/7/password', { newPassword: 'Changed!2027' });
  // 운영진 지정: 새 운영진(지정과 발급을 한 번에)
  call('PUT', '/api/v1/admin/operators/u_28_12', {
    teamName: '기획팀',
    username: 'boaz_assign_1',
    password: 'Assigned!2027',
  });
  // 이미 운영진의 팀·아이디·비밀번호 바꾸기
  call('PUT', '/api/v1/admin/operators/u_28_12', {
    teamName: '디자인팀',
    username: 'boaz_assign_2',
    password: 'Moved!2027',
  });
  // 400으로 거절된 요청도 기록되면 비밀번호가 남으면 안 된다.
  expectApiError(
    () =>
      call('PUT', '/api/v1/admin/operators/u_28_13', {
        teamName: '기획팀',
        password: 'Assigned!2027',
      }),
    400,
  );

  const rows = queryAll<Record<string, unknown>>(db, 'SELECT * FROM audit_log');
  const text = JSON.stringify(rows);
  for (const secret of secrets) assert.ok(!text.includes(secret), `${secret}가 감사 기록에 남았다`);
});

// ── 역할·팀장 동기화 ──────────────────────────────────────────────────

const clubRoleOf = (db: Awaited<ReturnType<typeof setup>>['db'], userId: string) =>
  queryAll<{ club_role: string }>(db, 'SELECT club_role FROM users WHERE id = ?', [userId])[0]
    .club_role;

test('운영진 계정을 발급하면 users.club_role이 OPERATOR, 삭제하면 MEMBER가 된다', async () => {
  const { db, call } = await setup();
  const userId = queryAll<{ id: string }>(
    db,
    `SELECT id FROM users WHERE club_role = 'MEMBER' AND club_status = 'ACTIVE'
       AND id NOT IN (SELECT user_id FROM admin) LIMIT 1`,
  )[0].id;

  const created = call<{ id: number }>('POST', '/api/v1/admin/accounts', {
    userId,
    username: 'boaz_role_sync',
    password: 'Issued!2027',
    role: 'TEAM',
    teamName: '기획팀',
  });
  assert.equal(clubRoleOf(db, userId), 'OPERATOR');

  call('DELETE', `/api/v1/admin/accounts/${created.id}`);
  assert.equal(clubRoleOf(db, userId), 'MEMBER');
});

test('시드에는 운영진 명단(admin) 없이 OPERATOR인 회원이 없고, 운영진은 모두 OPERATOR·PRESIDENT다', async () => {
  const { db } = await setup();
  const orphans = queryAll<{ id: string }>(
    db,
    "SELECT id FROM users WHERE club_role = 'OPERATOR' AND id NOT IN (SELECT user_id FROM admin)",
  ).map((row) => row.id);
  const plainAdmins = queryAll<{ id: string }>(
    db,
    "SELECT u.id FROM admin a JOIN users u ON u.id = a.user_id WHERE u.club_role = 'MEMBER'",
  ).map((row) => row.id);

  assert.deepEqual(orphans, []);
  assert.deepEqual(plainAdmins, []);
});

test('팀장이 다른 팀으로 옮기면 is_team_lead가 0이 된다', async () => {
  const { db, call } = await setup();
  const isLead = () =>
    queryAll<{ v: number }>(db, 'SELECT is_team_lead AS v FROM admin WHERE id = ?', [PLANNER.id])[0]
      .v;
  assert.equal(isLead(), 1, '시드에서 6번은 기획팀 팀장이다');

  call('PATCH', `/api/v1/admin/accounts/${PLANNER.id}`, { teamName: '디자인팀' });

  assert.equal(isLead(), 0);
});

// ── 부문 순서 ──────────────────────────────────────────────────────────

test('부문 정렬은 tracks.sort_order를 따른다(순서를 뒤집으면 엔지니어링 → 시각화 → 분석)', async () => {
  const { db, call } = await setup();
  // 시드 순서(분석 1, 시각화 2, 엔지니어링 3)를 뒤집는다. sort_order는 UNIQUE라 겹치지 않는 값으로 바꾼다.
  execute(db, "UPDATE tracks SET sort_order = 6 WHERE name = '분석'");
  execute(db, "UPDATE tracks SET sort_order = 5 WHERE name = '시각화'");
  execute(db, "UPDATE tracks SET sort_order = 4 WHERE name = '엔지니어링'");
  const REVERSED = ['엔지니어링', '시각화', '분석'];
  const isTrackOrdered = (members: readonly ClubMember[]) =>
    members.every(
      (member, i) =>
        i === 0 || REVERSED.indexOf(members[i - 1].track) <= REVERSED.indexOf(member.track),
    );

  const page = call<ClubMemberTermPage>(
    'GET',
    '/api/v1/club-members/by-term?status=ACTIVE&term=27',
  );
  assert.equal(page.members[0].track, '엔지니어링');
  assert.ok(isTrackOrdered(page.members));

  const activeInAll = call<ClubMember[]>('GET', '/api/v1/club-members').filter(
    (member) => member.status === 'ACTIVE',
  );
  assert.equal(activeInAll[0].track, '엔지니어링');
  assert.ok(isTrackOrdered(activeInAll));
});

// ── 감사 로그 필터 ─────────────────────────────────────────────────────

test('감사 로그 필터 API는 분류 전체를 순서대로 주고, 분류마다 권한 선택지가 있다', async () => {
  const { call } = await setup();
  const filters = call<AuditFilters>('GET', '/api/v1/admin/audit-logs/filters');

  assert.deepEqual(
    filters.categories.map((category) => [category.key, category.label]),
    AUDIT_CATEGORIES.map((category) => [category.id, category.label]),
  );
  for (const category of filters.categories) {
    // 권한이 없는 것이 맞는 분류가 생기면 여기에 예외로 적는다(지금은 없다).
    assert.ok(category.permissions.length > 0, `${category.label} 분류에 권한이 없다`);
    for (const permission of category.permissions) {
      assert.equal(typeof permission.key, 'string');
      assert.ok(permission.label.length > 0);
    }
  }
});

// ── 운영진·HOST 아이디 중복(409 DUPLICATE_USERNAME) ──────────────────────

test('운영진 지정(PUT operators)·추가(POST accounts)에 HOST 아이디를 쓰면 409 DUPLICATE_USERNAME', async () => {
  const { db, call } = await setup();
  const userId = queryAll<{ id: string }>(
    db,
    "SELECT id FROM users WHERE club_status = 'ACTIVE' AND id NOT IN (SELECT user_id FROM admin) LIMIT 1",
  )[0].id;

  expectApiError(
    () =>
      call('PUT', `/api/v1/admin/operators/${userId}`, {
        teamName: '기획팀',
        username: HOST_A.username,
        password: 'Issued!2027',
      }),
    409,
    'DUPLICATE_USERNAME',
  );
  assert.equal(
    queryAll(db, 'SELECT id FROM admin WHERE user_id = ?', [userId]).length,
    0,
    '409이면 운영진이 되지 않아야 한다',
  );
  expectApiError(
    () =>
      call('POST', '/api/v1/admin/accounts', {
        userId,
        username: HOST_A.username,
        password: 'Issued!2027',
        role: 'TEAM',
        teamName: '기획팀',
      }),
    409,
    'DUPLICATE_USERNAME',
  );
});

test('HOST 생성·수정에 운영진 아이디나 다른 HOST 아이디를 쓰면 409 DUPLICATE_USERNAME', async () => {
  const { call } = await setup();

  expectApiError(
    () => call('POST', '/api/v1/hosts', { username: 'boaz_master', initialPassword: 'x' }),
    409,
    'DUPLICATE_USERNAME',
  );
  expectApiError(
    () => call('PATCH', `/api/v1/hosts/${HOST_A.id}`, { username: 'boaz_master' }),
    409,
    'DUPLICATE_USERNAME',
  );
  expectApiError(
    () => call('PATCH', `/api/v1/hosts/${HOST_A.id}`, { username: HOST_C.username }),
    409,
    'DUPLICATE_USERNAME',
  );
});

test('HOST가 자기 아이디를 그대로 저장하거나, 새 아이디로 HOST를 만들면 거절하지 않는다', async () => {
  const { call } = await setup();

  const kept = call<{ username: string }>('PATCH', `/api/v1/hosts/${HOST_A.id}`, {
    username: HOST_A.username,
  });
  assert.equal(kept.username, HOST_A.username);

  const created = call<{ username: string }>('POST', '/api/v1/hosts', {
    username: 'host_new_unique',
    initialPassword: 'boaz2026!new',
  });
  assert.equal(created.username, 'host_new_unique');
});
