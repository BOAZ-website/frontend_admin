import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyFinalDecision,
  checkFinalDecisionMock,
  INITIAL_DATA,
  readMockScenario,
} from '../src/pages/recruiting-evaluation/model/evaluationMock';
import {
  FINAL_DECISION_OPTIONS,
  finalDecisionFailureNoticeOf,
} from '../src/pages/recruiting-evaluation/model/finalDecision';
import { ApiError } from '../src/shared/api/apiError';

const submitted = INITIAL_DATA.applicants.find((a) => a.status === 'SUBMITTED');
const draft = INITIAL_DATA.applicants.find((a) => a.status === 'DRAFT');

const rejectsWith = (fn: () => void, status: number, code: string) =>
  assert.throws(
    fn,
    (error) => error instanceof ApiError && error.status === status && error.code === code,
  );

test('최종 판정 선택지는 PASS·HOLD·FAIL·PENDING 네 가지다', () => {
  assert.deepEqual([...FINAL_DECISION_OPTIONS].sort(), ['FAIL', 'HOLD', 'PASS', 'PENDING']);
});

test('최종 판정 저장 검사는 제출 완료 지원서의 정해진 값만 통과시킨다', () => {
  assert.ok(submitted && draft);
  for (const decision of FINAL_DECISION_OPTIONS) {
    assert.doesNotThrow(() => checkFinalDecisionMock(INITIAL_DATA, submitted.id, decision, null));
  }
  rejectsWith(
    () => checkFinalDecisionMock(INITIAL_DATA, submitted.id, 'MAYBE', null),
    400,
    'INVALID_INPUT_VALUE',
  );
  rejectsWith(
    () => checkFinalDecisionMock(INITIAL_DATA, draft.id, 'PASS', null),
    400,
    'INVALID_INPUT_VALUE',
  );
  rejectsWith(
    () => checkFinalDecisionMock(INITIAL_DATA, -1, 'PASS', null),
    404,
    'APPLICATION_NOT_FOUND',
  );
});

test('최종 판정 시나리오는 네트워크 실패·권한 없음·지원서 없음을 재현한다', () => {
  assert.ok(submitted);
  assert.equal(readMockScenario('?mockScenario=final-decision-denied'), 'final-decision-denied');
  rejectsWith(
    () => checkFinalDecisionMock(INITIAL_DATA, submitted.id, 'PASS', 'final-decision-error'),
    0,
    'NETWORK_ERROR',
  );
  rejectsWith(
    () => checkFinalDecisionMock(INITIAL_DATA, submitted.id, 'PASS', 'final-decision-denied'),
    403,
    'ACCESS_DENIED',
  );
  rejectsWith(
    () => checkFinalDecisionMock(INITIAL_DATA, submitted.id, 'PASS', 'final-decision-not-found'),
    404,
    'APPLICATION_NOT_FOUND',
  );
});

test('최종 판정을 바꿔도 개인 평가 집계는 그대로다', () => {
  assert.ok(submitted);
  const next = applyFinalDecision(INITIAL_DATA, submitted.id, 'FAIL');
  const after = next.applicants.find((a) => a.id === submitted.id);
  assert.equal(after?.final_decision, 'FAIL');
  assert.equal(after?.total_score, submitted.total_score);
  assert.equal(next.evaluatorsMap, INITIAL_DATA.evaluatorsMap);
});

test('최종 판정 저장 실패는 오류 코드와 지원서 상태로 모달·토스트 문구를 고른다', () => {
  const notice = (error: unknown, status: 'SUBMITTED' | 'DRAFT' = 'SUBMITTED') =>
    finalDecisionFailureNoticeOf(error, status);
  assert.deepEqual(notice(new ApiError(403, 'ACCESS_DENIED', 'x')), {
    display: 'modal',
    message: '최종 판정을 변경할 권한이 없습니다.',
  });
  assert.deepEqual(notice(new ApiError(404, 'APPLICATION_NOT_FOUND', 'x')), {
    display: 'modal',
    message: '지원서를 찾을 수 없습니다.',
  });
  assert.deepEqual(notice(new ApiError(400, 'INVALID_INPUT_VALUE', 'x'), 'DRAFT'), {
    display: 'modal',
    message: '제출 완료된 지원서만 최종 판정을 변경할 수 있습니다.',
  });
  assert.equal(notice(new ApiError(400, 'INVALID_INPUT_VALUE', 'x')).display, 'toast');
  assert.deepEqual(notice(new ApiError(0, 'NETWORK_ERROR', 'x')), {
    display: 'toast',
    message: '최종 판정을 변경하지 못했습니다.',
  });
});
