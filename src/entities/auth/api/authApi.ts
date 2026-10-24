/**
 * 로그인 API 호출. 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 * 비밀번호는 요청에만 쓰고 브라우저에 저장하지 않는다.
 */
import { api } from '@/shared/api/client';

import type { AuthSession, LoginRequest } from '../model/types';

/**
 * 아이디·비밀번호로 로그인한다. 운영진 계정이 맞으면 운영진 세션, HOST 계정이 맞으면 HOST 세션이다.
 * 틀리면 401(INVALID_CREDENTIALS), 회수된 HOST 계정이면 403(ACCOUNT_LOCKED)으로 거절된다.
 */
export function login(request: LoginRequest): Promise<AuthSession> {
  return api.post('/api/v1/auth/login', request);
}

/** 로그아웃한다. 임시 API에서는 세션이 지워져 1번 계정으로 돌아간다. */
export function logout(): Promise<void> {
  return api.post('/api/v1/auth/logout');
}

/**
 * [임시 API 전용] 저장해 둔 아이디로 세션을 되살린다. 새로고침하면 임시 DB가 새로 만들어져 세션이 사라지기 때문이다.
 * 실제 서버에서는 토큰으로 세션을 유지하므로 이 호출이 필요 없다.
 */
export function restoreSession(username: string): Promise<AuthSession> {
  return api.put('/api/v1/mock/admin-session', { username });
}
