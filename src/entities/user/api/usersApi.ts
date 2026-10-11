/**
 * 회원 API 호출. 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 */
import { api, withQuery } from '@/shared/api/client';

import type { UserListQuery, UserVerifyResponse } from '../model/dto';
import type { UserProfile } from '../model/types';

/** 회원 목록·검색(팀장·팀원·트랙원 선택). */
export function fetchUsers(query: UserListQuery = {}): Promise<UserProfile[]> {
  return api.get(withQuery('/api/v1/users', { ...query }));
}

/** 등록된 회원인지 이름으로 확인한다. 동명이인이면 후보를 모두 돌려준다. */
export function verifyUserName(name: string): Promise<UserVerifyResponse> {
  return api.get(withQuery('/api/v1/users/verify', { name }));
}

/** 회원(users)에 있는 기수 목록. 큰 기수부터 온다. 기수 필터 선택지로 쓴다. */
export function fetchUserTerms(): Promise<number[]> {
  return api.get('/api/v1/users/terms');
}
