/**
 * 운영진 계정·권한 API. 백엔드 "Admin 권한 체계 재설계" 설계 문서의 동작을 따른다.
 *   · 요청마다 로그인한 계정의 유효 권한을 확인하고, 없으면 403을 돌려준다(@PreAuthorize 자리).
 *   · 본인 계정 여부·락아웃 방지처럼 대상을 봐야 하는 판정은 처리 함수 안에서 한다(ScopeGuard 자리).
 * 로그인은 임시 API 전용 세션(/api/v1/mock/admin-session)으로 흉내 낸다. 실제 서버는 JWT로 요청자를 안다.
 */
import type { Database } from 'sql.js';

import {
  deleteAdmin,
  findAdminRow,
  hasAdminAccount,
  insertAdmin,
  isUsernameTaken,
  listAdminRows,
  overridesOf,
  replaceOverrides,
  toAdminAccount,
  updateAdmin,
  updateAdminPassword,
  userExists,
  type AdminRow,
} from '@/entities/admin-account/api/adminAccountRepository';
import {
  BASE_SET_COLUMNS,
  BASE_SET_RULES,
  LOCKOUT_GUARDED_PERMISSION,
  PERMISSION_GROUPS,
  PERMISSIONS,
  baseSetKeyOf,
  isEffectivelyAllowed,
  isValidCombination,
  toOverrides,
  type PermissionOverrides,
} from '@/entities/admin-account/model/permissions';
import {
  ADMIN_ROLES,
  ADMIN_TEAM_NAMES,
  type AdminAccount,
  type PermissionCatalog,
} from '@/entities/admin-account/model/types';

import { notFound } from '../queries';
import { ApiError, type MockRoute } from '../router';
import {
  type Body,
  oneOf,
  optionalString,
  readBody,
  requiredString,
  stringArray,
} from '../validate';

const badRequest = (code: string, message: string) => new ApiError(400, code, message);
const conflict = (code: string, message: string) => new ApiError(409, code, message);

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
const USERNAME_PATTERN = /^[a-z0-9_]{4,30}$/;
const PASSWORD_POLICY =
  '비밀번호는 8자 이상이고 영문·숫자·특수문자(!@#$%^&*)를 각각 1개 이상 포함해야 합니다.';

// ─── 로그인 흉내(임시 API 전용) ───
/** DB마다 로그인한 계정 id. 새로고침하면 DB와 함께 첫 서운팀장 계정으로 돌아간다. */
const sessions = new WeakMap<Database, number>();
const DEFAULT_ACTOR_ID = 1;

function actorOf(db: Database): AdminRow {
  const actor = findAdminRow(db, sessions.get(db) ?? DEFAULT_ACTOR_ID) ?? listAdminRows(db)[0];
  if (!actor) throw new ApiError(401, 'UNAUTHORIZED', '로그인한 계정이 없습니다.');
  return actor;
}

const subjectOf = (db: Database, row: AdminRow, overrides?: PermissionOverrides) => ({
  role: row.role,
  teamName: row.team_name,
  leadership: toAdminAccount(db, row).leadership,
  overrides: overrides ?? overridesOf(db, row.id),
});

const hasPermission = (
  db: Database,
  row: AdminRow,
  key: string,
  overrides?: PermissionOverrides,
) => {
  const permission = PERMISSIONS.find((p) => p.key === key);
  return permission ? isEffectivelyAllowed(permission, subjectOf(db, row, overrides)) : false;
};

/** 요청자가 권한 중 하나라도 가졌는지 확인하고 요청자를 돌려준다. 없으면 403. */
function requireAny(db: Database, ...keys: string[]): AdminRow {
  const actor = actorOf(db);
  if (!keys.some((key) => hasPermission(db, actor, key))) {
    const labels = keys
      .map((key) => PERMISSIONS.find((p) => p.key === key)?.label ?? key)
      .join(' 또는 ');
    throw new ApiError(403, 'FORBIDDEN', `이 작업에는 "${labels}" 권한이 필요합니다.`);
  }
  return actor;
}

function findTarget(db: Database, accountId: string): AdminRow {
  const id = Number(accountId);
  const row = Number.isInteger(id) ? findAdminRow(db, id) : undefined;
  if (!row) throw notFound('운영진 계정을 찾을 수 없습니다.');
  return row;
}

// ─── 락아웃 방지(설계 §7.1) ───
/** 계정마다 바뀔 상태. row가 null이면 삭제, overrides가 있으면 그 예외로 계산한다. */
interface PendingChange {
  row?: AdminRow | null;
  overrides?: PermissionOverrides;
}

/**
 * 바뀔 상태를 반영했을 때 "타 계정 정보 수정" 권한을 요청자 본인이 잃거나, 가진 계정이 하나도 남지 않으면 거부한다.
 * 역할 기준이 아니라 유효 권한 보유자 수로 센다.
 */
