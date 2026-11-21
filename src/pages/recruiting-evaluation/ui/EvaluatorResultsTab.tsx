import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';

import { ApiError } from '@/shared/api/apiError';
import { useLoaded } from '@/shared/lib/useLoaded';
import { RefreshButton } from '@/shared/ui/RefreshButton';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { ICON_BTN } from '@/shared/ui/systemStyles';
import type { ToastMessage } from '@/shared/ui/Toast';

import {
  aggregateEvaluations,
  mergeEvaluatorRecords,
  orderForViewer,
} from '../model/evaluationStatus';
import {
  DEFAULT_SCORE,
  type MyEvaluationDraft,
  SCORE_OPTIONS,
  validateMyEvaluation,
} from '../model/myEvaluationForm';
import {
  DECISION_LABELS,
  type EvaluatorDetailItem,
  type InterviewQuestionItem,
  SELECTABLE_DECISIONS,
} from '../model/types';

/** 본인 행 편집. 개인 평가 탭과 같은 초안·검증·저장을 페이지가 맡고, 이 표는 그리기와 편집 여부만 가진다. */
export interface OwnRowEditing {
  draft: MyEvaluationDraft;
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

// 서류 평가 목록 표(MyEvaluationList)와 같은 방식: 짧은 열은 고정 너비, 메모·면접 추천 질문은 남는 너비를 나눠 쓴다.
const COLUMNS: { label: string; width?: string }[] = [
  { label: '평가자', width: '112px' },
  { label: '평가', width: '112px' },
  { label: '점수', width: '120px' },
  { label: '메모' },
  { label: '면접 추천 질문' },
];
const EDIT_WIDTH = '120px';

// 고를 수 있는 판정은 합격·보류·불합격이다. 미평가(null)는 처음 값으로만 보여 준다.
const DECISION_OPTIONS = SELECTABLE_DECISIONS.map((decision) => ({
  value: decision,
  label: DECISION_LABELS[decision],
}));
const SCORE_SELECT_OPTIONS = SCORE_OPTIONS.map((score) => ({
  value: String(score),
  label: `${score}점`,
}));

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
  // 판정 수는 PASS·HOLD·FAIL을 저장한 평가자 수다. 미평가(null)와 미정은 세지 않고, 총점은 null 점수를 뺀 합이다.
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

  // 입력 오류는 행 안에 쓰지 않고 브라우저 알림 창으로 알린다(행 높이가 바뀌지 않게).
  const handleSave = async () => {
    const message = Object.values(validateMyEvaluation(editing.draft))[0];
    if (message) {
      window.alert(message);
      return;
    }
    if (await editing.onSave()) setIsEditing(false);
  };

  const summary: [string, string][] = [
    ['합격', `${aggregate.pass_count}`],
    ['보류', `${aggregate.hold_count}`],
    ['불합', `${aggregate.fail_count}`],
    ['총점수', `${aggregate.total_score}`],
  ];

  return (
    <section className="review-paper review-status" aria-label="운영진 평가 현황">
      {/* 제목은 위의 탭 이름과 겹쳐 두지 않고 새로고침만 오른쪽에 둔다. */}
      <div className="flex justify-end">
        <RefreshButton
          ariaLabel="운영진 평가 현황 새로고침"
          isLoading={isLoading}
          onClick={reload}
        />
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
            <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
              <table
                className="w-full min-w-[760px] table-fixed text-xs"
                aria-label="운영진별 평가 기록"
              >
                <colgroup>
                  {COLUMNS.map((column) => (
                    <col key={column.label} style={{ width: column.width }} />
                  ))}
                  <col style={{ width: EDIT_WIDTH }} />
                </colgroup>
                <thead>
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column.label} scope="col" className="px-4 py-3 text-left">
                        {column.label}
                      </th>
                    ))}
                    <th scope="col" className="px-4 py-3">
                      <span className="sr-only">수정</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isRowEditing = row.isMe && isEditing;
                    const { draft } = editing;
                    return (
                      <tr key={row.admin_id}>
                        <td className="px-4 whitespace-nowrap">{row.displayName}</td>
                        <td className="px-4 whitespace-nowrap">
                          {isRowEditing ? (
                            <SelectDropdown
                              ariaLabel="내 판정"
                              value={draft.decision ?? ''}
                              options={
                                draft.decision === null
                                  ? [{ value: '', label: '미정' }, ...DECISION_OPTIONS]
                                  : DECISION_OPTIONS
                              }
                              onChange={(decision) => decision && editing.onChange({ decision })}
                              buttonClassName="h-[30px] w-20"
                            />
                          ) : row.decision ? (
                            DECISION_LABELS[row.decision]
                          ) : (
                            '미정'
                          )}
                        </td>
                        <td className="px-4 whitespace-nowrap">
                          {isRowEditing ? (
                            <SelectDropdown
                              ariaLabel="내 점수"
                              value={String(draft.score ?? DEFAULT_SCORE)}
                              options={SCORE_SELECT_OPTIONS}
                              onChange={(score) => editing.onChange({ score: Number(score) })}
                              buttonClassName="h-[30px] w-24"
                            />
                          ) : (
                            row.score
                          )}
                        </td>
                        <td className="review-status-text px-4">
                          {isRowEditing ? (
                            <textarea
                              aria-label="내 평가 메모"
                              value={draft.memo}
                              onChange={(e) => editing.onChange({ memo: e.target.value })}
                            />
                          ) : (
                            row.memo
                          )}
                        </td>
                        <td className="review-status-text px-4">
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
                          ) : null}
                        </td>
                        <td className="px-4 whitespace-nowrap">
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
