import { useCallback, useEffect, useState } from 'react';

import {
  fetchAdminAccounts,
  fetchAuditLogs,
  fetchMyAccount,
  fetchPermissionCatalog,
} from '@/entities/admin-account/api/adminAccountApi';
import type {
  AdminAccount,
  AdminAuditLog,
  PermissionCatalog,
} from '@/entities/admin-account/model/types';
import { fetchClubMembers } from '@/entities/club-member/api/clubMemberApi';
import type { ClubMember } from '@/entities/club-member/model/types';

export interface AdminConsoleData {
  me: AdminAccount;
  catalog: PermissionCatalog;
  /** 계정 목록 조회 권한이 없으면 null(요청하지 않는다). */
  accounts: AdminAccount[] | null;
  /** 감사 로그 조회 권한이 없으면 null(요청하지 않는다). */
  auditLogs: AdminAuditLog[] | null;
  /** 계정 발급 때 고를 동아리원(users). 계정 생성 권한이 없으면 null. */
  members: ClubMember[] | null;
}

export interface AdminConsoleState {
  /** 읽는 중이면 null. */
  data: AdminConsoleData | null;
  error: Error | null;
  reload: () => void;
}

/**
 * 시스템·계정 화면의 데이터. 로그인한 계정(/me)의 유효 권한을 먼저 읽고,
 * 권한이 있는 데이터(계정 목록·감사 로그)만 요청한다. 쓰기 요청 뒤에는 reload로 모두 다시 읽는다.
 */
export function useAdminConsole(): AdminConsoleState {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Omit<AdminConsoleState, 'reload'>>({
    data: null,
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;
    const load = async (): Promise<AdminConsoleData> => {
      const [me, catalog] = await Promise.all([fetchMyAccount(), fetchPermissionCatalog()]);
      const can = (key: string) => me.effectivePermissions.includes(key);
      const [accounts, auditLogs, members] = await Promise.all([
        can('ADMIN_ACCOUNT_READ') ? fetchAdminAccounts() : null,
        can('AUDIT_LOG_READ') ? fetchAuditLogs() : null,
        can('ADMIN_ACCOUNT_CREATE_DELETE') ? fetchClubMembers() : null,
      ]);
      return { me, catalog, accounts, auditLogs, members };
    };
    load()
      .then((data) => {
        if (!isCancelled) setState({ data, error: null });
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
