import { useState } from 'react';

import {
  applyFinalDecision,
  applyMyEvaluation,
  applyPromotion,
  CURRENT_EVALUATOR,
  type EvaluationData,
  INITIAL_DATA,
} from './evaluationMock';
import type {
  ApplicantEvaluationDto,
  EvaluationDecision,
  MyEvaluationInput,
  PromotionResult,
} from './types';

/** 서류 평가 화면의 서버 데이터와 저장 함수. 화면의 선택·필터·입력 상태는 화면이 따로 가진다. */
export interface EvaluationDataState extends EvaluationData {
  /** 지금 평가하는 관리자 id. 다른 평가자 결과와 구분할 때 쓴다. */
  currentEvaluatorId: number;
  /** 개인 평가를 저장하고 갱신된 지원자를 돌려준다. */
  saveMyEvaluation: (
    applicant: ApplicantEvaluationDto,
    input: MyEvaluationInput,
  ) => Promise<ApplicantEvaluationDto>;
  updateFinalDecision: (applicantId: number, decision: EvaluationDecision) => Promise<void>;
  promoteUsers: (userIds: readonly number[]) => Promise<PromotionResult>;
}

// PoC 응답 지연. 실제 API 연동 때 지운다.
const SAVE_DELAY_MS = 300;
const PROMOTE_DELAY_MS = 700;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * [PoC] 목 데이터(evaluationMock.ts)를 상태로 들고 저장 함수를 제공한다. 새로고침하면 처음 데이터로 돌아간다.
 * 실제 API 연동 때는 이 Hook 안의 목 함수 호출만 entities API 함수 호출과 재조회로 바꾸고, 화면은 그대로 둔다.
 */
export function useEvaluationData(): EvaluationDataState {
  const [data, setData] = useState<EvaluationData>(INITIAL_DATA);

  const saveMyEvaluation = async (
    applicant: ApplicantEvaluationDto,
    input: MyEvaluationInput,
  ): Promise<ApplicantEvaluationDto> => {
    await wait(SAVE_DELAY_MS);
    const next = applyMyEvaluation(data, applicant, input);
    setData(next.data);
    return next.applicant;
  };

  const updateFinalDecision = async (
    applicantId: number,
    decision: EvaluationDecision,
  ): Promise<void> => {
    setData((current) => applyFinalDecision(current, applicantId, decision));
  };

  const promoteUsers = async (userIds: readonly number[]): Promise<PromotionResult> => {
    await wait(PROMOTE_DELAY_MS);
    const next = applyPromotion(data, userIds);
    setData(next.data);
    return next.result;
  };

  return {
    ...data,
    currentEvaluatorId: CURRENT_EVALUATOR.admin_id,
    saveMyEvaluation,
    updateFinalDecision,
    promoteUsers,
  };
}
