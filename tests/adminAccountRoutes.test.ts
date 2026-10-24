import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type {
  AccountHolder,
  AdminAccount,
  PermissionCatalog,
} from '../src/entities/admin-account/model/types';
import { ApiError } from '../src/shared/api/apiError';
import { createRouter } from '../src/shared/api/mock/router';
import { adminAccountRoutes } from '../src/shared/api/mock/routes/adminAccountRoutes';
import { createDatabase, execute } from '../src/shared/db/createDatabase';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(adminAccountRoutes);
  const call = <T>(method: Method, path: string, body?: unknown) =>
    router.dispatch(db, method, path, body) as T;
  const loginAs = (accountId: number) =>
    call<AdminAccount>('PUT', '/api/v1/mock/admin-session', { accountId });
  return { db, call, loginAs };
}

function expectApiError(work: () => unknown, status: number, code?: string) {
  assert.throws(
    work,
    (error: unknown) =>
      error instanceof ApiError && error.status === status && (!code || error.code === code),
  );
}

/**
 * 운영진이면서 스터디장·ADV 팀장인 경우를 만든다. 시드의 출결 데이터는 건드리지 않고, 이 테스트 DB에서만
 * 고준서가 맡던 그룹(adv_t1·study_d)과 HOST 계정(host_adv_ana1)을 운영지원팀 운영진 전혜린(8번 계정)에게 옮긴다.
 */
function makeDualLeader(db: Awaited<ReturnType<typeof setup>>['db']) {
  execute(db, "UPDATE teams SET leader_id = 'u_27_26' WHERE id IN ('adv_t1', 'study_d')");
  execute(db, "UPDATE host_accounts SET user_id = 'u_27_26' WHERE id = 'h_adv1'");
}

// 박지훈(u_28_11)은 아직 운영진 계정이 없는 회원이다.
const NEW_ACCOUNT = {
  userId: 'u_28_11',
  username: 'boaz_pr_lead',
  password: 'Boaz!2027',
  role: 'TEAM',
  teamName: '홍보팀',
};

test('계정 목록은 기본 권한 세트·맡은 그룹·예외·유효 권한을 함께 돌려준다', async () => {
  const { db, call } = await setup();
  makeDualLeader(db);
  const accounts = call<AdminAccount[]>('GET', '/api/v1/admin/accounts');
  assert.equal(accounts.length, 40);

  const dual = accounts.find((a) => a.id === 8)!;
  assert.equal(dual.baseSetKey, 'opsTeam');
  assert.deepEqual(dual.leadership, ['ADV', 'STUDY']);
  assert.ok(dual.effectivePermissions.includes('ATTENDANCE_STUDY_ENTRY_OWN_GROUP_WRITE'));

  const planner = accounts.find((a) => a.teamName === '기획팀')!;
  assert.equal(planner.baseSetKey, 'otherTeam');
  assert.deepEqual(planner.overrides, { CONTENT_WRITE: true });
  assert.ok(planner.effectivePermissions.includes('CONTENT_WRITE'));
});

test('로그인한 계정의 권한이 없으면 403을 돌려준다', async () => {
  const { call, loginAs } = await setup();
  loginAs(7); // 디자인팀(기타 운영진): 계정 목록 조회 권한 없음
  expectApiError(() => call('GET', '/api/v1/admin/accounts'), 403, 'FORBIDDEN');
  assert.equal(call<AdminAccount>('GET', '/api/v1/admin/accounts/me').id, 7);

  loginAs(5); // 서비스운영팀: 목록은 보지만 발급은 못 한다
  assert.equal(call<AdminAccount[]>('GET', '/api/v1/admin/accounts').length, 40);
  expectApiError(() => call('POST', '/api/v1/admin/accounts', NEW_ACCOUNT), 403);
});

