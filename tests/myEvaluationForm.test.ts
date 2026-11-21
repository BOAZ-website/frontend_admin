import assert from 'node:assert/strict';
import test from 'node:test';

import {
  draftFromMyEvaluation,
  EMPTY_DRAFT,
  isDraftChanged,
  saveFailureNoticeOf,
  SCORE_OPTIONS,
  toSaveInput,
  validateMyEvaluation,
} from '../src/pages/recruiting-evaluation/model/myEvaluationForm';
import { ApiError } from '../src/shared/api/apiError';

test('점수 선택지는 명세 범위 1~10을 1점 단위로 둔다', () => {
  assert.deepEqual(SCORE_OPTIONS, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('내 평가가 없으면 빈 폼(처음 점수 8점)이고, 있으면 저장 값으로 채우며 빈 점수는 8점, 빈 메모는 빈 문자열이다', () => {
  assert.deepEqual(draftFromMyEvaluation(null), EMPTY_DRAFT);
  assert.deepEqual(
    draftFromMyEvaluation({
      evaluation_id: 1,
      applicant_id: 101,
      decision: 'PENDING',
      score: null,
      memo: null,
      interview_question: '역할은?',
    }),
    { decision: 'PENDING', score: 8, memo: '', interview_question: '역할은?' },
  );
});

test('판정이 없으면 판정 오류만 나고, 점수는 비워도 오류가 아니다', () => {
  assert.deepEqual(validateMyEvaluation(EMPTY_DRAFT), { decision: '평가 판정을 선택해주세요.' });
  assert.deepEqual(validateMyEvaluation({ ...EMPTY_DRAFT, decision: 'HOLD' }), {});
});

test('점수가 1~10 정수가 아니면 점수 오류가 난다', () => {
  const base = { ...EMPTY_DRAFT, decision: 'PASS' as const };

  for (const score of [0, 11, 7.5]) {
    assert.equal(
      validateMyEvaluation({ ...base, score }).score,
      '점수는 1~10 사이의 정수로 입력해주세요.',
    );
  }
  assert.deepEqual(validateMyEvaluation({ ...base, score: 10 }), {});
});

test('저장 요청은 네 필드를 모두 보내고, 판정이 없으면 만들지 않는다', () => {
  assert.equal(toSaveInput(EMPTY_DRAFT), null);
  assert.deepEqual(toSaveInput({ ...EMPTY_DRAFT, decision: 'FAIL' }), {
    decision: 'FAIL',
    score: 8,
    memo: '',
    interview_question: '',
  });
});

test('저장 값과 하나라도 다르면 저장하지 않은 수정으로 본다', () => {
  const saved = { ...EMPTY_DRAFT, decision: 'PASS' as const, score: 8 };

  assert.equal(isDraftChanged(saved, saved), false);
  assert.equal(isDraftChanged({ ...saved, score: null }, saved), true);
  assert.equal(isDraftChanged({ ...saved, memo: ' ' }, saved), true);
});

test('저장 실패는 오류 코드로 안내 문구와 목록 복귀를 고른다', () => {
  const notice = (error: unknown, status: 'SUBMITTED' | 'DRAFT' = 'SUBMITTED') =>
    saveFailureNoticeOf(error, status);

  assert.deepEqual(notice(new ApiError(403, 'ACCESS_DENIED', 'x')), {
    message: '해당 지원서를 평가할 권한이 없습니다.',
    leave: false,
  });
  assert.deepEqual(notice(new ApiError(404, 'APPLICATION_NOT_FOUND', 'x')), {
    message: '지원서를 찾을 수 없습니다.',
    leave: true,
  });
  assert.equal(
    notice(new ApiError(400, 'INVALID_INPUT_VALUE', 'x'), 'DRAFT').message,
    '제출 완료된 지원서만 평가할 수 있습니다.',
  );
  assert.deepEqual(notice(new ApiError(400, 'INVALID_INPUT_VALUE', 'x')), {
    message: '입력값이 올바르지 않습니다.',
    leave: false,
  });
  assert.deepEqual(notice(new ApiError(0, 'NETWORK_ERROR', 'x')), {
    message: '평가를 저장하지 못했습니다. 다시 시도해주세요.',
    leave: false,
  });
});
