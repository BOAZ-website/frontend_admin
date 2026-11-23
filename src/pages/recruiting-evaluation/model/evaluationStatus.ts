/**
 * 지원자 상세의 평가 현황 계산. 평가(REC-ADMIN-15)와 면접 추천 질문(REC-ADMIN-19)을 평가자별로 묶는다.
 * 로그인한 평가자 행을 맨 위에 두고, 나머지는 서버가 준 순서를 그대로 둔다.
 */
import type {
  ApplicantEvaluationDto,
  EvaluationDecision,
  EvaluatorDetailItem,
  InterviewQuestionItem,
} from './types';

/** 평가자 행에 본인 행 여부와 표시 이름을 더한 것. */
export type ViewerRow<T> = T & { isMe: boolean; displayName: string };

// shortcut: 목 데이터 이름에 '(나)'가 들어 있어 떼고 보여 준다, 실제 API 연동 때 이 치환을 지운다
const stripMeSuffix = (name: string) => name.replace(/\s*\(나\)$/, '');

/** 평가자 id가 currentAdminId인 행을 맨 위로 올린다. 이름에 '(나)'를 붙이지 않는다. 이름으로는 비교하지 않는다. */
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

/** 평가 현황의 평가자 한 줄. 평가(REC-ADMIN-15)와 면접 추천 질문(REC-ADMIN-19)을 평가자 id로 묶었다. */
export interface EvaluatorRecord extends EvaluatorDetailItem {
  interview_question: string | null;
}

/**
 * 평가자별 평가에 같은 평가자의 면접 추천 질문을 붙인다. 순서는 평가 목록(REC-ADMIN-15)을 따른다.
 * 질문만 있고 평가 목록에 없는 평가자는 미평가 행으로 뒤에 붙여 질문이 빠지지 않게 한다.
 */
export function mergeEvaluatorRecords(
  evaluations: readonly EvaluatorDetailItem[],
  questions: readonly InterviewQuestionItem[],
): EvaluatorRecord[] {
  const questionOf = new Map(questions.map((q) => [q.admin_id, q.interview_question]));
  const known = new Set(evaluations.map((e) => e.admin_id));
  return [
    ...evaluations.map((e) => ({ ...e, interview_question: questionOf.get(e.admin_id) ?? null })),
    ...questions
      .filter((q) => !known.has(q.admin_id))
      .map((q) => ({ ...q, decision: null, score: null, memo: null })),
  ];
}
