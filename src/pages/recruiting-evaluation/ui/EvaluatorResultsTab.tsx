import { RefreshCw } from 'lucide-react';

import { ApiError } from '@/shared/api/apiError';
import { useLoaded } from '@/shared/lib/useLoaded';
import type { ToastMessage } from '@/shared/ui/Toast';

import { mergeEvaluatorRecords, orderForViewer } from '../model/evaluationStatus';
import {
  DECISION_LABELS,
  type EvaluatorDetailItem,
  type InterviewQuestionItem,
} from '../model/types';

interface EvaluatorResultsTabProps {
  /** 지원자가 바뀌면 부모가 key로 새로 그린다. 그래서 읽는 중에 보이는 값은 같은 지원자의 이전 결과다. */
  applicantId: number;
  currentEvaluatorId: number;
  fetchEvaluations: (applicantIdKey: string) => Promise<EvaluatorDetailItem[]>;
  fetchInterviewQuestions: (applicantIdKey: string) => Promise<InterviewQuestionItem[]>;
  /** 질문 복사 결과 안내. 토스트는 페이지가 하나만 그린다. */
  onNotify: (message: string, tone: ToastMessage['tone']) => void;
}

/**
 * 평가 현황(GROUP-05·07, REC-ADMIN-15·19). 운영진별 판정·점수·메모·면접 추천 질문을 평가자 단위로 보여 준다.
 * 조회 전용이고 집계(완료 인원·총점·평균)는 두지 않는다. 로그인한 평가자는 '(나)'로 표시해 맨 위에 둔다.
 */
export function EvaluatorResultsTab({
  applicantId,
  currentEvaluatorId,
  fetchEvaluations,
  fetchInterviewQuestions,
  onNotify,
}: EvaluatorResultsTabProps) {
  const evaluations = useLoaded(String(applicantId), fetchEvaluations);
  const questions = useLoaded(String(applicantId), fetchInterviewQuestions);
  const error = evaluations.error ?? questions.error;
  const isLoading = evaluations.isLoading || questions.isLoading;
  const isLoaded = evaluations.data !== null && questions.data !== null;
  const rows = orderForViewer(
    mergeEvaluatorRecords(evaluations.data ?? [], questions.data ?? []),
    currentEvaluatorId,
  );

  const reload = () => {
    evaluations.reload();
    questions.reload();
  };

  // 보안 연결이 아니거나 브라우저가 막으면 clipboard가 없거나 거절된다. 둘 다 실패 안내로 처리한다.
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify('질문이 복사되었습니다.', 'success');
    } catch {
      window.alert('질문을 복사하지 못했습니다. 질문을 직접 선택해 복사해주세요.');
    }
  };

  return (
    <section className="review-panel" aria-labelledby="review-status-title">
      <div className="review-heading">
        <h2 id="review-status-title">운영진 평가 현황</h2>
        <button type="button" disabled={isLoading} onClick={reload}>
          <RefreshCw
            size={14}
            aria-hidden="true"
            className={isLoading && isLoaded ? 'animate-spin' : ''}
          />
          새로고침
        </button>
      </div>
      {error ? (
        <div role="alert" className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm font-semibold">
            {error instanceof ApiError && error.code === 'APPLICATION_NOT_FOUND'
              ? '지원서를 찾을 수 없습니다.'
              : '평가 결과를 불러오지 못했습니다.'}
          </p>
          <button type="button" onClick={reload}>
            다시 시도
          </button>
        </div>
      ) : !isLoaded ? (
        <p role="status">평가 결과를 불러오는 중입니다.</p>
      ) : rows.length === 0 ? (
        <p role="status">아직 등록된 평가가 없습니다.</p>
      ) : (
        <ul aria-label="운영진별 평가 기록">
          {rows.map((row) => (
            <li key={row.admin_id} className="review-evaluator review-record">
              <div className="review-record-head">
                <strong>
                  {row.displayName}
                  {row.isMe && ' (나)'}
                </strong>
                <span>{row.decision ? DECISION_LABELS[row.decision] : '미평가'}</span>
                <span>{row.score === null ? '-' : `${row.score}점`}</span>
              </div>
              <dl>
                <dt>평가 메모</dt>
                <dd>{row.memo || '-'}</dd>
                <dt>면접 추천 질문</dt>
                <dd className="review-record-question">
                  <span>{row.interview_question || '작성된 질문 없음'}</span>
                  {row.interview_question && (
                    <button
                      type="button"
                      aria-label={`${row.displayName} 질문 복사`}
                      onClick={() => void handleCopy(row.interview_question ?? '')}
                    >
                      질문 복사
                    </button>
                  )}
                </dd>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
