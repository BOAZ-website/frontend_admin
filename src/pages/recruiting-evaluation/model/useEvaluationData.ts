import { useCallback, useEffect, useRef, useState } from 'react';

import {
  applyFinalDecision,
  applyMyEvaluation,
  applyPromotion,
  checkMyEvaluationSaveMock,
  CURRENT_EVALUATOR,
  type EvaluationData,
  findMyEvaluationMock,
  INITIAL_DATA,
  listAnswersMock,
  listApplicantsMock,
  readMockScenario,
} from './evaluationMock';
import type {
  ApplicantAnswerDto,
  ApplicantEvaluationDto,
  EvaluationDecision,
  MyEvaluationDto,
  MyEvaluationInput,
  PromotionResult,
} from './types';

/** 서류 평가 화면의 서버 데이터와 저장 함수. 화면의 선택·필터·입력 상태는 화면이 따로 가진다. */
export interface EvaluationDataState extends EvaluationData {
  /** 지금 평가하는 관리자 id. 다른 평가자 결과와 구분할 때 쓴다. */
  currentEvaluatorId: number;
  /** [REC-ADMIN-13·14] 지원자 목록을 읽는다. useLoaded에 넘길 수 있게 참조가 바뀌지 않는다. */
  fetchApplicants: () => Promise<ApplicantEvaluationDto[]>;
  /** [REC-ADMIN-20] 지원서 답변을 읽는다. useLoaded 키(지원서 id 문자열)를 받는다. */
  fetchAnswers: (applicantIdKey: string) => Promise<ApplicantAnswerDto[]>;
  /** [REC-ADMIN-16] 내 평가를 읽는다. 아직 평가하지 않았으면 null. */
  fetchMyEvaluation: (applicantId: number) => Promise<MyEvaluationDto | null>;
  /** 개인 평가를 저장하고 갱신된 지원자를 돌려준다. 거절되면 ApiError를 던진다. */
  saveMyEvaluation: (
    applicant: ApplicantEvaluationDto,
    input: MyEvaluationInput,
  ) => Promise<ApplicantEvaluationDto>;
  updateFinalDecision: (applicantId: number, decision: EvaluationDecision) => Promise<void>;
  promoteUsers: (userIds: readonly number[]) => Promise<PromotionResult>;
}

// PoC 응답 지연. 실제 API 연동 때 지운다.
const LOAD_DELAY_MS = 200;
const SAVE_DELAY_MS = 300;
const PROMOTE_DELAY_MS = 700;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// 개발 서버에서만 주소의 ?mockScenario= 값으로 조회 실패·빈 목록을 재현한다(evaluationMock.ts).
const mockScenario = () => (import.meta.env?.DEV ? readMockScenario(window.location.search) : null);

/**
 * [PoC] 목 데이터(evaluationMock.ts)를 상태로 들고 저장 함수를 제공한다. 새로고침하면 처음 데이터로 돌아간다.
 * 실제 API 연동 때는 이 Hook 안의 목 함수 호출만 entities API 함수 호출과 재조회로 바꾸고, 화면은 그대로 둔다.
 */
export function useEvaluationData(): EvaluationDataState {
  const [data, setData] = useState<EvaluationData>(INITIAL_DATA);
  // 읽기 함수는 참조를 고정하고, 부를 때마다 최신 데이터를 읽는다.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const fetchApplicants = useCallback(async (): Promise<ApplicantEvaluationDto[]> => {
    await wait(LOAD_DELAY_MS);
    return listApplicantsMock(dataRef.current, mockScenario());
  }, []);

  const fetchAnswers = useCallback(
    async (applicantIdKey: string): Promise<ApplicantAnswerDto[]> => {
      await wait(LOAD_DELAY_MS);
      return listAnswersMock(dataRef.current, Number(applicantIdKey), mockScenario());
    },
    [],
  );

  const fetchMyEvaluation = useCallback(
    async (applicantId: number): Promise<MyEvaluationDto | null> => {
      await wait(LOAD_DELAY_MS);
      return findMyEvaluationMock(dataRef.current, applicantId, mockScenario());
    },
    [],
  );

  const saveMyEvaluation = async (
    applicant: ApplicantEvaluationDto,
    input: MyEvaluationInput,
  ): Promise<ApplicantEvaluationDto> => {
    await wait(SAVE_DELAY_MS);
    // 거절되면 오류를 던지고 데이터는 그대로 둔다(저장 실패 시 입력 유지는 화면이 맡는다).
    checkMyEvaluationSaveMock(dataRef.current, applicant.id, input, mockScenario());
    const next = applyMyEvaluation(dataRef.current, applicant, input);
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
    fetchApplicants,
    fetchAnswers,
    fetchMyEvaluation,
    saveMyEvaluation,
    updateFinalDecision,
    promoteUsers,
  };
}
