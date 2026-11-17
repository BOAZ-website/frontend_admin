/**
 * 리크루팅 관리(모집 공고·지원서 문항·사전 알림 명단) API.
 * 경로·응답 키(snake_case)·오류 코드는 백엔드 RecruitmentAdminController와 RecruitmentService를 따른다.
 *   · 공고 상태(예정·진행·마감)는 값으로 저장하지 않는다. is_active만 접수 기간으로 계산해 준다.
 *   · 문항 유형 검사는 백엔드보다 엄격하다. 백엔드는 유형을 바꿀 때만 보지만, 여기서는 저장할 때마다
 *     TEXT에 글자 수 제한이, TABLE에 표 정의가 있는지 본다(없는 채로 저장되면 백엔드 조회가 실패한다).
 *   · 사전 알림 명단은 전체 삭제만 있다(한 명만 지우는 API가 백엔드에 없다).
 * 지원서 CSV 추출과 지원서 전체 삭제는 아직 두지 않았다.
 */
import type { Database } from 'sql.js';

import {
  deleteAllSubscriptions,
  deleteQuestion,
  deleteRecruitment,
  findQuestion,
  findRecruitmentValues,
  hasQuestionAnswers,
  hasRecruitmentReferences,
  insertQuestion,
  insertRecruitment,
  isQuestionLabelTaken,
  isQuestionMetadata,
  isQuestionOrderTaken,
  isTermTaken,
  listQuestions,
  listRecruitments,
  listSubscriptions,
  updateQuestion,
  updateRecruitment,
  type QuestionValues,
  type RecruitmentValues,
} from '@/entities/recruitment/api/recruitmentRepository';
import type {
  QuestionIdResponse,
  QuestionIdsResponse,
  RecruitmentIdResponse,
} from '@/entities/recruitment/model/dto';
import {
  QUESTION_CATEGORIES,
  QUESTION_TYPES,
  type Question,
  type QuestionMetadata,
  type Recruitment,
  type Subscription,
} from '@/entities/recruitment/model/types';

import { isValidIsoDate } from '@/shared/lib/date';

import { ApiError, type MockRoute } from '../router';
import { parsePositiveInt, readBody, type Body } from '../validate';
import { requireAny } from './adminAccountRoutes';

const BASE = '/api/v1/admin/recruitment';
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
/** 백엔드 application_question.label 열 길이. */
const LABEL_MAX_LENGTH = 20;

// 오류 코드와 문구는 백엔드 ErrorCode와 같다.
const invalidInput = (message = '입력값이 올바르지 않습니다.') =>
  new ApiError(400, 'INVALID_INPUT_VALUE', message);
const missingParameter = () =>
  new ApiError(400, 'MISSING_PARAMETER', '요청 파라미터가 누락되었습니다.');
const recruitmentNotFound = () =>
  new ApiError(404, 'RECRUITMENT_NOT_FOUND', '해당 모집 공고를 찾을 수 없습니다.');
const questionNotFound = () => new ApiError(404, 'QUESTIONS_NOT_FOUND', '등록된 질문이 없습니다.');

/** 지금 시각 'YYYY-MM-DDTHH:mm:ss'(이 컴퓨터 시각). 접수 기간과 문자열로 비교한다. */
function now(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** 경로의 id. 숫자가 아니면 400이고, 0은 어떤 행과도 맞지 않아 404로 이어진다. */
const idOf = (value: string | undefined, key: string): number => parsePositiveInt(value, key) ?? 0;

// ── 값 읽기: 형식이 틀리면 400 INVALID_INPUT_VALUE ──────────────────

function positiveInt(value: unknown, key: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw invalidInput(`${key} 값은 양의 정수여야 합니다.`);
  }
  return value;
}

function text(value: unknown, key: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw invalidInput(`${key} 값이 필요합니다.`);
  }
  return value.trim();
}

function dateTime(value: unknown, key: string): string {
  if (
    typeof value !== 'string' ||
    !DATE_TIME_PATTERN.test(value) ||
    !isValidIsoDate(value.slice(0, 10))
  ) {
    throw invalidInput(`${key} 값은 실제로 있는 일시를 YYYY-MM-DDTHH:mm:ss 형식으로 써야 합니다.`);
  }
  return value;
}

function schedule(value: unknown, key: string): unknown[] {
  if (!Array.isArray(value)) throw invalidInput(`${key} 값은 배열이어야 합니다.`);
  return value;
}

function flag(value: unknown, key: string): boolean {
  if (typeof value !== 'boolean') throw invalidInput(`${key} 값은 true 또는 false여야 합니다.`);
  return value;
}

function label(value: unknown, key: string): string {
  const result = text(value, key);
  if (result.length > LABEL_MAX_LENGTH) {
    throw invalidInput(`${key} 값은 ${LABEL_MAX_LENGTH}자까지 쓸 수 있습니다.`);
  }
  return result;
}

function metadata(value: unknown, key: string): QuestionMetadata {
  if (!isQuestionMetadata(value)) throw invalidInput(`${key} 값의 형식이 올바르지 않습니다.`);
  return value;
}

