import assert from 'node:assert/strict';
import test from 'node:test';

import { INITIAL_DATA } from '../src/pages/recruiting-evaluation/model/evaluationMock';
import {
  isRetryable,
  registrationRequestFailureOf,
  registrationResultsOf,
  registrationRows,
  registrationSummaryOf,
} from '../src/pages/recruiting-evaluation/model/memberRegistration';
import type { ApplicantEvaluationDto } from '../src/pages/recruiting-evaluation/model/types';
import { ApiError } from '../src/shared/api/apiError';

const base = INITIAL_DATA.applicants[0];
const applicant = (patch: Partial<ApplicantEvaluationDto>): ApplicantEvaluationDto => ({
  ...base,
  final_decision: 'PASS',
  status: 'SUBMITTED',
  ...patch,
});

test('등록 대상은 제출 완료 최종 합격자이고 고른 정렬·부문 조건을 따른다', () => {
  const rows = registrationRows(
    [
      applicant({ id: 1, name: '하늘', track: 'ENGINEERING' }),
      applicant({ id: 2, name: '나래', track: 'ANALYSIS' }),
      applicant({ id: 3, name: '가람', track: 'ENGINEERING' }),
      applicant({ id: 4, name: '다솜', track: 'VISUALIZATION' }),
      applicant({ id: 5, name: '라온', track: 'ANALYSIS', final_decision: 'HOLD' }),
      applicant({ id: 6, name: '마루', track: 'ANALYSIS', status: 'DRAFT' }),
    ],
    { track: 'ALL', search: '', sort: 'NAME' },
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    [3, 2, 4, 1],
  );
  assert.deepEqual(
    registrationRows(rows, { track: 'ENGINEERING', search: '', sort: 'NAME' }).map((row) => row.id),
    [3, 1],
  );
});

test('200 응답은 실패 목록에 없는 요청 대상을 등록 완료로, ALREADY_MEMBER를 이미 등록으로 본다', () => {
  const results = registrationResultsOf([1, 2, 3, 4], {
    failed_user_ids: [
      { user_id: 2, error_code: 'ALREADY_MEMBER' },
      { user_id: 3, error_code: 'APPLICANT_NOT_PASSED' },
      { user_id: 4, error_code: 'SOMETHING_NEW' },
    ],
  });
  assert.deepEqual(results, {
    1: { status: 'REGISTERED' },
    2: { status: 'ALREADY_MEMBER' },
    3: { status: 'FAILED', reason: '최종 합격자가 아닙니다.' },
    4: { status: 'FAILED', reason: '등록하지 못했습니다. (SOMETHING_NEW)' },
  });
  assert.equal(
    registrationSummaryOf(results).split('\n')[1],
    '등록 완료 1명, 이미 등록 1명, 등록 실패 2명',
  );
  assert.deepEqual(
    Object.values(results).map((result) => isRetryable(result.status)),
    [false, false, true, true],
  );
});

test('요청 실패는 4xx면 거절, 5xx·연결 오류면 결과를 알 수 없음으로 본다', () => {
  assert.equal(
    registrationRequestFailureOf(new ApiError(403, 'ACCESS_DENIED', '')).isUnknown,
    false,
  );
  assert.equal(registrationRequestFailureOf(new ApiError(500, 'INTERNAL', '')).isUnknown, true);
  assert.equal(registrationRequestFailureOf(new ApiError(0, 'NETWORK_ERROR', '')).isUnknown, true);
  assert.equal(registrationRequestFailureOf(new TypeError('fetch failed')).isUnknown, true);
});
