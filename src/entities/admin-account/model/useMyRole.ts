import { useEffect, useState } from 'react';

import { fetchMyAccount } from '../api/adminAccountApi';
import type { AdminRole } from './types';

/**
 * 로그인한 운영진 계정의 등급. 읽는 중이거나 읽지 못했으면(HOST 세션 403 포함) null이다.
 * 화면이 편집 UI를 열지 정하는 데만 쓴다. 최종 판단은 서버가 한다.
 */
export function useMyRole(): AdminRole | null {
  const [role, setRole] = useState<AdminRole | null>(null);
  useEffect(() => {
    let isCancelled = false;
    fetchMyAccount()
      .then((account) => {
        if (!isCancelled) setRole(account.role);
      })
      // 읽지 못하면 편집 UI를 열지 않는다(조회만).
      .catch(() => undefined);
    return () => {
      isCancelled = true;
    };
  }, []);
  return role;
}
