import { useCallback, useEffect, useState } from 'react';

import { fetchHosts } from '../api/hostApi';
import type { HostAccount } from './types';

export interface HostsState {
  /** 읽는 중이면 null. */
  hosts: HostAccount[] | null;
  error: Error | null;
  reload: () => void;
}

/** HOST 계정 목록을 API에서 읽는다. 로그인할 때 계정의 담당 팀을 찾는 데 쓴다. */
export function useHosts(): HostsState {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Omit<HostsState, 'reload'>>({ hosts: null, error: null });

  useEffect(() => {
    let isCancelled = false;
    fetchHosts()
      .then((hosts) => {
        if (!isCancelled) setState({ hosts, error: null });
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState({
            hosts: null,
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
