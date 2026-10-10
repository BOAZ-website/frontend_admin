import { useCallback, useEffect, useState } from 'react';

import { fetchTeams } from '../api/teamApi';
import { toStudyTeamInfo } from './adapters';
import type { StudyTeamInfo } from './types';

export interface CurrentTeamsState {
  /** 현재 반기의 스터디·ADV 팀. 읽는 중이면 null. */
  teams: { study: StudyTeamInfo[]; adv: StudyTeamInfo[] } | null;
  error: Error | null;
  reload: () => void;
}

/** 현재 반기의 스터디·ADV 팀을 API에서 읽는다. 로그인한 HOST의 담당 팀을 찾는 데 쓴다. */
export function useCurrentTeams(): CurrentTeamsState {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Omit<CurrentTeamsState, 'reload'>>({
    teams: null,
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;
    // 로그인한 HOST의 담당 팀을 찾는 데 쓰므로 방학·학기 스터디를 모두 읽는다.
    Promise.all([fetchTeams('STUDY', { period: 'all' }), fetchTeams('ADV')])
      .then(([study, adv]) => {
        if (!isCancelled) {
          setState({
            teams: { study: study.teams.map(toStudyTeamInfo), adv: adv.teams.map(toStudyTeamInfo) },
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState({
            teams: null,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}
