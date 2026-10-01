/**
 * HOST 계정을 임시 DB(SQLite)에서 읽고 쓰는 저장소 계층.
 * 계정의 담당 팀은 스터디·ADV 출결이 쓰는 teams 테이블을 그대로 가리킨다(team_id).
 * 그래서 팀 이름과 구분(ADV/스터디)은 teams에서 읽고, 계정을 저장할 때는 팀 id(없으면 이름)로 팀을 찾는다.
 * 화면은 DB를 직접 다루지 않고 이 함수들로만 조회·저장한다. 백엔드가 붙으면 이 파일만 API 호출로 바꾸면 된다.
 */
import type { Database } from 'sql.js';

import { execute, inTransaction, queryAll } from '@/shared/db/createDatabase';

import type { AssignedGroup, HostAccount } from '../model/types';

interface HostRow extends Record<string, unknown> {
  id: string;
  user_id: string | null;
  username: string;
  initial_password: string | null;
  host_name: string | null;
  generation: string | null;
  track: string | null;
  role: string | null;
  team_id: string | null;
  team_name: string | null;
  group_type: string | null;
  account_type: 'STUDY' | 'ADV' | null;
  created_at: string;
  active: number;
  last_login: string | null;
  user_name: string | null;
  user_term: number | null;
  user_track: string | null;
}

function groupBy<T extends { host_id: string }>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => {
    const list = grouped.get(row.host_id) ?? [];
    list.push(row);
    grouped.set(row.host_id, list);
  });
  return grouped;
}

// ───────────────────────────── 조회 ─────────────────────────────

export function loadHosts(db: Database): HostAccount[] {
  const permissions = groupBy(
    queryAll<{ host_id: string; permission: 'ADV' | 'STUDY' }>(
      db,
      'SELECT host_id, permission FROM host_permissions ORDER BY host_id, position',
    ),
  );
  const groups = groupBy(
    queryAll<{ host_id: string; team_id: string; group_type: 'STUDY' | 'ADV'; team_name: string }>(
      db,
      `SELECT g.host_id, g.team_id, t.group_type, t.team_name
         FROM host_assigned_groups g JOIN teams t ON t.id = g.team_id
        ORDER BY g.host_id, g.position`,
    ),
  );
  const roles = groupBy(
    queryAll<{ host_id: string; role: string }>(
      db,
      'SELECT host_id, role FROM host_concurrent_roles ORDER BY host_id, position',
    ),
  );

  return queryAll<HostRow>(
    db,
    `SELECT h.*, t.team_name, u.name AS user_name, u.term AS user_term, u.track AS user_track
       FROM host_accounts h
       LEFT JOIN teams t ON t.id = h.team_id
       LEFT JOIN users u ON u.id = h.user_id
      ORDER BY h.created_at, h.id`,
  ).map((row) => {
    const hostPermissions = permissions.get(row.id)?.map((item) => item.permission);
    const assignedGroups = groups.get(row.id)?.map((item): AssignedGroup => ({
      type: item.group_type === 'ADV' ? 'ADV' : '스터디',
      teamName: item.team_name,
      teamId: item.team_id,
    }));
    const concurrentRoles = roles.get(row.id)?.map((item) => item.role);

    // 값이 없는 항목은 키 자체를 두지 않는다(화면이 "없음"과 "빈 목록"을 다르게 다룬다).
    return {
      id: row.id,
      username: row.username,
      team: row.team_name ?? '',
      createdAt: row.created_at,
      ...(row.user_id === null ? {} : { userId: row.user_id }),
      ...(row.team_id === null ? {} : { teamId: row.team_id }),
      active: row.active === 1,
      ...(row.initial_password === null ? {} : { initialPassword: row.initial_password }),
      ...(row.user_name === null && row.host_name === null
        ? {}
        : { hostName: row.user_name ?? row.host_name ?? undefined }),
      ...(row.user_term === null && row.generation === null
        ? {}
        : {
            generation:
              row.user_term === null ? (row.generation ?? undefined) : `${row.user_term}기`,
          }),
      ...(row.user_track === null && row.track === null
        ? {}
        : { track: row.user_track ?? row.track ?? undefined }),
      ...(row.role === null ? {} : { role: row.role }),
      ...(row.group_type === null ? {} : { groupType: row.group_type }),
      ...(row.account_type === null ? {} : { accountType: row.account_type }),
      ...(row.last_login === null ? {} : { lastLogin: row.last_login }),
      ...(hostPermissions ? { permissions: hostPermissions } : {}),
      ...(assignedGroups ? { assignedGroups } : {}),
      ...(concurrentRoles ? { concurrentRoles } : {}),
    };
  });
}

// ───────────────────────────── 저장 ─────────────────────────────

type TeamGroup = 'STUDY' | 'ADV';