const oneOf =
  <T extends string>(allowed: readonly T[]) =>
  (value: unknown, key: string): T => {
    const found = allowed.find((item) => item === value);
    if (!found) throw invalidInput(`${key} 값은 ${allowed.join(', ')} 중 하나여야 합니다.`);
    return found;
  };

type Parse<T> = (value: unknown, key: string) => T;

/**
 * 요청 본문에서 값을 읽는 함수 묶음. current는 수정할 때의 지금 값이다(등록이면 없다).
 *   · required: 보낸 값이 없으면 지금 값을 쓰고, 지금 값도 없으면(등록) 400이다.
 *   · nullable: 키가 없으면 지금 값을 두고, null을 보내면 지운다.
 */
function reader(input: Body) {
  const sent = (key: string) => input[key] !== undefined && input[key] !== null;
  return {
    required<T>(key: string, parse: Parse<T>, current: T | undefined): T {
      if (sent(key)) return parse(input[key], key);
      if (current === undefined) throw invalidInput(`${key} 값이 필요합니다.`);
      return current;
    },
    nullable<T>(key: string, parse: Parse<T>, current: T | null | undefined): T | null {
      if (!(key in input)) return current ?? null;
      return sent(key) ? parse(input[key], key) : null;
    },
  };
}

// ── 모집 공고 ───────────────────────────────────────────────────────

/** 저장할 공고 값을 만들고 기수 중복과 접수 기간을 검사한다. exceptId는 수정 중인 공고 자신이다. */
function recruitmentValues(
  db: Database,
  body: unknown,
  current?: RecruitmentValues,
  exceptId?: number,
): RecruitmentValues {
  const { required, nullable } = reader(readBody(body));
  const values: RecruitmentValues = {
    term: required('term', positiveInt, current?.term),
    start_date: required('start_date', dateTime, current?.start_date),
    end_date: required('end_date', dateTime, current?.end_date),
    schedule: required('schedule', schedule, current?.schedule),
    brochure_url: nullable('brochure_url', text, current?.brochure_url),
  };
  if (isTermTaken(db, values.term, exceptId)) {
    throw new ApiError(409, 'DUPLICATE_TERM', '이미 존재하는 기수입니다.');
  }
  if (values.end_date <= values.start_date) {
    throw invalidInput('접수 마감 일시는 시작 일시보다 늦어야 합니다.');
  }
  return values;
}

// ── 지원서 문항 ─────────────────────────────────────────────────────

/** 저장할 문항 값을 만든다. 유형에 맞지 않는 값(TEXT의 표 정의, TABLE의 글자 수 제한)은 비운다. */
function questionValues(item: unknown, current?: QuestionValues): QuestionValues {
  const { required, nullable } = reader(readBody(item));
  const type = required('type', oneOf(QUESTION_TYPES), current?.type);
  const values: QuestionValues = {
    label: required('label', label, current?.label),
    category: required('category', oneOf(QUESTION_CATEGORIES), current?.category),
    type,
    content: required('content', text, current?.content),
    description: nullable('description', text, current?.description),
    limit_length:
      type === 'TEXT' ? nullable('limit_length', positiveInt, current?.limit_length) : null,
    metadata: type === 'TABLE' ? nullable('metadata', metadata, current?.metadata) : null,
    order_num: required('order_num', positiveInt, current?.order_num),
    is_required: required('is_required', flag, current?.is_required),
  };
  if (type === 'TEXT' ? values.limit_length === null : values.metadata === null) {
    throw missingParameter();
  }
  return values;
}

/** 같은 공고 안에서 라벨과 (분류, 순서 번호)가 겹치지 않는지 본다. exceptId는 수정 중인 문항 자신이다. */
function requireUniqueQuestion(
  db: Database,
  recruitmentId: number,
  values: QuestionValues,
  exceptId?: number,
): void {
  if (isQuestionLabelTaken(db, recruitmentId, values.label, exceptId)) {
    throw new ApiError(409, 'DUPLICATE_QUESTION_LABEL', '이미 존재하는 질문 label입니다.');
  }
  if (isQuestionOrderTaken(db, recruitmentId, values.category, values.order_num, exceptId)) {
    throw new ApiError(409, 'DUPLICATE_QUESTION_ORDER', '이미 사용 중인 순서 번호입니다.');
  }
}

