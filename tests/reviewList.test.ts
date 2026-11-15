import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_REVIEW_QUERY,
  filterReviewList,
  isFilteredReviewQuery,
} from '../src/pages/recruiting-evaluation/model/applicantList';
import {
  aggregateEvaluations,
  orderForViewer,
  summarizeEvaluations,
} from '../src/pages/recruiting-evaluation/model/evaluationStatus';
import {
  applyMyEvaluation,
  INITIAL_DATA,
  listApplicantsMock,
  listEvaluationsMock,
  listInterviewQuestionsMock,
  withRecordAggregates,
} from '../src/pages/recruiting-evaluation/model/evaluationMock';
import { ApiError } from '../src/shared/api/apiError';

const applicants = INITIAL_DATA.applicants;

test('서류 평가 목록은 제출 완료 지원자만 기본 제출일 최신순으로 둔다', () => {
  const rows = filterReviewList(applicants, DEFAULT_REVIEW_QUERY);

  assert.equal(rows.length, applicants.filter((a) => a.status === 'SUBMITTED').length);
  assert.ok(rows.every((row) => row.status === 'SUBMITTED'));
  const dates = rows.map((row) => row.submitted_at ?? '');
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test('최종 판정·내 평가 상태 필터를 함께 걸러낸다', () => {
  for (const finalDecision of ['PASS', 'HOLD', 'FAIL', 'PENDING'] as const) {
    const rows = filterReviewList(applicants, { ...DEFAULT_REVIEW_QUERY, finalDecision });
    assert.ok(rows.every((row) => row.final_decision === finalDecision));
  }
  const unevaluated = filterReviewList(applicants, {
    ...DEFAULT_REVIEW_QUERY,
    myFilter: 'UNEVALUATED',
  });
  assert.ok(unevaluated.every((row) => row.my_decision === null));
});

test('합격 평가 많은순은 합격 수, 같으면 총점이 큰 순이고 총점 높은순은 그 반대 순서로 비교한다', () => {
  const byPass = filterReviewList(applicants, { ...DEFAULT_REVIEW_QUERY, sort: 'PASS_COUNT_DESC' });
  for (let i = 1; i < byPass.length; i++) {
    const [a, b] = [byPass[i - 1], byPass[i]];
    assert.ok(
      a.pass_count > b.pass_count ||
        (a.pass_count === b.pass_count && a.total_score >= b.total_score),
    );
  }
  const byScore = filterReviewList(applicants, {
    ...DEFAULT_REVIEW_QUERY,
    sort: 'TOTAL_SCORE_DESC',
  });
  for (let i = 1; i < byScore.length; i++) {
    const [a, b] = [byScore[i - 1], byScore[i]];
    assert.ok(
      a.total_score > b.total_score ||
        (a.total_score === b.total_score && a.pass_count >= b.pass_count),
    );
  }
});

test('정렬만 바꾸면 필터 초기화 대상이 아니고 최종 판정 필터를 바꾸면 대상이다', () => {
  assert.equal(isFilteredReviewQuery({ ...DEFAULT_REVIEW_QUERY, sort: 'TOTAL_SCORE_DESC' }), false);
  assert.equal(isFilteredReviewQuery({ ...DEFAULT_REVIEW_QUERY, finalDecision: 'HOLD' }), true);
});

test('로그인한 평가자는 id로 찾아 맨 위에 두고 나머지는 원래 순서를 지킨다', () => {
  const rows = [
    { admin_id: 2, name: '강민석' },
    { admin_id: 1, name: '문혁준 (나)' },
    { admin_id: 3, name: '김대현' },
  ];

  const asOne = orderForViewer(rows, 1);
  assert.deepEqual(
    asOne.map((row) => [row.admin_id, row.isMe, row.displayName]),
    [
      [1, true, '문혁준'],
      [2, false, '강민석'],
      [3, false, '김대현'],
    ],
  );
  // 다른 계정으로 보면 그 계정이 맨 위이고, 이름에 '(나)'가 있어도 표시하지 않는다.
  const asThree = orderForViewer(rows, 3);
  assert.deepEqual(
    asThree.map((row) => row.admin_id),
    [3, 2, 1],
  );
  assert.deepEqual(
    asThree.map((row) => row.isMe),
    [true, false, false],
  );
  // 내 행이 없어도 다른 평가자는 그대로 보인다.
  assert.deepEqual(
    orderForViewer(rows, 99).map((row) => row.admin_id),
    [2, 1, 3],
  );
});

test('평가 현황 집계는 판정이 있는 평가를 완료로 세고 평균은 점수가 있는 평가만 쓴다', () => {
  const base = { name: 'x', track: 'ENGINEERING' as const, memo: null };
  assert.deepEqual(
    summarizeEvaluations([
      { ...base, admin_id: 1, decision: 'PASS', score: 8 },
      { ...base, admin_id: 2, decision: 'HOLD', score: null },
      { ...base, admin_id: 3, decision: null, score: null },
      { ...base, admin_id: 4, decision: 'FAIL', score: 5 },
    ]),
    { completed: 3, total: 4, totalScore: 13, averageScore: 6.5 },
  );
  assert.deepEqual(summarizeEvaluations([]), {
    completed: 0,
    total: 0,
    totalScore: 0,
    averageScore: null,
  });
});

test('평가자별 평가·면접 질문 조회는 없는 지원서를 404로, 시나리오 실패를 네트워크 오류로 거절한다', () => {
  const id = applicants[0].id;
  assert.ok(listEvaluationsMock(INITIAL_DATA, id, null).length > 0);
  assert.ok(Array.isArray(listInterviewQuestionsMock(INITIAL_DATA, id, null)));

  for (const read of [listEvaluationsMock, listInterviewQuestionsMock]) {
    assert.throws(
      () => read(INITIAL_DATA, -1, null),
      (error) => error instanceof ApiError && error.code === 'APPLICATION_NOT_FOUND',
    );
  }
  assert.throws(
    () => listEvaluationsMock(INITIAL_DATA, id, 'evaluations-error'),
    (error) => error instanceof ApiError && error.status === 0,
  );
  assert.throws(
    () => listInterviewQuestionsMock(INITIAL_DATA, id, 'questions-error'),
    (error) => error instanceof ApiError && error.status === 0,
  );
});

test('평가가 하나도 없는 지원서는 평가자 전원을 미평가로 돌려준다', () => {
  const noEval = applicants.find((a) => !(a.id in INITIAL_DATA.evaluatorsMap));
  if (!noEval) return;
  const rows = listEvaluationsMock(INITIAL_DATA, noEval.id, null);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.decision === null && row.score === null && row.memo === null));
});

