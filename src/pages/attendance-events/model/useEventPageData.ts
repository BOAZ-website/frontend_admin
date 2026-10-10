/**
 * 행사 출결 화면 데이터. 화면을 열 때 행사·참가자를 API로 읽는다.
 * 화면은 지금처럼 목록 setter(setEvents 등)로 값을 바꾸고, 이 훅이 바뀐 항목만 골라 API를 부른다.
 * 저장 요청은 한 줄로 세워 순서대로 보낸다(새 행사를 만든 뒤 그 행사의 참가자를 저장하는 경우가 있다).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import {
  createEvent,
  createEventAttendee,
  deleteEvent,
  fetchEvent,
  fetchEventAttendees,
  fetchEvents,
  fetchEventTerms,
  patchEventAttendee,
  saveEventAttendees,
  updateEvent,
} from '@/entities/event/api/eventApi';
import { attendeePatchOf } from '@/entities/event/model/attendeePatch';
import type { AttendanceEvent, AttendeeRecord } from '@/entities/event/model/types';
import { alertApiError } from '@/shared/lib/alertApiError';

interface EventState {
  events: AttendanceEvent[];
  attendees: AttendeeRecord[];
}

export interface EventPageData {
  status: 'loading' | 'ready' | 'error';
  error: Error | null;
  events: AttendanceEvent[];
  attendees: AttendeeRecord[];
  setEvents: Dispatch<SetStateAction<AttendanceEvent[]>>;
  setAttendees: Dispatch<SetStateAction<AttendeeRecord[]>>;
  /** 행사 참가자의 기수 목록(백엔드, 행사 DB 기준). 앞서 보낸 저장 요청이 끝난 뒤에 읽는다. */
  loadEventTerms: (eventId: string) => Promise<number[]>;
  /** 행사 한 건(추가 컬럼·지운 기본 열 포함)을 서버에서 다시 읽는다. 앞서 보낸 저장 요청이 끝난 뒤에 읽는다. */
  loadEvent: (eventId: string) => Promise<AttendanceEvent>;
  /**
   * 참가자 한 명을 바꾼다(출결 버튼·뒤풀이 비용 등). 화면에 바로 반영하고, 바뀐 칸만 부분 저장(PATCH)으로 보낸다.
   * 명단 전체를 보내지 않으므로 다른 사람이 동시에 바꾼 내용을 덮어쓰지 않는다.
   */
  patchAttendee: (attendeeId: string, update: (attendee: AttendeeRecord) => AttendeeRecord) => void;
  /**
   * 참가자 한 명을 명단 맨 앞에 추가한다(참가자 추가 창). 화면에 바로 반영하고 한 명 추가(POST)로 보낸다.
   * 저장 결과(회원과 연결된 값)를 받으면 화면 값도 그것으로 바꾼다.
   */
  createAttendee: (attendee: AttendeeRecord) => void;
}

const EMPTY: EventState = { events: [], attendees: [] };

/** id로 비교해 지운 것·새로 만든 것·바뀐 것(객체가 달라진 것)을 나눈다. */
function diffById<T extends { id: string }>(prev: readonly T[], next: readonly T[]) {
  const prevById = new Map(prev.map((item) => [item.id, item]));
  const nextIds = new Set(next.map((item) => item.id));
  return {
    removed: prev.filter((item) => !nextIds.has(item.id)),
    added: next.filter((item) => !prevById.has(item.id)),
    changed: next.filter((item) => prevById.has(item.id) && prevById.get(item.id) !== item),
  };
}

/** 참가자 명단이 바뀐 행사 id. 행사별 명단의 항목이나 순서가 달라졌으면 바뀐 것으로 본다. */
function changedAttendeeEvents(
  prev: readonly AttendeeRecord[],
  next: readonly AttendeeRecord[],
): string[] {
  const groupOf = (list: readonly AttendeeRecord[]) => {
    const groups = new Map<string, AttendeeRecord[]>();
    list.forEach((attendee) =>
      groups.set(attendee.eventId, [...(groups.get(attendee.eventId) ?? []), attendee]),
    );
    return groups;
  };
  const before = groupOf(prev);
  const after = groupOf(next);
  return [...new Set([...before.keys(), ...after.keys()])].filter((eventId) => {
    const a = before.get(eventId) ?? [];
    const b = after.get(eventId) ?? [];
    return a.length !== b.length || a.some((attendee, index) => attendee !== b[index]);
  });
}

