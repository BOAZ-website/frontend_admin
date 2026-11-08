/**
 * 로그인 API(임시). 운영진 계정과 HOST 계정이 모두 admin 표에 있어 같은 로그인 창에서 받는다.
 * 세션은 session.ts에 DB마다 하나 기억한다. 세션 전환(PUT /api/v1/mock/admin-session)은 adminAccountRoutes.ts에 있다.
 * 로그인·로그아웃은 관리 작업이 아니라 감사 기록을 남기지 않는다(audit.ts IGNORED_WRITES).
 * 비밀번호는 비교에만 쓰고 응답·기록 어디에도 남기지 않는다.
 */
import type { Database } from 'sql.js';

import {
  findAdminLogin,
  isLoginUsernameTaken,
  isPasswordMatched,
  toAdminSession,
} from '@/entities/auth/api/authRepository';
import type { AuthSession } from '@/entities/auth/model/types';

import { notFound } from '../queries';
import { ApiError, type MockRoute } from '../router';
import { clearSession, setSession } from '../session';
import { readBody, requiredString } from '../validate';

const invalidCredentials = () =>
  new ApiError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호가 맞지 않습니다.');

/**
 * 새 로그인 아이디가 다른 계정(운영진·HOST)에 없는지 확인한다. 있으면 409 DUPLICATE_USERNAME.
 * 운영진 계정 발급과 HOST 계정 발급이 함께 쓴다.
 */
export function requireUnusedLoginUsername(db: Database, username: string): void {
  if (isLoginUsernameTaken(db, username)) {
    throw new ApiError(409, 'DUPLICATE_USERNAME', '이미 사용 중인 아이디입니다.');
  }
}

/**
 * 아이디·비밀번호를 확인해 세션을 정한다.
 * 아이디가 없거나 비밀번호가 틀리면 어느 쪽인지 알리지 않고 같은 401이다.
 */
function logIn(db: Database, username: string, password: string): AuthSession {
  const admin = findAdminLogin(db, username);
  if (!admin || !isPasswordMatched(admin.password, password)) throw invalidCredentials();
  setSession(db, { adminId: admin.id });
  return toAdminSession(db, admin);
}

/** 비밀번호 없이 아이디로 세션을 되살린다(임시 API 전용, PUT /api/v1/mock/admin-session { username }). */
export function restoreByUsername(db: Database, username: string): AuthSession {
  const admin = findAdminLogin(db, username);
  if (!admin) throw notFound('계정을 찾을 수 없습니다.');
  setSession(db, { adminId: admin.id });
  return toAdminSession(db, admin);
}

export const authRoutes: MockRoute[] = [
  {
    method: 'POST',
    pattern: '/api/v1/auth/login',
    summary: '로그인. 운영진·HOST 계정(admin.username·password). 틀리면 401 INVALID_CREDENTIALS',
    handler: ({ db, body }): AuthSession => {
      const data = readBody(body);
      return logIn(db, requiredString(data, 'username').trim(), requiredString(data, 'password'));
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/auth/logout',
    summary: '로그아웃. 세션을 지운다(이후 요청자가 필요한 API는 401)',
    handler: ({ db }) => {
      clearSession(db);
      return undefined;
    },
  },
];
