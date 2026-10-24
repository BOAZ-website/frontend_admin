/**
 * 계정 통합 목록을 임시 DB에서 만든다. 임시 API(adminAccountRoutes)만 쓴다.
 * 운영진 계정(admin)과 HOST 계정(host_accounts)을 회원(users.id) 단위로 합치고,
 * 이번 반기 맡은 그룹은 teams.leader_id로 찾는다.
 */
import type { Database } from 'sql.js';

import { queryAll } from '@/shared/db/createDatabase';

import type { AccountHolder, HostLogin, LeaderGroup } from '../model/types';
import { listAdminRows, toAdminAccount } from './adminAccountRepository';

interface HostLoginRow extends Record<string, unknown> {
  id: string;
  user_id: string | null;
  username: string;
  active: number;
  last_login: string | null;
  holder_name: string | null;
  holder_term: number | null;
  holder_track: string | null;
}

interface LeaderGroupRow extends Record<string, unknown> {
  leader_id: string;
  id: string;
  team_name: string;
  group_type: 'ADV' | 'STUDY';
  kind: 'MENTORING' | 'GENERAL';
}

interface UserRow extends Record<string, unknown> {
  id: string;
  name: string;
  term: number;
  track: string;
}

const groupByKey = <T>(rows: readonly T[], keyOf: (row: T) => string): Map<string, T[]> => {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => grouped.set(keyOf(row), [...(grouped.get(keyOf(row)) ?? []), row]));
  return grouped;
};

/** 계정을 가진 사람 전체. 순서는 운영진 계정 생성 순, 그다음 HOST 계정만 있는 사람이다. */
export function listAccountHolders(db: Database): AccountHolder[] {
  const admins = listAdminRows(db).map((row) => toAdminAccount(db, row));
  const hostRows = queryAll<HostLoginRow>(
    db,
    `SELECT h.id, h.user_id, h.username, h.active, h.last_login,
            COALESCE(u.name, h.host_name) AS holder_name, u.term AS holder_term,
            COALESCE(u.track, h.track) AS holder_track
       FROM host_accounts h LEFT JOIN users u ON u.id = h.user_id
      ORDER BY h.created_at, h.id`,
  );
  const groups = groupByKey(
    queryAll<LeaderGroupRow>(
      db,
      `SELECT t.leader_id, t.id, t.team_name, t.group_type, t.kind
         FROM teams t
        WHERE t.leader_id IS NOT NULL AND t.group_type IN ('ADV', 'STUDY')
          AND t.semester_cohort = (SELECT cohort FROM cohorts WHERE is_current = 1)
        ORDER BY t.group_type, t.team_name`,
    ),
    (row) => row.leader_id,
  );
  const hostsByKey = groupByKey(hostRows, (row) => row.user_id ?? `host:${row.id}`);

  const toLogins = (rows: readonly HostLoginRow[]): HostLogin[] =>
    rows.map((row) => ({
      id: row.id,
      username: row.username,
      active: row.active === 1,
      lastLogin: row.last_login,
    }));
  const toGroups = (userId: string | null): LeaderGroup[] =>
    (userId ? (groups.get(userId) ?? []) : []).map((row) => ({
      teamId: row.id,
      name: row.team_name,
      groupType: row.group_type,
      studyKind: row.group_type === 'STUDY' ? row.kind : null,
    }));

  const fromAdmins: AccountHolder[] = admins.map((account) => ({
    key: account.userId,
    userId: account.userId,
    name: account.name,
    term: account.term,
    track: account.track,
    adminAccount: account,
    hostLogins: toLogins(hostsByKey.get(account.userId) ?? []),
    leaderGroups: toGroups(account.userId),
  }));
  const adminUserIds = new Set(admins.map((account) => account.userId));
  const users = new Map(
    queryAll<UserRow>(db, 'SELECT id, name, term, track FROM users').map((row) => [row.id, row]),
  );
  const hostOnly: AccountHolder[] = [...hostsByKey.entries()]
    .filter(([key]) => !adminUserIds.has(key))
    .map(([key, rows]) => {
      const userId = rows[0].user_id;
      const user = userId ? users.get(userId) : undefined;
      return {
        key,
        userId,
        name: user?.name ?? rows[0].holder_name ?? rows[0].username,
        term: user?.term ?? rows[0].holder_term,
        track: user?.track ?? rows[0].holder_track,
        adminAccount: null,
        hostLogins: toLogins(rows),
        leaderGroups: toGroups(userId),
      };
    });
  return [...fromAdmins, ...hostOnly];
}
