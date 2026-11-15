import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyFinalDecision,
  applyMyEvaluation,
  applyPromotion,
  CURRENT_EVALUATOR,
  INITIAL_DATA,
} from '../src/pages/recruiting-evaluation/model/evaluationMock';

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

test('승격하면 고른 사용자만 승격 표시가 붙고 성공 목록으로 돌아온다', () => {
  const target = applicantOf(101);

  const { data, result } = applyPromotion(INITIAL_DATA, [target.user_id]);

  assert.deepEqual(result, { successUserIds: [target.user_id], failedList: [] });
  for (const applicant of data.applicants) {
    assert.equal(
      Boolean(applicant.is_promoted_to_member),
      applicant.user_id === target.user_id ||
        Boolean(applicantOf(applicant.id).is_promoted_to_member),
    );
  }
});
