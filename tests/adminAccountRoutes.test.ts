import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { AdminAccount, PermissionCatalog } from '../src/entities/admin-account/model/types';
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

test('본인 계정은 삭제할 수 없다', async () => {
  const { call } = await setup();
  expectApiError(() => call('DELETE', '/api/v1/admin/accounts/1'), 400, 'CANNOT_DELETE_SELF');
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
test('운영진으로 정해졌지만 계정이 없는 사람에게 아이디·초기 비밀번호를 발급한다', async () => {
  const { call, loginAs } = await setup();
  // 35번(디자인팀 27기)은 시드에서 운영진으로만 정해지고 계정은 아직 없다.
  const pending = call<AdminAccount[]>('GET', '/api/v1/admin/accounts').find((a) => a.id === 35)!;
  assert.equal(pending.username, null);
  expectApiError(
    () => call('PATCH', '/api/v1/admin/accounts/35/password', { newPassword: 'x' }),
    409,
    'CREDENTIALS_NOT_ISSUED',
  );

  // 비밀번호 규칙은 백엔드에 맡기므로 임시 API는 짧은 비밀번호도 받는다.
  const issued = call<AdminAccount>('PUT', '/api/v1/admin/accounts/35/credentials', {
    username: 'boaz_design_4',
    password: 'abc',
  });
  assert.equal(issued.username, 'boaz_design_4');

  expectApiError(
    () =>
      call('PUT', '/api/v1/admin/accounts/35/credentials', {
        username: 'boaz_design_x',
        password: 'abc',
      }),
    409,
    'CREDENTIALS_ALREADY_ISSUED',
  );
  // 다른 운영진이 쓰는 아이디는 줄 수 없다.
  expectApiError(
    () =>
      call('PUT', '/api/v1/admin/accounts/36/credentials', {
        username: 'boaz_design_4',
        password: 'abc',
      }),
    409,
    'DUPLICATE_USERNAME',
  );

  loginAs(5); // 서비스운영팀: 계정 생성·삭제 권한 없음
  expectApiError(
    () =>
      call('PUT', '/api/v1/admin/accounts/36/credentials', {
        username: 'boaz_design_5',
        password: 'abc',
      }),
    403,
    'FORBIDDEN',
  );
});

test('운영진 추가는 아이디·초기 비밀번호 없이도 되고, 둘 중 하나만 보내면 400이다', async () => {
  const { call } = await setup();
  const added = call<AdminAccount>('POST', '/api/v1/admin/accounts', {
    userId: 'u_28_11',
    role: 'TEAM',
    teamName: '기획팀',
  });
  assert.equal(added.username, null);

  expectApiError(
    () =>
      call('POST', '/api/v1/admin/accounts', {
        userId: 'u_28_12',
        username: 'boaz_half',
        role: 'TEAM',
        teamName: '기획팀',
      }),
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
