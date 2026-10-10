/**
 * HOST 계정과 팀의 연결을 정리하는 임시 API 공용 함수.
 * 팀 삭제와 반기 전환이 같은 규칙을 쓴다. 호출한 요청의 트랜잭션 안에서 실행되므로,
 * 중간에 실패하면 계정 정리도 함께 취소된다.
 */
import type { Database } from 'sql.js';

import { loadHosts } from '@/entities/host-account/api/hostRepository';
import type { HostAccount } from '@/entities/host-account/model/types';
import { execute, queryAll } from '@/shared/db/createDatabase';

import { findTeam } from './queries';

/** 계정이 맡은 팀 id(담당 팀 + 맡은 그룹, 중복 없이). */
export function managedTeamIds(host: HostAccount): string[] {
  return [
    ...new Set(
      [host.teamId, ...(host.assignedGroups ?? []).map((group) => group.teamId)].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  ];
}

/** 반기에 속한 팀 id(BASE·ADV·스터디 모두). */
export function teamIdsOfSemester(db: Database, cohort: number): Set<string> {
  return new Set(
    queryAll<{ team_id: string }>(
      db,
      'SELECT team_id FROM team_semesters WHERE semester_cohort = ?',
      [cohort],
    ).map((row) => row.team_id),
  );
}

/**
 * shouldDetach가 true인 팀을 HOST(출결) 계정에서 뗀다. 시스템 계정 등 다른 계정은 다루지 않는다.
 *  · 그 팀들만 맡던 계정은 출결 접근이 남지 않으므로 지운다.
 *  · 다른 팀도 맡는 계정은 남기고 그 팀들만 뺀다. 담당 팀이 빠지면 남은 팀 중 첫 팀을 담당 팀으로 두고,
 *    ADV·스터디 권한도 남은 팀에 맞춘다.
 *  · 맡은 팀이 하나도 없는 계정(팀 개설 대기)은 건드리지 않는다.
 * isTargetHost를 주면 그 조건에 맞는 계정만 다룬다(예: 팀장이 바뀐 팀의 예전 팀장 계정).
 */
export function detachTeamsFromHosts(
  db: Database,
  shouldDetach: (teamId: string) => boolean,
  isTargetHost: (host: HostAccount) => boolean = () => true,
) {
  const deletedHostIds: string[] = [];
  const detachedHostIds: string[] = [];
  loadHosts(db).forEach((host) => {
    if (!isTargetHost(host)) return;
    const managed = managedTeamIds(host);
    const removed = managed.filter(shouldDetach);
    if (removed.length === 0) return;
    const remaining = managed.filter((id) => !removed.includes(id));
    if (remaining.length === 0) {
      execute(db, 'DELETE FROM host_accounts WHERE id = ?', [host.id]);
      deletedHostIds.push(host.id);
      return;
    }
    removed.forEach((teamId) =>
      execute(db, 'DELETE FROM host_assigned_groups WHERE host_id = ? AND team_id = ?', [
        host.id,
        teamId,
      ]),
    );
    if (host.teamId && removed.includes(host.teamId)) {
      const next = findTeam(db, remaining[0]);
      execute(db, 'UPDATE host_accounts SET team_id = ?, group_type = ? WHERE id = ?', [
        next.id,
        next.group === 'ADV' ? 'ADV' : '스터디',
        host.id,
      ]);
    }
    // 출결 접근 권한(ADV·스터디)도 남은 팀에 맞춘다. 예: 스터디 팀이 모두 빠지면 스터디 권한도 뺀다.
    const permissions = [
      ...new Set(remaining.map((id) => (findTeam(db, id).group === 'ADV' ? 'ADV' : 'STUDY'))),
    ];
    execute(db, 'DELETE FROM host_permissions WHERE host_id = ?', [host.id]);
    permissions.forEach((permission, position) =>
      execute(db, 'INSERT INTO host_permissions (host_id, position, permission) VALUES (?, ?, ?)', [
        host.id,
        position,
        permission,
      ]),
    );
    detachedHostIds.push(host.id);
  });
  return { deletedHostIds, detachedHostIds };
}