test('새 팀으로 발급한 계정은 기타 운영진 권한을 받고, 다른 역할 전용 자리는 거부한다', async () => {
  const { call } = await setup();
  const created = call<AdminAccount>('POST', '/api/v1/admin/accounts', NEW_ACCOUNT);
  assert.equal(created.baseSetKey, 'otherTeam');
  assert.ok(created.effectivePermissions.includes('EVALUATION_OWN_TRACK_WRITE'));

  const catalog = call<PermissionCatalog>('GET', '/api/v1/admin/permissions');
  assert.ok(catalog.teamNames.includes('홍보팀'));

  expectApiError(
    () =>
      call('POST', '/api/v1/admin/accounts', {
        ...NEW_ACCOUNT,
        userId: 'u_28_12',
        username: 'boaz_x',
        teamName: '대표진',
      }),
    400,
    'INVALID_ROLE_TEAM',
  );
  // 다른 회원이라도 같은 아이디는 쓸 수 없다.
  expectApiError(
    () => call('POST', '/api/v1/admin/accounts', { ...NEW_ACCOUNT, userId: 'u_28_12' }),
    409,
    'DUPLICATE_USERNAME',
  );
});

test('역할·부서를 바꾸면 권한 예외가 지워지고, 본인 역할은 바꿀 수 없다', async () => {
  const { call } = await setup();
  const moved = call<AdminAccount>('PATCH', '/api/v1/admin/accounts/6', {
    teamName: '서비스운영팀',
  });
  assert.equal(moved.baseSetKey, 'serviceTeam');
  assert.deepEqual(moved.overrides, {});

  expectApiError(
    () => call('PATCH', '/api/v1/admin/accounts/1', { role: 'TEAM' }),
    400,
    'CANNOT_MODIFY_OWN_ROLE',
  );
});

test('권한 저장은 기본 세트와 다른 항목만 예외로 남긴다', async () => {
  const { call } = await setup();
  const designer = call<AdminAccount[]>('GET', '/api/v1/admin/accounts').find((a) => a.id === 7)!;
  const desired = [...designer.effectivePermissions, 'APPLICANT_CSV_READ'].filter(
    (key) => key !== 'FINAL_DECISION_READ',
  );
  const saved = call<AdminAccount>('PUT', '/api/v1/admin/accounts/7/permissions', {
    permissions: desired,
  });
  assert.deepEqual(saved.overrides, { APPLICANT_CSV_READ: true, FINAL_DECISION_READ: false });
});

test('"타 계정 정보 수정" 권한은 본인에게서, 또 마지막 보유자에게서 회수할 수 없다', async () => {
  const { call } = await setup();
  const permissionsOf = (accountId: number) =>
    call<AdminAccount[]>('GET', '/api/v1/admin/accounts').find((a) => a.id === accountId)!
      .effectivePermissions;
  const save = (accountId: number, permissions: string[]) =>
    call<AdminAccount>('PUT', `/api/v1/admin/accounts/${accountId}/permissions`, { permissions });

  expectApiError(
    () =>
      save(
        1,
        permissionsOf(1).filter((key) => key !== 'ADMIN_ACCOUNT_WRITE'),
      ),
    409,
    'CANNOT_REVOKE_OWN_ACCOUNT_WRITE',
  );
  expectApiError(() => call('DELETE', '/api/v1/admin/accounts/1'), 400, 'CANNOT_DELETE_SELF');

  // 다른 계정에 먼저 주면 보유자가 둘이 되어, 그 계정의 권한은 다시 회수할 수 있다.
  save(5, [...permissionsOf(5), 'ADMIN_ACCOUNT_WRITE']);
  const revoked = save(
    5,
    permissionsOf(5).filter((key) => key !== 'ADMIN_ACCOUNT_WRITE'),
  );
  assert.ok(!revoked.effectivePermissions.includes('ADMIN_ACCOUNT_WRITE'));
});

test('본인 비밀번호는 현재 비밀번호가 맞아야 바뀐다', async () => {
  const { call, loginAs } = await setup();
  loginAs(7);
  expectApiError(
    () =>
      call('PATCH', '/api/v1/admin/accounts/7/password', {
        currentPassword: 'wrong',
        newPassword: 'Boaz!2030',
      }),
    400,
    'INVALID_CURRENT_PASSWORD',
  );
  call('PATCH', '/api/v1/admin/accounts/7/password', {
    currentPassword: 'Boaz!2026',
    newPassword: 'Boaz!2030',
  });
  expectApiError(
    () => call('PATCH', '/api/v1/admin/accounts/6/password', { newPassword: 'Boaz!2030' }),
    403,
  );
});

