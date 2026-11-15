import type { ToastMessage } from '@/shared/ui/Toast';

import { applicantInfoFields } from '../model/applicantList';
import { type MyEvaluationErrors, SCORE_OPTIONS } from '../model/myEvaluationForm';
import {
  type ApplicantAnswerDto,
  type ApplicantEvaluationDto,
  DECISION_LABELS,
  type EvaluationDecision,
  type EvaluatorDetailItem,
  type InterviewQuestionItem,
  TRACK_LABELS,
} from '../model/types';
import { ApplicantAnswersSection } from './ApplicantAnswersSection';
import { EvaluatorResultsTab } from './EvaluatorResultsTab';
import { InterviewQuestionsTab } from './InterviewQuestionsTab';
import { type SegmentedTabItem, SegmentedTabs } from './SegmentedTabs';

/** 지원자 상세의 탭. 평가 현황·면접 질문은 조회 전용이고, 입력은 개인 평가 탭에만 있다. */
export type ReviewDetailTab = 'review' | 'status' | 'interview';

const DETAIL_TABS: SegmentedTabItem<ReviewDetailTab>[] = [
  { id: 'review', label: '개인 평가' },
  { id: 'status', label: '평가 현황' },
  { id: 'interview', label: '면접 질문' },
];

interface ApplicantReviewDetailProps {
  applicant: ApplicantEvaluationDto;
  /** 로그인한 평가자 id. 평가 현황·면접 질문에서 '(나)' 행을 맨 위에 둘 때 쓴다. */
  currentEvaluatorId: number;
  /** 지금 보이는 탭. 지원자를 옮겨도 유지되도록 페이지가 가진다. */
  tab: ReviewDetailTab;
  onTabChange: (tab: ReviewDetailTab) => void;
  fetchAnswers: (applicantIdKey: string) => Promise<ApplicantAnswerDto[]>;
  fetchEvaluations: (applicantIdKey: string) => Promise<EvaluatorDetailItem[]>;
  fetchInterviewQuestions: (applicantIdKey: string) => Promise<InterviewQuestionItem[]>;
  onNotify: (message: string, tone: ToastMessage['tone']) => void;
  /** 내 평가(REC-ADMIN-16)를 읽는 중이면 폼을 잠근다. */
  isMyEvaluationLoading: boolean;
  myEvaluationError: Error | null;
  onRetryMyEvaluation: () => void;
  /** 아직 고르지 않았으면 null. 저장할 때 판정이 없으면 필드 오류를 보여 준다. */
  decision: EvaluationDecision | null;
  /** 1~10점 중 고른 값. 고르지 않으면 null(선택 입력). */
  score: number | null;
  /** 저장을 누른 뒤 보여 줄 필드 오류. */
  errors: MyEvaluationErrors;
  memo: string;
  interview: string;
  saving: boolean;
  onDecision: (value: EvaluationDecision) => void;
  onScore: (value: number | null) => void;
  onMemo: (value: string) => void;
  onInterview: (value: string) => void;
  onSave: () => void;
  onBack: () => void;
  onNavigate: (direction: 'PREV' | 'NEXT') => void;
  position: number;
  total: number;
}

/**
 * 지원자 상세 전체 화면. 개인 평가 탭은 왼쪽 지원서·오른쪽 내 평가 입력이고, 평가 현황·면접 질문 탭은 조회만 한다.
 * 입력값은 페이지가 가지므로 탭을 바꿔도 남는다.
 */
