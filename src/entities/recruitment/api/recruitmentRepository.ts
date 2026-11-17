/**
 * 임시 DB의 리크루팅 테이블(recruitment·application_question·applicant·applicant_answer·subscription)을
 * 읽고 쓰는 함수. 임시 API(shared/api/mock/routes/recruitmentRoutes.ts)만 부른다.
 */
import type { Database } from 'sql.js';

import { execute, queryAll } from '@/shared/db/createDatabase';

import type {
  Question,
  QuestionCategory,
  QuestionMetadata,
  QuestionType,
  Recruitment,
  Subscription,
} from '../model/types';

/** 저장하는 모집 공고 값. is_active는 저장하지 않고 읽을 때 계산한다. */
export interface RecruitmentValues {
  term: number;
  start_date: string;
  end_date: string;
  schedule: unknown[];
  brochure_url: string | null;
}

/** 저장하는 문항 값. TEXT는 limit_length, TABLE은 metadata만 채운다. */
export interface QuestionValues {
  label: string;
  category: QuestionCategory;
  type: QuestionType;
  content: string;
  description: string | null;
  limit_length: number | null;
  metadata: QuestionMetadata | null;
  order_num: number;
  is_required: boolean;
}

interface RecruitmentRow extends Record<string, unknown> {
  id: number;
  term: number;
  start_date: string;
  end_date: string;
  schedule: string;
  brochure_url: string | null;
}

interface QuestionRow extends Record<string, unknown> {
  id: number;
  recruitment_id: number;
  label: string;
  category: QuestionCategory;
  type: QuestionType;
  content: string;
  description: string | null;
  limit_length: number | null;
  metadata: string | null;
  order_num: number;
  is_required: number;
}

const lastInsertId = (db: Database): number =>
  queryAll<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')[0].id;

const exists = (db: Database, sql: string, params: (string | number)[]): boolean =>
  queryAll(db, `SELECT 1 AS found WHERE EXISTS (${sql})`, params).length > 0;

const isStringArray = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/** 표 형식 문항의 정의로 쓸 수 있는 값인지 본다. 없는 키는 통과한다. */
export function isQuestionMetadata(value: unknown): value is QuestionMetadata {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const optional = (key: string, check: (item: unknown) => boolean) =>
    !(key in value) || check(Reflect.get(value, key));
  return (
    optional('multiple', (item) => typeof item === 'boolean') &&
    optional('columns', isStringArray) &&
    optional('rows', isStringArray)
  );
}

// ── 모집 공고 ───────────────────────────────────────────────────────

function recruitmentValuesOf(row: RecruitmentRow): RecruitmentValues {
  const schedule: unknown = JSON.parse(row.schedule);
  return {
    term: row.term,
    start_date: row.start_date,
    end_date: row.end_date,
    schedule: Array.isArray(schedule) ? schedule : [],
    brochure_url: row.brochure_url,
  };
}

/**
 * 모집 공고 목록. 기수가 큰 순서다.
 * now('YYYY-MM-DDTHH:mm:ss')가 접수 기간 안이면 is_active가 true다. 홍보 책자 주소가 없으면 키를 뺀다.
 */
export function listRecruitments(db: Database, now: string): Recruitment[] {
  return queryAll<RecruitmentRow>(db, 'SELECT * FROM recruitment ORDER BY term DESC').map((row) => {
    const { brochure_url, ...values } = recruitmentValuesOf(row);
    return {
      recruitment_id: row.id,
      ...values,
      ...(brochure_url === null ? {} : { brochure_url }),
      is_active: row.start_date <= now && now <= row.end_date,
    };
  });
}

export function findRecruitmentValues(db: Database, id: number): RecruitmentValues | undefined {
  const row = queryAll<RecruitmentRow>(db, 'SELECT * FROM recruitment WHERE id = ?', [id])[0];
  return row && recruitmentValuesOf(row);
}

/** 같은 기수의 공고가 이미 있는지. exceptId는 수정 중인 공고 자신을 뺀다. */
export function isTermTaken(db: Database, term: number, exceptId = 0): boolean {
  return exists(db, 'SELECT 1 FROM recruitment WHERE term = ? AND id <> ?', [term, exceptId]);
}

export function insertRecruitment(db: Database, values: RecruitmentValues): number {
  execute(
    db,
    `INSERT INTO recruitment (term, start_date, end_date, schedule, brochure_url)
     VALUES (?, ?, ?, ?, ?)`,
    [
      values.term,
      values.start_date,
      values.end_date,
      JSON.stringify(values.schedule),
      values.brochure_url,
    ],
  );
  return lastInsertId(db);
}

export function updateRecruitment(db: Database, id: number, values: RecruitmentValues): void {
  execute(
    db,
    `UPDATE recruitment
        SET term = ?, start_date = ?, end_date = ?, schedule = ?, brochure_url = ?
      WHERE id = ?`,
    [
      values.term,
      values.start_date,
      values.end_date,
      JSON.stringify(values.schedule),
      values.brochure_url,
      id,
    ],
  );
}

export function deleteRecruitment(db: Database, id: number): void {
  execute(db, 'DELETE FROM recruitment WHERE id = ?', [id]);
}