/** 목록 행의 집계가 평가 현황 기록으로 계산한 값과 같은지 지원자마다 확인한다. */
function assertListMatchesRecords(data: typeof INITIAL_DATA) {
  for (const row of listApplicantsMock(data, null)) {
    const records = listEvaluationsMock(data, row.id, null);
    const { pass_count, hold_count, fail_count, total_score } = row;
    assert.deepEqual(
      { pass_count, hold_count, fail_count, total_score },
      aggregateEvaluations(records),
      `지원자 ${row.id}`,
    );
    assert.equal(total_score, summarizeEvaluations(records).totalScore, `지원자 ${row.id} 총점`);
  }
}

test('집계는 판정별 평가자 수와 점수 합계이고 null 점수는 더하지 않는다', () => {
  const base = { name: 'x', track: 'ENGINEERING' as const, memo: null };
  assert.deepEqual(
    aggregateEvaluations([
      { ...base, admin_id: 1, decision: 'PASS', score: 9 },
      { ...base, admin_id: 2, decision: 'PASS', score: null },
      { ...base, admin_id: 3, decision: 'HOLD', score: 6 },
      { ...base, admin_id: 4, decision: 'PENDING', score: 4 },
      { ...base, admin_id: 5, decision: null, score: null },
    ]),
    { pass_count: 2, hold_count: 1, fail_count: 0, total_score: 19 },
  );
});

test('목록 집계는 지원자마다 평가 현황 기록으로 계산한 값과 같다', () => {
  assertListMatchesRecords(withRecordAggregates(INITIAL_DATA));
});

test('평가 기록이 없는 지원자는 0건·0점이고 기록이나 점수를 새로 만들지 않는다', () => {
  const data = withRecordAggregates(INITIAL_DATA);
  for (const id of [102, 103, 105]) {
    const row = data.applicants.find((a) => a.id === id);
    assert.ok(row);
    assert.deepEqual(
      [row.pass_count, row.hold_count, row.fail_count, row.total_score],
      [0, 0, 0, 0],
    );
  }
  assert.deepEqual(Object.keys(data.evaluatorsMap), Object.keys(INITIAL_DATA.evaluatorsMap));
  assert.equal(data.evaluatorsMap, INITIAL_DATA.evaluatorsMap);
});

test('개인 평가를 저장한 뒤에도 목록 집계와 평가 현황 기록이 같다', () => {
  let data = withRecordAggregates(INITIAL_DATA);
  for (const [id, score] of [
    [105, 9],
    [101, null],
  ] as const) {
    const applicant = data.applicants.find((a) => a.id === id);
    assert.ok(applicant);
    data = applyMyEvaluation(data, applicant, {
      decision: 'PASS',
      score,
      memo: '',
      interview_question: '',
    }).data;
  }
  assertListMatchesRecords(data);
});
