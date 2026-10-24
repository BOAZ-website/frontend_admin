import type { Database } from 'sql.js';

import { execute, queryAll } from '@/shared/db/createDatabase';

import type { ClubMember, ClubMemberTermScope } from '../model/types';

/** 부문 순서(분석 → 시각화 → 엔지니어링)는 tracks.sort_order를 따른다. 표에 없는 부문은 맨 뒤다. */
const TRACK_ORDER = 'COALESCE((SELECT t.sort_order FROM tracks t WHERE t.name = users.track), 999)';

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
              ${TRACK_ORDER},
              name, id`,
  );
}

/**
 * 기수 페이지 조건(status·track)을 WHERE 조각과 바인딩 값으로 만든다. 값은 모두 ?로 넘긴다.
 * status가 없으면 활동·수료(ACTIVE·ALUMNI)만 고른다(탈퇴는 기수 페이지에 넣지 않는다).
 */
function termScopeFilter(scope: ClubMemberTermScope): { sql: string; params: string[] } {
  const statusFilter = scope.status
    ? { sql: 'club_status = ?', params: [scope.status] }
    : { sql: "club_status IN ('ACTIVE', 'ALUMNI')", params: [] };
  if (!scope.track) return statusFilter;
  return {
    sql: `${statusFilter.sql} AND track = ?`,
    params: [...statusFilter.params, scope.track],
  };
}

/** 조건(status·track)에 맞는 사람이 있는 기수 목록. 큰 기수부터. */
export function listClubMemberTerms(db: Database, scope: ClubMemberTermScope): number[] {
  const filter = termScopeFilter(scope);
  return queryAll<{ term: number }>(
    db,
    `SELECT DISTINCT term FROM users WHERE ${filter.sql} ORDER BY term DESC`,
    filter.params,
  ).map((row) => row.term);
}

/**
 * 한 기수에서 조건(status·track)에 맞는 동아리원.
 * 활동 상태(활동 → 수료) → 부문(분석 → 시각화 → 엔지니어링) → 이름 → id 순이다.
 * 그래서 status만 주면 부문 → 이름 순, track만 주면 활동 → 수료 → 이름 순이 된다.
 */
export function listClubMembersByTerm(
  db: Database,
  scope: ClubMemberTermScope,
  term: number,
): ClubMember[] {
  const filter = termScopeFilter(scope);
  return queryAll<ClubMember & Record<string, unknown>>(
    db,
    `${SELECT_CLUB_MEMBERS}
     WHERE ${filter.sql} AND term = ?
     ORDER BY CASE club_status WHEN 'ACTIVE' THEN 0 WHEN 'ALUMNI' THEN 1 ELSE 2 END,
              ${TRACK_ORDER},
              name, id`,
    [...filter.params, term],
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

/** 운영진 명단(admin)에 있는 회원인지. 운영진은 운영진에서 먼저 빼야 탈퇴 처리할 수 있다. */
export function isOperator(db: Database, userId: string): boolean {
  return queryAll(db, 'SELECT 1 FROM admin WHERE user_id = ?', [userId]).length > 0;
}

/**
 * 동아리원을 탈퇴 처리한다. 행을 지우지 않고 활동 상태만 탈퇴(WITHDRAWN)로 바꾼다.
 * 반기 명단·팀 소속·출결 기록·HOST 계정 연결은 그대로 남는다.
 * 운영진이거나 이미 탈퇴한 회원은 부르는 쪽에서 먼저 막는다.
 */
export function withdrawClubMember(db: Database, userId: string): void {
  execute(db, `UPDATE users SET club_status = ?, updated_at = datetime('now') WHERE id = ?`, [
    'WITHDRAWN',
    userId,
  ]);
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