function guardLockout(db: Database, actor: AdminRow, pending: ReadonlyMap<number, PendingChange>) {
  const holdsAfter = (row: AdminRow) => {
    const change = pending.get(row.id);
    if (change?.row === null) return false;
    return hasPermission(db, change?.row ?? row, LOCKOUT_GUARDED_PERMISSION, change?.overrides);
  };
  const actorNow = hasPermission(db, actor, LOCKOUT_GUARDED_PERMISSION);
  if (actorNow && pending.has(actor.id) && !holdsAfter(actor)) {
    throw conflict(
      'CANNOT_REVOKE_OWN_ACCOUNT_WRITE',
      '본인 계정의 "타 계정 정보 수정" 권한은 회수할 수 없습니다.',
    );
  }
  if (!listAdminRows(db).some(holdsAfter)) {
    throw conflict(
      'LAST_ACCOUNT_MANAGER',
      '"타 계정 정보 수정" 권한을 가진 계정이 하나도 남지 않아 처리할 수 없습니다.',
    );
  }
}

// ─── 본문 읽기 ───
function requireValidCombination(role: string, teamName: string) {
  if (!isValidCombination(BASE_SET_RULES, role, teamName)) {
    throw badRequest(
      'INVALID_ROLE_TEAM',
      `${role} · ${teamName}은 정해진 역할·부서 조합이 아니라 권한이 없는 계정이 됩니다.`,
    );
  }
}

function readPermissionKeys(body: Body): string[] {
  const keys = stringArray(body, 'permissions', { required: true });
  const unknown = keys.filter((key) => !PERMISSIONS.some((p) => p.key === key));
  if (unknown.length > 0) {
    throw badRequest('UNKNOWN_PERMISSION', `없는 권한입니다: ${unknown.join(', ')}`);
  }
  return keys;
}

const catalogOf = (db: Database): PermissionCatalog => ({
  groups: PERMISSION_GROUPS.map((group) => ({ ...group, permissions: [...group.permissions] })),
  baseSets: [...BASE_SET_COLUMNS],
  rules: [...BASE_SET_RULES],
  // 기본 팀 목록에 없는 팀으로 만든 계정이 있으면 그 팀도 고를 수 있게 붙인다.
  teamNames: [...new Set([...ADMIN_TEAM_NAMES, ...listAdminRows(db).map((row) => row.team_name)])],
});

