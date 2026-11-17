import { useState } from 'react';
import { ArrowDown, ArrowUp, Edit3, Plus, Trash2 } from 'lucide-react';

import type { QuestionCreateItem } from '@/entities/recruitment/model/dto';
import type { QuestionsState } from '@/entities/recruitment/model/useQuestions';
import type {
  Question,
  QuestionCategory,
  QuestionType,
  Recruitment,
} from '@/entities/recruitment/model/types';
import { alertApiError } from '@/shared/lib/alertApiError';
import { BRAND_SELECTED } from '@/shared/ui/modalStyles';
import { Btn } from '@/shared/ui/Btn';
import { DataLoadFailedNotice } from '@/shared/ui/DataLoadFailedNotice';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { FIELD_INPUT, FIELD_LABEL, ICON_BTN } from '@/shared/ui/systemStyles';

import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  moveQuestionChanges,
  nextOrderNum,
} from '../model/recruitmentView';
import { RecruitingDialog } from './RecruitingDialog';

const TYPE_LABEL: Record<QuestionType, string> = {
  TEXT: '글 작성형 (TEXT)',
  TABLE: '표 형식 (TABLE)',
};
/** 백엔드 application_question.label 열 길이. */
const LABEL_MAX_LENGTH = 20;

/** 등록·수정 창의 입력값. questionId가 null이면 새 문항이다. */
interface QuestionDraft {
  questionId: number | null;
  /** 수정 전 분류·순서 번호. 분류를 바꾸면 새 분류의 마지막 번호로 옮긴다. */
  original: { category: QuestionCategory; orderNum: number } | null;
  label: string;
  category: QuestionCategory;
  type: QuestionType;
  content: string;
  description: string;
  limitLength: string;
  multiple: boolean;
  columns: string[];
  rows: string[];
  isRequired: boolean;
}

function draftOf(question: Question): QuestionDraft {
  return {
    questionId: question.question_id,
    original: { category: question.category, orderNum: question.order_num },
    label: question.label,
    category: question.category,
    type: question.type,
    content: question.content,
    description: question.description ?? '',
    limitLength: question.type === 'TEXT' ? String(question.limit_length) : '800',
    multiple: question.type === 'TABLE' && question.metadata.multiple === true,
    columns: question.type === 'TABLE' ? [...(question.metadata.columns ?? [])] : ['항목'],
    rows: question.type === 'TABLE' ? [...(question.metadata.rows ?? [])] : [],
    isRequired: question.is_required,
  };
}

const newDraft = (category: QuestionCategory): QuestionDraft => ({
  questionId: null,
  original: null,
  label: '',
  category,
  type: 'TEXT',
  content: '',
  description: '',
  limitLength: '800',
  multiple: false,
  columns: ['항목'],
  rows: [],
  isRequired: true,
});

/** 입력값을 검사한다. 라벨·순서 번호 중복은 서버가 막는다. */
function draftProblem(draft: QuestionDraft): string | null {
  if (!draft.label.trim()) return '문항 라벨을 입력해 주세요.';
  if (!draft.content.trim()) return '문항 내용을 입력해 주세요.';
  if (draft.type === 'TEXT') {
    const limit = Number(draft.limitLength);
    if (!Number.isInteger(limit) || limit <= 0) {
      return '글자 수 제한은 1 이상의 정수로 입력해 주세요.';
    }
  } else if (draft.columns.every((column) => !column.trim())) {
    return '표 형식 문항에는 열이 하나 이상 있어야 합니다.';
  }
  return null;
}

/** 입력값을 서버로 보낼 문항 값으로 바꾼다. 유형에 맞는 값만 채운다. */
function itemOf(draft: QuestionDraft, orderNum: number): QuestionCreateItem {
  const description = draft.description.trim();
  return {
    label: draft.label.trim(),
    category: draft.category,
    type: draft.type,
    content: draft.content.trim(),
    ...(description ? { description } : {}),
    ...(draft.type === 'TEXT'
      ? { limit_length: Number(draft.limitLength) }
      : {
          metadata: {
            multiple: draft.multiple,
            columns: draft.columns.map((column) => column.trim()).filter(Boolean),
            rows: draft.rows.map((row) => row.trim()).filter(Boolean),
          },
        }),
    order_num: orderNum,
    is_required: draft.isRequired,
  };
}

