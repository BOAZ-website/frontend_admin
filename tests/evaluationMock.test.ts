import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyFinalDecision,
  applyMyEvaluation,
  checkMyEvaluationSaveMock,
  CURRENT_EVALUATOR,
  findMyEvaluationMock,
  INITIAL_DATA,
  listAnswersMock,
  listApplicantsMock,
  promoteUsersMock,
  readMockScenario,
} from '../src/pages/recruiting-evaluation/model/evaluationMock';
import { ApiError } from '../src/shared/api/apiError';

const applicantOf = (id: number) => {
  const applicant = INITIAL_DATA.applicants.find((a) => a.id === id);
  assert.ok(applicant, `목 데이터에 지원자 ${id}가 있어야 한다`);
  return applicant;
};

const INPUT = {
  decision: 'FAIL',
  score: 3,
  memo: '근거 부족',
  interview_question: '프로젝트에서 맡은 역할은?',
} as const;

test('개인 평가를 저장하면 내 평가와 평가자별 결과·집계·면접 질문이 함께 바뀐다', () => {
  const before = applicantOf(102);

  const { data, applicant } = applyMyEvaluation(INITIAL_DATA, before, INPUT);

  assert.equal(applicant.my_decision, 'FAIL');
  assert.equal(applicant.my_score, 3);
  const evaluators = data.evaluatorsMap[102];
  const mine = evaluators.find((e) => e.admin_id === CURRENT_EVALUATOR.admin_id);
  assert.deepEqual([mine?.decision, mine?.score, mine?.memo], ['FAIL', 3, '근거 부족']);
  assert.equal(applicant.fail_count, evaluators.filter((e) => e.decision === 'FAIL').length);
  assert.equal(
    applicant.total_score,
    evaluators.reduce((sum, e) => sum + (e.score ?? 0), 0),
  );
  const question = data.interviewQuestionsMap[102].find(
    (q) => q.admin_id === CURRENT_EVALUATOR.admin_id,
  );
  assert.equal(question?.interview_question, '프로젝트에서 맡은 역할은?');
  assert.deepEqual(
    data.applicants.find((a) => a.id === 102),
    applicant,
  );
});

test('개인 평가 저장은 원래 목 데이터와 다른 지원자를 바꾸지 않는다', () => {
  const snapshot = structuredClone(INITIAL_DATA);

  const { data } = applyMyEvaluation(INITIAL_DATA, applicantOf(101), INPUT);

  assert.deepEqual(INITIAL_DATA, snapshot);
  assert.deepEqual(
    data.applicants.filter((a) => a.id !== 101),
    snapshot.applicants.filter((a) => a.id !== 101),
  );
});

test('최종 판정을 바꾸면 그 지원자의 최종 판정만 바뀌고 개인 평가 집계는 그대로다', () => {
  const before = applicantOf(102);

  const data = applyFinalDecision(INITIAL_DATA, 102, 'HOLD');

  const after = data.applicants.find((a) => a.id === 102);
  assert.equal(after?.final_decision, 'HOLD');
  assert.deepEqual({ ...after, final_decision: before.final_decision }, before);
});

test('최종 판정을 바꾼 뒤 옛 지원자 정보로 개인 평가를 저장해도 최종 판정은 그대로다', () => {
  const stale = applicantOf(102);
  const decided = applyFinalDecision(INITIAL_DATA, 102, 'HOLD');

  const { data, applicant } = applyMyEvaluation(decided, stale, INPUT);

  assert.equal(applicant.final_decision, 'HOLD');
  assert.equal(data.applicants.find((a) => a.id === 102)?.final_decision, 'HOLD');
  assert.equal(applicant.my_decision, 'FAIL');
});

