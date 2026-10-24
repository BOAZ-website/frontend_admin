import { useEffect, useState } from 'react';

import { fetchAuditActors, fetchAuditLogs } from '@/entities/audit-log/api/auditLogApi';
import type { AuditActorOption, AuditLogPage, AuditLogQuery } from '@/entities/audit-log/model/dto';

export interface AuditLogsState {
  /** 처음 읽는 중이면 null. 조건을 바꿔 다시 읽는 동안에는 앞의 결과를 그대로 둔다. */
  page: AuditLogPage | null;
  isLoading: boolean;
  error: Error | null;
}

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

/** 조회 조건이 바뀔 때마다 감사 로그 한 쪽을 다시 읽는다. 정렬·거르기는 서버가 한다. */
export function useAuditLogs(query: AuditLogQuery): AuditLogsState {
  const key = JSON.stringify(query);
  // loadedKey: 지금 보여 주는 결과가 어떤 조건으로 읽은 것인지. 조건과 다르면 읽는 중이다.
  const [state, setState] = useState<{
    page: AuditLogPage | null;
    error: Error | null;
    loadedKey: string | null;
  }>({ page: null, error: null, loadedKey: null });

  useEffect(() => {
    let isCancelled = false;
    fetchAuditLogs(JSON.parse(key) as AuditLogQuery)
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

  return { page: state.page, error: state.error, isLoading: state.loadedKey !== key };
}

/** 수행자 필터 선택지. 못 읽으면 빈 목록이다(필터에 '전체'만 남는다). */
export function useAuditActors(): AuditActorOption[] {
  const [actors, setActors] = useState<AuditActorOption[]>([]);
  useEffect(() => {
    let isCancelled = false;
    fetchAuditActors()
      .then((items) => {
        if (!isCancelled) setActors(items);
      })
      .catch(() => {
        if (!isCancelled) setActors([]);
      });
    return () => {
      isCancelled = true;
    };
  }, []);
  return actors;
}
