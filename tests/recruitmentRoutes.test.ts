import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { Question, Recruitment, Subscription } from '../src/entities/recruitment/model/types';
import { ApiError } from '../src/shared/api/apiError';
import { MOCK_ROUTES } from '../src/shared/api/mock/mockRoutes';
import { createRouter } from '../src/shared/api/mock/router';
import { createDatabase } from '../src/shared/db/createDatabase';

// 리크루팅 관리 API. 경로·응답·오류 코드는 백엔드 RecruitmentAdminController와 RecruitmentService를 따른다.

const read = (file: string) => readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
const schema = `${read('schema.sql')}\n${read('event-schema.sql')}`;
const seed = `${read('seed.sql')}\n${read('event-seed.sql')}`;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// 시드: 공고 1번(28기, 문항 6개·지원자 있음), 2번(27기, 문항·지원자 없음).
// 문항 1~3·5·6번은 답변이 있고 4번(분석2)은 답변이 없다.
const BASE = '/api/v1/admin/recruitment';
const MASTER_ID = 1;
const HOST_ID = 101;
const TERM_28 = 1;
const TERM_27 = 2;
const QUESTION_WITH_ANSWER = 1;
const QUESTION_WITHOUT_ANSWER = 4;

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(MOCK_ROUTES);
  const call = <T>(method: Method, path: string, body?: unknown) =>
    router.dispatch(db, method, path, body) as T;
  const actAs = (accountId: number) => call('PUT', '/api/v1/mock/admin-session', { accountId });
  actAs(MASTER_ID);
  const recruitments = () => call<Recruitment[]>('GET', BASE);
  const questions = (recruitmentId: number) =>
    call<Question[]>('GET', `${BASE}/${recruitmentId}/questions`);
  return { call, actAs, recruitments, questions };
}

function expectApiError(work: () => unknown, status: number, code: string) {
  assert.throws(
    work,
    (error: unknown) => error instanceof ApiError && error.status === status && error.code === code,
  );
}

const newRecruitment = {
  term: 29,
  start_date: '2027-01-04T00:00:00',
  end_date: '2027-01-27T23:59:59',
  schedule: [{ step: '서류 접수', startDate: '2027-01-04', endDate: '2027-01-27' }],
};

const textQuestion = {
  label: '공통3',
  category: 'COMMON',
  type: 'TEXT',
  content: '가장 몰입했던 경험을 적어 주세요.',
  limit_length: 500,
  order_num: 3,
  is_required: true,
};

// ── 모집 공고 ───────────────────────────────────────────────────────

test('공고 목록은 기수가 큰 순서이고, 접수 기간이 지난 공고는 is_active가 false다', async () => {
  const { recruitments } = await setup();

  const list = recruitments();

  assert.deepEqual(
    list.map((item) => item.term),
    [28, 27],
  );
  assert.equal(list[0].recruitment_id, TERM_28);
  assert.equal(list[0].is_active, false);
  assert.equal(list[0].start_date, '2026-08-01T00:00:00');
  assert.equal(Array.isArray(list[0].schedule), true);
});

test('공고를 등록하면 새 ID를 돌려주고 목록에 보인다. 홍보 책자 주소가 없으면 키가 빠진다', async () => {
  const { call, recruitments } = await setup();

  const created = call<{ recruitment_id: number }>('POST', BASE, newRecruitment);

  const found = recruitments().find((item) => item.recruitment_id === created.recruitment_id);
  assert.equal(found?.term, 29);
  assert.deepEqual(found?.schedule, newRecruitment.schedule);
  assert.equal(found && 'brochure_url' in found, false);
});

test('접수 기간 안에 있는 공고는 is_active가 true다', async () => {
  const { call, recruitments } = await setup();

  call('POST', BASE, {
    ...newRecruitment,
    start_date: '2000-01-01T00:00:00',
    end_date: '2999-12-31T23:59:59',
  });

  assert.equal(recruitments()[0].is_active, true);
});

test('이미 있는 기수로 공고를 등록하거나 수정하면 409 DUPLICATE_TERM이다', async () => {
  const { call } = await setup();

  expectApiError(() => call('POST', BASE, { ...newRecruitment, term: 28 }), 409, 'DUPLICATE_TERM');
  expectApiError(() => call('PATCH', `${BASE}/${TERM_27}`, { term: 28 }), 409, 'DUPLICATE_TERM');
});

test('마감 일시가 시작 일시보다 늦지 않으면 400 INVALID_INPUT_VALUE다', async () => {
  const { call } = await setup();

  expectApiError(
    () => call('POST', BASE, { ...newRecruitment, end_date: newRecruitment.start_date }),
    400,
    'INVALID_INPUT_VALUE',
  );
  expectApiError(
    () => call('PATCH', `${BASE}/${TERM_27}`, { end_date: '2025-01-01T00:00:00' }),
    400,
    'INVALID_INPUT_VALUE',
  );
});