test('부원 등록은 합격자만 등록하고, 이미 회원·미합격·지원서 없음은 실패 목록에 담는다', () => {
  const passed = applicantOf(101); // 최종 합격
  const pending = applicantOf(102); // 미결

  const first = promoteUsersMock(
    INITIAL_DATA,
    { user_ids: [passed.user_id, pending.user_id, 9999] },
    null,
  );

  assert.deepEqual(first.response.failed_user_ids, [
    { user_id: pending.user_id, error_code: 'APPLICANT_NOT_PASSED' },
    { user_id: 9999, error_code: 'APPLICATION_NOT_FOUND' },
  ]);
  assert.deepEqual(
    first.data.applicants.filter((a) => a.is_promoted_to_member).map((a) => a.user_id),
    [passed.user_id],
  );
  // 지원서는 지우지 않는다.
  assert.equal(first.data.applicants.length, INITIAL_DATA.applicants.length);

  const again = promoteUsersMock(first.data, { user_ids: [passed.user_id] }, null);
  assert.deepEqual(again.response.failed_user_ids, [
    { user_id: passed.user_id, error_code: 'ALREADY_MEMBER' },
  ]);
});

test('부원 등록 시나리오는 서버 오류와 부분 실패를 재현한다', () => {
  const ids = [applicantOf(101).user_id, applicantOf(104).user_id];
  assert.throws(
    () => promoteUsersMock(INITIAL_DATA, { user_ids: ids }, 'promote-error'),
    (error) => error instanceof ApiError && error.status === 500,
  );
  const partial = promoteUsersMock(INITIAL_DATA, { user_ids: ids }, 'promote-partial');
  assert.deepEqual(partial.response.failed_user_ids, [
    { user_id: ids[0], error_code: 'USER_NOT_FOUND' },
  ]);
  assert.deepEqual(
    partial.data.applicants.filter((a) => a.is_promoted_to_member).map((a) => a.user_id),
    [ids[1]],
  );
});

test('주소의 mockScenario 값은 정해진 시나리오만 읽는다', () => {
  assert.equal(readMockScenario('?mockScenario=applicants-error'), 'applicants-error');
  assert.equal(readMockScenario('?mockScenario=unknown'), null);
  assert.equal(readMockScenario(''), null);
});

test('목록 조회 시나리오는 실패·빈 목록·정상 목록을 구분해 돌려준다', () => {
  assert.throws(
    () => listApplicantsMock(INITIAL_DATA, 'applicants-error'),
    (error) => error instanceof ApiError && error.code === 'NETWORK_ERROR',
  );
  assert.deepEqual(listApplicantsMock(INITIAL_DATA, 'applicants-empty'), []);
  assert.equal(listApplicantsMock(INITIAL_DATA, null).length, INITIAL_DATA.applicants.length);
});

test('답변 조회는 없는 지원서를 404 APPLICATION_NOT_FOUND로 거절한다', () => {
  const id = INITIAL_DATA.applicants[0].id;

  const response = listAnswersMock(INITIAL_DATA, id, null);
  assert.equal(response.status, 200);
  assert.equal(response.data.applicant_id, id);
  assert.throws(
    () => listAnswersMock(INITIAL_DATA, 999999, null),
    (error) => error instanceof ApiError && error.status === 404,
  );
  assert.throws(
    () => listAnswersMock(INITIAL_DATA, id, 'answers-not-found'),
    (error) => error instanceof ApiError && error.code === 'APPLICATION_NOT_FOUND',
  );
  assert.throws(
    () => listAnswersMock(INITIAL_DATA, id, 'answers-error'),
    (error) => error instanceof ApiError && error.code === 'NETWORK_ERROR',
  );
});

test('내 평가 조회는 평가하지 않은 지원자에 null을, 평가한 지원자에 저장 값을 돌려준다', () => {
  const unevaluated = INITIAL_DATA.applicants.find((a) => a.my_decision === null);
  const evaluated = INITIAL_DATA.applicants.find((a) => a.my_decision !== null);
  assert.ok(unevaluated && evaluated);

  assert.equal(findMyEvaluationMock(INITIAL_DATA, unevaluated.id, null), null);
  const mine = findMyEvaluationMock(INITIAL_DATA, evaluated.id, null);
  assert.deepEqual(
    [mine?.decision, mine?.score, mine?.memo],
    [evaluated.my_decision, evaluated.my_score, evaluated.my_memo],
  );
  assert.throws(
    () => findMyEvaluationMock(INITIAL_DATA, evaluated.id, 'my-evaluation-error'),
    (error) => error instanceof ApiError && error.code === 'NETWORK_ERROR',
  );
});

