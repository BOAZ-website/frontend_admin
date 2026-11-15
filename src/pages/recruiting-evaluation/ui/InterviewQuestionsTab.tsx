import { ApiError } from '@/shared/api/apiError';
import { useLoaded } from '@/shared/lib/useLoaded';
import type { ToastMessage } from '@/shared/ui/Toast';

import { orderForViewer } from '../model/evaluationStatus';
import type { InterviewQuestionItem } from '../model/types';

interface InterviewQuestionsTabProps {
  /** 지원자가 바뀌면 부모가 key로 새로 그린다. */
  applicantId: number;
  currentEvaluatorId: number;
  fetchInterviewQuestions: (applicantIdKey: string) => Promise<InterviewQuestionItem[]>;
  /** 복사 결과 안내. 토스트는 페이지가 하나만 그린다. */
  onNotify: (message: string, tone: ToastMessage['tone']) => void;
}

/** 면접 질문 탭(GROUP-07, REC-ADMIN-19). 평가자별 면접 추천 질문을 보여 주고 복사할 수 있다. 조회 전용이다. */
export function InterviewQuestionsTab({
  applicantId,
  currentEvaluatorId,
  fetchInterviewQuestions,
  onNotify,
}: InterviewQuestionsTabProps) {
  const questions = useLoaded(String(applicantId), fetchInterviewQuestions);
  const rows = orderForViewer(questions.data ?? [], currentEvaluatorId);

  // 보안 연결이 아니거나 브라우저가 막으면 clipboard가 없거나 거절된다. 둘 다 실패 안내로 처리한다.
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify('질문이 복사되었습니다.', 'success');
    } catch {
      onNotify('질문을 복사하지 못했습니다. 질문을 직접 선택해 복사해주세요.', 'error');
    }
  };

  return (
    <section className="review-panel" aria-labelledby="review-interview-title">
      <div className="review-heading">
        <h2 id="review-interview-title">면접 추천 질문</h2>
        <button type="button" disabled={questions.isLoading} onClick={questions.reload}>
          {questions.isLoading && questions.data ? '불러오는 중…' : '↻ 새로고침'}
        </button>
      </div>
      {questions.error ? (
        <div role="alert" className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm font-semibold">
            {questions.error instanceof ApiError && questions.error.code === 'APPLICATION_NOT_FOUND'
              ? '지원서를 찾을 수 없습니다.'
              : '면접 질문을 불러오지 못했습니다.'}
          </p>
          <button type="button" onClick={questions.reload}>
            다시 시도
          </button>
        </div>
      ) : !questions.data ? (
        <p role="status">면접 질문을 불러오는 중입니다.</p>
      ) : rows.length === 0 ? (
        <p role="status">아직 등록된 면접 질문이 없습니다.</p>
      ) : (
        rows.map(({ admin_id, displayName, isMe, interview_question: question }) => (
          <div className="review-evaluator" key={admin_id}>
            <div className="flex items-center justify-between gap-3">
              <strong>
                {displayName}
                {isMe && ' (나)'}
              </strong>
              {question && (
                <button
                  type="button"
                  aria-label={`${displayName} 질문 복사`}
                  onClick={() => void handleCopy(question)}
                >
                  질문 복사
                </button>
              )}
            </div>
            <p>{question || '작성된 질문 없음'}</p>
          </div>
        ))
      )}
    </section>
  );
}
