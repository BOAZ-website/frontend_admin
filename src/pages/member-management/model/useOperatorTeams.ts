import { useEffect, useState } from 'react';

import { fetchPermissionCatalog } from '@/entities/admin-account/api/adminAccountApi';
import { compareTeamNames } from '@/entities/admin-account/model/teams';

/** 팀 이름을 화면 순서(대표진·차기대표진 고정 → 가나다순)로 정렬한 새 배열. 규칙은 entities의 teams.ts. */
export const sortOperatorTeams = (teamNames: Iterable<string>): string[] =>
  [...new Set(teamNames)].sort(compareTeamNames);

/**
 * 운영진으로 정할 수 있는 팀 목록. 권한 카탈로그 API(GET /api/v1/admin/permissions)의 팀 목록을 쓴다.
 * 차기대표진은 대표진과 권한이 달라 따로 고른다. 읽지 못하면 빈 배열과 오류를 돌려준다.
 */
export function useOperatorTeams(): { teams: string[]; error: Error | null } {
  const [teams, setTeams] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isCancelled = false;
    fetchPermissionCatalog()
      .then((catalog) => {
        if (!isCancelled) setTeams(sortOperatorTeams(catalog.teamNames));
      })
      .catch((loadError: unknown) => {
        if (!isCancelled) {
          setError(loadError instanceof Error ? loadError : new Error(String(loadError)));
        }
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  return { teams, error };
}