test('운영진 계정의 이름·기수·부문은 회원 정보에서 오고, 회원 정보를 고치면 그대로 반영된다', async () => {
  const { db, call } = await setup();
  const [master] = call<AdminAccount[]>('GET', '/api/v1/admin/accounts');
  assert.equal(master.userId, 'u_26_01');
  assert.deepEqual([master.name, master.term, master.track], ['남민서', 26, '엔지니어링']);

  execute(db, "UPDATE users SET term = 27, track = '시각화' WHERE id = 'u_26_01'");
  const me = call<AdminAccount>('GET', '/api/v1/admin/accounts/me');
  assert.deepEqual([me.term, me.track], [27, '시각화']);
});

test('회원 한 명에 운영진 계정은 하나이고, 없는 회원으로는 만들 수 없다', async () => {
  const { call } = await setup();
  expectApiError(
    () =>
      call('POST', '/api/v1/admin/accounts', {
        ...NEW_ACCOUNT,
        userId: 'u_26_01',
        username: 'boaz_dup',
      }),
    409,
    'DUPLICATE_ADMIN_USER',
  );
  expectApiError(
    () =>
      call('POST', '/api/v1/admin/accounts', {
        ...NEW_ACCOUNT,
        userId: 'u_none',
        username: 'boaz_none',
      }),
    400,
    'USER_NOT_FOUND',
  );
});

test('운영진 계정이 있는 회원은 회원 DB에서 지울 수 없다(외래 키)', async () => {
  const { db } = await setup();
  assert.throws(() => execute(db, "DELETE FROM users WHERE id = 'u_26_01'"), /FOREIGN KEY/);
});

test('역할·부서가 그대로인 수정은 저장하지 않아 권한 예외가 남는다', async () => {
  const { call } = await setup();
  const kept = call<AdminAccount>('PATCH', '/api/v1/admin/accounts/6', { teamName: '기획팀' });
  assert.deepEqual(kept.overrides, { CONTENT_WRITE: true });
});

test('계정 생성·삭제 권한이 없으면 삭제는 403이다', async () => {
  const { call, loginAs } = await setup();
  loginAs(5); // 서비스운영팀: 계정 생성·삭제 권한 없음
  expectApiError(() => call('DELETE', '/api/v1/admin/accounts/7'), 403, 'FORBIDDEN');
});

test('"타 계정 정보 수정" 권한의 마지막 보유자는 삭제할 수 없다', async () => {
  const { db, call, loginAs } = await setup();
  // 대표진(2번)에게 계정 생성·삭제를 주고, 서비스운영팀장(1번) 대신 5번만 "타 계정 정보 수정"을 갖게 한다.
  execute(
    db,
    `INSERT INTO admin_permission_override (admin_id, permission, effect, granted_by, created_at) VALUES
       (2, 'ADMIN_ACCOUNT_CREATE_DELETE', 'GRANT', 1, '2026-10-17 10:00:00'),
       (1, 'ADMIN_ACCOUNT_WRITE', 'REVOKE', 1, '2026-10-17 10:00:00'),
       (5, 'ADMIN_ACCOUNT_WRITE', 'GRANT', 1, '2026-10-17 10:00:00')`,
  );
  loginAs(2);
  expectApiError(() => call('DELETE', '/api/v1/admin/accounts/5'), 409, 'LAST_ACCOUNT_MANAGER');
});

test('팀장이 바뀌면 맡은 그룹도 새 팀장의 운영진 계정으로 옮겨진다', async () => {
  const { db, call } = await setup();
  const leadershipOf = (accountId: number) =>
    call<AdminAccount[]>('GET', '/api/v1/admin/accounts').find((a) => a.id === accountId)!
      .leadership;

  const leaderAccountOf = (groupId: string) =>
    db.exec('SELECT admin_id FROM admin_group_leader WHERE group_id = ?', [groupId])[0]?.values;

  makeDualLeader(db);
  execute(db, "UPDATE teams SET leader_id = 'u_26_08' WHERE id = 'adv_t1'");
  assert.deepEqual(leadershipOf(8), ['STUDY']);
  assert.deepEqual(leaderAccountOf('adv_t1'), [[4]]);

  // 운영진 계정이 없는 회원이 팀장이 되면 그 팀은 어느 계정에도 붙지 않는다.
  execute(db, "UPDATE teams SET leader_id = 'u_28_13' WHERE id = 'study_d'");
  assert.deepEqual(leadershipOf(8), []);
  assert.equal(leaderAccountOf('study_d'), undefined);
});

