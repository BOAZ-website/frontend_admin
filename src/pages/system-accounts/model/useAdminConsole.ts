import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchAccountHolders,
  fetchAdminAccounts,
  fetchMyAccount,
  fetchPermissionCatalog,
} from '@/entities/admin-account/api/adminAccountApi';
import { can } from '@/entities/admin-account/model/can';
import type {
  AccountHolder,
  AdminAccount,
  PermissionCatalog,
} from '@/entities/admin-account/model/types';

export interface AdminConsoleData {
  me: AdminAccount;
  catalog: PermissionCatalog;
  /** 계정 목록 조회 권한이 없으면 null(요청하지 않는다). */
  accounts: AdminAccount[] | null;
  /** 계정을 가진 사람 전체(운영진 + HOST). 계정 목록 조회 권한이 없으면 null. */
  holders: AccountHolder[] | null;
}

export interface AdminConsoleState {
  /** 처음 읽는 중이면 null. 다시 읽다 실패하면 이전 값을 그대로 둔다. */
  data: AdminConsoleData | null;
  /** 마지막으로 읽기에 실패한 사유. 다시 읽기를 시작하면 비운다. */
  error: Error | null;
  /**
   * 모두 다시 읽는다. 다시 읽었으면 true, 실패했으면 false를 돌려준다(실패 사유는 error에 둔다).
   * 쓰기 요청 뒤에 부르는 쪽은 false면 "저장은 됐지만 목록이 최신이 아니다"를 따로 알린다.
   */
  reload: () => Promise<boolean>;
}

/** 로그인한 계정(/me)의 유효 권한을 먼저 읽고, 권한이 있는 데이터(계정 목록)만 요청한다. */
async function loadAdminConsole(): Promise<AdminConsoleData> {
  const [me, catalog] = await Promise.all([fetchMyAccount(), fetchPermissionCatalog()]);
  const canReadAccounts = can(me, 'ADMIN_ACCOUNT_READ');
  const [accounts, holders] = await Promise.all([
    canReadAccounts ? fetchAdminAccounts() : null,
    canReadAccounts ? fetchAccountHolders() : null,
  ]);
  return { me, catalog, accounts, holders };
}

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/**
 * 시스템·계정 화면의 데이터. 쓰기 요청 뒤에는 reload로 모두 다시 읽는다.
 * 처음 읽기·reload·"다시 시도"가 겹쳐도 마지막으로 보낸 요청의 결과만 반영한다(늦게 온 이전 응답은 버린다).
 */
export function useAdminConsole(): AdminConsoleState {
  const [data, setData] = useState<AdminConsoleData | null>(null);
  const [error, setError] = useState<Error | null>(null);
  /** 마지막으로 보낸 읽기 요청 번호. 화면을 떠나면 -1로 두어 남은 응답을 모두 버린다. */
  const latestRequestRef = useRef(0);

  const load = useCallback(async (): Promise<boolean> => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setError(null);
    try {
      const loaded = await loadAdminConsole();
      if (latestRequestRef.current !== requestId) return false;
      setData(loaded);
      return true;
    } catch (loadError) {
      if (latestRequestRef.current === requestId) setError(toError(loadError));
      return false;
    }
  }, []);

  useEffect(() => {
    void load();
    return () => {
      latestRequestRef.current = -1;
    };
  }, [load]);

  return { data, error, reload: load };
}
