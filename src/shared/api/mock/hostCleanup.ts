/**
 * 맡은 그룹이 없어진 HOST 계정을 지우는 임시 API 공용 함수(설계문서 2026-11-06판 3.3·3.4·4.3).
 * 팀장 변경·팀장 해제·팀 삭제·반기 전환이 같은 규칙을 쓴다. 호출한 요청의 트랜잭션 안에서 실행되므로,
 * 중간에 실패하면 계정 정리도 함께 취소된다.
 *  · 운영진 계정은 지우지 않는다. 리더 권한은 admin_group_leader 행이 빠지면서 함께 빠진다.
 *  · 시작 전이거나 진행 중인 그룹을 하나라도 맡은 HOST 계정은 남긴다(다음 반기 팀장으로 미리 지정된 사람 포함).
 *  · 그 밖의 HOST 계정은 지운다. 맡은 그룹 연결(admin_group_leader)도 외래 키로 함께 지워진다.
 * 맡은 그룹은 admin_group_leader가 아니라 teams.leader_id로 판단한다. admin_group_leader는 현재 반기 팀만 담아서
 * 다음 반기 팀장 여부를 알 수 없기 때문이다.
 */
import type { Database } from 'sql.js';

import { execute, queryAll } from '@/shared/db/createDatabase';

import { groupStates } from './groupState';

/**
 * 맡은 그룹이 없는 HOST 계정을 지우고, 지운 계정 id를 돌려준다.
 * userIds를 주면 그 회원의 계정만 본다(팀장 변경·해제·팀 삭제의 예전 팀장). 주지 않으면 모든 HOST 계정을 본다(반기 전환).
 */
export function cleanupHostAccounts(db: Database, userIds?: readonly (string | null)[]): number[] {
  const targets = userIds?.filter((id): id is string => Boolean(id));
  if (targets?.length === 0) return [];

  const states = groupStates(db);
  const leadingUserIds = new Set(
    queryAll<{ id: string; leader_id: string }>(
      db,
      "SELECT id, leader_id FROM teams WHERE leader_id IS NOT NULL AND group_type IN ('ADV', 'STUDY')",
    )
      .filter((team) => states.has(team.id) && states.get(team.id) !== 'ENDED')
      .map((team) => team.leader_id),
  );
  const hosts = queryAll<{ id: number; user_id: string }>(
    db,
    "SELECT id, user_id FROM admin WHERE role = 'HOST'",
  ).filter((host) => !targets || targets.includes(host.user_id));

  const deleted = hosts.filter((host) => !leadingUserIds.has(host.user_id)).map((host) => host.id);
  deleted.forEach((id) => execute(db, 'DELETE FROM admin WHERE id = ?', [id]));
  return deleted;
}
