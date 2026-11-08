import { useCallback, useEffect, useState } from 'react';

import { fetchAuditFilters } from '../api/auditLogApi';
import type { AuditFilterOptions } from './dto';

/** useAuditFilters가 돌려주는 값. */
export interface AuditFiltersState {
  /** 읽는 중이거나 읽지 못했으면 null. */
  filters: AuditFilterOptions | null;
  isLoading: boolean;
  error: Error | null;
  /** 다시 읽는다. */
  reload: () => void;
}

/** 읽은 선택지와, 몇 번째 읽기의 결과인지. */
interface LoadedAuditFilters {
  filters: AuditFilterOptions | null;
  error: Error | null;
  loadedVersion: number | null;
}

/** 감사 로그의 분류·권한 필터 선택지(GET /api/v1/admin/audit-logs/filters)를 읽는다. */
export function useAuditFilters(): AuditFiltersState {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<LoadedAuditFilters>({
    filters: null,
    error: null,
    loadedVersion: null,
  });

  useEffect(() => {
    let isCancelled = false;
    fetchAuditFilters()
      .then((filters) => {
        if (!isCancelled) setState({ filters, error: null, loadedVersion: version });
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState({
            filters: null,
            error: error instanceof Error ? error : new Error(String(error)),
            loadedVersion: version,
          });
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return {
    filters: state.filters,
    error: state.error,
    isLoading: state.loadedVersion !== version,
    reload,
  };
}
