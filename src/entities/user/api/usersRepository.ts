import type { Database } from 'sql.js';

import { queryAll } from '@/shared/db/createDatabase';

import type { UserProfile } from '../model/types';

/** 임시 DB의 users 테이블에서 회원 목록을 읽는다. */
export function listUsers(db: Database): UserProfile[] {
  return queryAll<UserProfile & Record<string, unknown>>(
    db,
    `SELECT id, provider, provider_id, nickname, member_type, name, term, track,
            affiliation, email, phone, university, major, minor_double_major,
            last_semester, military_status, birth_date, graduation_date,
            grad_school_plan, created_at, updated_at
       FROM users
      ORDER BY term, name`,
  );
}

/** 출결·점수 시스템의 한 반기에 등록된 회원만 읽는다. */
export function listSemesterUsers(db: Database, cohort: number): UserProfile[] {
  return queryAll<UserProfile & Record<string, unknown>>(
    db,
    `SELECT u.id, u.provider, u.provider_id, u.nickname, u.member_type,
            sm.name, sm.term, sm.track,
            u.affiliation, u.email, u.phone, u.university, u.major, u.minor_double_major,
            u.last_semester, u.military_status, u.birth_date, u.graduation_date,
            u.grad_school_plan, u.created_at, u.updated_at
       FROM semester_members sm
       JOIN users u ON u.id = sm.user_id
      WHERE sm.cohort = ?
      ORDER BY u.term, u.name`,
    [cohort],
  );
}
