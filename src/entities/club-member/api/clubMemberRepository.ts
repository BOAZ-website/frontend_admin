import type { Database } from 'sql.js';

import { execute, queryAll } from '@/shared/db/createDatabase';

import type { ClubMember } from '../model/types';

const SELECT_CLUB_MEMBERS = `
  SELECT id, name, email, phone, university, major, term, track,
         club_status AS status, club_role AS role
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