test('권한 저장은 없는 권한 키를 400으로, 권한 부여 권한이 없으면 403으로 거부한다', async () => {
  const { call, loginAs } = await setup();
  expectApiError(
    () =>
      call('PUT', '/api/v1/admin/accounts/7/permissions', {
        permissions: ['CONTENT_WRITE', 'NOT_A_PERMISSION'],
      }),
    400,
    'UNKNOWN_PERMISSION',
  );
  expectApiError(
    () => call('PUT', '/api/v1/admin/accounts/7/permissions', { permissions: 'CONTENT_WRITE' }),
    400,
  );

  loginAs(5); // 서비스운영팀: 권한 부여(커스텀) 권한 없음
  expectApiError(
    () => call('PUT', '/api/v1/admin/accounts/7/permissions', { permissions: [] }),
    403,
    'FORBIDDEN',
  );
});

test('계정 통합 목록은 운영진 계정과 HOST 계정을 회원 단위로 합치고 맡은 그룹을 싣는다', async () => {
  const { db, call, loginAs } = await setup();
  makeDualLeader(db);
  const holders = call<AccountHolder[]>('GET', '/api/v1/admin/account-holders');

  // 운영진 40명 + HOST 계정만 있는 4명(문지훈·강태양·최민혁·송하늘)
  assert.equal(holders.length, 44);
  assert.equal(new Set(holders.map((holder) => holder.key)).size, holders.length);

  // 운영지원팀 운영진이면서 ADV·스터디 팀장인 전혜린: 한 사람으로 합쳐진다
  const dual = holders.find((holder) => holder.userId === 'u_27_26')!;
  assert.equal(dual.adminAccount?.teamName, '운영지원팀');
  assert.deepEqual(
    dual.hostLogins.map((login) => login.username),
    ['host_adv_ana1'],
  );
  assert.deepEqual(dual.leaderGroups.map((group) => group.teamId).sort(), ['adv_t1', 'study_d']);

  // HOST 계정만 있는 사람은 운영진 계정이 없다
  const hostOnly = holders.find((holder) => holder.userId === 'u_28_08')!;
  assert.equal(hostOnly.adminAccount, null);
  assert.deepEqual(
    hostOnly.leaderGroups.map((group) => group.groupType),
    ['ADV'],
  );

  loginAs(7); // 계정 목록 조회 권한 없음
  expectApiError(() => call('GET', '/api/v1/admin/account-holders'), 403, 'FORBIDDEN');
});

test('모든 운영진 계정에는 아이디가 있다(시드 35~40번 포함)', async () => {
  const { call } = await setup();
  const accounts = call<AdminAccount[]>('GET', '/api/v1/admin/accounts');
  assert.deepEqual(
    accounts.filter((account) => typeof account.username !== 'string' || !account.username),
    [],
  );
  const usernameOf = (id: number) => accounts.find((account) => account.id === id)?.username;
  assert.deepEqual([35, 36, 37, 38, 39, 40].map(usernameOf), [
    'boaz_design_4',
    'boaz_design_5',
    'boaz_design_6',
    'boaz_plan_4',
    'boaz_plan_5',
    'boaz_plan_6',
  ]);
  assert.equal(new Set(accounts.map((account) => account.username)).size, accounts.length);
});

test('운영진 추가(POST)는 아이디·초기 비밀번호가 모두 있어야 하고, 없거나 하나만 있으면 400이다', async () => {
  const { call } = await setup();
  const { username: _username, password: _password, ...withoutCredentials } = NEW_ACCOUNT;
  expectApiError(
    () => call('POST', '/api/v1/admin/accounts', withoutCredentials),
    400,
    'INCOMPLETE_CREDENTIALS',
  );
  expectApiError(
    () => call('POST', '/api/v1/admin/accounts', { ...withoutCredentials, username: 'boaz_half' }),
    400,
    'INCOMPLETE_CREDENTIALS',
  );
  expectApiError(
    () => call('POST', '/api/v1/admin/accounts', { ...withoutCredentials, password: 'Boaz!2027' }),
    400,
    'INCOMPLETE_CREDENTIALS',
  );
});

