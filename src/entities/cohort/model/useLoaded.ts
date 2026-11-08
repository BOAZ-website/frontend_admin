import { useCallback, useEffect, useState } from 'react';

/** 반기 Hook들이 함께 쓰는 읽기 상태. key가 바뀌거나 reload를 부르면 다시 읽는다. */
export interface LoadedState<T> {
  /** 아직 한 번도 읽지 못했으면 null. 다시 읽는 동안에는 이전 값을 그대로 둔다. */
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
  }>({ data: null, error: null, loadedKey: null });

  useEffect(() => {
    if (key === null || requestKey === null) return;
    let isCancelled = false;
    load(key)
      .then((data) => {
        if (!isCancelled) setState({ data, error: null, loadedKey: requestKey });
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error : new Error(String(error)),
          loadedKey: requestKey,
        }));
      });
    return () => {
      isCancelled = true;
    };
  }, [key, requestKey, load]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return {
    data: state.data,
    error: state.error,
    isLoading: requestKey !== null && state.loadedKey !== requestKey,
    reload,
  };
}
