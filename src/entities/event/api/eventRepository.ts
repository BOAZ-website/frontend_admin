/**
 * 행사 출결(행사·참가자)을 임시 DB(SQLite)에서 읽고 쓰는 저장소 계층.
 * 화면은 DB를 직접 다루지 않고 이 함수들로만 조회·저장한다. 백엔드가 붙으면 이 파일만 API 호출로 바꾸면 된다.
 */
import type { Database } from 'sql.js';

import { execute, inTransaction, queryAll } from '@/shared/db/createDatabase';

import type {
  AttendanceEvent,
  AttendeeRecord,
  AttendStatus,
  CheckinMethod,
  CustomFormField,
  EventAttendanceFormat,
  EventBaseColumn,
  EventStatus,
  EventStatusOption,
} from '../model/types';
import { withMemberIdentity } from '../model/memberIdentity';

export interface EventDbState {
  events: AttendanceEvent[];
  attendees: AttendeeRecord[];
}

interface FieldRow extends Record<string, unknown> {
  owner_id: string;
  field_id: string;
  label: string;
  type: CustomFormField['type'];
  options: string | null;
  is_required: number;
  target: CustomFormField['target'];
}

interface EventRow extends Record<string, unknown> {
  id: string;
  title: string;
  status: EventStatus;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  description: string;
  allow_external: number;
  checkin_method: CheckinMethod;
  checkin_code: string;
  status_column_index: number | null;
  attendance_format: EventAttendanceFormat;
  session_labels: string;
  status_options: string;
  hidden_columns: string;
  target_terms: string;
  target_tracks: string;
  total_target_count: number;
  internal_attended_count: number;
  external_attended_count: number;
  created_at: string;
}

interface AttendeeRow extends Record<string, unknown> {
  id: string;
  event_id: string;
  user_id: string | null;
  is_external: number;
  name: string;
  affiliation: string;
  term: number | null;
  email: string;
  phone: string;
  status: AttendStatus;
  second_status: AttendStatus | null;
  session_statuses: string;
  custom_status: string | null;
  checked_in_at: string;
  memo: string | null;
  custom_answers: string;
}

// ───────────────────────────── 조회 ─────────────────────────────

function parseJson<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

function toField(row: FieldRow): CustomFormField {
  const field: CustomFormField = {
    id: row.field_id,
    label: row.label,
    type: row.type,
    isRequired: row.is_required === 1,
    target: row.target,
  };
  const options = parseJson<string[] | null>(row.options, null);
  return options ? { ...field, options } : field;
}

function groupFields(rows: readonly FieldRow[]): Map<string, CustomFormField[]> {
  const grouped = new Map<string, CustomFormField[]>();
  rows.forEach((row) => {
    const list = grouped.get(row.owner_id) ?? [];
    list.push(toField(row));
    grouped.set(row.owner_id, list);
  });
  return grouped;
}

export function loadEventState(db: Database): EventDbState {
  const eventFields = groupFields(
    queryAll<FieldRow>(
      db,
      `SELECT event_id AS owner_id, field_id, label, type, options, is_required, target
         FROM event_fields ORDER BY event_id, position`,
    ),
  );

  const events = queryAll<EventRow>(db, 'SELECT * FROM events ORDER BY created_at, id').map(
    (row): AttendanceEvent => {
      const event: AttendanceEvent = {
        id: row.id,
        title: row.title,
        status: row.status,
        date: row.event_date,
        startTime: row.start_time,
        endTime: row.end_time,
        location: row.location,
        description: row.description,
        allowExternal: row.allow_external === 1,
        checkinMethod: row.checkin_method,
        checkinCode: row.checkin_code,
        attendanceFormat: row.attendance_format,
        customFields: eventFields.get(row.id) ?? [],
        targetTerms: parseJson<number[]>(row.target_terms, []),
        targetTracks: parseJson<string[]>(row.target_tracks, []),
        totalTargetCount: row.total_target_count,
        internalAttendedCount: row.internal_attended_count,
        externalAttendedCount: row.external_attended_count,
        createdAt: row.created_at,
      };
      const sessionLabels = parseJson<string[]>(row.session_labels, []);
      const statusOptions = parseJson<EventStatusOption[]>(row.status_options, []);
      const hiddenColumns = parseJson<EventBaseColumn[]>(row.hidden_columns, []);
      return {
        ...event,
        ...(row.status_column_index === null ? {} : { statusColumnIndex: row.status_column_index }),
        ...(sessionLabels.length === 0 ? {} : { sessionLabels }),
        ...(statusOptions.length === 0 ? {} : { statusOptions }),
        ...(hiddenColumns.length === 0 ? {} : { hiddenColumns }),
      };
    },
  );

  const attendees = queryAll<AttendeeRow>(
    db,
    // 행사 DB만 읽는다(유저 DB와 조인하지 않는다). 회원의 이름·기수·부문은 저장할 때 유저 DB 값으로 맞춰 둔다.
    'SELECT * FROM event_attendees ORDER BY position, id',
  ).map((row): AttendeeRecord => {
    const attendee: AttendeeRecord = {
      id: row.id,
      eventId: row.event_id,
      ...(row.user_id === null ? {} : { userId: row.user_id }),
      isExternal: row.is_external === 1,
      name: row.name,
      affiliation: row.affiliation,
      email: row.email,
      phone: row.phone,
      status: row.status,
      checkedInAt: row.checked_in_at,
      customAnswers: parseJson<Record<string, string>>(row.custom_answers, {}),
    };
    return {
      ...attendee,
      ...(row.term === null ? {} : { term: row.term }),
      ...(row.second_status === null ? {} : { secondStatus: row.second_status }),
      ...(row.session_statuses === '{}'
        ? {}
        : { sessionStatuses: parseJson<Record<string, AttendStatus>>(row.session_statuses, {}) }),
      ...(row.custom_status === null ? {} : { customStatus: row.custom_status }),
      ...(row.memo === null ? {} : { memo: row.memo }),
    };
  });

  return { events, attendees };
}

