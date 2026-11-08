/**
 * 그룹 계정 관리(HOST 계정)를 임시 DB(SQLite)에서 읽는 저장소 계층. 임시 API(hostRoutes)만 쓴다.
 * HOST 계정은 운영진 계정과 같은 admin 표에 role = 'HOST'로 있고, 계정 주인 회원(user_id)에 묶인다.
 * 맡은 그룹은 계정에 저장하지 않고 팀의 현재 팀장(teams.leader_id)으로 정한다(설계문서 2026-11-06판 1.2·2.1).
 */
import type { Database } from 'sql.js';

import { queryAll } from '@/shared/db/createDatabase';

import type { GroupLeaderAccount, LeaderAccountRole } from '../model/types';

interface LeaderRow extends Record<string, unknown> {
  team_id: string;
  group_type: 'ADV' | 'STUDY';
  leader_id: string;
  admin_id: number | null;
  username: string | null;
  role: LeaderAccountRole | null;
}

/**
 * 팀장이 있는 팀마다 팀장과 그 계정(없으면 account가 null). 순서는 팀 종류, 팀 이름 순이다.
 * 어느 팀을 보여 줄지(진행 중인 그룹만)는 부르는 쪽이 teamIds로 정한다.
 */
export function listGroupLeaderAccounts(
  db: Database,
  teamIds: ReadonlySet<string>,
): GroupLeaderAccount[] {
  return queryAll<LeaderRow>(
    db,
    `SELECT t.id AS team_id, t.group_type, t.leader_id, a.id AS admin_id, a.username, a.role
       FROM teams t
       LEFT JOIN admin a ON a.user_id = t.leader_id
      WHERE t.leader_id IS NOT NULL AND t.group_type IN ('ADV', 'STUDY')
      ORDER BY t.group_type, t.team_name, t.id`,
  )
    .filter((row) => teamIds.has(row.team_id))
    .map((row) => ({
      teamId: row.team_id,
      groupType: row.group_type,
      leaderUserId: row.leader_id,
      account:
        row.admin_id === null || row.username === null || row.role === null
          ? null
          : { id: row.admin_id, username: row.username, role: row.role },
    }));
}