export function ApplicantReviewDetail(p: ApplicantReviewDetailProps) {
  const a = p.applicant;
  // 내 평가를 읽는 중·실패했거나 저장 중이면 입력을 잠근다(저장 중 값이 바뀌어 다른 값이 저장되지 않게).
  const isFormLocked = p.isMyEvaluationLoading || p.myEvaluationError !== null || p.saving;
  return (
    <div className="evaluation-page applicant-review">
      <div className="review-toolbar">
        <button type="button" disabled={p.saving} onClick={p.onBack}>
          ← 목록
        </button>
        <span className="review-spacer" />
        <span>
          {p.position} / {p.total}
        </span>
        <button disabled={p.saving} onClick={() => p.onNavigate('PREV')}>
          ← 이전
        </button>
        <button disabled={p.saving} onClick={() => p.onNavigate('NEXT')}>
          다음 →
        </button>
      </div>
      <div className="review-tabs">
        <SegmentedTabs
          label="지원자 상세"
          items={DETAIL_TABS}
          value={p.tab}
          onChange={p.onTabChange}
        />
        <span className="review-spacer" />
        <strong>{a.name}</strong>
        <span className="review-tag">{TRACK_LABELS[a.track]}</span>
      </div>
      {p.tab === 'status' && (
        <EvaluatorResultsTab
          key={a.id}
          applicantId={a.id}
          currentEvaluatorId={p.currentEvaluatorId}
          fetchEvaluations={p.fetchEvaluations}
        />
      )}
      {p.tab === 'interview' && (
        <InterviewQuestionsTab
          key={a.id}
          applicantId={a.id}
          currentEvaluatorId={p.currentEvaluatorId}
          fetchInterviewQuestions={p.fetchInterviewQuestions}
          onNotify={p.onNotify}
        />
      )}
      {/* 다른 탭에 있는 동안에도 지원서 답변을 다시 읽지 않도록 숨기기만 한다. */}
      <div className="review-layout" hidden={p.tab !== 'review'}>
        <article className="review-paper">
          <div className="review-person">
            <h1>{a.name}</h1>
          </div>
          {/* 인적사항은 접지 않고 전체 지원 현황 상세와 같은 항목을 모두 보여 준다. */}
          <div className="review-meta">
            {applicantInfoFields(a).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                {value}
              </div>
            ))}
          </div>
          <ApplicantAnswersSection
            applicantId={a.id}
            fetchAnswers={p.fetchAnswers}
            missingAction={{ label: '목록으로 돌아가기', onClick: p.onBack }}
            deniedAction={{ label: '목록으로 돌아가기', onClick: p.onBack }}
          />
        </article>
        <aside className="review-aside">
          <form
            className="review-panel"
            onSubmit={(e) => {
              e.preventDefault();
              p.onSave();
            }}
          >
            <div className="review-heading">
              <h2>내 평가</h2>
              <span>{a.my_decision === null ? '미평가' : '저장됨'}</span>
            </div>
            {p.isMyEvaluationLoading && <p role="status">내 평가를 불러오는 중입니다.</p>}
            {p.myEvaluationError && (
              <div role="alert">
                <p>내 평가를 불러오지 못했습니다.</p>
                <button type="button" onClick={p.onRetryMyEvaluation}>
                  다시 시도
                </button>
              </div>
            )}
            <fieldset disabled={isFormLocked} className="contents">
              <label className="review-label" htmlFor="review-score">
                점수 (선택)
              </label>
              <div className="review-score">
                <select
                  id="review-score"
                  value={p.score ?? ''}
                  aria-invalid={p.errors.score ? true : undefined}
                  aria-describedby={p.errors.score ? 'review-score-error' : undefined}
                  onChange={(e) => p.onScore(e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">점수 없음</option>
                  {SCORE_OPTIONS.map((score) => (
                    <option key={score} value={score}>
                      {score}점
                    </option>
                  ))}
                </select>
                <span>/ 10</span>
              </div>
              {p.errors.score && (
                <p id="review-score-error" role="alert" className="review-field-error">
                  {p.errors.score}
                </p>
              )}
              <span className="review-label" id="review-decision-label">
                개인 결정 (필수)
              </span>
              <div
                className="review-choices"
                role="group"
                aria-labelledby="review-decision-label"
                aria-describedby={p.errors.decision ? 'review-decision-error' : undefined}
              >
                {(Object.keys(DECISION_LABELS) as EvaluationDecision[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={p.decision === d}
                    onClick={() => p.onDecision(d)}
                  >
                    {DECISION_LABELS[d]}
                  </button>
                ))}
              </div>
              {p.errors.decision && (
                <p id="review-decision-error" role="alert" className="review-field-error">
                  {p.errors.decision}
                </p>
              )}
              <label className="review-label" htmlFor="review-memo">
                평가 의견
              </label>
              <textarea
                id="review-memo"
                value={p.memo}
                onChange={(e) => p.onMemo(e.target.value)}
                placeholder="판단의 근거가 된 답변과 의견을 남겨주세요."
              />
              <label className="review-label" htmlFor="review-interview">
                면접 추천 질문
              </label>
              <textarea
                id="review-interview"
                value={p.interview}
                onChange={(e) => p.onInterview(e.target.value)}
              />
            </fieldset>
            <button className="review-submit" type="submit" disabled={p.saving || isFormLocked}>
              {p.saving ? '저장 중…' : '평가 저장'}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