test('달력에 없는 날짜나 범위를 벗어난 시각은 400 INVALID_INPUT_VALUE다', async () => {
  const { call } = await setup();

  const invalid = [
    { start_date: '2026-02-30T00:00:00' },
    { end_date: '2027-13-01T23:59:59' },
    { end_date: '2027-01-27T24:00:00' },
    { end_date: '2027-01-27T23:60:00' },
    { end_date: '2027-01-27T23:59:60' },
  ];
  for (const override of invalid) {
    expectApiError(
      () => call('POST', BASE, { ...newRecruitment, ...override }),
      400,
      'INVALID_INPUT_VALUE',
    );
  }
  expectApiError(
    () => call('PATCH', `${BASE}/${TERM_27}`, { end_date: '2026-02-31T23:59:59' }),
    400,
    'INVALID_INPUT_VALUE',
  );
  call('POST', BASE, {
    ...newRecruitment,
    term: 30,
    start_date: '2028-02-29T00:00:00',
    end_date: '2028-03-10T23:59:59',
  });
});

test('공고 수정은 보낸 값만 바꾸고, 홍보 책자 주소는 null을 보내면 지운다', async () => {
  const { call, recruitments } = await setup();
  const before = recruitments().find((item) => item.recruitment_id === TERM_27);

  call('PATCH', `${BASE}/${TERM_27}`, { end_date: '2026-01-30T23:59:59', brochure_url: null });

  const after = recruitments().find((item) => item.recruitment_id === TERM_27);
  assert.equal(after?.end_date, '2026-01-30T23:59:59');
  assert.equal(after?.start_date, before?.start_date);
  assert.equal(after?.term, 27);
  assert.equal(after && 'brochure_url' in after, false);
});

test('문항이나 지원자가 있는 공고는 삭제가 400 RECRUITMENT_HAS_REFERENCES로 막히고, 없으면 지워진다', async () => {
  const { call, recruitments } = await setup();

  expectApiError(() => call('DELETE', `${BASE}/${TERM_28}`), 400, 'RECRUITMENT_HAS_REFERENCES');
  call('DELETE', `${BASE}/${TERM_27}`);

  assert.deepEqual(
    recruitments().map((item) => item.term),
    [28],
  );
});

test('없는 공고를 고치거나 지우거나 문항을 읽으면 404 RECRUITMENT_NOT_FOUND다', async () => {
  const { call } = await setup();

  expectApiError(() => call('PATCH', `${BASE}/999`, { term: 30 }), 404, 'RECRUITMENT_NOT_FOUND');
  expectApiError(() => call('DELETE', `${BASE}/999`), 404, 'RECRUITMENT_NOT_FOUND');
  expectApiError(() => call('GET', `${BASE}/999/questions`), 404, 'RECRUITMENT_NOT_FOUND');
});

test('공고 관리 권한이 없는 계정은 403이다', async () => {
  const { call, actAs } = await setup();
  actAs(HOST_ID);

  expectApiError(() => call('GET', BASE), 403, 'FORBIDDEN');
  expectApiError(() => call('POST', BASE, newRecruitment), 403, 'FORBIDDEN');
});

// ── 지원서 문항 ─────────────────────────────────────────────────────

test('문항 목록은 순서 번호 순이고, TEXT 문항은 limit_length만, TABLE 문항은 metadata만 준다', async () => {
  const { questions } = await setup();

  const list = questions(TERM_28);

  assert.equal(list.length, 6);
  assert.deepEqual(
    list.map((item) => item.order_num),
    [...list.map((item) => item.order_num)].sort((a, b) => a - b),
  );
  const text = list.find((item) => item.label === '공통1');
  const table = list.find((item) => item.label === '분석1');
  assert.equal(text?.type === 'TEXT' && text.limit_length, 800);
  assert.equal(text && 'metadata' in text, false);
  assert.equal(table?.type === 'TABLE' && table.metadata.multiple, true);
  assert.equal(table && 'limit_length' in table, false);
});

test('문항을 여러 개 등록하면 ID 목록을 돌려주고 목록에 보인다', async () => {
  const { call, questions } = await setup();

  const created = call<{ ids: number[] }>('POST', `${BASE}/questions`, {
    recruitment_id: TERM_27,
    questions: [
      textQuestion,
      {
        label: '분석1',
        category: 'ANALYSIS',
        type: 'TABLE',
        content: '다뤄 본 도구를 적어 주세요.',
        metadata: { multiple: true, columns: ['도구', '숙련도'], rows: ['1', '2'] },
        order_num: 1,
        is_required: false,
      },
    ],
  });

  assert.equal(created.ids.length, 2);
  assert.deepEqual(
    questions(TERM_27).map((item) => item.label),
    ['분석1', '공통3'],
  );
});

