import { useCallback, useEffect, useState } from 'react';

/** 서버 데이터를 읽는 Hook들이 함께 쓰는 읽기 상태. key가 바뀌거나 reload를 부르면 다시 읽는다. */
export interface LoadedState<T> {
  /** 같은 key를 다시 읽는 동안에는 이전 값을 두고, key가 바뀌면 새 응답이 올 때까지 null이다. */
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * load(key)를 부르고, 늦게 도착한 옛 응답은 버린다(R6-9). key가 null이면 읽지 않는다.
 * load는 모듈 최상위 함수를 넘긴다. 그릴 때마다 새로 만든 함수를 넘기면 계속 다시 읽는다.
 */
export function useLoaded<T>(
  key: string | null,
  load: (key: string) => Promise<T>,
): LoadedState<T> {
  const [version, setVersion] = useState(0);
  const requestKey = key === null ? null : `${key}#${version}`;
  const [state, setState] = useState<{
    data: T | null;
    error: Error | null;
    loadedKey: string | null;
    /** data·error를 요청한 key(version 제외). */
    dataKey: string | null;
  }>({ data: null, error: null, loadedKey: null, dataKey: null });

  useEffect(() => {
    if (key === null || requestKey === null) return;
    let isCancelled = false;
    load(key)
      .then((data) => {
        if (!isCancelled) setState({ data, error: null, loadedKey: requestKey, dataKey: key });
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        setState((current) => ({
          // 같은 key를 다시 읽다 실패했으면 이전 값을 두고, 다른 key의 값은 버린다.
          data: current.dataKey === key ? current.data : null,
          error: error instanceof Error ? error : new Error(String(error)),
          loadedKey: requestKey,
          dataKey: key,
        }));
      });
    return () => {
      isCancelled = true;
    };
  }, [key, requestKey, load]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return {
    data: state.dataKey === key ? state.data : null,
    error: state.dataKey === key ? state.error : null,
    isLoading: requestKey !== null && state.loadedKey !== requestKey,
    reload,
  };
}
