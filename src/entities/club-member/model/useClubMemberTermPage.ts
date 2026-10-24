import { useCallback, useEffect, useState } from 'react';

import { fetchClubMembersByTerm } from '../api/clubMemberApi';
import type { ClubMemberTermPage, ClubMemberTermScope } from './types';

export interface ClubMemberTermPageState {
  /** 읽는 중이거나 읽지 않는 조건(scope가 null이거나 status·track이 둘 다 없음)이면 null. */
  page: ClubMemberTermPage | null;
  error: Error | null;
  reload: () => void;
}

/**
 * 활동기수·수료기수 목록이나 부문 명단의 한 기수(GET /api/v1/club-members/by-term)를 읽는다.
 * scope가 null이거나 status·track이 둘 다 없으면 읽지 않는다(탈퇴 명단 등 기수 페이지가 없는 화면).
 * term이 null이면 조건에 맞는 가장 최근 기수다.
 * scope 객체가 아니라 scope.status·scope.track 값과 term이 바뀔 때 다시 읽는다(매 렌더 새 객체를 넘겨도 된다).
 * 수정 뒤에는 reload로 다시 읽는다. 다시 읽기를 시작하면 error는 null이 되고, page는 새 결과가 올 때까지 이전 값을 유지한다.
 */
export function useClubMemberTermPage(
  scope: ClubMemberTermScope | null,
  term: number | null,
): ClubMemberTermPageState {
  const status = scope?.status;
  const track = scope?.track;
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Omit<ClubMemberTermPageState, 'reload'>>({
    page: null,
    error: null,
  });

  useEffect(() => {
    if (!status && !track) {
      setState({ page: null, error: null });
      return;
    }
    // 다시 읽기 시작할 때 이전 조건의 오류는 지운다. page는 화면이 튀지 않게 그대로 둔다.
    // 오류가 없으면 같은 객체를 돌려줘서 다시 그리지 않는다.
    setState((current) => (current.error === null ? current : { ...current, error: null }));
    let isCancelled = false;
    fetchClubMembersByTerm({ status, track }, term ?? undefined)
      .then((page) => {
        if (!isCancelled) setState({ page, error: null });
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
  }, [status, track, term, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}
