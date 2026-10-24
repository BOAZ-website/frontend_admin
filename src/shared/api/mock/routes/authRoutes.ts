/**
 * 로그인 API(임시). 운영진 계정(admin)과 HOST 계정(host_accounts)을 같은 로그인 창에서 받는다.
 * 세션은 session.ts에 DB마다 하나 기억한다. 세션 전환(PUT /api/v1/mock/admin-session)은 adminAccountRoutes.ts에 있다.
 * 로그인·로그아웃은 관리 작업이 아니라 감사 기록을 남기지 않는다(audit.ts IGNORED_WRITES).
 * 비밀번호는 비교에만 쓰고 응답·기록 어디에도 남기지 않는다.
 */
import type { Database } from 'sql.js';

import {
  findAdminLogin,
  findHostLogin,
  isLoginUsernameTaken,
  isPasswordMatched,
  toAdminSession,
  toHostSession,
} from '@/entities/auth/api/authRepository';
import type { AuthSession } from '@/entities/auth/model/types';

import { notFound } from '../queries';
import { ApiError, type MockRoute } from '../router';
import { clearSession, setSession } from '../session';
import { readBody, requiredString } from '../validate';

const invalidCredentials = () =>
  new ApiError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 맞지 않습니다.');

const accountLocked = () =>
  new ApiError(403, 'ACCOUNT_LOCKED', '사용이 중지된 계정입니다. 운영진에게 문의해 주세요.');

/**
 * 새 로그인 아이디가 운영진·HOST 계정 어디에도 없는지 확인한다. 있으면 409 DUPLICATE_USERNAME.
 * 운영진 계정 발급과 HOST 계정 생성·아이디 변경이 함께 쓴다(형식 검사는 실제 백엔드에 맡긴다).
 */
export function requireUnusedLoginUsername(
  db: Database,
  username: string,
  exceptHostId?: string,
): void {
  if (isLoginUsernameTaken(db, username, exceptHostId)) {
    throw new ApiError(409, 'DUPLICATE_USERNAME', '이미 사용 중인 아이디입니다.');
  }
}

/**
 * 아이디·비밀번호를 확인해 세션을 정한다. 운영진 계정을 먼저 보고, 없으면 HOST 계정을 본다.
 * 아이디가 없거나 비밀번호가 틀리면 어느 쪽인지 알리지 않고 같은 401이다.
 */
function logIn(db: Database, username: string, password: string): AuthSession {
  const admin = findAdminLogin(db, username);
  if (admin) {
    if (!isPasswordMatched(admin.password, password)) throw invalidCredentials();
    setSession(db, { kind: 'ADMIN', adminId: admin.id });
    return toAdminSession(admin);
  }
  const host = findHostLogin(db, username);
  if (!host || !isPasswordMatched(host.initial_password, password)) throw invalidCredentials();
  if (host.active !== 1) throw accountLocked();
  setSession(db, { kind: 'HOST', hostId: host.id });
  return toHostSession(host);
}

/**
 * 비밀번호 없이 아이디로 세션을 되살린다(임시 API 전용, PUT /api/v1/mock/admin-session { username }).
 * 회수된 HOST 계정은 되살리지 않는다.
 */
export function restoreByUsername(db: Database, username: string): AuthSession {
  const admin = findAdminLogin(db, username);
  if (admin) {
    setSession(db, { kind: 'ADMIN', adminId: admin.id });
    return toAdminSession(admin);
  }
  const host = findHostLogin(db, username);
  if (!host) throw notFound('계정을 찾을 수 없습니다.');
  if (host.active !== 1) throw accountLocked();
  setSession(db, { kind: 'HOST', hostId: host.id });
  return toHostSession(host);
}

export const authRoutes: MockRoute[] = [
  {
    method: 'POST',
    pattern: '/api/v1/auth/login',
    summary:
      '로그인. 운영진(admin.username·password) 또는 HOST(host_accounts.username·initial_password) 계정. 틀리면 401 INVALID_CREDENTIALS, 회수된 HOST는 403 ACCOUNT_LOCKED',
    handler: ({ db, body }): AuthSession => {
      const data = readBody(body);
      return logIn(db, requiredString(data, 'username').trim(), requiredString(data, 'password'));
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/logout',
    summary: '로그아웃. 세션을 지운다(임시 API는 세션이 없으면 1번 운영진 계정으로 본다)',
    handler: ({ db }) => {
      clearSession(db);
      return undefined;
    },
  },
];
