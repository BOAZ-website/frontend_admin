/**
 * 리크루팅 관리 API 호출. 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 * 경로는 백엔드 RecruitmentAdminController와 같다.
 */
import { api } from '@/shared/api/client';

import type {
  QuestionCreateItem,
  QuestionIdResponse,
  QuestionIdsResponse,
  QuestionUpdateRequest,
  RecruitmentCreateRequest,
  RecruitmentIdResponse,
  RecruitmentUpdateRequest,
} from '../model/dto';
import type { Question, Recruitment, Subscription } from '../model/types';

const BASE = '/api/v1/admin/recruitment';

/** 모집 공고 목록. 기수가 큰 순서다. */
export function fetchRecruitments(): Promise<Recruitment[]> {
  return api.get(BASE);
}

/** 같은 기수의 공고가 있으면 409 DUPLICATE_TERM으로 거절된다. */
export function createRecruitment(
  request: RecruitmentCreateRequest,
): Promise<RecruitmentIdResponse> {
  return api.post(BASE, request);
}

/** 보낸 값만 바뀐다. */
export function updateRecruitment(
  recruitmentId: number,
  request: RecruitmentUpdateRequest,
): Promise<RecruitmentIdResponse> {
  return api.patch(`${BASE}/${recruitmentId}`, request);
}

/** 문항이나 지원자가 있는 공고는 400 RECRUITMENT_HAS_REFERENCES로 거절된다. */
export function deleteRecruitment(recruitmentId: number): Promise<void> {
  return api.delete(`${BASE}/${recruitmentId}`);
}

/** 한 공고의 문항 전체. 순서 번호 순이다. */
export function fetchQuestions(recruitmentId: number): Promise<Question[]> {
  return api.get(`${BASE}/${recruitmentId}/questions`);
}

/** 문항을 한 번에 여러 개 등록한다. 하나라도 거절되면 모두 등록되지 않는다. */
export function createQuestions(
  recruitmentId: number,
  questions: QuestionCreateItem[],
): Promise<QuestionIdsResponse> {
  return api.post(`${BASE}/questions`, { recruitment_id: recruitmentId, questions });
}

/** 보낸 값만 바뀐다. */
export function updateQuestion(
  questionId: number,
  request: QuestionUpdateRequest,
): Promise<QuestionIdResponse> {
  return api.patch(`${BASE}/questions/${questionId}`, request);
}

/** 답변이 있는 문항은 400 QUESTION_HAS_ANSWERS로 거절된다. */
export function deleteQuestion(questionId: number): Promise<void> {
  return api.delete(`${BASE}/questions/${questionId}`);
}

/** 사전 알림 신청 명단. 최근 신청 순이다. */
export function fetchSubscriptions(): Promise<Subscription[]> {
  return api.get(`${BASE}/subscriptions`);
}

/** 사전 알림 신청 명단을 모두 지운다. 한 명만 지우는 API는 없다. */
export function deleteAllSubscriptions(): Promise<void> {
  return api.delete(`${BASE}/subscriptions`);
}