// ───────────────────────────── 저장 ─────────────────────────────

const flag = (value: boolean) => (value ? 1 : 0);

function writeFields(
  db: Database,
  table: 'event_fields',
  ownerColumn: 'event_id',
  ownerId: string,
  fields: readonly CustomFormField[],
): void {
  execute(db, `DELETE FROM ${table} WHERE ${ownerColumn} = ?`, [ownerId]);
  fields.forEach((field, position) =>
    execute(
      db,
      `INSERT INTO ${table} (${ownerColumn}, position, field_id, label, type, options, is_required, target)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ownerId,
        position,
        field.id,
        field.label,
        field.type,
        field.options ? JSON.stringify(field.options) : null,
        flag(field.isRequired),
        field.target,
      ],
    ),
  );
}

export function persistEvents(
  db: Database,
  prev: readonly AttendanceEvent[],
  next: readonly AttendanceEvent[],
): void {
  const prevById = new Map(prev.map((event) => [event.id, event]));
  const nextIds = new Set(next.map((event) => event.id));

  inTransaction(db, () => {
    // 행사를 지우면 그 행사의 추가 컬럼과 참가자도 함께 지워진다(ON DELETE CASCADE).
    prev
      .filter((event) => !nextIds.has(event.id))
      .forEach((event) => execute(db, 'DELETE FROM events WHERE id = ?', [event.id]));

    next
      .filter((event) => prevById.get(event.id) !== event)
      .forEach((event) => {
        execute(
          db,
          `INSERT INTO events (id, title, status, event_date, start_time, end_time, location, description,
                               allow_external, checkin_method, checkin_code, status_column_index,
                               attendance_format, session_labels, status_options, hidden_columns,
                               target_terms, target_tracks, total_target_count,
                               internal_attended_count, external_attended_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title, status = excluded.status,
             event_date = excluded.event_date, start_time = excluded.start_time,
             end_time = excluded.end_time, location = excluded.location,
             description = excluded.description, allow_external = excluded.allow_external,
             checkin_method = excluded.checkin_method, checkin_code = excluded.checkin_code,
             status_column_index = excluded.status_column_index,
             attendance_format = excluded.attendance_format,
             session_labels = excluded.session_labels,
             status_options = excluded.status_options,
             hidden_columns = excluded.hidden_columns,
             target_terms = excluded.target_terms, target_tracks = excluded.target_tracks,
             total_target_count = excluded.total_target_count,
             internal_attended_count = excluded.internal_attended_count,
             external_attended_count = excluded.external_attended_count`,
          [
            event.id,
            event.title,
            event.status,
            event.date,
            event.startTime,
            event.endTime,
            event.location,
            event.description,
            flag(event.allowExternal),
            event.checkinMethod,
            event.checkinCode,
            event.statusColumnIndex ?? null,
            event.attendanceFormat ?? 'GENERAL',
            JSON.stringify(event.sessionLabels ?? []),
            JSON.stringify(event.statusOptions ?? []),
            JSON.stringify(event.hiddenColumns ?? []),
            JSON.stringify(event.targetTerms),
            JSON.stringify(event.targetTracks),
            event.totalTargetCount,
            event.internalAttendedCount,
            event.externalAttendedCount,
            event.createdAt,
          ],
        );
        writeFields(db, 'event_fields', 'event_id', event.id, event.customFields);
      });
  });
}

/**
 * 저장할 참가자의 회원 연결. 명단을 올릴 때 회원 API로 확인해 연결한 회원(userId)만 인정한다.
 * 외부 참가자, 연결이 없는 참가자, 회원 DB에 없는 userId는 연결하지 않는다.
 * 행사 명단으로 회원을 새로 만들거나 이름으로 짐작해 연결하지 않는다.
 */
function resolveAttendeeUserId(db: Database, attendee: AttendeeRecord): string | null {
  if (attendee.isExternal || !attendee.userId) return null;
  const existing = queryAll<{ id: string }>(db, 'SELECT id FROM users WHERE id = ?', [
    attendee.userId,
  ]);
  return existing.length > 0 ? attendee.userId : null;
}

/**
 * 동아리 회원의 이름·기수·부문은 행사 출결에서 바꿀 수 없다.
 * 화면이 다른 값을 보내도 유저 DB(users) 값으로 덮어써 행사 DB에 저장한다.
 * (행사 DB와 유저 DB는 따로이며, 여기서 users를 읽는 것은 유저 DB 조회를 대신한다.)
 */
function lockMemberIdentity(
  db: Database,
  attendee: AttendeeRecord,
  userId: string,
): AttendeeRecord {
  const member = queryAll<{ name: string; term: number; track: string | null }>(
    db,
    'SELECT name, term, track FROM users WHERE id = ?',
    [userId],
  )[0];
  return member ? withMemberIdentity({ ...attendee, userId }, member) : attendee;
}

/**
 * 참가자를 저장한다. 명단 순서(position)가 바뀌면(예: 앞에 새로 추가) 순서가 달라진 행도 다시 쓴다.
 * 행사가 아직 저장되지 않은 참가자는 건너뛴다(행사가 먼저 저장돼야 한다).
 */
export function persistAttendees(
  db: Database,
  prev: readonly AttendeeRecord[],
  next: readonly AttendeeRecord[],
): void {
  const prevById = new Map(prev.map((attendee) => [attendee.id, attendee]));
  const prevIndex = new Map(prev.map((attendee, index) => [attendee.id, index]));
  const nextIds = new Set(next.map((attendee) => attendee.id));

  inTransaction(db, () => {
    prev
      .filter((attendee) => !nextIds.has(attendee.id))
      .forEach((attendee) =>
        execute(db, 'DELETE FROM event_attendees WHERE id = ?', [attendee.id]),
      );

    next.forEach((attendee, position) => {
      const unchanged =
        prevById.get(attendee.id) === attendee && prevIndex.get(attendee.id) === position;
      if (unchanged) return;
      const eventExists =
        queryAll<{ id: string }>(db, 'SELECT id FROM events WHERE id = ?', [attendee.eventId])
          .length > 0;
      if (!eventExists) return;

      const userId = resolveAttendeeUserId(db, attendee);
      const record = userId === null ? attendee : lockMemberIdentity(db, attendee, userId);

      execute(
        db,
        `INSERT INTO event_attendees (id, event_id, user_id, position, is_external, name, affiliation, term, email,
                                      phone, status, second_status, session_statuses, custom_status,
                                      checked_in_at, memo, custom_answers)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id, position = excluded.position,
           is_external = excluded.is_external, name = excluded.name,
           affiliation = excluded.affiliation, term = excluded.term, email = excluded.email,
           phone = excluded.phone, status = excluded.status, second_status = excluded.second_status,
           session_statuses = excluded.session_statuses, custom_status = excluded.custom_status,
           checked_in_at = excluded.checked_in_at,
           memo = excluded.memo, custom_answers = excluded.custom_answers`,
        [
          record.id,
          record.eventId,
          userId,
          position,
          flag(record.isExternal),
          record.name,
          record.affiliation,
          record.term ?? null,
          record.email,
          record.phone,
          record.status,
          record.secondStatus ?? null,
          JSON.stringify(record.sessionStatuses ?? {}),
          record.customStatus ?? null,
          record.checkedInAt,
          record.memo ?? null,
          JSON.stringify(record.customAnswers ?? {}),
        ],
      );
    });
  });
}