/** 팀 id가 있으면 그 팀이 실제로 있는지 확인하고, 없으면 이름으로 찾는다(같은 이름이면 가장 큰 기수의 팀). 못 찾으면 null. */
function resolveTeamId(
  db: Database,
  teamId: string | undefined,
  teamName: string | undefined,
  group: TeamGroup | undefined,
): string | null {
  if (teamId) {
    const byId = queryAll<{ id: string }>(db, 'SELECT id FROM teams WHERE id = ?', [teamId]);
    if (byId.length > 0) return byId[0].id;
  }
  const name = teamName?.trim();
  if (!name) return null;
  const byName = queryAll<{ id: string }>(
    db,
    `SELECT id FROM teams
      WHERE team_name = ? AND (? IS NULL OR group_type = ?)
      ORDER BY cohort DESC, id LIMIT 1`,
    [name, group ?? null, group ?? null],
  );
  return byName[0]?.id ?? null;
}

const toTeamGroup = (type: string | undefined): TeamGroup | undefined =>
  type === 'ADV' ? 'ADV' : type === '스터디' || type === 'STUDY' ? 'STUDY' : undefined;

function resolveOrCreateUserId(db: Database, host: HostAccount): string | null {
  if (host.userId) {
    const existing = queryAll<{ id: string }>(db, 'SELECT id FROM users WHERE id = ?', [
      host.userId,
    ]);
    if (existing.length > 0) return host.userId;
  }
  const name = host.hostName?.trim();
  const term = Number.parseInt(host.generation ?? '', 10);
  if (!name || !Number.isFinite(term)) return null;
  const matched = queryAll<{ id: string }>(
    db,
    'SELECT id FROM users WHERE name = ? AND term = ? LIMIT 1',
    [name, term],
  )[0];
  if (matched) return matched.id;

  const id = `u_host_${host.id}`;
  const track = ['분석', '시각화', '엔지니어링'].includes(host.track ?? '')
    ? (host.track as string)
    : '분석';
  execute(db, 'INSERT INTO users (id, name, term, track) VALUES (?, ?, ?, ?)', [
    id,
    name,
    term,
    track,
  ]);
  return id;
}

function writeChildren(db: Database, host: HostAccount): void {
  execute(db, 'DELETE FROM host_permissions WHERE host_id = ?', [host.id]);
  (host.permissions ?? []).forEach((permission, position) =>
    execute(db, 'INSERT INTO host_permissions (host_id, position, permission) VALUES (?, ?, ?)', [
      host.id,
      position,
      permission,
    ]),
  );

  // 담당 그룹은 실제로 있는 팀만 저장한다(팀이 아직 없는 그룹은 건너뛴다).
  execute(db, 'DELETE FROM host_assigned_groups WHERE host_id = ?', [host.id]);
  (host.assignedGroups ?? [])
    .map((group) => resolveTeamId(db, group.teamId, group.teamName, toTeamGroup(group.type)))
    .filter((teamId): teamId is string => teamId !== null)
    .forEach((teamId, position) =>
      execute(
        db,
        'INSERT INTO host_assigned_groups (host_id, position, team_id) VALUES (?, ?, ?)',
        [host.id, position, teamId],
      ),
    );

  execute(db, 'DELETE FROM host_concurrent_roles WHERE host_id = ?', [host.id]);
  (host.concurrentRoles ?? []).forEach((role, position) =>
    execute(db, 'INSERT INTO host_concurrent_roles (host_id, position, role) VALUES (?, ?, ?)', [
      host.id,
      position,
      role,
    ]),
  );
}

export function persistHosts(
  db: Database,
  prev: readonly HostAccount[],
  next: readonly HostAccount[],
): void {
  const prevById = new Map(prev.map((host) => [host.id, host]));
  const nextIds = new Set(next.map((host) => host.id));

  inTransaction(db, () => {
    prev
      .filter((host) => !nextIds.has(host.id))
      .forEach((host) => execute(db, 'DELETE FROM host_accounts WHERE id = ?', [host.id]));

    next
      .filter((host) => prevById.get(host.id) !== host)
      .forEach((host) => {
        const userId = resolveOrCreateUserId(db, host);
        execute(
          db,
          `INSERT INTO host_accounts (id, username, initial_password, user_id, host_name, generation, track, role, team_id,
                                      group_type, account_type, created_at, active, last_login)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             username = excluded.username, initial_password = excluded.initial_password,
             user_id = excluded.user_id, host_name = excluded.host_name,
             generation = excluded.generation, track = excluded.track,
             role = excluded.role, team_id = excluded.team_id, group_type = excluded.group_type,
             account_type = excluded.account_type, active = excluded.active,
             last_login = excluded.last_login`,
          [
            host.id,
            host.username,
            host.initialPassword ?? null,
            userId,
            userId ? null : (host.hostName ?? null),
            userId ? null : (host.generation ?? null),
            userId ? null : (host.track ?? null),
            host.role ?? null,
            resolveTeamId(
              db,
              host.teamId,
              host.team,
              toTeamGroup(host.groupType ?? host.accountType),
            ),
            host.groupType ?? null,
            host.accountType ?? null,
            host.createdAt,
            host.active ? 1 : 0,
            host.lastLogin ?? null,
          ],
        );
        writeChildren(db, host);
      });
  });
}
