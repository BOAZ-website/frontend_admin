import { useCallback, useEffect, useState } from 'react';

import { fetchAuditLogs } from '../api/auditLogApi';
import type { AuditLogPage, AuditLogQuery } from './dto';

/** useAuditLogs가 돌려주는 값. */
export interface AuditLogsState {
  /** 처음 읽는 중이면 null. 조건을 바꿔 다시 읽는 동안에는 앞의 결과를 그대로 둔다. */
  page: AuditLogPage | null;
  isLoading: boolean;
  error: Error | null;
  /** 같은 조건으로 다시 읽는다. */
  reload: () => void;
}

/** 읽은 결과와, 그 결과를 어떤 키로 읽었는지. */
interface LoadedAuditLogs {
  page: AuditLogPage | null;
  error: Error | null;
  loadedKey: string | null;
}

/** 의존성 키로 쓰는 값: 조회 조건과 다시 읽기 횟수. */
interface AuditLogsKey {
  query: AuditLogQuery;
  version: number;
}

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

/** 조회 조건이 바뀔 때마다 감사 로그 한 쪽을 다시 읽는다. 정렬·거르기는 서버가 한다. */
export function useAuditLogs(query: AuditLogQuery): AuditLogsState {
  const [version, setVersion] = useState(0);
  // 조건이 객체라 JSON 문자열을 의존성으로 쓴다(R6-11). 다시 읽기 횟수도 키에 넣는다.
  const key = JSON.stringify({ query, version } satisfies AuditLogsKey);
  // loadedKey: 지금 보여 주는 결과가 어떤 키로 읽은 것인지. 키와 다르면 읽는 중이다.
  const [state, setState] = useState<LoadedAuditLogs>({ page: null, error: null, loadedKey: null });

  useEffect(() => {
    let isCancelled = false;
    // 같은 Hook에서 만든 키를 되돌리는 것이라 단언을 허용한다(R9-3 예외).
    const { query: loadedQuery } = JSON.parse(key) as AuditLogsKey;
    fetchAuditLogs(loadedQuery)
      .then((page) => {
        if (!isCancelled) setState({ page, error: null, loadedKey: key });
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState((current) => ({ ...current, error: toError(error), loadedKey: key }));
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [key]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { page: state.page, error: state.error, isLoading: state.loadedKey !== key, reload };
}
