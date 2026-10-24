/**
 * 로그인 계정 조회(임시 DB). 임시 API(authRoutes)와 세션 처리만 쓴다.
 * 운영진은 admin.username·password, HOST는 host_accounts.username·initial_password로 확인한다.
 * 비밀번호는 비교에만 쓰고 응답(AuthSession)에는 담지 않는다.
 */
import type { Database } from 'sql.js';

import type { AdminRole } from '@/entities/admin-account/model/types';
import { queryAll } from '@/shared/db/createDatabase';

import type { AuthSession } from '../model/types';

interface AdminLoginRow extends Record<string, unknown> {
  id: number;
  username: string;
  password: string;
  role: AdminRole;
  team_name: string;
  name: string;
}

interface HostLoginRow extends Record<string, unknown> {
  id: string;
  username: string;
  initial_password: string | null;
  user_id: string | null;
  name: string;
  active: number;
  first_team_id: string | null;
}

const SELECT_ADMIN_LOGIN = `
  SELECT a.id, a.username, a.password, a.role, a.team_name, u.name
    FROM admin a
    JOIN users u ON u.id = a.user_id`;

/**
 * HOST 계정과 표시 이름·맡은 첫 그룹. 이름은 계정 주인 회원 이름, 없으면 host_name, 그것도 없으면 아이디다.
 * 맡은 첫 그룹은 담당 팀(team_id), 없으면 맡은 그룹 목록의 첫 팀이다.
 */
const SELECT_HOST_LOGIN = `
  SELECT h.id, h.username, h.initial_password, h.user_id, h.active,
         COALESCE(u.name, h.host_name, h.username) AS name,
         COALESCE(h.team_id,
                  (SELECT g.team_id FROM host_assigned_groups g
                    WHERE g.host_id = h.id ORDER BY g.position LIMIT 1)) AS first_team_id
    FROM host_accounts h
    LEFT JOIN users u ON u.id = h.user_id`;

/** 아이디로 운영진 계정을 찾는다. */
export const findAdminLogin = (db: Database, username: string): AdminLoginRow | undefined =>
  queryAll<AdminLoginRow>(db, `${SELECT_ADMIN_LOGIN} WHERE a.username = ?`, [username])[0];

export const findAdminLoginById = (db: Database, id: number): AdminLoginRow | undefined =>
  queryAll<AdminLoginRow>(db, `${SELECT_ADMIN_LOGIN} WHERE a.id = ?`, [id])[0];

export const findHostLogin = (db: Database, username: string): HostLoginRow | undefined =>
  queryAll<HostLoginRow>(db, `${SELECT_HOST_LOGIN} WHERE h.username = ?`, [username])[0];

export const findHostLoginById = (db: Database, id: string): HostLoginRow | undefined =>
  queryAll<HostLoginRow>(db, `${SELECT_HOST_LOGIN} WHERE h.id = ?`, [id])[0];

/**
 * 로그인 아이디가 운영진 계정(admin)이나 HOST 계정(host_accounts)에 이미 있는지.
 * 두 테이블에 같은 아이디가 있으면 로그인할 때 운영진 계정이 먼저 맞춰져 HOST 계정으로 들어갈 수 없으므로 둘 다 본다.
 * HOST 계정 아이디를 바꿀 때는 그 계정 자신(exceptHostId)은 뺀다.
 */
export const isLoginUsernameTaken = (
  db: Database,
  username: string,
  exceptHostId?: string,
): boolean =>
  queryAll(
    db,
    `SELECT 1 FROM admin WHERE username = ?
     UNION ALL
     SELECT 1 FROM host_accounts WHERE username = ? AND id <> ?`,
    [username, username, exceptHostId ?? ''],
  ).length > 0;

/** 비밀번호가 맞는지. 비밀번호가 없는 HOST 계정은 어떤 값과도 맞지 않는다. */
export const isPasswordMatched = (stored: string | null, given: string): boolean =>
  stored !== null && stored === given;

export const toAdminSession = (row: AdminLoginRow): AuthSession => ({
  kind: 'ADMIN',
  name: row.name,
  username: row.username,
  role: row.role,
  teamName: row.team_name,
  accountId: row.id,
  hostId: null,
  hostTeamId: null,
});

export const toHostSession = (row: HostLoginRow): AuthSession => ({
  kind: 'HOST',
  name: row.name,
  username: row.username,
  role: 'HOST',
  teamName: null,
  accountId: null,
  hostId: row.id,
  hostTeamId: row.first_team_id,
});
