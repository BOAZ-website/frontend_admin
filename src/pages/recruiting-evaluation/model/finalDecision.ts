/**
 * 지원자별 최종 판정 변경(GROUP-08, REC-ADMIN-18). 서류 평가 목록의 행에서 고르고 저장한다.
 * 기수 전체 확정·확정 후 잠금은 백엔드 API가 없어 다루지 않는다.
 */
import { ApiError } from '@/shared/api/apiError';

import type { ApplicationStatus, EvaluationDecision } from './types';

/** 최종 판정 선택지 순서. 명세의 PASS / HOLD / FAIL / PENDING을 모두 둔다. */
export const FINAL_DECISION_OPTIONS: readonly EvaluationDecision[] = [
  'PENDING',
  'PASS',
  'HOLD',
  'FAIL',
];

export const FINAL_DECISION_SAVED_MESSAGE = '최종 판정이 변경되었습니다.';

/** 저장 실패 안내(명세 §5.7·§8). 어느 경우에도 선택값은 서버 값으로 되돌리고 목록을 다시 읽는다. */
export interface FinalDecisionFailureNotice {
  display: 'modal' | 'toast';
  message: string;
}

export function finalDecisionFailureNoticeOf(
  error: unknown,
  applicantStatus: ApplicationStatus,
): FinalDecisionFailureNotice {
  const code = error instanceof ApiError ? error.code : null;
  if (code === 'ACCESS_DENIED') {
    return { display: 'modal', message: '최종 판정을 변경할 권한이 없습니다.' };
  }
  if (code === 'APPLICATION_NOT_FOUND') {
    return { display: 'modal', message: '지원서를 찾을 수 없습니다.' };
  }
  if (code === 'INVALID_INPUT_VALUE') {
    // 서버는 DRAFT 거절과 값 오류를 같은 코드로 준다. 화면이 아는 지원서 상태로 문구를 고른다.
    return applicantStatus === 'DRAFT'
      ? { display: 'modal', message: '제출 완료된 지원서만 최종 판정을 변경할 수 있습니다.' }
      : { display: 'toast', message: '입력값이 올바르지 않습니다.' };
  }
  return { display: 'toast', message: '최종 판정을 변경하지 못했습니다.' };
}