export const adminAccountRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/admin/accounts',
    summary:
      '운영진 계정 목록(생성일 순). 계정마다 기본 권한 세트·맡은 그룹·예외·유효 권한을 싣는다',
    handler: ({ db }) => {
      requireAny(db, 'ADMIN_ACCOUNT_READ');
      return listAdminRows(db).map((row) => toAdminAccount(db, row));
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/accounts/me',
    summary: '로그인한 계정 정보와 유효 권한 목록. 화면은 이 목록으로 메뉴·버튼을 보이거나 숨긴다',
    handler: ({ db }) => toAdminAccount(db, actorOf(db)),
  },
  {
    method: 'POST',
    pattern: '/api/v1/admin/accounts',
    summary:
      '운영진 계정 발급. 계정 주인은 회원(userId)으로 고른다. 정해지지 않은 역할·부서 조합은 400, 같은 아이디·이미 계정이 있는 회원은 409',
    handler: ({ db, body }) => {
      const actor = requireAny(db, 'ADMIN_ACCOUNT_CREATE_DELETE');
      const data = readBody(body);
      const userId = requiredString(data, 'userId');
      const username = requiredString(data, 'username');
      const password = requiredString(data, 'password');
      const role = oneOf(requiredString(data, 'role'), ADMIN_ROLES, 'role')!;
      const teamName = requiredString(data, 'teamName');
      if (!userExists(db, userId)) {
        throw badRequest('USER_NOT_FOUND', '동아리원 명단에 없는 회원입니다.');
      }
      if (hasAdminAccount(db, userId)) {
        throw conflict('DUPLICATE_ADMIN_USER', '이 회원은 이미 운영진 계정이 있습니다.');
      }
      if (!USERNAME_PATTERN.test(username)) {
        throw badRequest('INVALID_USERNAME', '아이디는 영어 소문자·숫자·밑줄로 4~30자여야 합니다.');
      }
      if (!PASSWORD_PATTERN.test(password)) throw badRequest('INVALID_PASSWORD', PASSWORD_POLICY);
      requireValidCombination(role, teamName);
      if (isUsernameTaken(db, username)) {
        throw conflict('DUPLICATE_USERNAME', '이미 사용 중인 아이디입니다.');
      }
      const id = insertAdmin(db, {
        user_id: userId,
        username,
        password,
        role,
        team_name: teamName,
        created_by: actor.id,
      });
      return toAdminAccount(db, findAdminRow(db, id)!);
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/admin/accounts/:accountId',
    summary:
      '역할·부서 수정(보낸 값만 바뀐다). 이름·기수·부문은 회원 정보에서 고친다. 본인 역할·부서 변경은 400, 역할·부서가 바뀌면 권한 예외를 모두 지운다',
    handler: ({ db, params, body }) => {
      const target = findTarget(db, params.accountId);
      const actor = actorOf(db);
      const isSelf = actor.id === target.id;
      if (isSelf) requireAny(db, 'ADMIN_ACCOUNT_SELF_WRITE', 'ADMIN_ACCOUNT_WRITE');
      else requireAny(db, 'ADMIN_ACCOUNT_WRITE');

      const data = readBody(body);
      const next: AdminRow = {
        ...target,
        role: oneOf(optionalString(data, 'role'), ADMIN_ROLES, 'role') ?? target.role,
        team_name: optionalString(data, 'teamName') || target.team_name,
      };
      const isBaseChanged = next.role !== target.role || next.team_name !== target.team_name;
      if (isSelf && isBaseChanged) {
        throw badRequest(
          'CANNOT_MODIFY_OWN_ROLE',
          '본인 계정의 역할·부서는 스스로 바꿀 수 없습니다.',
        );
      }
      // 바뀐 것이 없으면 저장하지 않는다(수정 시각·권한 예외를 그대로 둔다).
      if (!isBaseChanged) return toAdminAccount(db, target);
      requireValidCombination(next.role, next.team_name);
      guardLockout(db, actor, new Map([[target.id, { row: next, overrides: {} }]]));
      replaceOverrides(db, target.id, {}, actor.id);
      updateAdmin(db, next);
      return toAdminAccount(db, findAdminRow(db, target.id)!);
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/admin/accounts/:accountId/password',
    summary:
      '비밀번호 변경. 본인은 현재 비밀번호가 필요하고, 다른 계정은 "타 계정 정보 수정" 권한으로 재설정한다',
    handler: ({ db, params, body }) => {
      const target = findTarget(db, params.accountId);
      const actor = actorOf(db);
      const isSelf = actor.id === target.id;
      if (isSelf) requireAny(db, 'ADMIN_ACCOUNT_SELF_WRITE', 'ADMIN_ACCOUNT_WRITE');
      else requireAny(db, 'ADMIN_ACCOUNT_WRITE');

      const data = readBody(body);
      const newPassword = requiredString(data, 'newPassword');
      if (isSelf && optionalString(data, 'currentPassword') !== target.password) {
        throw badRequest('INVALID_CURRENT_PASSWORD', '현재 비밀번호가 맞지 않습니다.');
      }
      if (!PASSWORD_PATTERN.test(newPassword))
        throw badRequest('INVALID_PASSWORD', PASSWORD_POLICY);
      updateAdminPassword(db, target.id, newPassword);
      return undefined;
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/admin/accounts/:accountId',
    summary:
      '운영진 계정 삭제. 본인 계정과 "타 계정 정보 수정" 권한의 마지막 보유자는 지울 수 없다',
    handler: ({ db, params }) => {
      const actor = requireAny(db, 'ADMIN_ACCOUNT_CREATE_DELETE');
      const target = findTarget(db, params.accountId);
      if (actor.id === target.id) {
        throw badRequest('CANNOT_DELETE_SELF', '본인 계정은 삭제할 수 없습니다.');
      }
      guardLockout(db, actor, new Map([[target.id, { row: null }]]));
      deleteAdmin(db, target.id);
      return undefined;
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/permissions',
    summary: '권한 카탈로그: 권한 41개(묶음별), 기본 권한 세트 7개와 규칙, 운영진 팀 목록',
    handler: ({ db }) => {
      actorOf(db);
      return catalogOf(db);
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/admin/accounts/:accountId/permissions',
    summary: '계정별 권한 저장. 체크된 최종 집합을 받아 기본 세트와의 차이만 예외로 저장한다',
    handler: ({ db, params, body }) => {
      const actor = requireAny(db, 'ADMIN_PERMISSION_WRITE');
      const target = findTarget(db, params.accountId);
      const desired = new Set(readPermissionKeys(readBody(body)));
      const checked = Object.fromEntries(PERMISSIONS.map((p) => [p.key, desired.has(p.key)]));
      const overrides = toOverrides(checked, baseSetKeyOf(target.role, target.team_name));
      guardLockout(db, actor, new Map([[target.id, { overrides }]]));
      replaceOverrides(db, target.id, overrides, actor.id);
      return toAdminAccount(db, target);
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/mock/admin-session',
    summary:
      '[임시 API 전용] 고른 계정으로 로그인한 것처럼 바꾼다. 권한별 동작을 확인하는 테스트에서 쓴다',
    handler: ({ db, body }): AdminAccount => {
      const accountId = readBody(body).accountId;
      if (typeof accountId !== 'number') {
        throw badRequest('BAD_REQUEST', 'accountId 값은 정수여야 합니다.');
      }
      const row = findTarget(db, String(accountId));
      sessions.set(db, row.id);
      return toAdminAccount(db, row);
    },
  },
];
