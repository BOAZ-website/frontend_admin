import { fetchScoreRuleSets } from '../api/seasonApi';
import type { ScoreRuleSetOption } from './season';
import { type LoadedState, useLoaded } from '@/shared/lib/useLoaded';

const loadAll = (): Promise<ScoreRuleSetOption[]> => fetchScoreRuleSets();

/** 반기에 고를 수 있는 점수 규칙 버전(ATT-12). */
export function useScoreRuleSets(): LoadedState<ScoreRuleSetOption[]> {
  return useLoaded('all', loadAll);
}
