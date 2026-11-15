/**
 * 개인 평가 입력 폼의 규칙(EVL-MY, MY-06~08). 검증·변경 여부·저장 실패 안내를 계산하고, 그리기는 하지 않는다.
 * 문구는 FE 기능명세 v1.1 §4.4~4.6, §8.2~8.3을 따른다.
 */
import { ApiError } from '@/shared/api/apiError';

import type {
  ApplicationStatus,
  EvaluationDecision,
  MyEvaluationDto,
  MyEvaluationInput,
} from './types';

/** 점수 선택지. FE·BE 명세의 score 범위(1~10 정수)를 1점 단위로 둔다. 고르지 않으면 null이다. */
export const SCORE_OPTIONS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** 입력 중인 내 평가. 판정을 아직 고르지 않았으면 decision이 null이다. */
export interface MyEvaluationDraft {
  decision: EvaluationDecision | null;
  score: number | null;
  memo: string;
  interview_question: string;
}

export const EMPTY_DRAFT: MyEvaluationDraft = {
  decision: null,
  score: null,
  memo: '',
  interview_question: '',
};

/** 저장된 내 평가로 폼을 채운다. 평가가 없으면(null) 빈 폼이다. */
export function draftFromMyEvaluation(mine: MyEvaluationDto | null): MyEvaluationDraft {
  if (!mine) return EMPTY_DRAFT;
  return {
    decision: mine.decision,
    score: mine.score,
    memo: mine.memo ?? '',
    interview_question: mine.interview_question ?? '',
  };
}

/** 저장된 값과 다른지. 다르면 다른 지원자·메뉴로 옮기기 전에 확인한다(§4.5). */
export const isDraftChanged = (draft: MyEvaluationDraft, saved: MyEvaluationDraft): boolean =>
  draft.decision !== saved.decision ||
  draft.score !== saved.score ||
  draft.memo !== saved.memo ||
  draft.interview_question !== saved.interview_question;

/** 필드별 오류 문구. 오류가 없는 필드는 빠진다. */
export interface MyEvaluationErrors {
  decision?: string;
  score?: string;
}

/** 저장 전 검증(§4.4, §7.4). 판정은 필수, 점수는 비워도 되지만 있으면 1~10 정수여야 한다. */
export function validateMyEvaluation(draft: MyEvaluationDraft): MyEvaluationErrors {
  const errors: MyEvaluationErrors = {};
  if (draft.decision === null) errors.decision = '평가 판정을 선택해주세요.';
  if (
    draft.score !== null &&
    !(Number.isInteger(draft.score) && draft.score >= 1 && draft.score <= 10)
  ) {
    errors.score = '점수는 1~10 사이의 정수로 입력해주세요.';
  }
  return errors;
}

/** 검증을 통과한 초안을 저장 요청으로 바꾼다. 네 필드를 모두 보낸다(§4.4). 판정이 없으면 null. */
export function toSaveInput(draft: MyEvaluationDraft): MyEvaluationInput | null {
  if (draft.decision === null) return null;
  return {
    decision: draft.decision,
    score: draft.score,
    memo: draft.memo,
    interview_question: draft.interview_question,
  };
}

/**
 * 저장 실패를 사용자에게 어떻게 알릴지(§4.6, §8.2~8.3). 오류 코드로 고르고 서버 문구는 분기에 쓰지 않는다.
 * leave가 true면 안내 뒤 평가 화면을 닫고 목록으로 돌아간다. 입력한 값은 어느 경우에도 지우지 않는다.
 */
export interface SaveFailureNotice {
  display: 'modal' | 'toast';
  message: string;
  leave: boolean;
}

export function saveFailureNoticeOf(
  error: unknown,
  applicantStatus: ApplicationStatus,
): SaveFailureNotice {
  const code = error instanceof ApiError ? error.code : null;
  if (code === 'ACCESS_DENIED') {
    return { display: 'modal', message: '해당 지원서를 평가할 권한이 없습니다.', leave: false };
  }
  if (code === 'APPLICATION_NOT_FOUND') {
    return { display: 'modal', message: '지원서를 찾을 수 없습니다.', leave: true };
  }
  if (code === 'INVALID_INPUT_VALUE') {
    // 서버가 DRAFT 여부를 따로 알려 주지 않으므로 화면이 아는 지원서 상태로 문구를 고른다(§8.2 주의).
    return applicantStatus === 'DRAFT'
      ? { display: 'modal', message: '제출 완료된 지원서만 평가할 수 있습니다.', leave: true }
      : { display: 'toast', message: '입력값이 올바르지 않습니다.', leave: false };
  }
  return {
    display: 'toast',
    message: '평가를 저장하지 못했습니다. 다시 시도해주세요.',
    leave: false,
  };
}

/** 저장하지 않은 평가가 있을 때 다른 지원자·메뉴로 옮기기 전 확인 문구(§4.6). */
export const UNSAVED_EVALUATION_MESSAGE = '저장하지 않은 평가 내용이 있습니다. 이동하시겠습니까?';
