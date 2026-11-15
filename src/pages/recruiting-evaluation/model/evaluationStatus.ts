/**
 * 지원자 상세의 평가 현황(REC-ADMIN-15)·면접 질문(REC-ADMIN-19) 탭 계산.
 * 로그인한 평가자 행을 맨 위에 두고, 나머지는 서버가 준 순서를 그대로 둔다.
 */
import type { ApplicantEvaluationDto, EvaluationDecision, EvaluatorDetailItem } from './types';

/** 평가자 행에 '(나)' 표시 여부와 표시 이름을 더한 것. */
export type ViewerRow<T> = T & { isMe: boolean; displayName: string };

// shortcut: 목 데이터 이름에 '(나)'가 들어 있어 떼고 보여 준다, 실제 API 연동 때 이 치환을 지운다
const stripMeSuffix = (name: string) => name.replace(/\s*\(나\)$/, '');

/** 평가자 id가 currentAdminId인 행을 맨 위로 올리고 '(나)'로 표시한다. 이름으로는 비교하지 않는다. */
export function orderForViewer<T extends { admin_id: number; name: string }>(
  rows: readonly T[],
  currentAdminId: number,
): ViewerRow<T>[] {
  const marked = rows.map((row) => ({
    ...row,
    isMe: row.admin_id === currentAdminId,
    displayName: stripMeSuffix(row.name),
  }));
  return [...marked.filter((row) => row.isMe), ...marked.filter((row) => !row.isMe)];
}

/** 지원자 목록의 평가 집계(REC-ADMIN-14 pass_count·hold_count·fail_count·total_score). */
export type EvaluationAggregate = Pick<
  ApplicantEvaluationDto,
  'pass_count' | 'hold_count' | 'fail_count' | 'total_score'
>;

/**
 * 평가자별 기록으로 목록 집계를 계산한다. 목록·저장·평가 현황이 모두 이 함수를 쓴다.
 * 판정 수는 그 판정을 고른 평가자 수, 총점은 점수 합계다. 점수가 null인 평가는 더하지 않는다.
 */
export function aggregateEvaluations(rows: readonly EvaluatorDetailItem[]): EvaluationAggregate {
  const countOf = (decision: EvaluationDecision) =>
    rows.filter((row) => row.decision === decision).length;
  return {
    pass_count: countOf('PASS'),
    hold_count: countOf('HOLD'),
    fail_count: countOf('FAIL'),
    total_score: rows.reduce((sum, row) => sum + (row.score ?? 0), 0),
  };
}

/** 평가 현황 집계. 총점은 목록의 총점과 같고, 평균은 점수를 남긴 평가 수로 나눈다(점수는 선택 입력). */
export interface EvaluationSummary {
  completed: number;
  total: number;
  totalScore: number;
  /** 점수를 남긴 평가가 없으면 null. */
  averageScore: number | null;
}

export function summarizeEvaluations(rows: readonly EvaluatorDetailItem[]): EvaluationSummary {
  const totalScore = aggregateEvaluations(rows).total_score;
  const scoredCount = rows.filter((row) => row.score !== null).length;
  return {
    completed: rows.filter((row) => row.decision !== null).length,
    total: rows.length,
    totalScore,
    averageScore: scoredCount ? totalScore / scoredCount : null,
  };
}
