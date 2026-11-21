import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

import type { ToastMessage } from '@/shared/ui/Toast';

import { applicantInfoFields } from '../model/applicantList';
import { DEFAULT_SCORE, type MyEvaluationErrors, SCORE_OPTIONS } from '../model/myEvaluationForm';
import {
  type ApplicantAnswerDto,
  type ApplicantEvaluationDto,
  DECISION_LABELS,
  type EvaluationDecision,
  type EvaluatorDetailItem,
  type InterviewQuestionItem,
  SELECTABLE_DECISIONS,
  TRACK_LABELS,
} from '../model/types';
import { ApplicantAnswersSection } from './ApplicantAnswersSection';
import { EvaluatorResultsTab, type OwnRowEditing } from './EvaluatorResultsTab';
import { type SegmentedTabItem, SegmentedTabs } from './SegmentedTabs';

/** 지원자 상세 오른쪽 영역의 탭. 평가 현황은 조회 전용이고, 입력은 개인 평가 탭에만 있다. */
export type ReviewDetailTab = 'review' | 'status';

const DETAIL_TABS: SegmentedTabItem<ReviewDetailTab>[] = [
  { id: 'review', label: '개인 평가' },
  { id: 'status', label: '운영진 평가 현황' },
];

interface ApplicantReviewDetailProps {
  applicant: ApplicantEvaluationDto;
  /** 로그인한 평가자 id. 평가 현황에서 '(나)' 행을 맨 위에 둘 때 쓴다. */
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
  /** 운영진 평가 현황의 본인 행 편집. 개인 평가와 같은 초안·저장을 쓴다. */
  ownRowEditing: OwnRowEditing;
  /** 바뀌면 운영진 평가 현황을 다시 읽는다. */
  statusRefreshKey: number;
  /** 저장한 값과 다른 입력이 있는지. 다르면 저장하기 버튼을 강조한다. */
  isDirty: boolean;
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
 * 지원자 상세 전체 화면. 위에 인적사항 카드가 있고, 아래는 탭에 따라 바뀐다.
 * 개인 평가: 왼쪽 지원서 답변, 오른쪽 내 평가. 운영진 평가 현황: 전체 너비의 평가자별 표.
 */
export function ApplicantReviewDetail(p: ApplicantReviewDetailProps) {
  const a = p.applicant;
  // 내 평가를 읽는 중·실패했거나 저장 중이면 입력을 잠근다(저장 중 값이 바뀌어 다른 값이 저장되지 않게).
  const isFormLocked = p.isMyEvaluationLoading || p.myEvaluationError !== null || p.saving;
  return (
    <div className="evaluation-page applicant-review">
      <div className="review-toolbar">
        <button type="button" disabled={p.saving} onClick={p.onBack}>
          <ArrowLeft size={14} aria-hidden="true" />
          목록
        </button>
        <SegmentedTabs
          label="오른쪽 영역"
          items={DETAIL_TABS}
          value={p.tab}
          onChange={p.onTabChange}
        />
        <span className="review-spacer" />
        <span>
          {p.position} / {p.total}
        </span>
        <button disabled={p.saving} onClick={() => p.onNavigate('PREV')}>
          <ChevronLeft size={14} aria-hidden="true" />
          이전
        </button>
        <button disabled={p.saving} onClick={() => p.onNavigate('NEXT')}>
          다음
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
      {/* 인적사항은 탭과 관계없이 그대로다. 전체 지원 현황 상세와 같은 항목을 접지 않고 모두 보여 준다. */}
      <section className="review-paper review-profile" aria-label="지원자 정보">
        <div className="review-person">
          <h1>{a.name}</h1>
          <span className="review-tag">{TRACK_LABELS[a.track]}</span>
        </div>
        <dl className="review-meta">
          {applicantInfoFields(a)
            .filter(([label]) => label !== '부문')
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      </section>
      {/* 운영진 평가 현황은 아래 영역 전체 너비를 쓴다. 개인 평가 영역은 입력값이 남도록 숨기기만 한다. */}
      {p.tab === 'status' && (
        <EvaluatorResultsTab
          key={a.id}
          applicantId={a.id}
          currentEvaluatorId={p.currentEvaluatorId}
          fetchEvaluations={p.fetchEvaluations}
          fetchInterviewQuestions={p.fetchInterviewQuestions}
          refreshKey={p.statusRefreshKey}
          editing={p.ownRowEditing}
          onNotify={p.onNotify}
        />
      )}
      <div className="review-layout" hidden={p.tab !== 'review'}>
        {/* 답변과 내 평가는 제목을 남긴 채 각자 스크롤한다. tabIndex로 키보드로도 스크롤 영역에 들어간다. */}
        <article
          className="review-paper review-scroll-panel"
          aria-labelledby="review-answers-title"
        >
          <h2 id="review-answers-title" className="review-section-title">
            지원서 답변
          </h2>
          <div className="review-scroll" tabIndex={0} aria-labelledby="review-answers-title">
            <ApplicantAnswersSection
              applicantId={a.id}
              fetchAnswers={p.fetchAnswers}
              missingAction={{ label: '목록으로 돌아가기', onClick: p.onBack }}
              deniedAction={{ label: '목록으로 돌아가기', onClick: p.onBack }}
            />
          </div>
        </article>
        <aside className="review-aside">
          <form
            className="review-panel review-scroll-panel"
            onSubmit={(e) => {
              e.preventDefault();
              p.onSave();
            }}
          >
            <div className="review-heading">
              <h2 id="review-my-title">평가</h2>
            </div>
            <div className="review-scroll" tabIndex={0} aria-labelledby="review-my-title">
              {p.isMyEvaluationLoading && <p role="status">평가를 불러오는 중입니다.</p>}
              {p.myEvaluationError && (
                <div role="alert">
                  <p>평가를 불러오지 못했습니다.</p>
                  <button type="button" onClick={p.onRetryMyEvaluation}>
                    다시 시도
                  </button>
                </div>
              )}
              <fieldset disabled={isFormLocked} className="contents">
                <label className="review-label" htmlFor="review-score">
                  점수
                </label>
                <div className="review-score">
                  <select
                    id="review-score"
                    value={p.score ?? DEFAULT_SCORE}
                    aria-invalid={p.errors.score ? true : undefined}
                    aria-describedby={p.errors.score ? 'review-score-error' : undefined}
                    onChange={(e) => p.onScore(Number(e.target.value))}
                  >
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
                  평가
                </span>
                <div
                  className="review-choices"
                  role="group"
                  aria-labelledby="review-decision-label"
                  aria-describedby={p.errors.decision ? 'review-decision-error' : undefined}
                >
                  {SELECTABLE_DECISIONS.map((d) => (
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
                  placeholder="면접에서 확인하고 싶은 내용을 질문으로 남겨주세요."
                />
              </fieldset>
            </div>
            <button
              className={`review-submit ${p.isDirty ? 'is-dirty' : ''}`}
              type="submit"
              disabled={p.saving || isFormLocked}
            >
              {p.saving ? '저장 중…' : '저장하기'}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