test('수정·비밀번호 변경은 권한을 먼저 확인해, 권한이 없으면 없는 계정 id에도 403을 돌려준다', async () => {
  const { call, loginAs } = await setup();
  loginAs(7); // 디자인팀(기타 운영진): 타 계정 정보 수정 권한 없음
  expectApiError(
    () => call('PATCH', '/api/v1/admin/accounts/6', { teamName: '기획팀' }),
    403,
    'FORBIDDEN',
  );
  expectApiError(
    () => call('PATCH', '/api/v1/admin/accounts/9999', { teamName: '기획팀' }),
    403,
    'FORBIDDEN',
  );
  expectApiError(
    () => call('PATCH', '/api/v1/admin/accounts/9999/password', { newPassword: 'x' }),
    403,
    'FORBIDDEN',
  );

  loginAs(1); // 권한이 있으면 없는 계정은 404다.
  expectApiError(() => call('PATCH', '/api/v1/admin/accounts/9999', { teamName: '기획팀' }), 404);
});

test('팀 이름의 앞뒤 공백은 지우고, 공백만 있으면 400이다', async () => {
  const { call } = await setup();
  const moved = call<AdminAccount>('PATCH', '/api/v1/admin/accounts/6', {
    teamName: ' 서비스운영팀 ',
  });
  assert.equal(moved.teamName, '서비스운영팀');
  assert.equal(moved.baseSetKey, 'serviceTeam');

  expectApiError(
    () => call('PATCH', '/api/v1/admin/accounts/6', { teamName: '   ' }),
    400,
    'INVALID_TEAM_NAME',
  );
  // '대표진 '처럼 공백이 붙어도 대표진 자리로 보고, TEAM 역할로는 받지 않는다.
  expectApiError(
    () => call('PATCH', '/api/v1/admin/accounts/7', { teamName: '대표진 ' }),
    400,
    'INVALID_ROLE_TEAM',
  );
});

const clubRoleOf = (db: Awaited<ReturnType<typeof setup>>['db'], userId: string) =>
  db.exec('SELECT club_role FROM users WHERE id = ?', [userId])[0]?.values[0]?.[0];

const accountOf = (call: Awaited<ReturnType<typeof setup>>['call'], userId: string) =>
  call<AdminAccount[]>('GET', '/api/v1/admin/accounts').find(
    (account) => account.userId === userId,
  );

// 새 운영진 지정에 보내는 아이디·초기 비밀번호.
const NEW_CREDENTIALS = { username: 'boaz_plan_7', password: 'Boaz!2027' };

test('한 명의 운영진 지정은 새 운영진에게 보낸 아이디로 계정을 만들고, 팀을 옮기고, null이면 운영진에서 뺀다', async () => {
  const { db, call } = await setup();

  call('PUT', '/api/v1/admin/operators/u_28_11', { teamName: '기획팀', ...NEW_CREDENTIALS });
  const added = accountOf(call, 'u_28_11')!;
  assert.equal(added.teamName, '기획팀');
  assert.equal(added.username, NEW_CREDENTIALS.username);
  assert.equal(added.role, 'TEAM');
  assert.equal(clubRoleOf(db, 'u_28_11'), 'OPERATOR');

  call('PUT', '/api/v1/admin/operators/u_28_11', { teamName: ' 디자인팀 ' });
  assert.equal(accountOf(call, 'u_28_11')?.teamName, '디자인팀');

  call('PUT', '/api/v1/admin/operators/u_28_11', { teamName: null });
  assert.equal(accountOf(call, 'u_28_11'), undefined);
  assert.equal(clubRoleOf(db, 'u_28_11'), 'MEMBER');
});

test('새 운영진 지정의 아이디는 앞뒤 공백을 지우고 저장한다', async () => {
  const { call } = await setup();
  call('PUT', '/api/v1/admin/operators/u_28_11', {
    teamName: '기획팀',
    username: ' boaz_trim_1 ',
    password: 'Boaz!2027',
  });
  assert.equal(accountOf(call, 'u_28_11')?.username, 'boaz_trim_1');
});

test('새 운영진 지정에 아이디·초기 비밀번호가 없거나 하나만 있으면 400 INCOMPLETE_CREDENTIALS이고 운영진이 되지 않는다', async () => {
  const { db, call } = await setup();
  const assign = (body: Record<string, unknown>) =>
    call('PUT', '/api/v1/admin/operators/u_28_11', { teamName: '기획팀', ...body });

  expectApiError(() => assign({}), 400, 'INCOMPLETE_CREDENTIALS');
  expectApiError(() => assign({ username: 'boaz_half' }), 400, 'INCOMPLETE_CREDENTIALS');
  expectApiError(() => assign({ password: 'Boaz!2027' }), 400, 'INCOMPLETE_CREDENTIALS');
  expectApiError(
    () => assign({ username: '   ', password: 'Boaz!2027' }),
    400,
    'INCOMPLETE_CREDENTIALS',
  );

  assert.equal(accountOf(call, 'u_28_11'), undefined);
  assert.equal(clubRoleOf(db, 'u_28_11'), 'MEMBER');
});