/** 이 공고에 문항이나 지원자가 있는지. 있으면 공고를 지울 수 없다. */
export function hasRecruitmentReferences(db: Database, id: number): boolean {
  return (
    exists(db, 'SELECT 1 FROM application_question WHERE recruitment_id = ?', [id]) ||
    exists(db, 'SELECT 1 FROM applicant WHERE recruitment_id = ?', [id])
  );
}

// ── 지원서 문항 ─────────────────────────────────────────────────────

function questionValuesOf(row: QuestionRow): QuestionValues {
  const metadata: unknown = row.metadata === null ? null : JSON.parse(row.metadata);
  return {
    label: row.label,
    category: row.category,
    type: row.type,
    content: row.content,
    description: row.description,
    limit_length: row.limit_length,
    metadata: isQuestionMetadata(metadata) ? metadata : null,
    order_num: row.order_num,
    is_required: row.is_required === 1,
  };
}

/** 응답 모양으로 바꾼다. 설명이 없으면 키를 빼고, 유형에 맞는 값(limit_length 또는 metadata)만 넣는다. */
function toQuestion(id: number, values: QuestionValues): Question {
  const base = {
    question_id: id,
    label: values.label,
    category: values.category,
    content: values.content,
    ...(values.description === null ? {} : { description: values.description }),
    order_num: values.order_num,
    is_required: values.is_required,
  };
  return values.type === 'TEXT'
    ? { ...base, type: 'TEXT', limit_length: values.limit_length ?? 0 }
    : { ...base, type: 'TABLE', metadata: values.metadata ?? {} };
}

/** 한 공고의 문항 전체. 순서 번호 순이고, 번호가 같으면 등록 순이다. */
export function listQuestions(db: Database, recruitmentId: number): Question[] {
  return queryAll<QuestionRow>(
    db,
    'SELECT * FROM application_question WHERE recruitment_id = ? ORDER BY order_num, id',
    [recruitmentId],
  ).map((row) => toQuestion(row.id, questionValuesOf(row)));
}

export function findQuestion(
  db: Database,
  id: number,
): { recruitmentId: number; values: QuestionValues } | undefined {
  const row = queryAll<QuestionRow>(db, 'SELECT * FROM application_question WHERE id = ?', [id])[0];
  return row && { recruitmentId: row.recruitment_id, values: questionValuesOf(row) };
}

/** 같은 공고에 같은 라벨의 문항이 있는지. exceptId는 수정 중인 문항 자신을 뺀다. */
export function isQuestionLabelTaken(
  db: Database,
  recruitmentId: number,
  label: string,
  exceptId = 0,
): boolean {
  return exists(
    db,
    'SELECT 1 FROM application_question WHERE recruitment_id = ? AND label = ? AND id <> ?',
    [recruitmentId, label, exceptId],
  );
}

/** 같은 공고·같은 분류에 같은 순서 번호의 문항이 있는지. exceptId는 수정 중인 문항 자신을 뺀다. */
export function isQuestionOrderTaken(
  db: Database,
  recruitmentId: number,
  category: QuestionCategory,
  orderNum: number,
  exceptId = 0,
): boolean {
  return exists(
    db,
    `SELECT 1 FROM application_question
      WHERE recruitment_id = ? AND category = ? AND order_num = ? AND id <> ?`,
    [recruitmentId, category, orderNum, exceptId],
  );
}

const questionParams = (values: QuestionValues): (string | number | null)[] => [
  values.label,
  values.category,
  values.type,
  values.content,
  values.description,
  values.limit_length,
  values.metadata === null ? null : JSON.stringify(values.metadata),
  values.order_num,
  values.is_required ? 1 : 0,
];

export function insertQuestion(
  db: Database,
  recruitmentId: number,
  values: QuestionValues,
): number {
  execute(
    db,
    `INSERT INTO application_question
       (label, category, type, content, description, limit_length, metadata, order_num, is_required,
        recruitment_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [...questionParams(values), recruitmentId],
  );
  return lastInsertId(db);
}

export function updateQuestion(db: Database, id: number, values: QuestionValues): void {
  execute(
    db,
    `UPDATE application_question
        SET label = ?, category = ?, type = ?, content = ?, description = ?, limit_length = ?,
            metadata = ?, order_num = ?, is_required = ?
      WHERE id = ?`,
    [...questionParams(values), id],
  );
}

export function deleteQuestion(db: Database, id: number): void {
  execute(db, 'DELETE FROM application_question WHERE id = ?', [id]);
}

/** 이 문항에 지원자의 답변이 있는지. 있으면 문항을 지울 수 없다. */
export function hasQuestionAnswers(db: Database, id: number): boolean {
  return exists(db, 'SELECT 1 FROM applicant_answer WHERE question_id = ?', [id]);
}

// ── 사전 알림 신청 ──────────────────────────────────────────────────

/** 사전 알림 신청 명단. 최근 신청 순이다. */
export function listSubscriptions(db: Database): Subscription[] {
  return queryAll<Subscription & Record<string, unknown>>(
    db,
    'SELECT id, email, created_at FROM subscription ORDER BY created_at DESC, id DESC',
  );
}

export function deleteAllSubscriptions(db: Database): void {
  execute(db, 'DELETE FROM subscription');
}
