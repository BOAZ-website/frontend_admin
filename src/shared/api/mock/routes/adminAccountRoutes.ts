/**
 * 운영진 계정·권한 API. 백엔드 "Admin 권한 체계 재설계" 설계 문서의 동작을 따른다.
 *   · 요청마다 로그인한 계정의 유효 권한을 확인하고, 없으면 403을 돌려준다(@PreAuthorize 자리).
 *   · 본인 계정 여부·락아웃 방지처럼 대상을 봐야 하는 판정은 처리 함수 안에서 한다(ScopeGuard 자리).
 * 요청자는 임시 API 세션(session.ts, 로그인은 authRoutes.ts)에서 읽는다. 실제 서버는 JWT로 요청자를 안다.
 */
import type { Database } from 'sql.js';

import { listAccountHolders } from '@/entities/admin-account/api/accountHolderRepository';
import { syncOperatorRole } from '@/entities/club-member/api/clubMemberRepository';
import {
  deleteAdmin,
  findAdminRow,
  hasAdminAccount,
  insertAdmin,
  listAdminRows,
  overridesOf,
  replaceOverrides,
  toAdminAccount,
  updateAdmin,
  updateAdminPassword,
  updateAdminUsername,
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
import { compareTeamNames } from '@/entities/admin-account/model/teams';
import type { AuthSession } from '@/entities/auth/model/types';
import {
  ADMIN_ROLES,
  ADMIN_TEAM_NAMES,
  type AdminAccount,
  type AdminRole,
  type PermissionCatalog,
} from '@/entities/admin-account/model/types';

import { notFound } from '../queries';
import { ApiError, type MockRoute } from '../router';
import { currentSession, setSession } from '../session';
import { requireUnusedLoginUsername, restoreByUsername } from './authRoutes';
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

// 아이디 형식(글자 종류·길이)과 비밀번호 규칙 검사는 실제 백엔드에 맡긴다. 임시 API는 빈 값과 아이디 중복만 거부한다.

// ─── 요청자(임시 API 세션) ───
/**
 * 지금 로그인한 운영진 계정. 세션의 계정이 지워졌으면 첫 계정으로 본다.
 * HOST 세션은 운영진 계정 API를 쓸 수 없어 403이다(내 계정 정보 /me 포함).
 */
function actorOf(db: Database): AdminRow {
  const session = currentSession(db);
  if (session.kind === 'HOST') {
    throw new ApiError(403, 'FORBIDDEN', 'HOST 계정으로는 운영진 계정 기능을 쓸 수 없습니다.');
  }
  const actor = findAdminRow(db, session.adminId) ?? listAdminRows(db)[0];
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
export function requireAny(db: Database, ...keys: string[]): AdminRow {
  const actor = actorOf(db);
  if (!keys.some((key) => hasPermission(db, actor, key))) {
    const labels = keys
      .map((key) => PERMISSIONS.find((p) => p.key === key)?.label ?? key)
      .join(' 또는 ');
    throw new ApiError(403, 'FORBIDDEN', `이 작업에는 "${labels}" 권한이 필요합니다.`);
  }
  return actor;
}

/**
 * 계정 하나를 고치는 요청의 권한 확인. 본인 여부는 경로의 id로 정하고, 권한을 먼저 확인한 뒤 계정을 찾는다.
 * 그래서 권한이 없는 사람은 없는 계정 id를 보내도 404가 아니라 403을 받는다(계정이 있는지 알 수 없다).
 */
function requireAccountWrite(db: Database, accountId: string) {
  const actor = actorOf(db);
  const isSelf = String(actor.id) === accountId;
  if (isSelf) requireAny(db, 'ADMIN_ACCOUNT_SELF_WRITE', 'ADMIN_ACCOUNT_WRITE');
  else requireAny(db, 'ADMIN_ACCOUNT_WRITE');
  return { actor, isSelf, target: findTarget(db, accountId) };
}

/** 팀 이름의 앞뒤 공백을 지운다. '대표진 '처럼 공백만 다른 이름이 새 팀으로 저장되지 않게 한다. */
function teamNameOf(value: string): string {
  const teamName = value.trim();
  if (!teamName) throw badRequest('INVALID_TEAM_NAME', '소속 부서를 입력해 주세요.');
  return teamName;
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
  // 코드의 기본 팀 목록과 DB에 있는 팀을 합치는 곳은 여기 한 곳이다. 화면 순서(고정 팀 → 가나다순)로 준다.
  teamNames: [
    ...new Set([...ADMIN_TEAM_NAMES, ...listAdminRows(db).map((row) => row.team_name)]),
  ].sort(compareTeamNames),
});

// ─── 운영진 지정(동아리원 명단) ───
/**
 * 운영진 자리(팀)에 맞는 역할. 기본 권한 규칙에서 그 팀 이름을 쓰는 역할을 고르고(서비스운영팀은 TEAM),
 * 규칙에 없는 팀은 TEAM이다. 예: 대표진·차기대표진은 SUPER.
 */
function roleForTeam(teamName: string): AdminRole {
  const roles = BASE_SET_RULES.filter(
    (rule) => rule.teamName === teamName && rule.role !== 'HOST',
  ).map((rule) => rule.role as AdminRole);
  if (roles.length === 0 || roles.includes('TEAM')) return 'TEAM';
  return roles[0];
}

/** 새 운영진의 로그인 계정. 운영진이면 반드시 아이디·비밀번호가 있다. */
interface Credentials {
  username: string;
  password: string;
}

/**
 * 아이디(앞뒤 공백 제거)·비밀번호를 읽는다. 둘 중 하나라도 비었으면 400, 아이디가 운영진·HOST와 겹치면 409.
 * 운영진 추가(POST /admin/accounts)와 새 운영진 지정(PUT /admin/operators/:userId)이 같이 쓴다.
 */
function readCredentials(db: Database, data: Body): Credentials {
  const username = optionalString(data, 'username')?.trim() ?? '';
  const password = optionalString(data, 'password') ?? '';
  if (!username || !password) {
    throw badRequest('INCOMPLETE_CREDENTIALS', '아이디와 초기 비밀번호를 입력해 주세요.');
  }
  requireUnusedLoginUsername(db, username);
  return { username, password };
}

/** 본인·서비스운영팀장은 운영진에서 빼거나 다른 팀으로 옮길 수 없다. */
function requireMovable(actor: AdminRow, row: AdminRow): void {
  if (row.id === actor.id) {
    throw badRequest(
      'CANNOT_MODIFY_OWN_ROLE',
      '본인은 운영진에서 빼거나 다른 팀으로 옮길 수 없습니다.',
    );
  }
  if (row.role === 'MASTER') {
    throw badRequest(
      'CANNOT_MOVE_MASTER',
      '서비스운영팀장(MASTER)은 운영진에서 빼거나 다른 팀으로 옮길 수 없습니다.',
    );
  }
}

/**
 * 운영진 지정에서 아이디·비밀번호를 바꿀 수 없는 계정. 본인은 현재 비밀번호를 확인하는 PATCH .../password로만 바꾸고,
 * 서비스운영팀장(MASTER) 계정은 바꿀 수 없다.
 */
function requireCredentialsEditable(actor: AdminRow, row: AdminRow): void {
  if (row.id === actor.id) {
    throw badRequest(
      'CANNOT_MODIFY_OWN_CREDENTIALS',
      '본인 계정의 아이디·비밀번호는 여기서 바꿀 수 없습니다. 내 계정에서 바꿔 주세요.',
    );
  }
  if (row.role === 'MASTER') {
    throw badRequest(
      'CANNOT_MODIFY_MASTER_CREDENTIALS',
      '서비스운영팀장(MASTER) 계정의 아이디·비밀번호는 바꿀 수 없습니다.',
    );
  }
}

/** 운영진에서 뺀다(계정도 함께 삭제). "타 계정 정보 수정" 보유자를 하나는 남긴다. */
function removeOperator(db: Database, actor: AdminRow, row: AdminRow): void {
  requireMovable(actor, row);
  guardLockout(db, actor, new Map([[row.id, { row: null }]]));
  deleteAdmin(db, row.id);
  syncOperatorRole(db, row.user_id, false);
}

/**
 * 이미 운영진인 계정의 팀·아이디·비밀번호를 바꾼다. 모두 검사한 뒤 한꺼번에 저장한다(하나라도 막히면 아무것도 바뀌지 않는다).
 *   · 팀: teamName이 지금 팀과 다르면 옮긴다. 역할·부서가 바뀌므로 권한 예외는 지운다. 본인·서비스운영팀장은 옮길 수 없다.
 *   · 아이디: username을 보내고 지금 아이디와 다르면 바꾼다. 빈 값은 400, 다른 계정과 겹치면 409.
 *   · 비밀번호: password를 보내면(빈 값 아님) 바꾼다.
 *   · 아이디·비밀번호가 실제로 바뀌면 본인·서비스운영팀장(MASTER) 계정은 400이다(바뀌는 것이 없으면 막지 않는다).
 */
function updateOperator(
  db: Database,
  actor: AdminRow,
  row: AdminRow,
  teamName: string,
  data: Body,
): void {
  const isTeamChanged = row.team_name !== teamName;
  const role = isTeamChanged ? roleForTeam(teamName) : row.role;
  if (isTeamChanged) {
    requireMovable(actor, row);
    requireValidCombination(role, teamName);
    guardLockout(
      db,
      actor,
      new Map([[row.id, { row: { ...row, role, team_name: teamName }, overrides: {} }]]),
    );
  }
  const usernameInput = optionalString(data, 'username');
  if (usernameInput !== undefined && !usernameInput) {
    throw badRequest('INCOMPLETE_CREDENTIALS', '아이디와 초기 비밀번호를 입력해 주세요.');
  }
  const nextUsername =
    usernameInput !== undefined && usernameInput !== row.username ? usernameInput : null;
  const nextPassword = optionalString(data, 'password') || null;
  if (nextUsername !== null || nextPassword !== null) requireCredentialsEditable(actor, row);
  if (nextUsername !== null) requireUnusedLoginUsername(db, nextUsername);

  if (isTeamChanged) {
    replaceOverrides(db, row.id, {}, actor.id);
    updateAdmin(db, { id: row.id, role, team_name: teamName });
  }
  if (nextUsername !== null) updateAdminUsername(db, row.id, nextUsername);
  if (nextPassword !== null) updateAdminPassword(db, row.id, nextPassword);
}

/** 운영진이 아닌 회원을 그 팀 운영진으로 정하고, 받은 아이디·비밀번호로 계정을 만든다. */
function addOperator(
  db: Database,
  actor: AdminRow,
  userId: string,
  teamName: string,
  data: Body,
): void {
  if (!userExists(db, userId))
    throw badRequest('USER_NOT_FOUND', '동아리원 명단에 없는 회원입니다.');
  const role = roleForTeam(teamName);
  requireValidCombination(role, teamName);
  const { username, password } = readCredentials(db, data);
  insertAdmin(db, {
    user_id: userId,
    username,
    password,
    role,
    team_name: teamName,
    created_by: actor.id,
  });
  syncOperatorRole(db, userId, true);
}

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
    pattern: '/api/v1/admin/account-holders',
    summary:
      '[협의 필요] 계정 통합 목록. 운영진 계정과 HOST 계정을 회원 단위로 합치고, 이번 반기 맡은 그룹을 싣는다',
    handler: ({ db }) => {
      requireAny(db, 'ADMIN_ACCOUNT_READ');
      return listAccountHolders(db);
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
      '운영진 추가. 계정 주인은 회원(userId)으로 고르고, 아이디·초기 비밀번호는 필수다(없으면 400). 정해지지 않은 역할·부서 조합은 400, 같은 아이디·이미 운영진인 회원은 409',
    handler: ({ db, body }) => {
      const actor = requireAny(db, 'ADMIN_ACCOUNT_CREATE_DELETE');
      const data = readBody(body);
      const userId = requiredString(data, 'userId');
      const role = oneOf(requiredString(data, 'role'), ADMIN_ROLES, 'role')!;
      const teamName = teamNameOf(requiredString(data, 'teamName'));
      if (!userExists(db, userId)) {
        throw badRequest('USER_NOT_FOUND', '동아리원 명단에 없는 회원입니다.');
      }
      if (hasAdminAccount(db, userId)) {
        throw conflict('DUPLICATE_ADMIN_USER', '이 회원은 이미 운영진 계정이 있습니다.');
      }
      const { username, password } = readCredentials(db, data);
      requireValidCombination(role, teamName);
      const id = insertAdmin(db, {
        user_id: userId,
        username,
        password,
        role,
        team_name: teamName,
        created_by: actor.id,
      });
      syncOperatorRole(db, userId, true);
      return toAdminAccount(db, findAdminRow(db, id)!);
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/admin/accounts/:accountId',
    summary:
      '역할·부서 수정(보낸 값만 바뀐다). 이름·기수·부문은 회원 정보에서 고친다. 본인 역할·부서 변경은 400, 역할·부서가 바뀌면 권한 예외를 모두 지운다',
    handler: ({ db, params, body }) => {
      const { actor, isSelf, target } = requireAccountWrite(db, params.accountId);

      const data = readBody(body);
      const teamNameInput = optionalString(data, 'teamName');
      const next: AdminRow = {
        ...target,
        role: oneOf(optionalString(data, 'role'), ADMIN_ROLES, 'role') ?? target.role,
        team_name: teamNameInput === undefined ? target.team_name : teamNameOf(teamNameInput),
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
      const { isSelf, target } = requireAccountWrite(db, params.accountId);

      const data = readBody(body);
      const newPassword = requiredString(data, 'newPassword');
      if (isSelf && optionalString(data, 'currentPassword') !== target.password) {
        throw badRequest('INVALID_CURRENT_PASSWORD', '현재 비밀번호가 맞지 않습니다.');
      }
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
      if (target.role === 'MASTER') {
        throw badRequest(
          'CANNOT_DELETE_MASTER',
          '서비스운영팀장(MASTER) 계정은 삭제할 수 없습니다.',
        );
      }
      guardLockout(db, actor, new Map([[target.id, { row: null }]]));
      deleteAdmin(db, target.id);
      syncOperatorRole(db, target.user_id, false);
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
      '[임시 API 전용] 세션을 바꾼다. { username }이면 그 계정(운영진·HOST)으로 세션을 되살려 AuthSession을, { accountId }면 그 운영진 계정으로 바꿔 계정 정보를 돌려준다. 새로고침 뒤 세션 복원과 테스트에서 쓴다',
    handler: ({ db, body }): AuthSession | AdminAccount => {
      const data = readBody(body);
      if (typeof data.username === 'string') return restoreByUsername(db, data.username.trim());
      if (typeof data.accountId !== 'number') {
        throw badRequest('BAD_REQUEST', 'username 또는 accountId(정수) 값이 필요합니다.');
      }
      const row = findAdminRow(db, data.accountId);
      if (!row) throw notFound('운영진 계정을 찾을 수 없습니다.');
      setSession(db, { kind: 'ADMIN', adminId: row.id });
      return toAdminAccount(db, row);
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/admin/operators/:userId',
    summary:
      '한 명의 운영진 지정(동아리원 명단). 운영진이 아닌 회원을 팀으로 정하면 아이디·초기 비밀번호가 필수이고(없으면 400, 겹치면 409) 그 값으로 계정을 만든다. 이미 운영진이면 teamName이 다를 때 팀을 옮기고, username이 지금과 다르면 아이디를(빈 값 400, 겹치면 409), password를 보내면 비밀번호를 함께 바꾼다. null이면 운영진에서 뺀다(운영진 계정도 함께 삭제)',
    handler: ({ db, params, body }) => {
      const actor = requireAny(db, 'ADMIN_ACCOUNT_CREATE_DELETE');
      const data = readBody(body);
      const teamName = data.teamName === null ? null : teamNameOf(requiredString(data, 'teamName'));
      const row = listAdminRows(db).find((admin) => admin.user_id === params.userId);
      if (teamName === null) {
        if (row) removeOperator(db, actor, row);
        return undefined;
      }
      if (!row) {
        addOperator(db, actor, params.userId, teamName, data);
        return undefined;
      }
      updateOperator(db, actor, row, teamName, data);
      return undefined;
    },
  },
];
