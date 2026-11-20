import { useEffect, useRef, useState } from 'react';
import { Pencil, RefreshCw } from 'lucide-react';

import { ApiError } from '@/shared/api/apiError';
import { useLoaded } from '@/shared/lib/useLoaded';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { ICON_BTN } from '@/shared/ui/systemStyles';
import type { ToastMessage } from '@/shared/ui/Toast';

import {
  aggregateEvaluations,
  mergeEvaluatorRecords,
  orderForViewer,
} from '../model/evaluationStatus';
import {
  type MyEvaluationDraft,
  type MyEvaluationErrors,
  SCORE_OPTIONS,
} from '../model/myEvaluationForm';
import {
  DECISION_LABELS,
  type EvaluationDecision,
  type EvaluatorDetailItem,
  type InterviewQuestionItem,
} from '../model/types';

/** 본인 행 편집. 개인 평가 탭과 같은 초안·검증·저장을 페이지가 맡고, 이 표는 그리기와 편집 여부만 가진다. */
export interface OwnRowEditing {
  draft: MyEvaluationDraft;
  errors: MyEvaluationErrors;
  saving: boolean;
  /** 내 평가를 읽는 중이거나 읽지 못했으면 편집을 막는다. */
  locked: boolean;
  onChange: (patch: Partial<MyEvaluationDraft>) => void;
  /** 편집을 시작해도 되는지. 저장하지 않은 입력이 있으면 페이지가 묻고, 초안을 저장값으로 되돌린다. */
  onStart: () => boolean;
  onCancel: () => void;
  /** 저장에 성공하면 true. 실패하면 페이지가 알리고 입력은 그대로 둔다. */
  onSave: () => Promise<boolean>;
}

interface EvaluatorResultsTabProps {
  /** 지원자가 바뀌면 부모가 key로 새로 그린다. 그래서 읽는 중에 보이는 값은 같은 지원자의 이전 결과다. */
  applicantId: number;
  currentEvaluatorId: number;
  fetchEvaluations: (applicantIdKey: string) => Promise<EvaluatorDetailItem[]>;
  fetchInterviewQuestions: (applicantIdKey: string) => Promise<InterviewQuestionItem[]>;
  /** 바뀌면 평가 기록을 다시 읽는다. 개인 평가 탭에서 저장한 뒤 현황을 맞출 때 쓴다. */
  refreshKey: number;
  editing: OwnRowEditing;
  /** 질문 복사 완료 안내. 토스트는 페이지가 하나만 그린다. */
  onNotify: (message: string, tone: ToastMessage['tone']) => void;
}

const COLUMNS = ['평가자', '판정', '점수', '메모', '면접 추천 질문'];

const DECISION_OPTIONS = (Object.keys(DECISION_LABELS) as EvaluationDecision[]).map((decision) => ({
  value: decision,
  label: DECISION_LABELS[decision],
}));
const SCORE_SELECT_OPTIONS = [
  { value: '', label: '점수 없음' },
  ...SCORE_OPTIONS.map((score) => ({ value: String(score), label: `${score}점` })),
];

/**
 * 운영진 평가 현황(GROUP-05·07, REC-ADMIN-15·19). 위에 판정 수·총점, 아래 표에 운영진별 판정·점수·메모·면접 추천 질문을 둔다.
 * 로그인한 평가자는 '(나)'로 맨 위에 두고 그 행만 고칠 수 있다. 다른 운영진 행은 조회만 한다.
 * shortcut: '(나)' 행이면 고칠 수 있게 둔다, 평가 API 연동 때 /accounts/me의 부문 권한(EVALUATION_*_TRACK_WRITE)도 확인한다
 */
