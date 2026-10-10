import { useCallback, useEffect, useState } from 'react';

import { ApiError } from '@/shared/api/client';

import { fetchAppliedScoreRule, fetchScoreRules } from '../api/scoreRuleApi';
import type { ScoreRule } from './types';

export interface ScoreRulesState {
  /** 모든 점수 규칙(큰 기수부터). 읽는 중이면 빈 배열. */
  rules: ScoreRule[];
  /** 현재 반기에 적용되는 규칙. 읽는 중이거나 없으면 null. */
  appliedRule: ScoreRule | null;
  error: Error | null;
  /** 규칙을 바꾼 뒤 다시 읽는다. */
  reload: () => void;
}

/** 점수 규칙을 API에서 읽는다. 규칙의 원본은 DB이며 화면은 이 값을 그대로 쓴다. */
export function useScoreRules(): ScoreRulesState {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Omit<ScoreRulesState, 'reload'>>({
    rules: [],
    appliedRule: null,
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;
    // 현재 반기 규칙이 아직 없는 것(SCORE_RULE_NOT_FOUND)은 정상 상태라 null로 두고, 다른 오류는 그대로 알린다.
    const applied = fetchAppliedScoreRule().catch((error: unknown) => {
      if (error instanceof ApiError && error.code === 'SCORE_RULE_NOT_FOUND') return null;
      throw error;
    });
    Promise.all([fetchScoreRules(), applied])
      .then(([rules, appliedRule]) => {
        if (!isCancelled) setState({ rules, appliedRule, error: null });
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState({
            rules: [],
            appliedRule: null,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}
