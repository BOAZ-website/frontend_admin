import type { Database } from 'sql.js';

import { queryAll } from '@/shared/db/createDatabase';

import type { UserProfile } from '../model/types';

/** 임시 DB의 users 테이블에서 회원 목록을 읽는다. */
export function listUsers(db: Database): UserProfile[] {
  return queryAll<UserProfile & Record<string, unknown>>(
    db,
    'SELECT id, name, term, track, affiliation, email, phone FROM users ORDER BY term, name',
  );
}
