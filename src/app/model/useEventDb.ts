import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Database } from 'sql.js';

import {
  loadEventState,
  persistAttendees,
  persistEvents,
  persistTemplates,
  type EventDbState,
} from '@/entities/event/api/eventRepository';
import { getDatabase } from '@/shared/db/database';

type Persist<K extends keyof EventDbState> = (
  db: Database,
  prev: EventDbState[K],
  next: EventDbState[K],
) => void;

/**
 * 행사·행사 참가자·양식 템플릿을 임시 DB에서 불러와 화면 상태로 들고, 값을 바꾸면 곧바로 DB에도 저장한다.
 * setter는 useState의 setter처럼 값 또는 (이전값) => 다음값 함수를 받는다.
 */
export function useEventDb() {
  const [state, setState] = useState<EventDbState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const stateRef = useRef<EventDbState | null>(null);
  const dbRef = useRef<Database | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDatabase()
      .then((db) => {
        if (cancelled) return;
        dbRef.current = db;
        stateRef.current = loadEventState(db);
        setState(stateRef.current);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause : new Error(String(cause)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setters = useMemo(() => {
    // 최신 값은 ref에서 읽고 DB에 먼저 쓴다. 한 이벤트에서 여러 번 호출해도 순서대로 반영된다.
    function makeSetter<K extends keyof EventDbState>(
      key: K,
      persist: Persist<K>,
    ): Dispatch<SetStateAction<EventDbState[K]>> {
      return (action) => {
        const current = stateRef.current;
        const db = dbRef.current;
        if (!current || !db) return;
        const prev = current[key];
        const next =
          typeof action === 'function'
            ? (action as (value: EventDbState[K]) => EventDbState[K])(prev)
            : action;
        if (next === prev) return;
        persist(db, prev, next);
        stateRef.current = { ...current, [key]: next };
        setState(stateRef.current);
      };
    }

    return {
      setEvents: makeSetter('events', persistEvents),
      setAttendees: makeSetter('attendees', persistAttendees),
      setTemplates: makeSetter('templates', persistTemplates),
    };
  }, []);

  return { state, error, ...setters };
}