/** 표 형식 문항의 열·행 이름 목록 편집기. */
function NameListEditor({
  label,
  names,
  onChange,
}: {
  label: string;
  names: string[];
  onChange: (names: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">
          {label} ({names.length}개)
        </span>
        <Btn size="xs" variant="outline" onClick={() => onChange([...names, ''])}>
          <Plus size={12} /> {label} 추가
        </Btn>
      </div>
      {names.map((name, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={name}
            onChange={(event) =>
              onChange(names.map((item, i) => (i === index ? event.target.value : item)))
            }
            aria-label={`${label} ${index + 1}`}
            className={FIELD_INPUT}
          />
          <button
            type="button"
            onClick={() => onChange(names.filter((_, i) => i !== index))}
            aria-label={`${label} ${index + 1} 삭제`}
            className={ICON_BTN}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

interface QuestionsTabProps {
  recruitments: Recruitment[];
  recruitmentId: number | null;
  onSelectRecruitment: (recruitmentId: number) => void;
  state: QuestionsState;
  onToast: (message: string) => void;
}

/** 지원서 문항 설정(REC-QST). 공고를 골라 분류별 문항을 추가·수정·삭제하고 순서를 바꾼다. */
export function QuestionsTab({
  recruitments,
  recruitmentId,
  onSelectRecruitment,
  state,
  onToast,
}: QuestionsTabProps) {
  const [filter, setFilter] = useState<'ALL' | QuestionCategory>('ALL');
  const [draft, setDraft] = useState<QuestionDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const questions = state.questions ?? [];
  const shown = questions.filter((q) => filter === 'ALL' || q.category === filter);

  const handleSave = async () => {
    if (!draft) return;
    const problem = draftProblem(draft);
    if (problem) {
      window.alert(problem);
      return;
    }
    const orderNum =
      draft.original?.category === draft.category
        ? draft.original.orderNum
        : nextOrderNum(questions, draft.category);
    const item = itemOf(draft, orderNum);
    setIsSaving(true);
    try {
      if (draft.questionId === null) {
        await state.create(item);
      } else {
        // 지운 값(안내 문구, 유형에 맞지 않는 값)은 null로 보내야 서버에서도 지워진다.
        await state.update([
          {
            questionId: draft.questionId,
            request: { description: null, limit_length: null, metadata: null, ...item },
          },
        ]);
      }
    } catch (error) {
      alertApiError(error);
      return;
    } finally {
      setIsSaving(false);
    }
    setDraft(null);
    onToast(`'${item.label}' 문항을 저장했습니다.`);
  };

  const handleMove = async (question: Question, direction: 'UP' | 'DOWN') => {
    const changes = moveQuestionChanges(questions, question.question_id, direction);
    if (changes.length === 0) return;
    setBusyId(question.question_id);
    try {
      await state.update(changes);
    } catch (error) {
      alertApiError(error);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (question: Question) => {
    if (
      !window.confirm(
        `'${question.label}' 문항을 삭제할까요?\n지원자 답변이 있는 문항은 삭제할 수 없습니다.`,
      )
    ) {
      return;
    }
    setBusyId(question.question_id);
    try {
      await state.remove(question.question_id);
    } catch (error) {
      alertApiError(error);
      return;
    } finally {
      setBusyId(null);
    }
    onToast(`'${question.label}' 문항을 삭제했습니다.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">지원서 문항 설정</h2>
          <p className="mt-1 text-xs text-slate-500">
            공고별로 공통 문항과 트랙별 문항, 표 형식 문항의 행·열을 설정합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {recruitmentId !== null && (
            <SelectDropdown
              ariaLabel="문항을 설정할 모집 공고"
              value={String(recruitmentId)}
              options={recruitments.map((r) => ({
                value: String(r.recruitment_id),
                label: `제${r.term}기 공고`,
              }))}
              onChange={(value) => onSelectRecruitment(Number(value))}
              buttonClassName="h-8 w-32"
            />
          )}
          <Btn
            onClick={() => setDraft(newDraft(filter === 'ALL' ? 'COMMON' : filter))}
            disabled={state.questions === null}
          >
            <Plus size={14} /> 새 문항 추가
          </Btn>
        </div>
      </div>

      {recruitmentId === null && (
        <p className="text-xs text-slate-500">문항을 설정하려면 모집 공고를 먼저 등록해 주세요.</p>
      )}
      {state.error && <DataLoadFailedNotice onRetry={state.reload} />}
      {recruitmentId !== null && state.questions === null && !state.error && (
        <p className="text-xs text-slate-500">문항을 불러오는 중입니다.</p>
      )}

      {state.questions && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="분류 선택">
          {(['ALL', ...CATEGORY_ORDER] as const).map((category) => {
            const count =
              category === 'ALL'
                ? questions.length
                : questions.filter((q) => q.category === category).length;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setFilter(category)}
                aria-pressed={filter === category}
                className={`cursor-pointer rounded-sm border px-3 py-1 text-xs font-semibold ${
                  filter === category
                    ? BRAND_SELECTED
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {category === 'ALL' ? '전체' : CATEGORY_LABEL[category]} ({count})
              </button>
            );
          })}
        </div>
      )}
      {state.questions && shown.length === 0 && (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">
          등록된 문항이 없습니다.
        </p>
      )}

      {shown.map((question) => (
        <section
          key={question.question_id}
          className="space-y-3 rounded-md border border-slate-200 bg-white p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                {CATEGORY_LABEL[question.category]}
              </span>
              <span className="text-sm font-bold text-slate-900">[{question.label}]</span>
              {question.is_required && (
                <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-600">
                  필수
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleMove(question, 'UP')}
                disabled={busyId !== null}
                aria-label={`${question.label} 위로 이동`}
                className={`${ICON_BTN} disabled:opacity-40`}
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                onClick={() => void handleMove(question, 'DOWN')}
                disabled={busyId !== null}
                aria-label={`${question.label} 아래로 이동`}
                className={`${ICON_BTN} disabled:opacity-40`}
              >
                <ArrowDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => setDraft(draftOf(question))}
                aria-label={`${question.label} 수정`}
                className={ICON_BTN}
              >
                <Edit3 size={13} />
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(question)}
                disabled={busyId !== null}
                aria-label={`${question.label} 삭제`}
                className={`${ICON_BTN} hover:text-red-600 disabled:opacity-40`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <p className="text-sm font-semibold leading-relaxed text-slate-800">{question.content}</p>
          {question.description && (
            <p className="text-xs text-slate-500">안내: {question.description}</p>
          )}
          {question.type === 'TABLE' && (
            <div className="space-y-1 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
              <p>열: {(question.metadata.columns ?? []).join(' · ') || '없음'}</p>
              <p>행: {(question.metadata.rows ?? []).join(' · ') || '없음'}</p>
            </div>
          )}
          <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">
            {TYPE_LABEL[question.type]} ·{' '}
            {question.type === 'TEXT'
              ? `${question.limit_length}자 이내`
              : question.metadata.multiple
                ? '복수 응답 허용'
                : '단일 응답'}
          </p>
        </section>
      ))}

      {draft && (
        <RecruitingDialog
          title={draft.questionId === null ? '새 지원서 문항 추가' : '문항 수정'}
          isSaving={isSaving}
          onClose={() => setDraft(null)}
          onSave={() => void handleSave()}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={FIELD_LABEL}>트랙 구분</span>
              <SelectDropdown
                ariaLabel="트랙 구분"
                value={draft.category}
                options={CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
                onChange={(category) => setDraft({ ...draft, category })}
                buttonClassName="h-10 w-full"
              />
            </div>
            <div>
              <label htmlFor="question-label" className={FIELD_LABEL}>
                문항 라벨 (예: 공통1, {LABEL_MAX_LENGTH}자까지)
              </label>
              <input
                id="question-label"
                value={draft.label}
                maxLength={LABEL_MAX_LENGTH}
                onChange={(event) => setDraft({ ...draft, label: event.target.value })}
                className={FIELD_INPUT}
              />
            </div>
          </div>
          <div>
            <label htmlFor="question-content" className={FIELD_LABEL}>
              문항 내용 (지원자에게 보이는 질문)
            </label>
            <textarea
              id="question-content"
              rows={3}
              value={draft.content}
              onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              className={`${FIELD_INPUT} h-auto py-2`}
            />
          </div>
          <div>
            <label htmlFor="question-description" className={FIELD_LABEL}>
              답변 작성 안내 (선택)
            </label>
            <input
              id="question-description"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              className={FIELD_INPUT}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={FIELD_LABEL}>문항 유형</span>
              <SelectDropdown
                ariaLabel="문항 유형"
                value={draft.type}
                options={(['TEXT', 'TABLE'] as const).map((t) => ({
                  value: t,
                  label: TYPE_LABEL[t],
                }))}
                onChange={(type) => setDraft({ ...draft, type })}
                buttonClassName="h-10 w-full"
              />
            </div>
            {draft.type === 'TEXT' ? (
              <div>
                <label htmlFor="question-limit" className={FIELD_LABEL}>
                  글자 수 제한
                </label>
                <input
                  id="question-limit"
                  type="number"
                  min={1}
                  value={draft.limitLength}
                  onChange={(event) => setDraft({ ...draft, limitLength: event.target.value })}
                  className={FIELD_INPUT}
                />
              </div>
            ) : (
              <label className="flex items-end gap-2 pb-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={draft.multiple}
                  onChange={(event) => setDraft({ ...draft, multiple: event.target.checked })}
                  className="size-4"
                />
                복수 응답 허용 (multiple)
              </label>
            )}
          </div>
          {draft.type === 'TABLE' && (
            <div className="space-y-4 rounded-md border border-slate-200 p-4">
              <NameListEditor
                label="열"
                names={draft.columns}
                onChange={(columns) => setDraft({ ...draft, columns })}
              />
              <NameListEditor
                label="행"
                names={draft.rows}
                onChange={(rows) => setDraft({ ...draft, rows })}
              />
            </div>
          )}
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={draft.isRequired}
              onChange={(event) => setDraft({ ...draft, isRequired: event.target.checked })}
              className="size-4"
            />
            필수 응답
          </label>
        </RecruitingDialog>
      )}
    </div>
  );
}
