import type { Database } from 'sql.js';

import { execute, queryAll } from '@/shared/db/createDatabase';

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

/**
 * 반기 등록(member_enrollment)이 살아 있는 회원. 이름·기수·부문은 동아리원 명단(users)의 지금 값을 쓴다.
 * 동아리원 명단이 회원 마스터라, 동아리원 관리에서 고친 값이 출결 화면에도 그대로 보여야 하기 때문이다
 * (docs/spec/05-attendance.md 4.1).
 */
function semesterUsers(db: Database, cohort: number, onlyActive: boolean): UserProfile[] {
  return queryAll<UserProfile & Record<string, unknown>>(
    db,
    `SELECT u.id, u.provider, u.provider_id, u.nickname, u.member_type,
            u.name, u.term, u.track,
            u.affiliation, u.email, u.phone, u.university, u.major, u.minor_double_major,
            u.last_semester, u.military_status, u.birth_date, u.graduation_date,
            u.grad_school_plan, u.created_at, u.updated_at
       FROM member_enrollment e
       JOIN users u ON u.id = e.member_id
      WHERE e.activity_season_id = ? AND e.deleted_at IS NULL${onlyActive ? " AND u.club_status = 'ACTIVE'" : ''}
      ORDER BY u.term, u.name`,
    [cohort],
  );
}

/** 반기 명단 중 지금 활동 중인 회원. 팀장·팀원·트랙원을 고르는 목록이 쓴다(탈퇴·수료 회원은 고를 수 없다). */
export const listSelectableSemesterUsers = (db: Database, cohort: number): UserProfile[] =>
  semesterUsers(db, cohort, true);

/**
 * 활동 중인 회원을 현재 반기 명단에 넣는다(이미 있으면 그대로). 동아리원 관리에서 회원을 추가하거나
 * 활동 상태로 바꾸면 부른다. 활동 중이 아니거나 현재 반기가 없으면 아무것도 하지 않는다.
 * 구분은 회원 기수로 정하고(반기의 BASE 기수 BASE, ADV 기수 ADV, 그 밖 COMPLETED) 병행 부문은 동아리원 명단 값을 복사한다.
 * 예전에 등록을 취소했으면 취소를 푼다.
 */
export function addToCurrentSemester(db: Database, userId: string): void {
  execute(
    db,
    `INSERT OR IGNORE INTO member_enrollment (member_id, activity_season_id, season_role, parallel_track)
     SELECT u.id, c.cohort,
            CASE WHEN u.term = c.cohort THEN 'BASE' WHEN u.term = c.adv_term THEN 'ADV' ELSE 'COMPLETED' END,
            u.parallel_track
       FROM users u JOIN cohorts c ON c.is_current = 1
      WHERE u.id = ? AND u.club_status = 'ACTIVE'`,
    [userId],
  );
  execute(
    db,
    `UPDATE member_enrollment SET deleted_at = NULL, version = version + 1
      WHERE member_id = ? AND deleted_at IS NOT NULL
        AND activity_season_id = (SELECT cohort FROM cohorts WHERE is_current = 1)
        AND EXISTS (SELECT 1 FROM users WHERE id = ? AND club_status = 'ACTIVE')`,
    [userId, userId],
  );
}

/** users 테이블에 있는 회원 기수 목록(중복 없이 큰 기수부터). */
export function listUserTerms(db: Database): number[] {
  return queryAll<{ term: number }>(db, 'SELECT DISTINCT term FROM users ORDER BY term DESC').map(
    ({ term }) => term,
  );
}
