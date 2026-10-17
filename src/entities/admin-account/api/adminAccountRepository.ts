/**
 * 운영진 계정·권한 임시 DB 저장소. 임시 API(adminAccountRoutes)만 쓴다.
 * 유효 권한 계산은 백엔드 EffectivePermissions와 같다: 기본 세트 − 제외 + 추가 + 맡은 그룹 파생.
 */
import type { Database } from 'sql.js';

import { execute, queryAll } from '@/shared/db/createDatabase';
import { localDateTime } from '@/shared/lib/date';

import {
  PERMISSIONS,
  baseSetKeyOf,
  isEffectivelyAllowed,
  type LeadershipGroup,
  type PermissionOverrides,
} from '../model/permissions';
import type { AdminAccount, AdminRole } from '../model/types';

/** admin 테이블의 열과, 계정 주인 회원(users)에서 합쳐 읽는 이름·기수·부문. */
export interface AdminFields {
  id: number;
  user_id: string;
  username: string;
  password: string;
  role: AdminRole;
  /** users.name */
  name: string;
  /** users.track */
  track: string;
  /** users.term */
  term: number;
  team_name: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export type AdminRow = AdminFields & Record<string, unknown>;

/** 운영진 계정과 계정 주인 회원을 합쳐 읽는다. 이름·기수·부문은 users에만 있다. */
const SELECT_ADMIN = `
  SELECT a.id, a.user_id, a.username, a.password, a.role, a.team_name,
         a.created_by, a.created_at, a.updated_at,
         u.name, u.term, u.track
    FROM admin a
    JOIN users u ON u.id = a.user_id`;

export const listAdminRows = (db: Database): AdminRow[] =>
  queryAll<AdminRow>(db, `${SELECT_ADMIN} ORDER BY a.created_at, a.id`);

export const findAdminRow = (db: Database, id: number): AdminRow | undefined =>
  queryAll<AdminRow>(db, `${SELECT_ADMIN} WHERE a.id = ?`, [id])[0];

export const userExists = (db: Database, userId: string): boolean =>
  queryAll(db, 'SELECT 1 FROM users WHERE id = ?', [userId]).length > 0;

/** 그 회원에게 이미 운영진 계정이 있는지(회원 한 명에 계정 하나). */
export const hasAdminAccount = (db: Database, userId: string): boolean =>
  queryAll(db, 'SELECT 1 FROM admin WHERE user_id = ?', [userId]).length > 0;

export const isUsernameTaken = (db: Database, username: string): boolean =>
  queryAll(db, 'SELECT 1 FROM admin WHERE username = ?', [username]).length > 0;

/** 계정별 예외를 권한 이름 → 추가(true)·제외(false) 형태로 읽는다. */
export function overridesOf(db: Database, adminId: number): PermissionOverrides {
  const rows = queryAll<{ permission: string; effect: string }>(
    db,
    'SELECT permission, effect FROM admin_permission_override WHERE admin_id = ?',
    [adminId],
  );
  return Object.fromEntries(rows.map((row) => [row.permission, row.effect === 'GRANT']));
}

/** 맡은 그룹의 종류(ADV·STUDY). 그룹이 몇 개든 종류별로 한 번씩만 나온다. */
export function leadershipOf(db: Database, adminId: number): LeadershipGroup[] {
  return queryAll<{ group_type: LeadershipGroup }>(
    db,
    `SELECT DISTINCT t.group_type
       FROM admin_group_leader g
       JOIN teams t ON t.id = g.group_id
      WHERE g.admin_id = ? AND t.group_type IN ('ADV', 'STUDY')
      ORDER BY t.group_type`,
    [adminId],
  ).map((row) => row.group_type);
}

/** 계정 행에 기본 권한 세트·맡은 그룹·예외·유효 권한을 붙여 응답 형태로 만든다. */
export function toAdminAccount(db: Database, row: AdminRow): AdminAccount {
  const leadership = leadershipOf(db, row.id);
  const overrides = overridesOf(db, row.id);
  const subject = { role: row.role, teamName: row.team_name, leadership, overrides };
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    name: row.name,
    role: row.role,
    track: row.track,
    term: row.term,
    teamName: row.team_name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    baseSetKey: baseSetKeyOf(row.role, row.team_name),
    leadership,
    overrides,
    effectivePermissions: PERMISSIONS.filter((p) => isEffectivelyAllowed(p, subject)).map(
      (p) => p.key,
    ),
  };
}

export const nowText = (): string => localDateTime();

export function insertAdmin(
  db: Database,
  values: Pick<
    AdminFields,
    'user_id' | 'username' | 'password' | 'role' | 'team_name' | 'created_by'
  >,
): number {
  const now = nowText();
  execute(
    db,
    `INSERT INTO admin (user_id, username, password, role, team_name, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      values.user_id,
      values.username,
      values.password,
      values.role,
      values.team_name,
      values.created_by,
      now,
      now,
    ],
  );
  return queryAll<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')[0].id;
}

/** 계정에서 바꿀 수 있는 것은 역할·부서뿐이다. 이름·기수·부문은 회원 정보(users)에서 고친다. */
export function updateAdmin(
  db: Database,
  row: Pick<AdminFields, 'id' | 'role' | 'team_name'>,
): void {
  execute(db, 'UPDATE admin SET role = ?, team_name = ?, updated_at = ? WHERE id = ?', [
    row.role,
    row.team_name,
    nowText(),
    row.id,
  ]);
}

export function updateAdminPassword(db: Database, id: number, password: string): void {
  execute(db, 'UPDATE admin SET password = ?, updated_at = ? WHERE id = ?', [
    password,
    nowText(),
    id,
  ]);
}

export function deleteAdmin(db: Database, id: number): void {
  execute(db, 'DELETE FROM admin WHERE id = ?', [id]);
}

/** 그 계정의 예외를 모두 지우고 새로 넣는다(백엔드 쓰기 방식과 같다). */
export function replaceOverrides(
  db: Database,
  adminId: number,
  overrides: PermissionOverrides,
  grantedBy: number,
): void {
  execute(db, 'DELETE FROM admin_permission_override WHERE admin_id = ?', [adminId]);
  const now = nowText();
  Object.entries(overrides).forEach(([permission, isGranted]) => {
    execute(
      db,
      `INSERT INTO admin_permission_override (admin_id, permission, effect, granted_by, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [adminId, permission, isGranted ? 'GRANT' : 'REVOKE', grantedBy, now],
    );
  });
}