export function useEventPageData(): EventPageData {
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<EventPageData['status']>('loading');
  const [error, setError] = useState<Error | null>(null);
  const [state, setState] = useState<EventState>(EMPTY);
  const stateRef = useRef<EventState>(EMPTY);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    let isCancelled = false;
    Promise.all([fetchEvents(), fetchEventAttendees()])
      .then(([events, attendees]) => {
        if (isCancelled) return;
        stateRef.current = { events, attendees };
        setState(stateRef.current);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (isCancelled) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setStatus('error');
      });
    return () => {
      isCancelled = true;
    };
  }, [version]);

  /** 저장 요청을 앞 요청 뒤에 이어 보낸다. 실패하면 사유를 알리고 서버 값으로 다시 읽는다. */
  const enqueue = useCallback((requests: (() => Promise<unknown>)[]) => {
    if (requests.length === 0) return;
    queueRef.current = requests
      .reduce((chain, request) => chain.then(request), queueRef.current)
      .catch((cause: unknown) => {
        alertApiError(cause);
        setVersion((value) => value + 1);
      });
  }, []);

  const setters = useMemo(() => {
    /** 화면에 먼저 반영하고, 이전 값과 비교해 만든 요청을 보낸다. */
    function makeSetter<K extends keyof EventState>(
      key: K,
      toRequests: (prev: EventState[K], next: EventState[K]) => (() => Promise<unknown>)[],
    ): Dispatch<SetStateAction<EventState[K]>> {
      return (action) => {
        const prev = stateRef.current[key];
        const next =
          typeof action === 'function'
            ? (action as (value: EventState[K]) => EventState[K])(prev)
            : action;
        if (next === prev) return;
        stateRef.current = { ...stateRef.current, [key]: next };
        setState(stateRef.current);
        enqueue(toRequests(prev, next));
      };
    }

    return {
      setEvents: makeSetter('events', (prev, next) => {
        const { removed, added, changed } = diffById(prev, next);
        return [
          ...removed.map((event) => () => deleteEvent(event.id)),
          ...added.map((event) => () => createEvent(event)),
          ...changed.map((event) => () => updateEvent(event)),
        ];
      }),
      // 지운 행사의 참가자는 행사 삭제와 함께 지워지므로, 남아 있는 행사의 명단만 저장한다.
      setAttendees: makeSetter('attendees', (prev, next) =>
        changedAttendeeEvents(prev, next)
          .filter((eventId) => stateRef.current.events.some((event) => event.id === eventId))
          .map(
            (eventId) => () =>
              saveEventAttendees(
                eventId,
                next.filter((attendee) => attendee.eventId === eventId),
              ),
          ),
      ),
    };
  }, [enqueue]);

  /** 저장 요청이 모두 끝난 뒤 기수 목록을 읽어, 방금 바꾼 명단이 반영되게 한다. */
  const loadEventTerms = useCallback(
    (eventId: string) =>
      queueRef.current.catch(() => undefined).then(() => fetchEventTerms(eventId)),
    [],
  );

  /** 저장 요청이 모두 끝난 뒤 행사를 읽어, 방금 바꾼 컬럼 설정이 반영되게 한다. */
  const loadEvent = useCallback(
    (eventId: string) => queueRef.current.catch(() => undefined).then(() => fetchEvent(eventId)),
    [],
  );

  const patchAttendee = useCallback(
    (attendeeId: string, update: (attendee: AttendeeRecord) => AttendeeRecord) => {
      const current = stateRef.current.attendees;
      const before = current.find((attendee) => attendee.id === attendeeId);
      if (!before) return;
      const after = update(before);
      const patch = attendeePatchOf(before, after);
      if (Object.keys(patch).length === 0) return;
      // 화면에는 바로 반영한다. stateRef도 바꿔 두어 이후 명단 저장(PUT)이 이 변경을 다시 보내지 않게 한다.
      stateRef.current = {
        ...stateRef.current,
        attendees: current.map((attendee) => (attendee.id === attendeeId ? after : attendee)),
      };
      setState(stateRef.current);
      enqueue([() => patchEventAttendee(after.eventId, attendeeId, patch)]);
    },
    [enqueue],
  );

  const createAttendee = useCallback(
    (attendee: AttendeeRecord) => {
      // 화면에는 바로 반영한다. stateRef도 바꿔 두어 이후 명단 저장(PUT)이 이 추가를 다시 보내지 않게 한다.
      stateRef.current = {
        ...stateRef.current,
        attendees: [attendee, ...stateRef.current.attendees],
      };
      setState(stateRef.current);
      enqueue([
        () =>
          createEventAttendee(attendee.eventId, attendee).then((saved) => {
            stateRef.current = {
              ...stateRef.current,
              attendees: stateRef.current.attendees.map((item) =>
                item.id === saved.id ? saved : item,
              ),
            };
            setState(stateRef.current);
          }),
      ]);
    },
    [enqueue],
  );

  return {
    status,
    error,
    ...state,
    ...setters,
    loadEventTerms,
    loadEvent,
    patchAttendee,
    createAttendee,
  };
}