test('새 운영진 지정에 다른 운영진이 쓰는 아이디를 보내면 409 DUPLICATE_USERNAME', async () => {
  const { call } = await setup();
  const assignWith = (username: string) =>
    call('PUT', '/api/v1/admin/operators/u_28_11', {
      teamName: '기획팀',
      username,
      password: 'Boaz!2027',
    });
  expectApiError(() => assignWith('boaz_plan_1'), 409, 'DUPLICATE_USERNAME');
  // 시드 35~40번에 준 아이디도 이미 쓰는 아이디다.
  expectApiError(() => assignWith('boaz_design_4'), 409, 'DUPLICATE_USERNAME');
  assert.equal(accountOf(call, 'u_28_11'), undefined);
});

// 6번(김민정, u_26_17)은 기획팀 운영진이고 아이디는 boaz_plan_1, 권한 예외 CONTENT_WRITE가 있다.
test('이미 운영진이면 팀·아이디를 한 요청으로 함께 바꾼다', async () => {
  const { call } = await setup();
  call('PUT', '/api/v1/admin/operators/u_26_17', {
    teamName: '디자인팀',
    username: ' boaz_design_9 ',
    password: 'Changed!2027',
  });
  const moved = accountOf(call, 'u_26_17')!;
  assert.equal(moved.id, 6);
  assert.equal(moved.teamName, '디자인팀');
  assert.equal(moved.username, 'boaz_design_9');
  assert.deepEqual(moved.overrides, {});
});

test('이미 운영진이고 팀이 같으면 아이디만 바꾸고, 팀과 권한 예외는 그대로다', async () => {
  const { call } = await setup();
  call('PUT', '/api/v1/admin/operators/u_26_17', {
    teamName: '기획팀',
    username: 'boaz_plan_renamed',
  });
  const kept = accountOf(call, 'u_26_17')!;
  assert.equal(kept.username, 'boaz_plan_renamed');
  assert.equal(kept.teamName, '기획팀');
  assert.deepEqual(kept.overrides, { CONTENT_WRITE: true });
});

test('이미 운영진이고 같은 팀·같은 아이디를 보내면 아무것도 바뀌지 않는다', async () => {
  const { call } = await setup();
  const before = accountOf(call, 'u_26_17')!;
  call('PUT', '/api/v1/admin/operators/u_26_17', { teamName: '기획팀', username: 'boaz_plan_1' });
  // 자기 아이디는 겹침으로 보지 않는다(앞뒤 공백이 있어도).
  call('PUT', '/api/v1/admin/operators/u_26_17', {
    teamName: '기획팀',
    username: ' boaz_plan_1 ',
  });
  assert.deepEqual(accountOf(call, 'u_26_17'), before);
});

test('이미 운영진의 아이디를 다른 운영진·HOST 아이디로 바꾸면 409, 빈 아이디는 400이고 아무것도 바뀌지 않는다', async () => {
  const { call } = await setup();
  const before = accountOf(call, 'u_26_17')!;
  const change = (body: Record<string, unknown>) =>
    call('PUT', '/api/v1/admin/operators/u_26_17', body);

  expectApiError(
    () => change({ teamName: '디자인팀', username: 'boaz_plan_2', password: 'Changed!2027' }),
    409,
    'DUPLICATE_USERNAME',
  );
  expectApiError(
    () => change({ teamName: '디자인팀', username: 'host_a' }),
    409,
    'DUPLICATE_USERNAME',
  );
  expectApiError(
    () => change({ teamName: '디자인팀', username: '   ', password: 'Changed!2027' }),
    400,
    'INCOMPLETE_CREDENTIALS',
  );
  expectApiError(() => change({ teamName: '기획팀', username: '' }), 400, 'INCOMPLETE_CREDENTIALS');

  // 검사에 걸리면 팀도 옮기지 않는다(셋은 함께 저장된다).
  assert.deepEqual(accountOf(call, 'u_26_17'), before);
});

