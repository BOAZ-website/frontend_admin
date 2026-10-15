import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type {
  AdminAccount,
  AdminAuditLog,
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

// 박지훈(u_28_11)은 아직 운영진 계정이 없는 회원이다.
const NEW_ACCOUNT = {
  userId: 'u_28_11',
  username: 'boaz_pr_lead',
  password: 'Boaz!2027',
  role: 'TEAM',
  teamName: '홍보팀',
};

test('계정 목록은 기본 권한 세트·맡은 그룹·예외·유효 권한을 함께 돌려준다', async () => {
  const { call } = await setup();
  const accounts = call<AdminAccount[]>('GET', '/api/v1/admin/accounts');
  assert.equal(accounts.length, 8);

  const dual = accounts.find((a) => a.username === 'boaz_dual_leader')!;
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
  expectApiError(() => call('GET', '/api/v1/admin/audit-logs'), 403);
  assert.equal(call<AdminAccount>('GET', '/api/v1/admin/accounts/me').id, 7);

  loginAs(5); // 서비스운영팀: 목록·감사 로그는 보지만 발급은 못 한다
  assert.equal(call<AdminAccount[]>('GET', '/api/v1/admin/accounts').length, 8);
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

test('권한 저장은 기본 세트와 다른 항목만 예외로 남기고 감사 로그에 기록한다', async () => {
  const { call } = await setup();
  const designer = call<AdminAccount[]>('GET', '/api/v1/admin/accounts').find((a) => a.id === 7)!;
  const desired = [...designer.effectivePermissions, 'APPLICANT_CSV_READ'].filter(
    (key) => key !== 'FINAL_DECISION_READ',
  );
  const saved = call<AdminAccount>('PUT', '/api/v1/admin/accounts/7/permissions', {
    permissions: desired,
  });
  assert.deepEqual(saved.overrides, { APPLICANT_CSV_READ: true, FINAL_DECISION_READ: false });

  const [latest] = call<AdminAuditLog[]>('GET', '/api/v1/admin/audit-logs');
  assert.equal(latest.actionType, 'PERMISSION_CHANGE');
  assert.match(latest.description, /지원자 CSV 추출/);
});

test('일괄 부여·회수는 고른 계정들에 같은 권한을 반영한다', async () => {
  const { call } = await setup();
  const changed = call<AdminAccount[]>('POST', '/api/v1/admin/permissions/bulk', {
    accountIds: [6, 7],
    permissions: ['AUDIT_LOG_READ', 'CONTENT_WRITE'],
    change: 'grant',
  });
  assert.ok(changed.every((a) => a.effectivePermissions.includes('AUDIT_LOG_READ')));
  assert.deepEqual(changed.find((a) => a.id === 6)!.overrides, {
    CONTENT_WRITE: true,
    AUDIT_LOG_READ: true,
  });

  const reset = call<AdminAccount[]>('POST', '/api/v1/admin/permissions/bulk', {
    accountIds: [6],
    permissions: ['CONTENT_WRITE'],
    change: 'reset',
  });
  assert.deepEqual(reset[0].overrides, { AUDIT_LOG_READ: true });
});

test('"타 계정 정보 수정" 권한은 본인에게서, 또 마지막 보유자에게서 회수할 수 없다', async () => {
  const { call } = await setup();
  expectApiError(
    () =>
      call('POST', '/api/v1/admin/permissions/bulk', {
        accountIds: [1],
        permissions: ['ADMIN_ACCOUNT_WRITE'],
        change: 'revoke',
      }),
    409,
    'CANNOT_REVOKE_OWN_ACCOUNT_WRITE',
  );
  expectApiError(() => call('DELETE', '/api/v1/admin/accounts/1'), 400, 'CANNOT_DELETE_SELF');

  // 다른 계정에 먼저 주면 보유자가 둘이 되어, 그 계정의 권한은 다시 회수할 수 있다.
  call('POST', '/api/v1/admin/permissions/bulk', {
    accountIds: [5],
    permissions: ['ADMIN_ACCOUNT_WRITE'],
    change: 'grant',
  });
  const revoked = call<AdminAccount[]>('POST', '/api/v1/admin/permissions/bulk', {
    accountIds: [5],
    permissions: ['ADMIN_ACCOUNT_WRITE'],
    change: 'revoke',
  });
  assert.ok(!revoked[0].effectivePermissions.includes('ADMIN_ACCOUNT_WRITE'));
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
  assert.deepEqual([master.name, master.term, master.track], ['남민서', 26, '분석']);

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
