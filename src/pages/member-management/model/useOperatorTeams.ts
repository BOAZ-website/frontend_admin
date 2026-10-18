import { useEffect, useState } from 'react';

import { fetchPermissionCatalog } from '@/entities/admin-account/api/adminAccountApi';

/** 운영진 팀 목록에서 맨 위에 이 순서로 두는 팀. 나머지는 가나다순이다. */
const PINNED_TEAMS: readonly string[] = ['대표진', '차기대표진'];

const rankOf = (teamName: string): number => {
  const index = PINNED_TEAMS.indexOf(teamName);
  return index === -1 ? PINNED_TEAMS.length : index;
};

/** 팀 이름을 화면 순서로 정렬한 새 배열. */
export const sortOperatorTeams = (teamNames: Iterable<string>): string[] =>
  [...new Set(teamNames)].sort((a, b) => rankOf(a) - rankOf(b) || a.localeCompare(b, 'ko'));

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
