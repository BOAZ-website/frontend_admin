/**
 * 회원(User) 목록 조회. 임시 DB의 users 테이블을 읽는다.
 * 백엔드가 붙으면 GET /api/v1/admin/users 호출로 바꾸면 되고, 반환 형태(UserProfile[])는 그대로 둔다.
 */
import { getDatabase } from '@/shared/db/database';

import type { UserProfile } from '../model/types';

import { listUsers } from './usersRepository';

export async function fetchUsers(): Promise<UserProfile[]> {
  return listUsers(await getDatabase());
}