// 등록 순서에 뜻이 있다. '/subscriptions'와 '/questions'가 '/:id'보다 앞에 있어야
// DELETE /subscriptions가 공고 삭제(DELETE /:id)로 가지 않는다(라우터는 먼저 맞는 경로를 쓴다).
export const recruitmentRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/subscriptions`,
    summary: '사전 알림 신청 명단(이메일·신청 시각). 최근 신청 순',
    handler: ({ db }): Subscription[] => {
      requireAny(db, 'PRE_NOTIFICATION_READ');
      return listSubscriptions(db);
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/subscriptions`,
    summary: '사전 알림 신청 명단 전체 삭제',
    handler: ({ db }): void => {
      requireAny(db, 'PRE_NOTIFICATION_DELETE');
      deleteAllSubscriptions(db);
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/questions`,
    summary:
      '문항 여러 개 등록 { recruitment_id, questions[] }. 하나라도 거절되면 모두 등록되지 않는다. 없는 공고 404, 라벨·순서 번호 중복 409, 유형에 맞는 값 없음 400',
    handler: ({ db, body }): QuestionIdsResponse => {
      requireAny(db, 'RECRUITMENT_NOTICE_WRITE');
      const input = readBody(body);
      const recruitmentId = positiveInt(input.recruitment_id, 'recruitment_id');
      if (!findRecruitmentValues(db, recruitmentId)) throw recruitmentNotFound();
      if (!Array.isArray(input.questions) || input.questions.length === 0) {
        throw invalidInput('questions 값은 비어 있을 수 없습니다.');
      }
      const items = input.questions.map((item: unknown) => questionValues(item));
      // 앞에서 넣은 문항과도 겹치는지 보도록 하나씩 검사하고 넣는다. 실패하면 라우터가 모두 되돌린다.
      const ids = items.map((values) => {
        requireUniqueQuestion(db, recruitmentId, values);
        return insertQuestion(db, recruitmentId, values);
      });
      return { ids };
    },
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/questions/:questionId`,
    summary:
      '문항 수정. 보낸 값만 바뀌고 description·limit_length·metadata는 null로 지운다. 없는 문항 404, 라벨·순서 번호 중복 409',
    handler: ({ db, params, body }): QuestionIdResponse => {
      requireAny(db, 'RECRUITMENT_NOTICE_WRITE');
      const questionId = idOf(params.questionId, 'questionId');
      const current = findQuestion(db, questionId);
      if (!current) throw questionNotFound();
      const values = questionValues(body, current.values);
      requireUniqueQuestion(db, current.recruitmentId, values, questionId);
      updateQuestion(db, questionId, values);
      return { question_id: questionId };
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/questions/:questionId`,
    summary: '문항 삭제. 없는 문항 404, 답변이 있는 문항 400',
    handler: ({ db, params }): void => {
      requireAny(db, 'RECRUITMENT_NOTICE_WRITE');
      const questionId = idOf(params.questionId, 'questionId');
      if (!findQuestion(db, questionId)) throw questionNotFound();
      if (hasQuestionAnswers(db, questionId)) {
        throw new ApiError(
          400,
          'QUESTION_HAS_ANSWERS',
          '연관된 답변 데이터가 존재하여 삭제할 수 없습니다.',
        );
      }
      deleteQuestion(db, questionId);
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/:recruitmentId/questions`,
    summary: '한 공고의 문항 전체. 순서 번호 순. 없는 공고 404',
    handler: ({ db, params }): Question[] => {
      requireAny(db, 'RECRUITMENT_NOTICE_READ');
      const recruitmentId = idOf(params.recruitmentId, 'recruitmentId');
      if (!findRecruitmentValues(db, recruitmentId)) throw recruitmentNotFound();
      return listQuestions(db, recruitmentId);
    },
  },
  {
    method: 'GET',
    pattern: BASE,
    summary: '모집 공고 목록. 기수가 큰 순서. is_active는 지금이 접수 기간 안인지다',
    handler: ({ db }): Recruitment[] => {
      requireAny(db, 'RECRUITMENT_NOTICE_READ');
      return listRecruitments(db, now());
    },
  },
  {
    method: 'POST',
    pattern: BASE,
    summary:
      '모집 공고 등록 { term, start_date, end_date, schedule[], brochure_url? }. 기수 중복 409, 마감이 시작보다 늦지 않으면 400',
    handler: ({ db, body }): RecruitmentIdResponse => {
      requireAny(db, 'RECRUITMENT_NOTICE_WRITE');
      return { recruitment_id: insertRecruitment(db, recruitmentValues(db, body)) };
    },
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/:id`,
    summary:
      '모집 공고 수정. 보낸 값만 바뀌고 brochure_url은 null로 지운다. 없는 공고 404, 기수 중복 409',
    handler: ({ db, params, body }): RecruitmentIdResponse => {
      requireAny(db, 'RECRUITMENT_NOTICE_WRITE');
      const id = idOf(params.id, 'id');
      const current = findRecruitmentValues(db, id);
      if (!current) throw recruitmentNotFound();
      updateRecruitment(db, id, recruitmentValues(db, body, current, id));
      return { recruitment_id: id };
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/:id`,
    summary: '모집 공고 삭제. 없는 공고 404, 문항이나 지원자가 있는 공고 400',
    handler: ({ db, params }): void => {
      requireAny(db, 'RECRUITMENT_NOTICE_WRITE');
      const id = idOf(params.id, 'id');
      if (!findRecruitmentValues(db, id)) throw recruitmentNotFound();
      if (hasRecruitmentReferences(db, id)) {
        throw new ApiError(
          400,
          'RECRUITMENT_HAS_REFERENCES',
          '연관된 데이터가 존재하여 삭제할 수 없습니다.',
        );
      }
      deleteRecruitment(db, id);
    },
  },
];
