import type { Database } from 'sql.js';

import { execute, queryAll } from '@/shared/db/createDatabase';

import type { ClubMember } from '../model/types';

/** 운영진 팀은 운영진 명단(admin)에서 읽는다. 운영진 계정 관리와 같은 데이터다. */
const SELECT_CLUB_MEMBERS = `
  SELECT id, name, email, phone, university, major, term, track,
         club_status AS status, club_role AS role,
         (SELECT a.team_name FROM admin a WHERE a.user_id = users.id) AS operatorTeam
    FROM users`;

/** 임시 DB의 users 테이블에서 동아리원 목록을 읽는다. 최신 기수 → 이름 순. */
export function listClubMembers(db: Database): ClubMember[] {
  return queryAll<ClubMember & Record<string, unknown>>(
    db,
    `${SELECT_CLUB_MEMBERS} ORDER BY term DESC, name`,
  );
}

export function findClubMember(db: Database, id: string): ClubMember | undefined {
  return queryAll<ClubMember & Record<string, unknown>>(db, `${SELECT_CLUB_MEMBERS} WHERE id = ?`, [
    id,
  ])[0];
}

/** 같은 기수에 같은 이름의 다른 동아리원이 있는지 확인한다(users는 이름·기수가 유일하다). */
export function hasNameConflict(
  db: Database,
  name: string,
  term: number,
  exceptId?: string,
): boolean {
  return (
    queryAll(db, 'SELECT 1 FROM users WHERE name = ? AND term = ? AND id <> ?', [
      name,
      term,
      exceptId ?? '',
    ]).length > 0
  );
}

/**
 * 운영진으로 정하거나 뺄 때 동아리원 역할을 맞춘다. 운영진이면 OPERATOR, 아니면 MEMBER다.
 * 대표(PRESIDENT)는 운영진 지정과 따로 정하므로 그대로 둔다.
 */
export function syncOperatorRole(db: Database, userId: string, isOperator: boolean): void {
  execute(
    db,
    `UPDATE users
        SET club_role = CASE WHEN club_role = 'PRESIDENT' THEN 'PRESIDENT' ELSE ? END,
            updated_at = datetime('now')
      WHERE id = ?`,
    [isOperator ? 'OPERATOR' : 'MEMBER', userId],
  );
}

export function updateClubMember(db: Database, member: ClubMember): void {
  execute(
    db,
    `UPDATE users
        SET name = ?, term = ?, track = ?, email = ?, phone = ?, university = ?, major = ?,
            club_status = ?, club_role = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [
      member.name,
      member.term,
      member.track,
      member.email,
      member.phone,
      member.university,
      member.major,
      member.status,
      member.role,
      member.id,
    ],
  );
}
