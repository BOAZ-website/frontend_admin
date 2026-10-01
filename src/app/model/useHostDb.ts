import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Database } from 'sql.js';

import { loadHosts, persistHosts } from '@/entities/host-account/api/hostRepository';
import type { HostAccount } from '@/entities/host-account/model/types';
import { getDatabase } from '@/shared/db/database';
import { execute, inTransaction } from '@/shared/db/createDatabase';

/**
 * HOST 계정을 임시 DB에서 불러와 화면 상태로 들고, 값을 바꾸면 곧바로 DB에도 저장한다.
 * setter는 useState의 setter처럼 값 또는 (이전값) => 다음값 함수를 받는다.
 */
export function useHostDb() {
  const [hosts, setHostsState] = useState<HostAccount[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const hostsRef = useRef<HostAccount[] | null>(null);
  const dbRef = useRef<Database | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDatabase()
      .then((db) => {
        if (cancelled) return;
        dbRef.current = db;
        hostsRef.current = loadHosts(db);
        setHostsState(hostsRef.current);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause : new Error(String(cause)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 최신 값은 ref에서 읽고 DB에 먼저 쓴다. 한 이벤트에서 여러 번 호출해도 순서대로 반영된다.
  const setHosts: Dispatch<SetStateAction<HostAccount[]>> = useCallback((action) => {
    const prev = hostsRef.current;
    const db = dbRef.current;
    if (!prev || !db) return;
    const next = typeof action === 'function' ? action(prev) : action;
    if (next === prev) return;
    persistHosts(db, prev, next);
    hostsRef.current = next;
    setHostsState(next);
  }, []);

  const saveHostWithLeader = useCallback(
    (account: HostAccount, teamId: string | undefined, leaderId: string | undefined) => {
      const previous = hostsRef.current;
      const db = dbRef.current;
      if (!previous || !db) throw new Error('계정 데이터가 아직 준비되지 않았습니다.');
      const next = previous.some((host) => host.id === account.id)
        ? previous.map((host) => (host.id === account.id ? account : host))
        : [...previous, account];
      inTransaction(db, () => {
        persistHosts(db, previous, next);
        if (teamId && leaderId)
          execute(db, 'UPDATE teams SET leader_id = ? WHERE id = ?', [leaderId, teamId]);
      });
      hostsRef.current = next;
      setHostsState(next);
    },
    [],
  );

  return { hosts, error, setHosts, saveHostWithLeader };
}
