import { useEffect, useState } from 'react';

import { fetchAuditFilters } from '../api/auditLogApi';
import type { AuditFilterOptions } from './dto';

export interface AuditFiltersState {
  /** 읽는 중이면 null. */
  filters: AuditFilterOptions | null;
  error: Error | null;
}

/** 감사 로그의 분류·권한 필터 선택지(GET /api/v1/admin/audit-logs/filters)를 한 번 읽는다. */
export function useAuditFilters(): AuditFiltersState {
  const [state, setState] = useState<AuditFiltersState>({ filters: null, error: null });

  useEffect(() => {
    let isCancelled = false;
    fetchAuditFilters()
      .then((filters) => {
        if (!isCancelled) setState({ filters, error: null });
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState({
            filters: null,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  return state;
}
