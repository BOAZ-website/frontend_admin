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

interface ApplicantReviewDetailProps {
  applicant: ApplicantEvaluationDto;
  /** 지금 평가하는 관리자 id. 다른 평가 목록에서 본인을 뺄 때 쓴다. */
  currentEvaluatorId: number;
  fetchAnswers: (applicantIdKey: string) => Promise<ApplicantAnswerDto[]>;
  /** 내 평가(REC-ADMIN-16)를 읽는 중이면 폼을 잠근다. */
  isMyEvaluationLoading: boolean;
  myEvaluationError: Error | null;
  onRetryMyEvaluation: () => void;
  evaluators: EvaluatorDetailItem[];
  questions: InterviewQuestionItem[];
  /** 아직 고르지 않았으면 null. 판정을 고르기 전에는 저장할 수 없다. */
  decision: EvaluationDecision | null;
  /** 비워 두면 null. */
  score: number | null;
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

/** 개인 평가 전체 화면. 왼쪽은 지원서, 오른쪽은 내 평가 입력과 다른 평가자 결과다. */
export function ApplicantReviewDetail(p: ApplicantReviewDetailProps) {
  const a = p.applicant;
  const others = p.evaluators.filter((e) => e.admin_id !== p.currentEvaluatorId);
  const scored = p.evaluators.filter((e) => e.score !== null);
  const isFormLocked = p.isMyEvaluationLoading || p.myEvaluationError !== null;
  return (
    <div className="evaluation-page applicant-review">
      <div className="review-toolbar">
        <button onClick={p.onBack}>← 목록</button>
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
      <div className="review-layout">
        <article className="review-paper">
          <div className="review-person">
            <h1>{a.name}</h1>
            <span className="review-tag">{TRACK_LABELS[a.track]}</span>
          </div>
          <div className="review-meta">
            {[
              ['학교', a.university],
              ['전공', a.major],
              ['이메일', a.email],
              ['전화번호', a.phone],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                {value || '—'}
              </div>
            ))}
          </div>
          <details className="review-extra">
            <summary>지원자 정보 더 보기</summary>
            <div className="review-meta">
              {[
                ['부·복수전공', a.minor_double_major.join(', ')],
                ['마지막 학기', String(a.last_semester)],
                ['병역', a.military_status],
                ['생년월일', a.birth_date],
                ['졸업 예정', a.graduation_date],
                ['대학원 진학 계획', a.grad_school_plan ? '있음' : '없음'],
                ['제출 일시', a.submitted_at || '미제출'],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  {value || '—'}
                </div>
              ))}
            </div>
          </details>
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
                점수
              </label>
              <div className="review-score">
                <input
                  id="review-score"
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={p.score ?? ''}
                  onChange={(e) => p.onScore(e.target.value === '' ? null : e.target.valueAsNumber)}
                />
                <span>/ 10</span>
              </div>
              <span className="review-label" id="review-decision-label">
                개인 결정
              </span>
              <div className="review-choices" role="group" aria-labelledby="review-decision-label">
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
            <button
              className="review-submit"
              type="submit"
              disabled={p.saving || isFormLocked || p.decision === null}
            >
              {p.saving ? '저장 중…' : '평가 저장'}
            </button>
          </form>
          <section className="review-panel">
            <div className="review-heading">
              <h2>
                다른 평가 <span>{others.length}</span>
              </h2>
              <button
                type="button"
                onClick={() =>
                  alert(
                    '현재는 로컬 PoC 데이터입니다. 서버 새로고침은 API 연결 후 사용할 수 있습니다.',
                  )
                }
              >
                ↻ 새로고침
              </button>
            </div>
            <div className="review-summary">
              <span>
                평균{' '}
                {scored.length
                  ? (scored.reduce((sum, e) => sum + (e.score ?? 0), 0) / scored.length).toFixed(1)
                  : '—'}
                점
              </span>
              <span>
                {p.evaluators.filter((e) => e.decision !== null).length} / {p.evaluators.length}명
                완료
              </span>
            </div>
            {others.map((e) => (
              <details className="review-evaluator" key={e.admin_id}>
                <summary>
                  <strong>{e.name}</strong>
                  <span>{e.score === null ? '미평가' : e.score + '점'}</span>
                  <span>{e.decision ? DECISION_LABELS[e.decision] : ''}</span>
                </summary>
                <p>{e.memo || '아직 작성된 의견이 없습니다.'}</p>
              </details>
            ))}
            {!others.length && <p>아직 다른 평가가 없습니다.</p>}
          </section>
          <section className="review-panel">
            <details>
              <summary>면접 추천 질문 모아보기</summary>
              {p.questions.map((q) => (
                <div className="review-evaluator" key={q.admin_id}>
                  <strong>{q.name}</strong>
                  <p>{q.interview_question || '등록된 질문이 없습니다.'}</p>
                  {q.interview_question && (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(q.interview_question!)}
                    >
                      질문 복사
                    </button>
                  )}
                </div>
              ))}
            </details>
          </section>
        </aside>
      </div>
    </div>
  );
}
