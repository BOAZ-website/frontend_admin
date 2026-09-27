import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Database } from 'sql.js';

import {
  loadTeamState,
  persistAttendance,
  persistMembers,
  persistTeams,
  type TeamDbState,
} from '@/entities/study-team/api/teamRepository';
import { persistWeekDates } from '@/entities/cohort/api/cohortRepository';
import { getDatabase } from '@/shared/db/database';

type Persist<K extends keyof TeamDbState> = (
  db: Database,
  prev: TeamDbState[K],
  next: TeamDbState[K],
) => void;

/**
 * 스터디·ADV 팀, 팀원, 출결을 임시 DB에서 불러와 화면 상태로 들고, 값을 바꾸면 곧바로 DB에도 저장한다.
 * 스터디 출결 입력·관리·점수·대시보드가 모두 이 훅이 돌려주는 같은 데이터를 쓰므로,
 * 어느 화면에서 입력하든 다른 화면에서 같은 DB 내용을 조회하게 된다.
 * setter는 useState의 setter처럼 값 또는 (이전값) => 다음값 함수를 받는다.
 */
export function useTeamDb() {
  const [state, setState] = useState<TeamDbState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const stateRef = useRef<TeamDbState | null>(null);
  const dbRef = useRef<Database | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDatabase()
      .then((db) => {
        if (cancelled) return;
        dbRef.current = db;
        stateRef.current = loadTeamState(db);
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
    function makeSetter<K extends keyof TeamDbState>(
      key: K,
      persist: Persist<K>,
    ): Dispatch<SetStateAction<TeamDbState[K]>> {
      return (action) => {
        const current = stateRef.current;
        const db = dbRef.current;
        if (!current || !db) return;
        const prev = current[key];
        const next =
          typeof action === 'function'
            ? (action as (value: TeamDbState[K]) => TeamDbState[K])(prev)
            : action;
        if (next === prev) return;
        persist(db, prev, next);
        stateRef.current = { ...current, [key]: next };
        setState(stateRef.current);
      };
    }

    return {
      setStudyTeams: makeSetter('studyTeams', (db, prev, next) =>
        persistTeams(db, prev, next, 'STUDY'),
      ),
      setAdvTeams: makeSetter('advTeams', (db, prev, next) => persistTeams(db, prev, next, 'ADV')),
      setBaseTeams: makeSetter('baseTeams', (db, prev, next) =>
        persistTeams(db, prev, next, 'BASE'),
      ),
      setMembers: makeSetter('members', persistMembers),
      setWeekDates: makeSetter('weekDates', persistWeekDates),
      setAttendance: makeSetter('attendance', persistAttendance),
    };
  }, []);

  return { state, error, ...setters };
}
