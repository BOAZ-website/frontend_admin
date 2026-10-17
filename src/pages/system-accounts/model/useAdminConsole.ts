import { useCallback, useEffect, useState } from 'react';

import {
  fetchAdminAccounts,
  fetchMyAccount,
  fetchPermissionCatalog,
} from '@/entities/admin-account/api/adminAccountApi';
import { can } from '@/entities/admin-account/model/can';
import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import { fetchClubMembers } from '@/entities/club-member/api/clubMemberApi';
import type { ClubMember } from '@/entities/club-member/model/types';

export interface AdminConsoleData {
  me: AdminAccount;
  catalog: PermissionCatalog;
  /** 계정 목록 조회 권한이 없으면 null(요청하지 않는다). */
  accounts: AdminAccount[] | null;
  /** 계정 발급 때 고를 동아리원(users). 계정 생성 권한이 없으면 null. */
  members: ClubMember[] | null;
}

export interface AdminConsoleState {
  /** 처음 읽는 중이면 null. 다시 읽다 실패하면 이전 값을 그대로 둔다. */
  data: AdminConsoleData | null;
  /** 마지막으로 읽기에 실패한 사유. 다시 읽기를 시작하면 비운다. */
  error: Error | null;
  /** 모두 다시 읽는다. 읽기가 끝나면(실패해도) 끝나는 Promise를 돌려준다. */
  reload: () => Promise<void>;
}

/** 로그인한 계정(/me)의 유효 권한을 먼저 읽고, 권한이 있는 데이터(계정 목록·발급 대상 회원)만 요청한다. */
async function loadAdminConsole(): Promise<AdminConsoleData> {
  const [me, catalog] = await Promise.all([fetchMyAccount(), fetchPermissionCatalog()]);
  const [accounts, members] = await Promise.all([
    can(me, 'ADMIN_ACCOUNT_READ') ? fetchAdminAccounts() : null,
    can(me, 'ADMIN_ACCOUNT_CREATE_DELETE') ? fetchClubMembers() : null,
  ]);
  return { me, catalog, accounts, members };
}

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/** 시스템·계정 화면의 데이터. 쓰기 요청 뒤에는 reload로 모두 다시 읽는다. */
export function useAdminConsole(): AdminConsoleState {
  const [data, setData] = useState<AdminConsoleData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isCancelled = false;
    loadAdminConsole()
      .then((loaded) => {
        if (!isCancelled) setData(loaded);
      })
      .catch((loadError: unknown) => {
        if (!isCancelled) setError(toError(loadError));
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    setError(null);
    try {
      setData(await loadAdminConsole());
    } catch (loadError) {
      setError(toError(loadError));
    }
  }, []);

  return { data, error, reload };
}
