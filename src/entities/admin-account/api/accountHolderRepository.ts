/**
 * 계정 통합 목록을 임시 DB에서 만든다. 임시 API(adminAccountRoutes)만 쓴다.
 * 운영진 계정과 HOST 계정(admin.role = 'HOST')을 회원(users.id) 단위로 합치고,
 * 이번 반기 맡은 그룹은 teams.leader_id로 찾는다. 회원 한 명에 계정은 하나라서 한 사람은 둘 중 하나만 가진다.
 */
import type { Database } from 'sql.js';

import { queryAll } from '@/shared/db/createDatabase';

import type { AccountHolder, HostLogin, LeaderGroup } from '../model/types';
import { listAdminRows, toAdminAccount } from './adminAccountRepository';

interface HostLoginRow extends Record<string, unknown> {
  id: number;
  user_id: string;
  username: string;
  holder_name: string;
  holder_term: number;
  holder_track: string;
}

interface LeaderGroupRow extends Record<string, unknown> {
  leader_id: string;
  id: string;
  team_name: string;
  group_type: 'ADV' | 'STUDY';
  kind: 'MENTORING' | 'GENERAL';
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
    `SELECT a.id, a.user_id, a.username,
            u.name AS holder_name, u.term AS holder_term, u.track AS holder_track
       FROM admin a JOIN users u ON u.id = a.user_id
      WHERE a.role = 'HOST'
      ORDER BY a.created_at, a.id`,
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
  const hostsByKey = groupByKey(hostRows, (row) => row.user_id);

  const toLogins = (rows: readonly HostLoginRow[]): HostLogin[] =>
    rows.map((row) => ({
      id: String(row.id),
      username: row.username,
      // 임시 DB는 HOST 계정을 비활성화하지 않고(정리할 때 지운다) 마지막 접속 시각을 기록하지 않는다.
      active: true,
      lastLogin: null,
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
  const hostOnly: AccountHolder[] = [...hostsByKey.entries()]
    .filter(([key]) => !adminUserIds.has(key))
    .map(([userId, rows]) => ({
      key: userId,
      userId,
      name: rows[0].holder_name,
      term: rows[0].holder_term,
      track: rows[0].holder_track,
      adminAccount: null,
      hostLogins: toLogins(rows),
      leaderGroups: toGroups(userId),
    }));
  return [...fromAdmins, ...hostOnly];
}