test('점수를 비워 저장하면 내 점수는 null이고 총점은 점수가 있는 평가만 더한다', () => {
  const { data, applicant } = applyMyEvaluation(INITIAL_DATA, applicantOf(102), {
    ...INPUT,
    score: null,
  });

  assert.equal(applicant.my_score, null);
  const evaluators = data.evaluatorsMap[102];
  const mine = evaluators.find((e) => e.admin_id === CURRENT_EVALUATOR.admin_id);
  assert.equal(mine?.score, null);
  assert.equal(
    applicant.total_score,
    evaluators.reduce((sum, e) => sum + (e.score ?? 0), 0),
  );
});

test('저장 검사는 정상 입력을 통과시키고 DRAFT·점수 범위 위반·시나리오 실패를 거절한다', () => {
  const submitted = INITIAL_DATA.applicants.find((a) => a.status === 'SUBMITTED');
  const draft = INITIAL_DATA.applicants.find((a) => a.status === 'DRAFT');
  assert.ok(submitted && draft);
  const code = (expected: string) => (error: unknown) =>
    error instanceof ApiError && error.code === expected;

  assert.doesNotThrow(() => checkMyEvaluationSaveMock(INITIAL_DATA, submitted.id, INPUT, null));
  assert.doesNotThrow(() =>
    checkMyEvaluationSaveMock(INITIAL_DATA, submitted.id, { ...INPUT, score: null }, null),
  );
  assert.throws(
    () => checkMyEvaluationSaveMock(INITIAL_DATA, draft.id, INPUT, null),
    code('INVALID_INPUT_VALUE'),
  );
  assert.throws(
    () => checkMyEvaluationSaveMock(INITIAL_DATA, submitted.id, { ...INPUT, score: 11 }, null),
    code('INVALID_INPUT_VALUE'),
  );
  assert.throws(
    () => checkMyEvaluationSaveMock(INITIAL_DATA, submitted.id, INPUT, 'save-error'),
    code('NETWORK_ERROR'),
  );
  assert.throws(
    () => checkMyEvaluationSaveMock(INITIAL_DATA, submitted.id, INPUT, 'save-denied'),
    code('ACCESS_DENIED'),
  );
  assert.throws(
    () => checkMyEvaluationSaveMock(INITIAL_DATA, submitted.id, INPUT, 'save-not-found'),
    code('APPLICATION_NOT_FOUND'),
  );
});

test('답변은 지원자마다 다르고, 공통·자기 부문 문항만 order_num 순으로 주며 {Track}을 부문 이름으로 바꾼다', () => {
  const answersOf = (id: number) => listAnswersMock(INITIAL_DATA, id, null).data.answers;
  const engineering = answersOf(101);
  const analysis = answersOf(104);

  assert.notDeepEqual(engineering, analysis);
  assert.ok(engineering.every((a) => a.category === 'COMMON' || a.category === 'ENGINEERING'));
  assert.ok(analysis.every((a) => a.category === 'COMMON' || a.category === 'ANALYSIS'));
  const orders = engineering.map((a) => a.order_num);
  assert.deepEqual(
    orders,
    [...orders].sort((x, y) => x - y),
  );
  const trackQuestion = engineering.find((a) => a.question_id === 3);
  assert.ok(trackQuestion?.content.includes('BOAZ 엔지니어링 부문'));
  assert.ok(engineering.some((a) => a.type === 'TABLE' && typeof a.answer === 'object'));
  // 답하지 않은 문항은 빠지고, 답변이 없으면 빈 배열이다.
  assert.equal(answersOf(102).length, 2);
  assert.deepEqual(answersOf(103), []);
});