test('같은 공고에 같은 라벨이나 같은 분류·순서 번호가 있으면 409이고, 함께 보낸 문항도 등록되지 않는다', async () => {
  const { call, questions } = await setup();

  expectApiError(
    () =>
      call('POST', `${BASE}/questions`, {
        recruitment_id: TERM_28,
        questions: [textQuestion, { ...textQuestion, label: '공통1', order_num: 4 }],
      }),
    409,
    'DUPLICATE_QUESTION_LABEL',
  );
  expectApiError(
    () =>
      call('POST', `${BASE}/questions`, {
        recruitment_id: TERM_28,
        questions: [{ ...textQuestion, order_num: 1 }],
      }),
    409,
    'DUPLICATE_QUESTION_ORDER',
  );
  assert.equal(questions(TERM_28).length, 6);
});

test('TEXT 문항에 글자 수 제한이 없거나 TABLE 문항에 metadata가 없으면 400 MISSING_PARAMETER다', async () => {
  const { call } = await setup();
  const post = (question: Record<string, unknown>) => () =>
    call('POST', `${BASE}/questions`, { recruitment_id: TERM_27, questions: [question] });

  expectApiError(post({ ...textQuestion, limit_length: undefined }), 400, 'MISSING_PARAMETER');
  expectApiError(post({ ...textQuestion, type: 'TABLE' }), 400, 'MISSING_PARAMETER');
  expectApiError(
    post({ ...textQuestion, type: 'TABLE', metadata: { multiple: 'yes' } }),
    400,
    'INVALID_INPUT_VALUE',
  );
});

test('문항 수정은 보낸 값만 바꾸고, 유형을 TABLE로 바꾸면 글자 수 제한이 지워진다', async () => {
  const { call, questions } = await setup();
  const find = () =>
    questions(TERM_28).find((item) => item.question_id === QUESTION_WITHOUT_ANSWER);

  call('PATCH', `${BASE}/questions/${QUESTION_WITHOUT_ANSWER}`, { content: '바꾼 질문' });
  assert.equal(find()?.content, '바꾼 질문');
  assert.equal(find()?.label, '분석2');

  call('PATCH', `${BASE}/questions/${QUESTION_WITHOUT_ANSWER}`, {
    type: 'TABLE',
    metadata: { columns: ['항목'], rows: ['1'] },
  });
  const changed = find();
  assert.equal(changed?.type, 'TABLE');
  assert.equal(changed && 'limit_length' in changed, false);
});

test('문항 수정에서 다른 문항과 라벨이나 순서 번호가 겹치면 409다', async () => {
  const { call } = await setup();
  const path = `${BASE}/questions/${QUESTION_WITHOUT_ANSWER}`;

  expectApiError(() => call('PATCH', path, { label: '분석1' }), 409, 'DUPLICATE_QUESTION_LABEL');
  expectApiError(() => call('PATCH', path, { order_num: 1 }), 409, 'DUPLICATE_QUESTION_ORDER');
  // 자기 자신과 같은 값은 겹침이 아니다.
  call('PATCH', path, { label: '분석2', order_num: 2 });
});

test('답변이 있는 문항은 삭제가 400 QUESTION_HAS_ANSWERS로 막히고, 없으면 지워진다', async () => {
  const { call, questions } = await setup();

  expectApiError(
    () => call('DELETE', `${BASE}/questions/${QUESTION_WITH_ANSWER}`),
    400,
    'QUESTION_HAS_ANSWERS',
  );
  call('DELETE', `${BASE}/questions/${QUESTION_WITHOUT_ANSWER}`);

  assert.equal(questions(TERM_28).length, 5);
  expectApiError(() => call('DELETE', `${BASE}/questions/999`), 404, 'QUESTIONS_NOT_FOUND');
});

// ── 사전 알림 명단 ──────────────────────────────────────────────────

test('사전 알림 명단은 최근 신청 순으로 이메일과 신청 시각을 주고, 전체 삭제하면 비워진다', async () => {
  const { call } = await setup();

  const list = call<Subscription[]>('GET', `${BASE}/subscriptions`);
  assert.equal(list.length, 5);
  assert.deepEqual(Object.keys(list[0]).sort(), ['created_at', 'email', 'id']);
  assert.equal(list[0].created_at > list[1].created_at, true);

  call('DELETE', `${BASE}/subscriptions`);

  assert.deepEqual(call<Subscription[]>('GET', `${BASE}/subscriptions`), []);
});
