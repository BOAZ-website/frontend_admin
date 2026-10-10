/**
 * 출석 표의 출결 열. 행사 출결 방식마다 열 구성이 다르다.
 * - 신입 특칙형·세션이 없는 일반 행사: 출결 열 하나(status)
 * - 컨퍼런스: 1차(status)·2차(secondStatus). 외부 참석자 시트는 출석 하나(status)
 * - 여러 행사를 한 표에 관리하는 일반 행사형: 행사(sessionLabels)마다 열 하나(sessionStatuses)
 * - 기타: 백엔드가 보낸 출결 값(statusOptions)이 있으면 그 값으로 열 하나(customStatus), 없으면 출결 열 없음
 * 기타가 아닌 방식의 출결 값은 프론트에 고정되어 있어 statusOptions를 쓰지 않는다.
 * 컬럼 설정에서 출결 열을 지웠으면(hiddenColumns의 STATUS) 방식과 상관없이 출결 열이 없다.
 */
import type {
  AttendanceEvent,
  AttendeeRecord,
  AttendStatus,
  EventStatusOption,
} from '@/entities/event/model/types';
import { withoutKeys } from '@/shared/lib/object';

type EventColumnSource = Pick<
  AttendanceEvent,
  'attendanceFormat' | 'sessionLabels' | 'statusOptions' | 'hiddenColumns'
>;

export type StatusColumn =
  | { kind: 'main'; key: string; label: string }
  | { kind: 'second'; key: string; label: string }
  | { kind: 'session'; key: string; label: string; session: string }
  | { kind: 'custom'; key: string; label: string; options: readonly EventStatusOption[] };

const MAIN_COLUMN: StatusColumn = { kind: 'main', key: 'status', label: '출결' };

/** 행사(시트)의 출결 열. key는 열 너비를 기억하는 키다. */
export function statusColumnsOf(
  event: EventColumnSource,
  isExternalSheet: boolean,
): StatusColumn[] {
  if (event.hiddenColumns?.includes('STATUS')) {
    return [];
  }
  // 기타: 백엔드가 보낸 출결 값이 있을 때만 출결 열을 둔다. 없으면 명단 파일의 열에 글자로 입력한다.
  if (event.attendanceFormat === 'OTHER') {
    const options = event.statusOptions ?? [];
    return options.length > 0 ? [{ kind: 'custom', key: 'status', label: '출결', options }] : [];
  }
  if (event.attendanceFormat === 'CONFERENCE') {
    return isExternalSheet
      ? [{ kind: 'main', key: 'status', label: '출석' }]
      : [
          { kind: 'main', key: 'status', label: '1차 출결' },
          // 컬럼 설정에서 2차 출결만 지울 수 있다.
          ...(event.hiddenColumns?.includes('SECOND_STATUS')
            ? []
            : [{ kind: 'second', key: 'status2', label: '2차 출결' } as const]),
        ];
  }
  const sessions = event.sessionLabels ?? [];
  if (sessions.length > 0) {
    return sessions.map((session) => ({
      kind: 'session',
      key: `session_${session}`,
      label: session,
      session,
    }));
  }
  return [MAIN_COLUMN];
}

/** 한 참가자가 기록하는 출결 열. 컨퍼런스 외부 참석자는 1차·2차를 나누지 않는다. */
export function statusColumnsOfAttendee(
  event: EventColumnSource,
  attendee: Pick<AttendeeRecord, 'isExternal'>,
): StatusColumn[] {
  return statusColumnsOf(event, event.attendanceFormat === 'CONFERENCE' && attendee.isExternal);
}

/**
 * 열의 출결 값. 칸이 없으면(외부 참석자의 2차) undefined, 기록하지 않은 행사는 미정이다.
 * 기타 방식의 출결(custom)은 정해진 출결 값이 아니므로 undefined다(customStatusIn을 쓴다).
 */
export function statusIn(attendee: AttendeeRecord, column: StatusColumn): AttendStatus | undefined {
  switch (column.kind) {
    case 'custom':
      return undefined;
    case 'main':
      return attendee.status;
    case 'second':
      return attendee.secondStatus;
    case 'session':
      return attendee.sessionStatuses?.[column.session] ?? 'unmarked';
  }
}

/** 열의 출결 값을 바꾼 새 참가자. 행사 열에서 미정으로 바꾸면 기록을 지운다. */
export function withStatusIn(
  attendee: AttendeeRecord,
  column: StatusColumn,
  status: AttendStatus,
): AttendeeRecord {
  switch (column.kind) {
    case 'custom':
      return attendee;
    case 'main':
      return { ...attendee, status };
    case 'second':
      return { ...attendee, secondStatus: status };
    case 'session': {
      const rest = withoutKeys(attendee.sessionStatuses ?? {}, column.session);
      return {
        ...attendee,
        sessionStatuses: status === 'unmarked' ? rest : { ...rest, [column.session]: status },
      };
    }
  }
}

/** 참가자가 기록한 모든 출결 값(통계·출결 필터용). */
export function statusesOfAttendee(
  event: EventColumnSource,
  attendee: AttendeeRecord,
): AttendStatus[] {
  return statusColumnsOfAttendee(event, attendee).flatMap((column) => {
    const status = statusIn(attendee, column);
    return status === undefined ? [] : [status];
  });
}

/** 기타 방식 출결 열에서 고른 값(code). 고르지 않았으면 undefined다. */
export function customStatusIn(attendee: AttendeeRecord): string | undefined {
  return attendee.customStatus;
}

/** 기타 방식 출결을 바꾼 새 참가자. 이미 고른 값을 다시 고르면 비운다. */
export function withCustomStatus(attendee: AttendeeRecord, code: string): AttendeeRecord {
  if (attendee.customStatus === code) {
    return withoutKeys(attendee, 'customStatus');
  }
  return { ...attendee, customStatus: code };
}
