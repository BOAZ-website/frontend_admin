/**
 * 출석 표의 기본 열(출결·2차 출결·비고)을 지우고 되살리는 규칙. 이름 열은 참가자를 가리키는 열이라 지우지 않는다.
 * 지운 기본 열은 행사의 hiddenColumns에 적고, 같은 이름으로 컬럼을 추가하면 되살아난다.
 * 일반 행사형의 행사별 출결 열(sessionLabels)은 하나씩 지운다. 마지막 하나를 지우면 출결 열 전체를 지운 것과 같다.
 * 컬럼을 지우면 그 열에 입력한 값도 저장할 때 함께 지운다(되살려도 빈 열로 나온다).
 */
import type {
  AttendanceEvent,
  AttendeeRecord,
  EventBaseColumn,
} from '@/entities/event/model/types';

import type { StatusColumn } from './statusColumns';
import { withoutKeys } from '@/shared/lib/object';

/** 이 이름으로 컬럼을 추가하면 출결 열(컨퍼런스는 1차·2차 모두)이 되살아난다. */
const STATUS_COLUMN_NAMES: readonly string[] = [
  '출결',
  '출석',
  '출석 상태',
  '출석상태',
  '1차 출결',
];
const SECOND_STATUS_COLUMN_NAME = '2차 출결';
const MEMO_COLUMN_NAME = '비고';

/** 지울 수 없는 열 이름(추가 컬럼 이름으로도 쓸 수 없다). */
export const NAME_COLUMN_NAME = '이름';

/** 컬럼 이름이 기본 열 이름이면 그 기본 열. */
export function baseColumnOfName(name: string): EventBaseColumn | undefined {
  if (STATUS_COLUMN_NAMES.includes(name)) return 'STATUS';
  if (name === SECOND_STATUS_COLUMN_NAME) return 'SECOND_STATUS';
  if (name === MEMO_COLUMN_NAME) return 'MEMO';
  return undefined;
}

/** 이름·출결·비고처럼 추가 컬럼 이름으로 쓸 수 없는 이름인지. */
export function isReservedColumnName(name: string): boolean {
  return name === NAME_COLUMN_NAME || baseColumnOfName(name) !== undefined;
}

export function isBaseColumnHidden(
  event: Pick<AttendanceEvent, 'hiddenColumns'>,
  column: EventBaseColumn,
): boolean {
  return event.hiddenColumns?.includes(column) ?? false;
}

/**
 * 기본 열을 지우거나 되살린 행사.
 * 출결 열을 지우면 일반 행사형의 행사별 열(sessionLabels)도 함께 지워져, 되살리면 출결 열 하나로 나온다.
 * 출결 열을 되살리면 컨퍼런스의 2차 출결도 함께 되살아난다.
 */
export function withBaseColumnHidden<E extends AttendanceEvent>(
  event: E,
  column: EventBaseColumn,
  isHidden: boolean,
): E {
  const touched: readonly EventBaseColumn[] =
    column === 'STATUS' && !isHidden ? ['STATUS', 'SECOND_STATUS'] : [column];
  const rest = (event.hiddenColumns ?? []).filter((item) => !touched.includes(item));
  const next: E = { ...event, hiddenColumns: isHidden ? [...rest, column] : rest };
  if (column === 'STATUS' && isHidden) {
    return withoutKeys(next, 'sessionLabels') as E;
  }
  return next;
}

/** 지우기 확인창에 덧붙이는 설명. 함께 지워지는 열이 있으면 알린다. */
export function statusColumnRemovalNote(column: StatusColumn): string {
  return column.kind === 'main' && column.key === 'status' && column.label === '1차 출결'
    ? '\n1차 출결을 지우면 2차 출결도 함께 지워집니다.'
    : '';
}

/** 출결 열 하나를 지운 행사. 1차(또는 하나뿐인 출결)를 지우면 출결 열 전체가 지워진다. */
export function withStatusColumnRemoved<E extends AttendanceEvent>(
  event: E,
  column: StatusColumn,
): E {
  if (column.kind === 'second') {
    return withBaseColumnHidden(event, 'SECOND_STATUS', true);
  }
  if (column.kind === 'session') {
    const sessions = (event.sessionLabels ?? []).filter((session) => session !== column.session);
    return sessions.length > 0
      ? { ...event, sessionLabels: sessions }
      : withBaseColumnHidden(event, 'STATUS', true);
  }
  return withBaseColumnHidden(event, 'STATUS', true);
}

/** 컬럼 설정을 저장할 때, 지운 열에 입력해 둔 참가자 값을 비운 새 참가자. 지운 열이 없으면 그대로 돌려준다. */
export function withRemovedColumnValuesCleared(
  before: AttendanceEvent,
  after: AttendanceEvent,
  attendee: AttendeeRecord,
): AttendeeRecord {
  const keptFieldIds = new Set((after.customFields ?? []).map((field) => field.id));
  const removedFields = (before.customFields ?? []).filter((field) => !keptFieldIds.has(field.id));
  const wasRemoved = (column: EventBaseColumn) =>
    !isBaseColumnHidden(before, column) && isBaseColumnHidden(after, column);
  const isStatusRemoved = wasRemoved('STATUS');
  const isSecondRemoved = isStatusRemoved || wasRemoved('SECOND_STATUS');
  const isMemoRemoved = wasRemoved('MEMO');
  const keptSessions = new Set(after.sessionLabels ?? []);
  const removedSessions = (before.sessionLabels ?? []).filter(
    (session) => !keptSessions.has(session),
  );
  if (
    removedFields.length === 0 &&
    removedSessions.length === 0 &&
    !isStatusRemoved &&
    !isSecondRemoved &&
    !isMemoRemoved
  ) {
    return attendee;
  }

  const removedKeys = new Set(removedFields.flatMap((field) => [field.id, field.label]));
  let next: AttendeeRecord = {
    ...attendee,
    customAnswers: Object.fromEntries(
      Object.entries(attendee.customAnswers ?? {}).filter(([key]) => !removedKeys.has(key)),
    ),
  };
  if (removedSessions.length > 0 && attendee.sessionStatuses) {
    next = {
      ...next,
      sessionStatuses: Object.fromEntries(
        Object.entries(attendee.sessionStatuses).filter(
          ([session]) => !removedSessions.includes(session),
        ),
      ),
    };
  }
  if (isStatusRemoved) {
    next = {
      ...withoutKeys(next, 'sessionStatuses', 'customStatus'),
      status: 'unmarked',
      checkedInAt: '-',
    };
  }
  if (isSecondRemoved && attendee.secondStatus !== undefined) {
    next = { ...next, secondStatus: 'unmarked' };
  }
  if (isMemoRemoved) {
    next = { ...next, memo: '' };
  }
  return next;
}
