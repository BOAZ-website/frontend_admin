import { ApiError } from '@/shared/api/apiError';
import { useLoaded } from '@/shared/lib/useLoaded';

import { orderForViewer, summarizeEvaluations } from '../model/evaluationStatus';
import { DECISION_LABELS, type EvaluatorDetailItem } from '../model/types';

interface EvaluatorResultsTabProps {
  /** 지원자가 바뀌면 부모가 key로 새로 그린다. 그래서 읽는 중에 보이는 값은 같은 지원자의 이전 결과다. */
  applicantId: number;
  currentEvaluatorId: number;
  fetchEvaluations: (applicantIdKey: string) => Promise<EvaluatorDetailItem[]>;
}

// 메모가 남는 너비를 모두 쓰도록 앞 세 열은 내용 너비로 고정한다. 점수는 숫자라 오른쪽 정렬이다.
const STATUS_COLUMNS = [
  { label: '평가자', className: 'w-36 text-left' },
  { label: '개인 판정', className: 'w-24 text-left' },
  { label: '점수', className: 'w-20 text-right' },
  { label: '메모', className: 'text-left' },
];

/**
 * 평가 현황 탭(GROUP-05, REC-ADMIN-15). 평가자별 판정·점수·메모를 표 하나로 비교한다. 조회 전용이다.
 * 로그인한 평가자는 '(나)'로 표시해 맨 위에 둔다.
 */
export function EvaluatorResultsTab({
  applicantId,
  currentEvaluatorId,
  fetchEvaluations,
}: EvaluatorResultsTabProps) {
  const evaluations = useLoaded(String(applicantId), fetchEvaluations);
  const rows = orderForViewer(evaluations.data ?? [], currentEvaluatorId);
  const summary = summarizeEvaluations(rows);

  return (
    <section className="review-panel" aria-labelledby="review-status-title">
      <div className="review-heading">
        <h2 id="review-status-title">평가 현황</h2>
        <button type="button" disabled={evaluations.isLoading} onClick={evaluations.reload}>
          {evaluations.isLoading && evaluations.data ? '불러오는 중…' : '↻ 새로고침'}
        </button>
      </div>
      {evaluations.error ? (
        <div role="alert" className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm font-semibold">
            {evaluations.error instanceof ApiError &&
            evaluations.error.code === 'APPLICATION_NOT_FOUND'
              ? '지원서를 찾을 수 없습니다.'
              : '평가 결과를 불러오지 못했습니다.'}
          </p>
          <button type="button" onClick={evaluations.reload}>
            다시 시도
          </button>
        </div>
      ) : !evaluations.data ? (
        <p role="status">평가 결과를 불러오는 중입니다.</p>
      ) : rows.length === 0 ? (
        <p role="status">아직 등록된 평가가 없습니다.</p>
      ) : (
        <>
          <div className="review-summary">
            <span>
              평가 완료 {summary.completed} / {summary.total}명
            </span>
            <span>총점 {summary.totalScore}점</span>
            <span>
              평균 점수{' '}
              {summary.averageScore === null ? '-' : `${summary.averageScore.toFixed(1)}점`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr>
                  {STATUS_COLUMNS.map(({ label, className }) => (
                    <th key={label} scope="col" className={`px-4 py-3 ${className}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.admin_id}>
                    <td className="px-4 font-semibold whitespace-nowrap">
                      {row.displayName}
                      {row.isMe && ' (나)'}
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      {row.decision ? DECISION_LABELS[row.decision] : '미평가'}
                    </td>
                    <td className="px-4 text-right whitespace-nowrap">
                      {row.score === null ? '-' : `${row.score}점`}
                    </td>
                    <td className="px-4 whitespace-pre-wrap">{row.memo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
