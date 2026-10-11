import { useCallback, useEffect, useState } from 'react';

import { fetchUserTerms } from '@/entities/user/api/usersApi';

import { fetchClubMembers } from '../api/clubMemberApi';
import type { ClubMember } from './types';

export interface ClubMembersState {
  /** 읽는 중이면 null. */
  members: ClubMember[] | null;
  /** 기수 필터 선택지. users 테이블의 기수(GET /api/v1/users/terms)이며, 큰 기수부터 온다. */
  terms: number[];
  error: Error | null;
  reload: () => void;
}

/** 동아리원 목록과 기수 목록을 API에서 읽는다. 수정 뒤에는 reload로 둘 다 다시 읽는다. */
export function useClubMembers(): ClubMembersState {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Omit<ClubMembersState, 'reload'>>({
    members: null,
    terms: [],
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;
    // 기수 목록을 못 읽으면 기수 필터에 '전체'만 보여준다. 동아리원 목록의 오류는 따로 표시한다.
    const termsRequest = fetchUserTerms().catch((): number[] => []);
    Promise.all([fetchClubMembers(), termsRequest])
      .then(([members, terms]) => {
        if (!isCancelled) setState({ members, terms, error: null });
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState((current) => ({
            ...current,
            error: error instanceof Error ? error : new Error(String(error)),
          }));
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}
