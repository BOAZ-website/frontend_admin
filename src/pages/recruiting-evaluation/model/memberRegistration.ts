/**
 * 합격자 부원 등록(PATCH /api/v1/admin/users/promote)의 대상 목록과 결과 계산. 그리기와 요청은 하지 않는다.
 * 회원 상태를 조회하는 API가 없어 상태는 이 화면에서 보낸 요청의 결과로만 정한다.
 */
import { ApiError } from '@/shared/api/apiError';

import { DEFAULT_REVIEW_QUERY, filterReviewList, type ReviewSort } from './applicantList';
import type { ApplicantEvaluationDto, PromoteUsersResponse, TrackType } from './types';

/** 행 상태. WAITING은 화면의 초기 표시값이고 서버에서 확인한 회원 상태가 아니다. */
export type RegistrationStatus =
  'WAITING' | 'REGISTERING' | 'REGISTERED' | 'ALREADY_MEMBER' | 'FAILED' | 'UNKNOWN';

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  WAITING: '등록 대기',
  REGISTERING: '등록 중',
  REGISTERED: '등록 완료',
  ALREADY_MEMBER: '이미 등록',
  FAILED: '등록 실패',
  UNKNOWN: '확인 필요',
};

export interface RegistrationResult {
  status: RegistrationStatus;
  /** 등록 실패 사유. FAILED일 때만 있다. */
  reason?: string;
}

const FAILURE_REASONS: Record<string, string> = {
  USER_NOT_FOUND: '계정을 찾을 수 없습니다.',
  APPLICATION_NOT_FOUND: '제출 완료된 지원서가 없습니다.',
  APPLICANT_NOT_PASSED: '최종 합격자가 아닙니다.',
};

/** 다시 등록을 시도할 수 있는 결과. 요청이 끝난 뒤 이 행만 선택을 남긴다. */
export const isRetryable = (status: RegistrationStatus): boolean =>
  status === 'FAILED' || status === 'UNKNOWN';

/** 부원 등록 대상: 제출 완료 + 최종 합격. 정렬은 서류 평가 목록과 같다(filterReviewList). */
export function registrationRows(
  applicants: readonly ApplicantEvaluationDto[],
  query: { track: 'ALL' | TrackType; search: string; sort: ReviewSort },
): ApplicantEvaluationDto[] {
  return filterReviewList(applicants, { ...DEFAULT_REVIEW_QUERY, ...query, finalDecision: 'PASS' });
}

/** 200 응답을 요청 대상별 결과로 바꾼다. 실패 목록에 없는 요청 대상은 성공이다. */
export function registrationResultsOf(
  userIds: readonly number[],
  response: PromoteUsersResponse,
): Record<number, RegistrationResult> {
  const results: Record<number, RegistrationResult> = {};
  for (const userId of userIds) {
    const failure = response.failed_user_ids.find((item) => item.user_id === userId);
    results[userId] = !failure
      ? { status: 'REGISTERED' }
      : failure.error_code === 'ALREADY_MEMBER'
        ? { status: 'ALREADY_MEMBER' }
        : {
            status: 'FAILED',
            reason:
              FAILURE_REASONS[failure.error_code] ?? `등록하지 못했습니다. (${failure.error_code})`,
          };
  }
  return results;
}

/** 결과 안내 문구. 상태별 인원을 센다. */
export function registrationSummaryOf(results: Record<number, RegistrationResult>): string {
  const count = (status: RegistrationStatus) =>
    Object.values(results).filter((result) => result.status === status).length;
  return (
    `부원 등록 요청을 처리했습니다.\n` +
    `등록 완료 ${count('REGISTERED')}명, 이미 등록 ${count('ALREADY_MEMBER')}명, 등록 실패 ${count('FAILED')}명`
  );
}

/**
 * 요청 자체가 실패했을 때의 안내. 4xx는 서버가 처리하지 않고 거절한 것이라 행 상태를 되돌린다.
 * 5xx·연결 오류는 일부만 처리됐을 수 있어 전체 실패로 단정하지 않고 확인 필요로 둔다.
 */
export function registrationRequestFailureOf(error: unknown): {
  message: string;
  isUnknown: boolean;
} {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return {
      message:
        error.code === 'ACCESS_DENIED'
          ? '부원 등록 권한이 없습니다.'
          : '등록 요청이 거절되었습니다. 선택한 인원을 확인한 뒤 다시 시도해주세요.',
      isUnknown: false,
    };
  }
  return {
    message:
      '처리 결과를 확인할 수 없습니다. 일부 인원은 등록되었을 수 있습니다.\n' +
      '동아리원 명단에서 등록 여부를 확인한 뒤 다시 시도해주세요.',
    isUnknown: true,
  };
}