export function EvaluatorResultsTab({
  applicantId,
  currentEvaluatorId,
  fetchEvaluations,
  fetchInterviewQuestions,
  refreshKey,
  editing,
  onNotify,
}: EvaluatorResultsTabProps) {
  const evaluations = useLoaded(String(applicantId), fetchEvaluations);
  const questions = useLoaded(String(applicantId), fetchInterviewQuestions);
  const [isEditing, setIsEditing] = useState(false);
  const error = evaluations.error ?? questions.error;
  const isLoading = evaluations.isLoading || questions.isLoading;
  const isLoaded = evaluations.data !== null && questions.data !== null;
  const rows = orderForViewer(
    mergeEvaluatorRecords(evaluations.data ?? [], questions.data ?? []),
    currentEvaluatorId,
  );
  // 판정 수는 PASS·HOLD·FAIL을 저장한 평가자 수다. 미평가(null)와 미결은 세지 않고, 총점은 null 점수를 뺀 합이다.
  const aggregate = aggregateEvaluations(rows);

  const reload = () => {
    evaluations.reload();
    questions.reload();
  };

  // 처음 그릴 때는 이미 읽고 있으므로 refreshKey가 바뀔 때만 다시 읽는다.
  const handledRefreshRef = useRef(refreshKey);
  const { reload: reloadEvaluations } = evaluations;
  const { reload: reloadQuestions } = questions;
  useEffect(() => {
    if (refreshKey === handledRefreshRef.current) return;
    handledRefreshRef.current = refreshKey;
    reloadEvaluations();
    reloadQuestions();
  }, [refreshKey, reloadEvaluations, reloadQuestions]);

  // 보안 연결이 아니거나 브라우저가 막으면 clipboard가 없거나 거절된다. 둘 다 실패 안내로 처리한다.
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify('질문이 복사되었습니다.', 'success');
    } catch {
      window.alert('질문을 복사하지 못했습니다. 질문을 직접 선택해 복사해주세요.');
    }
  };

  const handleSave = async () => {
    if (await editing.onSave()) setIsEditing(false);
  };

  const summary: [string, string][] = [
    ['합격', `${aggregate.pass_count}`],
    ['보류', `${aggregate.hold_count}`],
    ['불합', `${aggregate.fail_count}`],
    ['총점', `${aggregate.total_score}`],
  ];

  return (
    <section className="review-paper review-status" aria-labelledby="review-status-title">
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
      ) : (
        <>
          <dl className="review-status-summary" aria-label="운영진 평가 집계">
            {summary.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {rows.length === 0 ? (
            <p role="status">아직 등록된 평가가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]" aria-label="운영진별 평가 기록">
                <thead>
                  <tr>
                    {COLUMNS.map((label) => (
                      <th key={label} scope="col" className="px-3">
                        {label}
                      </th>
                    ))}
                    <th scope="col" className="px-3">
                      <span className="sr-only">수정</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isRowEditing = row.isMe && isEditing;
                    const { draft, errors } = editing;
                    return (
                      <tr key={row.admin_id}>
                        <td className="px-3 whitespace-nowrap">
                          {row.displayName}
                          {row.isMe && ' (나)'}
                        </td>
                        <td className="px-3 whitespace-nowrap">
                          {isRowEditing ? (
                            <>
                              <SelectDropdown
                                ariaLabel="내 판정"
                                value={draft.decision ?? ''}
                                options={
                                  draft.decision === null
                                    ? [{ value: '', label: '선택' }, ...DECISION_OPTIONS]
                                    : DECISION_OPTIONS
                                }
                                onChange={(decision) => decision && editing.onChange({ decision })}
                                buttonClassName="h-[30px] w-20"
                              />
                              {errors.decision && (
                                <p role="alert" className="review-field-error">
                                  {errors.decision}
                                </p>
                              )}
                            </>
                          ) : row.decision ? (
                            DECISION_LABELS[row.decision]
                          ) : (
                            '미평가'
                          )}
                        </td>
                        <td className="px-3 whitespace-nowrap">
                          {isRowEditing ? (
                            <>
                              <SelectDropdown
                                ariaLabel="내 점수"
                                value={draft.score === null ? '' : String(draft.score)}
                                options={SCORE_SELECT_OPTIONS}
                                onChange={(score) =>
                                  editing.onChange({ score: score === '' ? null : Number(score) })
                                }
                                buttonClassName="h-[30px] w-24"
                              />
                              {errors.score && (
                                <p role="alert" className="review-field-error">
                                  {errors.score}
                                </p>
                              )}
                            </>
                          ) : row.score === null ? (
                            '-'
                          ) : (
                            row.score
                          )}
                        </td>
                        <td className="review-status-text px-3">
                          {isRowEditing ? (
                            <textarea
                              aria-label="내 평가 메모"
                              value={draft.memo}
                              onChange={(e) => editing.onChange({ memo: e.target.value })}
                            />
                          ) : (
                            row.memo || '-'
                          )}
                        </td>
                        <td className="review-status-text px-3">
                          {isRowEditing ? (
                            <textarea
                              aria-label="내 면접 추천 질문"
                              value={draft.interview_question}
                              onChange={(e) =>
                                editing.onChange({ interview_question: e.target.value })
                              }
                            />
                          ) : row.interview_question ? (
                            <div className="review-record-question">
                              <span>{row.interview_question}</span>
                              <button
                                type="button"
                                aria-label={`${row.displayName} 질문 복사`}
                                onClick={() => void handleCopy(row.interview_question ?? '')}
                              >
                                복사
                              </button>
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 whitespace-nowrap">
                          {isRowEditing ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={editing.saving}
                                onClick={() => void handleSave()}
                              >
                                {editing.saving ? '저장 중…' : '저장'}
                              </button>
                              <button
                                type="button"
                                disabled={editing.saving}
                                onClick={() => {
                                  editing.onCancel();
                                  setIsEditing(false);
                                }}
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            row.isMe && (
                              <button
                                type="button"
                                aria-label="내 평가 수정"
                                title="수정"
                                disabled={editing.locked}
                                onClick={() => editing.onStart() && setIsEditing(true)}
                                className={ICON_BTN}
                              >
                                <Pencil size={14} aria-hidden="true" />
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
