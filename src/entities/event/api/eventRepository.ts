/**
 * 행사 출결(행사·참가자·양식 템플릿)을 임시 DB(SQLite)에서 읽고 쓰는 저장소 계층.
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
  EventStatus,
  FormTemplate,
} from '../model/types';

export interface EventDbState {
  events: AttendanceEvent[];
  attendees: AttendeeRecord[];
  templates: FormTemplate[];
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
  target_terms: string;
  target_tracks: string;
  total_target_count: number;
  internal_attended_count: number;
  external_attended_count: number;
  created_at: string;
}

interface TemplateRow extends Record<string, unknown> {
  id: string;
  title: string;
  description: string;
  allow_external: number;
  default_checkin_method: CheckinMethod;
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
  checked_in_at: string;
  memo: string | null;
  custom_answers: string;
  user_name: string | null;
  user_affiliation: string | null;
  user_term: number | null;
  user_email: string | null;
  user_phone: string | null;
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
  const templateFields = groupFields(
    queryAll<FieldRow>(
      db,
      `SELECT template_id AS owner_id, field_id, label, type, options, is_required, target
         FROM event_template_fields ORDER BY template_id, position`,
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
        customFields: eventFields.get(row.id) ?? [],
        targetTerms: parseJson<number[]>(row.target_terms, []),
        targetTracks: parseJson<string[]>(row.target_tracks, []),
        totalTargetCount: row.total_target_count,
        internalAttendedCount: row.internal_attended_count,
        externalAttendedCount: row.external_attended_count,
        createdAt: row.created_at,
      };
      return row.status_column_index === null
        ? event
        : { ...event, statusColumnIndex: row.status_column_index };
    },
  );

  const templates = queryAll<TemplateRow>(
    db,
    'SELECT * FROM event_templates ORDER BY created_at, id',
  ).map((row): FormTemplate => ({
    id: row.id,
    title: row.title,
    description: row.description,
    allowExternal: row.allow_external === 1,
    defaultCheckinMethod: row.default_checkin_method,
    customFields: templateFields.get(row.id) ?? [],
    createdAt: row.created_at,
  }));

  const attendees = queryAll<AttendeeRow>(
    db,
    `SELECT a.*, u.name AS user_name, u.affiliation AS user_affiliation,
            u.term AS user_term, u.email AS user_email, u.phone AS user_phone
       FROM event_attendees a LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.position, a.id`,
  ).map((row): AttendeeRecord => {
    const attendee: AttendeeRecord = {
      id: row.id,
      eventId: row.event_id,
      ...(row.user_id === null ? {} : { userId: row.user_id }),
      isExternal: row.is_external === 1,
      name: row.user_name ?? row.name,
      affiliation: row.user_affiliation ?? row.affiliation,
      email: row.user_email ?? row.email,
      phone: row.user_phone ?? row.phone,
      status: row.status,
      checkedInAt: row.checked_in_at,
      customAnswers: parseJson<Record<string, string>>(row.custom_answers, {}),
    };
    return {
      ...attendee,
      ...(row.user_term === null && row.term === null
        ? {}
        : { term: row.user_term ?? row.term ?? undefined }),
      ...(row.memo === null ? {} : { memo: row.memo }),
    };
  });

  return { events, attendees, templates };
}

// ───────────────────────────── 저장 ─────────────────────────────

const flag = (value: boolean) => (value ? 1 : 0);

function writeFields(
  db: Database,
  table: 'event_fields' | 'event_template_fields',
  ownerColumn: 'event_id' | 'template_id',
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
                               allow_external, checkin_method, checkin_code, status_column_index, target_terms,
                               target_tracks, total_target_count, internal_attended_count,
                               external_attended_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title, status = excluded.status,
             event_date = excluded.event_date, start_time = excluded.start_time,
             end_time = excluded.end_time, location = excluded.location,
             description = excluded.description, allow_external = excluded.allow_external,
             checkin_method = excluded.checkin_method, checkin_code = excluded.checkin_code,
             status_column_index = excluded.status_column_index,
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

export function persistTemplates(
  db: Database,
  prev: readonly FormTemplate[],
  next: readonly FormTemplate[],
): void {
  const prevById = new Map(prev.map((template) => [template.id, template]));
  const nextIds = new Set(next.map((template) => template.id));

  inTransaction(db, () => {
    prev
      .filter((template) => !nextIds.has(template.id))
      .forEach((template) =>
        execute(db, 'DELETE FROM event_templates WHERE id = ?', [template.id]),
      );

    next
      .filter((template) => prevById.get(template.id) !== template)
      .forEach((template) => {
        execute(
          db,
          `INSERT INTO event_templates (id, title, description, allow_external, default_checkin_method, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             title = excluded.title, description = excluded.description,
             allow_external = excluded.allow_external,
             default_checkin_method = excluded.default_checkin_method`,
          [
            template.id,
            template.title,
            template.description,
            flag(template.allowExternal),
            template.defaultCheckinMethod,
            template.createdAt,
          ],
        );
        writeFields(db, 'event_template_fields', 'template_id', template.id, template.customFields);
      });
  });
}

function resolveOrCreateAttendeeUserId(db: Database, attendee: AttendeeRecord): string | null {
  if (attendee.isExternal) return null;
  if (attendee.userId) {
    const existing = queryAll<{ id: string }>(db, 'SELECT id FROM users WHERE id = ?', [
      attendee.userId,
    ]);
    if (existing.length > 0) return attendee.userId;
  }
  if (attendee.term === undefined) return null;
  const matched = queryAll<{ id: string }>(
    db,
    'SELECT id FROM users WHERE name = ? AND term = ? LIMIT 1',
    [attendee.name, attendee.term],
  )[0];
  if (matched) return matched.id;

  const track = attendee.affiliation.includes('시각화')
    ? '시각화'
    : attendee.affiliation.includes('엔지니어링')
      ? '엔지니어링'
      : '분석';
  const id = `u_event_${attendee.id}`;
  execute(
    db,
    `INSERT INTO users (id, name, term, track, affiliation, email, phone)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, attendee.name, attendee.term, track, attendee.affiliation, attendee.email, attendee.phone],
  );
  return id;
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

      const userId = resolveOrCreateAttendeeUserId(db, attendee);

      execute(
        db,
        `INSERT INTO event_attendees (id, event_id, user_id, position, is_external, name, affiliation, term, email,
                                      phone, status, checked_in_at, memo, custom_answers)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id, position = excluded.position,
           is_external = excluded.is_external, name = excluded.name,
           affiliation = excluded.affiliation, term = excluded.term, email = excluded.email,
           phone = excluded.phone, status = excluded.status, checked_in_at = excluded.checked_in_at,
           memo = excluded.memo, custom_answers = excluded.custom_answers`,
        [
          attendee.id,
          attendee.eventId,
          userId,
          position,
          flag(attendee.isExternal),
          attendee.name,
          attendee.affiliation,
          attendee.term ?? null,
          attendee.email,
          attendee.phone,
          attendee.status,
          attendee.checkedInAt,
          attendee.memo ?? null,
          JSON.stringify(attendee.customAnswers ?? {}),
        ],
      );
    });
  });
}
