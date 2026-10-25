import type { Database } from 'sql.js';

import { execute, inTransaction, queryAll } from '@/shared/db/createDatabase';

import type { ClubMember } from '../model/types';

/** 운영진 팀은 운영진 명단(admin)에서 읽는다. 운영진 계정 관리와 같은 데이터다. */
const SELECT_CLUB_MEMBERS = `
  SELECT id, name, email, phone, university, major, term, track,
         club_status AS status, club_role AS role,
         (SELECT a.team_name FROM admin a WHERE a.user_id = users.id) AS operatorTeam
    FROM users`;

/**
 * 임시 DB의 users 테이블에서 동아리원 목록을 읽는다. 화면은 정렬하지 않고 이 순서를 그대로 쓴다.
 * 1차는 활동 상태(활동기수 → 수료 → 탈퇴), 2차는 부문(분석 → 시각화 → 엔지니어링), 3차는 이름 가나다순이다.
 * 그래서 부문 명단은 활동기수 → 수료 → 이름 순, 활동기수·수료기수 목록은 부문 → 이름 순으로 보인다.
 * 탈퇴한 사람만은 부문 대신 기수(최신 기수부터)로 정렬한다.
 */
export function listClubMembers(db: Database): ClubMember[] {
  return queryAll<ClubMember & Record<string, unknown>>(
    db,
    `${SELECT_CLUB_MEMBERS}
     ORDER BY CASE club_status WHEN 'ACTIVE' THEN 0 WHEN 'ALUMNI' THEN 1 ELSE 2 END,
              CASE WHEN club_status = 'WITHDRAWN' THEN -term ELSE 0 END,
              CASE track WHEN '분석' THEN 0 WHEN '시각화' THEN 1 WHEN '엔지니어링' THEN 2 ELSE 3 END,
              name, id`,
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

/** 동아리원을 새로 넣는다. 역할은 일반 회원(MEMBER)으로 시작한다. */
export function insertClubMember(db: Database, member: ClubMember): void {
  execute(
    db,
    `INSERT INTO users (id, name, term, track, email, phone, university, major, club_status, club_role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MEMBER')`,
    [
      member.id,
      member.name,
      member.term,
      member.track,
      member.email,
      member.phone,
      member.university,
      member.major,
      member.status,
    ],
  );
}

/** 운영진 명단(admin)에 있는 회원인지. 운영진은 운영진에서 먼저 빼야 삭제할 수 있다. */
export function isOperator(db: Database, userId: string): boolean {
  return queryAll(db, 'SELECT 1 FROM admin WHERE user_id = ?', [userId]).length > 0;
}

/**
 * 동아리원을 관련 기록과 함께 지운다. 한 트랜잭션이라 중간에 실패하면 아무것도 지워지지 않는다.
 * - 팀 소속(team_members)과 그 출결 기록(attendance_records, 연쇄 삭제)
 * - 팀장으로 들어 있던 팀의 팀장 칸(비운다)
 * - 반기 명단(semester_members)과 활동 명단(members, 연쇄 삭제)
 * - HOST 계정은 남기고, 주인 정보(이름·기수·부문)를 계정에 옮겨 적은 뒤 주인 연결만 끊는다
 * 운영진 명단(admin)에 있는 회원은 부르는 쪽에서 먼저 막는다.
 */
export function deleteClubMember(db: Database, userId: string): void {
  inTransaction(db, () => {
    execute(
      db,
      `DELETE FROM team_members
        WHERE user_id = ? OR member_id IN (SELECT id FROM members WHERE user_id = ?)`,
      [userId, userId],
    );
    execute(db, 'UPDATE teams SET leader_id = NULL WHERE leader_id = ?', [userId]);
    execute(db, 'DELETE FROM semester_members WHERE user_id = ?', [userId]);
    execute(
      db,
      `UPDATE host_accounts
          SET host_name = COALESCE(host_name, (SELECT name FROM users WHERE id = ?)),
              generation = COALESCE(generation, (SELECT term || '기' FROM users WHERE id = ?)),
              track = COALESCE(track, (SELECT track FROM users WHERE id = ?))
        WHERE user_id = ?`,
      [userId, userId, userId, userId],
    );
    execute(db, 'DELETE FROM users WHERE id = ?', [userId]);
  });
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
