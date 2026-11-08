/**
 * 로그인 계정 조회(임시 DB). 임시 API(authRoutes)와 세션 처리만 쓴다.
 * 운영진 계정과 스터디장·ADV 팀장의 HOST 계정이 모두 admin 표에 있어 admin.username·password로 확인한다.
 * 비밀번호는 비교에만 쓰고 응답(AuthSession)에는 담지 않는다.
 */
import type { Database } from 'sql.js';

import type { AccountRole } from '@/entities/admin-account/model/types';
import { queryAll } from '@/shared/db/createDatabase';

import type { AuthSession } from '../model/types';

interface AdminLoginRow extends Record<string, unknown> {
  id: number;
  user_id: string;
  username: string;
  password: string;
  role: AccountRole;
  team_name: string;
  name: string;
}

const SELECT_ADMIN_LOGIN = `
  SELECT a.id, a.user_id, a.username, a.password, a.role, a.team_name, u.name
    FROM admin a
    JOIN users u ON u.id = a.user_id`;

/** 아이디로 계정(운영진·HOST)을 찾는다. */
export const findAdminLogin = (db: Database, username: string): AdminLoginRow | undefined =>
  queryAll<AdminLoginRow>(db, `${SELECT_ADMIN_LOGIN} WHERE a.username = ?`, [username])[0];

export const findAdminLoginById = (db: Database, id: number): AdminLoginRow | undefined =>
  queryAll<AdminLoginRow>(db, `${SELECT_ADMIN_LOGIN} WHERE a.id = ?`, [id])[0];

/** 로그인 아이디가 이미 있는지. 운영진 계정과 HOST 계정이 같은 admin 표라 한 번만 본다. */
export const isLoginUsernameTaken = (db: Database, username: string): boolean =>
  queryAll(db, 'SELECT 1 FROM admin WHERE username = ?', [username]).length > 0;

/** 비밀번호가 맞는지. */
export const isPasswordMatched = (stored: string, given: string): boolean => stored === given;

/** 계정 주인이 지금 팀장인 현재 반기 팀(맡은 그룹). 팀 종류, 팀 이름 순이다. */
const leaderTeamIdsOf = (db: Database, adminId: number): string[] =>
  queryAll<{ group_id: string }>(
    db,
    `SELECT g.group_id FROM admin_group_leader g JOIN teams t ON t.id = g.group_id
      WHERE g.admin_id = ? ORDER BY t.group_type, t.team_name, t.id`,
    [adminId],
  ).map((row) => row.group_id);

export const toAdminSession = (db: Database, row: AdminLoginRow): AuthSession => {
  const isHost = row.role === 'HOST';
  return {
    kind: isHost ? 'HOST' : 'ADMIN',
    name: row.name,
    username: row.username,
    role: row.role,
    teamName: isHost ? null : row.team_name,
    accountId: row.id,
    leaderTeamIds: leaderTeamIdsOf(db, row.id),
  };
};