test('다른 팀 운영진을 옮기면 기본 권한 세트가 새 팀 기준이 되고 권한 예외가 지워진다', async () => {
  const { call } = await setup();
  // 6번(기획팀)은 시드에서 CONTENT_WRITE 예외가 있다.
  assert.deepEqual(accountOf(call, 'u_26_17')?.overrides, { CONTENT_WRITE: true });

  call('PUT', '/api/v1/admin/operators/u_26_17', { teamName: '서비스운영팀' });
  const moved = accountOf(call, 'u_26_17')!;
  assert.equal(moved.baseSetKey, 'serviceTeam');
  assert.deepEqual(moved.overrides, {});

  // 서비스운영팀(u_26_23)에서 자료연구팀으로 옮기면 기타 운영진 세트를 받는다.
  call('PUT', '/api/v1/admin/operators/u_26_23', { teamName: '자료연구팀' });
  const other = accountOf(call, 'u_26_23')!;
  assert.equal(other.teamName, '자료연구팀');
  assert.equal(other.baseSetKey, 'otherTeam');
  assert.deepEqual(other.overrides, {});
});

test('대표진으로 지정하면 대표진 역할(SUPER)을 받는다', async () => {
  const { call } = await setup();
  call('PUT', '/api/v1/admin/operators/u_28_11', { teamName: '대표진', ...NEW_CREDENTIALS });
  assert.equal(accountOf(call, 'u_28_11')?.role, 'SUPER');

  // 이미 운영진인 사람을 대표진으로 옮겨도 SUPER가 된다.
  call('PUT', '/api/v1/admin/operators/u_26_17', { teamName: '대표진' });
  assert.equal(accountOf(call, 'u_26_17')?.role, 'SUPER');
});

test('운영진 지정은 본인·서비스운영팀장(MASTER)을 빼거나 옮기지 못하고, 권한이 없으면 403이다', async () => {
  const { db, call, loginAs } = await setup();
  // 1번(로그인한 서비스운영팀장 본인)
  expectApiError(
    () => call('PUT', '/api/v1/admin/operators/u_26_01', { teamName: null }),
    400,
    'CANNOT_MODIFY_OWN_ROLE',
  );
  expectApiError(
    () => call('PUT', '/api/v1/admin/operators/u_26_01', { teamName: '기획팀' }),
    400,
    'CANNOT_MODIFY_OWN_ROLE',
  );

  // 대표진(2번)에게 계정 생성·삭제를 주고 MASTER(1번)를 빼려 하면 거부한다.
  execute(
    db,
    `INSERT INTO admin_permission_override (admin_id, permission, effect, granted_by, created_at) VALUES
       (2, 'ADMIN_ACCOUNT_CREATE_DELETE', 'GRANT', 1, '2026-10-24 10:00:00')`,
  );
  loginAs(2);
  expectApiError(
    () => call('PUT', '/api/v1/admin/operators/u_26_01', { teamName: null }),
    400,
    'CANNOT_MOVE_MASTER',
  );
  assert.equal(accountOf(call, 'u_26_01')?.role, 'MASTER');

  loginAs(5); // 서비스운영팀: 계정 생성·삭제 권한 없음
  expectApiError(
    () =>
      call('PUT', '/api/v1/admin/operators/u_28_11', { teamName: '기획팀', ...NEW_CREDENTIALS }),
    403,
    'FORBIDDEN',
  );
});

// 본인·MASTER의 아이디·비밀번호 변경을 막을 때의 오류 코드. 팀도 함께 바꾸면 팀 검사(CANNOT_MODIFY_OWN_ROLE·CANNOT_MOVE_MASTER)가 먼저 난다.
const OWN_CREDENTIALS_CODE = 'CANNOT_MODIFY_OWN_CREDENTIALS';
const MASTER_CREDENTIALS_CODE = 'CANNOT_MODIFY_MASTER_CREDENTIALS';

const credentialsOf = (db: Awaited<ReturnType<typeof setup>>['db'], id: number) =>
  db.exec('SELECT username, password FROM admin WHERE id = ?', [id])[0]?.values[0];

