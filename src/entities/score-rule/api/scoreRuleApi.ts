/**
 * 출결 점수 규칙 API 호출. 규칙은 DB에 저장되며 화면은 localStorage 대신 이 함수들을 쓴다.
 */
import { api, withQuery } from '@/shared/api/client';

import type { ScoreRuleUpsertRequest } from '../model/dto';
import type { ScoreRule } from '../model/types';

const rulePath = (ruleId: string) => `/api/v1/score-rules/${encodeURIComponent(ruleId)}`;

export function fetchScoreRules(term?: number): Promise<ScoreRule[]> {
  return api.get(withQuery('/api/v1/score-rules', { term }));
}

/** 반기(생략하면 현재 반기)에 적용되는 규칙. */
export function fetchAppliedScoreRule(semester?: string): Promise<ScoreRule> {
  return api.get(withQuery('/api/v1/score-rules/applied', { semester }));
}

export function fetchScoreRule(ruleId: string): Promise<ScoreRule> {
  return api.get(rulePath(ruleId));
}

export function createScoreRule(
  request: ScoreRuleUpsertRequest & { term: number; name: string; startDate: string },
): Promise<ScoreRule> {
  return api.post('/api/v1/score-rules', request);
}

export function updateScoreRule(
  ruleId: string,
  request: ScoreRuleUpsertRequest,
): Promise<ScoreRule> {
  return api.patch(rulePath(ruleId), request);
}

/** 이 규칙을 적용 중으로 바꾼다. 기존 적용 중 규칙은 비활성으로 바뀐다. */
export function activateScoreRule(ruleId: string): Promise<ScoreRule> {
  return api.post(`${rulePath(ruleId)}/activate`);
}

export function deleteScoreRule(ruleId: string): Promise<{ deleted: string }> {
  return api.delete(rulePath(ruleId));
}
