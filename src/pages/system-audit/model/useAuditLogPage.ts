import { useEffect, useState } from 'react';

import type { AuditLogPage, AuditLogQuery } from '@/entities/audit-log/model/dto';
import type { AuditLogEntry } from '@/entities/audit-log/model/types';
import { useAuditFilters } from '@/entities/audit-log/model/useAuditFilters';
import { useAuditLogs } from '@/entities/audit-log/model/useAuditLogs';

import {
  type AuditFilterOption,
  type AuditSheet,
  hashOfSheet,
  permissionOptionsOf,
  sheetOfHash,
} from './auditLogView';

/** 한 쪽에 보이는 기록 수. */
const PAGE_SIZE = 7;

/** 도구 줄의 거르기 조건. */
export interface AuditLogFilter {
  /** 권한 매트릭스의 권한 이름, 매트릭스에 없는 작업(NONE), 또는 전체(ALL). */
  permission: string;
  /** 'YYYY-MM-DD'. 고르면 그날 기록만 본다. */
  date: string;
  q: string;
}

/** 아무것도 거르지 않는 조건. */
export const EMPTY_AUDIT_FILTER: AuditLogFilter = { permission: 'ALL', date: '', q: '' };

/** 감사 로그 화면 상태: 고른 분류·조건·쪽, 읽은 기록, 처리 함수. */
export interface AuditLogPageState {
  /** 오른쪽에 연 분류. 패널을 닫았으면 null. */
  sheet: AuditSheet | null;
  filter: AuditLogFilter;
  isFiltered: boolean;
  result: AuditLogPage | null;
  isLoading: boolean;
  error: Error | null;
  reloadLogs: () => void;
  permissionOptions: AuditFilterOption[];
  filtersError: Error | null;
  reloadFilters: () => void;
  lastPage: number;
  /** 상세 창을 연 기록. 닫혀 있으면 null. */
  openEntry: AuditLogEntry | null;
  handleChangeFilter: (patch: Partial<AuditLogFilter>) => void;
  handleChangeSheet: (sheet: AuditSheet) => void;
  handleClosePanel: () => void;
  handleChangePage: (page: number) => void;
  handleOpenEntry: (entryId: number) => void;
  handleCloseEntry: () => void;
}

/**
 * 감사 로그 화면. 분류를 주소에 남겨 새로고침해도 유지하고, 조건·쪽을 바꾸면 서버가 거른 기록을 다시 읽는다.
 */
export function useAuditLogPage(): AuditLogPageState {
  const [sheet, setSheet] = useState<AuditSheet | null>(() => sheetOfHash(window.location.hash));
  const [filter, setFilter] = useState<AuditLogFilter>(EMPTY_AUDIT_FILTER);
  const [page, setPage] = useState(1);
  const [openEntryId, setOpenEntryId] = useState<number | null>(null);

  // 주소(외부)와 고른 분류를 맞춘다.
  useEffect(() => {
    const hash = hashOfSheet(sheet);
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [sheet]);

  const query: AuditLogQuery = {
    category: sheet && sheet !== 'ALL' ? sheet : undefined,
    permission: filter.permission === 'ALL' ? undefined : filter.permission,
    from: filter.date || undefined,
    to: filter.date || undefined,
    q: filter.q.trim() || undefined,
    page,
    size: PAGE_SIZE,
  };
  const logs = useAuditLogs(query);
  const filters = useAuditFilters();
  const result = logs.page;

  return {
    sheet,
    filter,
    isFiltered: JSON.stringify(filter) !== JSON.stringify(EMPTY_AUDIT_FILTER),
    result,
    isLoading: logs.isLoading,
    error: logs.error,
    reloadLogs: logs.reload,
    permissionOptions: permissionOptionsOf(filters.filters, sheet),
    filtersError: filters.error,
    reloadFilters: filters.reload,
    lastPage: result ? Math.max(1, Math.ceil(result.total / result.size)) : 1,
    openEntry: result?.items.find((entry) => entry.id === openEntryId) ?? null,
    handleChangeFilter: (patch) => {
      setFilter((current) => ({ ...current, ...patch }));
      setPage(1);
    },
    // 권한 필터는 분류마다 선택지가 달라 푼다.
    handleChangeSheet: (next) => {
      setSheet(next);
      setFilter((current) => ({ ...current, permission: 'ALL' }));
      setPage(1);
    },
    handleClosePanel: () => setSheet(null),
    handleChangePage: setPage,
    handleOpenEntry: setOpenEntryId,
    handleCloseEntry: () => setOpenEntryId(null),
  };
}