test('운영진 지정으로 본인(1번 MASTER)의 아이디·비밀번호는 바꿀 수 없고, 같은 아이디만 보내면 통과한다', async () => {
  const { db, call } = await setup();
  const before = accountOf(call, 'u_26_01');
  const beforeCredentials = credentialsOf(db, 1);
  const change = (body: Record<string, unknown>) =>
    call('PUT', '/api/v1/admin/operators/u_26_01', { teamName: '서비스운영팀', ...body });

  expectApiError(() => change({ username: 'boaz_master_2' }), 400, OWN_CREDENTIALS_CODE);
  expectApiError(() => change({ password: 'Changed!2027' }), 400, OWN_CREDENTIALS_CODE);
  expectApiError(
    () => change({ username: 'boaz_master_2', password: 'Changed!2027' }),
    400,
    OWN_CREDENTIALS_CODE,
  );
  assert.deepEqual(accountOf(call, 'u_26_01'), before);
  assert.deepEqual(credentialsOf(db, 1), beforeCredentials);

  // 아이디가 그대로이고 비밀번호를 보내지 않으면 막지 않는다(바뀌는 것도 없다).
  change({ username: 'boaz_master' });
  change({});
  assert.deepEqual(accountOf(call, 'u_26_01'), before);
  assert.deepEqual(credentialsOf(db, 1), beforeCredentials);
});

test('다른 계정으로 로그인해도 MASTER의 아이디·비밀번호는 운영진 지정으로 바꿀 수 없다', async () => {
  const { db, call, loginAs } = await setup();
  // 대표진(2번)에게 계정 생성·삭제를 준다.
  execute(
    db,
    `INSERT INTO admin_permission_override (admin_id, permission, effect, granted_by, created_at) VALUES
       (2, 'ADMIN_ACCOUNT_CREATE_DELETE', 'GRANT', 1, '2026-10-24 10:00:00')`,
  );
  loginAs(2);
  const before = accountOf(call, 'u_26_01');
  const beforeCredentials = credentialsOf(db, 1);
  const change = (body: Record<string, unknown>) =>
    call('PUT', '/api/v1/admin/operators/u_26_01', { teamName: '서비스운영팀', ...body });

  expectApiError(() => change({ username: 'boaz_master_2' }), 400, MASTER_CREDENTIALS_CODE);
  expectApiError(() => change({ password: 'Changed!2027' }), 400, MASTER_CREDENTIALS_CODE);
  expectApiError(
    () => change({ username: 'boaz_master_2', password: 'Changed!2027' }),
    400,
    MASTER_CREDENTIALS_CODE,
  );
  assert.deepEqual(accountOf(call, 'u_26_01'), before);
  assert.deepEqual(credentialsOf(db, 1), beforeCredentials);

  change({ username: ' boaz_master ' });
  assert.deepEqual(accountOf(call, 'u_26_01'), before);
  assert.deepEqual(credentialsOf(db, 1), beforeCredentials);

  // MASTER가 아닌 다른 계정(6번)은 2번이 바꿀 수 있다.
  call('PUT', '/api/v1/admin/operators/u_26_17', { teamName: '기획팀', password: 'Changed!2027' });
  assert.equal(credentialsOf(db, 6)?.[1], 'Changed!2027');
});

test('운영진 계정을 삭제하면 운영진에서도 빠져 회원 역할이 MEMBER가 된다', async () => {
  const { db, call } = await setup();
  // 7번(디자인팀 운영진, u_26_14)
  assert.equal(clubRoleOf(db, 'u_26_14'), 'OPERATOR');
  call('DELETE', '/api/v1/admin/accounts/7');

  assert.equal(accountOf(call, 'u_26_14'), undefined);
  assert.equal(clubRoleOf(db, 'u_26_14'), 'MEMBER');
  assert.equal(
    db.exec("SELECT id FROM admin WHERE user_id = 'u_26_14'").length,
    0,
    '운영진 명단(admin)에 행이 남으면 안 된다',
  );
});

test('지운 경로(계정 발급·팀 일괄 지정)는 더 이상 없다', async () => {
  const { call } = await setup();
  expectApiError(
    () =>
      call('PUT', '/api/v1/admin/accounts/35/credentials', {
        username: 'boaz_x',
        password: 'abc',
      }),
    404,
  );
  expectApiError(
    () =>
      call('PUT', `/api/v1/admin/operator-teams/${encodeURIComponent('기획팀')}`, {
        userIds: [],
      }),
    404,
  );
});
