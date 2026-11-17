import { useState } from 'react';
import { BookOpen, Calendar, Clock, Edit3, Plus, Trash2 } from 'lucide-react';

import type { RecruitmentsState } from '@/entities/recruitment/model/useRecruitments';
import type { Recruitment } from '@/entities/recruitment/model/types';
import { alertApiError } from '@/shared/lib/alertApiError';
import { Btn } from '@/shared/ui/Btn';
import { DataLoadFailedNotice } from '@/shared/ui/DataLoadFailedNotice';
import { FIELD_INPUT, FIELD_LABEL, ICON_BTN } from '@/shared/ui/systemStyles';

import {
  nowDateTime,
  recruitmentStatusOf,
  scheduleStepsOf,
  toDateTime,
  type RecruitmentStatus,
} from '../model/recruitmentView';
import { RecruitingDialog } from './RecruitingDialog';

const STATUS_BADGE: Record<RecruitmentStatus, { label: string; className: string }> = {
  UPCOMING: { label: '모집 예정', className: 'bg-slate-100 text-slate-700' },
  ACTIVE: { label: '모집 진행 중', className: 'bg-slate-900 text-white' },
  CLOSED: { label: '모집 마감', className: 'bg-slate-100 text-slate-500' },
};

/** 등록·수정 창의 입력값. recruitmentId가 null이면 새 공고다. */
interface PostDraft {
  recruitmentId: number | null;
  term: string;
  /** 'YYYY-MM-DD' */
  startDate: string;
  endDate: string;
  brochureUrl: string;
}

const today = () => nowDateTime().slice(0, 10);

function draftOf(recruitment: Recruitment): PostDraft {
  return {
    recruitmentId: recruitment.recruitment_id,
    term: String(recruitment.term),
    startDate: recruitment.start_date.slice(0, 10),
    endDate: recruitment.end_date.slice(0, 10),
    brochureUrl: recruitment.brochure_url ?? '',
  };
}

/** 입력값을 검사한다. 문제가 있으면 안내 문구, 없으면 null. 기수 중복은 서버가 막는다. */
function draftProblem(draft: PostDraft): string | null {
  const term = Number(draft.term);
  if (!Number.isInteger(term) || term <= 0) return '모집 기수는 1 이상의 정수로 입력해 주세요.';
  if (!draft.startDate || !draft.endDate) return '접수 시작일과 마감일을 입력해 주세요.';
  if (draft.endDate < draft.startDate) return '접수 마감일은 시작일과 같거나 뒤여야 합니다.';
  return null;
}

interface PostsTabProps {
  state: RecruitmentsState;
  onToast: (message: string) => void;
}

/** 모집 공고 관리(REC-POST). 목록·등록·수정·삭제와 홍보 책자 열기. */
export function PostsTab({ state, onToast }: PostsTabProps) {
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const now = nowDateTime();

  const openNew = () => {
    const latestTerm = state.recruitments?.[0]?.term ?? 0;
    setDraft({
      recruitmentId: null,
      term: String(latestTerm + 1),
      startDate: today(),
      endDate: today(),
      brochureUrl: '',
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    const problem = draftProblem(draft);
    if (problem) {
      window.alert(problem);
      return;
    }
    const period = {
      term: Number(draft.term),
      start_date: toDateTime(draft.startDate, 'start'),
      end_date: toDateTime(draft.endDate, 'end'),
    };
    const brochureUrl = draft.brochureUrl.trim();
    setIsSaving(true);
    try {
      if (draft.recruitmentId === null) {
        // 전형 일정 편집(POST-06)은 디자인 확정 뒤에 만든다. 그 전에는 서류 접수 단계 하나로 등록한다.
        await state.create({
          ...period,
          schedule: [{ step: '서류 접수', startDate: draft.startDate, endDate: draft.endDate }],
          ...(brochureUrl ? { brochure_url: brochureUrl } : {}),
        });
      } else {
        await state.update(draft.recruitmentId, { ...period, brochure_url: brochureUrl || null });
      }
    } catch (error) {
      alertApiError(error); // 입력은 그대로 둔다
      return;
    } finally {
      setIsSaving(false);
    }
    setDraft(null);
    onToast(`제${period.term}기 모집 공고를 저장했습니다.`);
  };

  const handleDelete = async (recruitment: Recruitment) => {
    if (
      !window.confirm(
        `제${recruitment.term}기 모집 공고를 삭제할까요?\n문항이나 지원자가 있는 공고는 삭제할 수 없습니다.`,
      )
    ) {
      return;
    }
    setDeletingId(recruitment.recruitment_id);
    try {
      await state.remove(recruitment.recruitment_id);
    } catch (error) {
      alertApiError(error);
      return;
    } finally {
      setDeletingId(null);
    }
    onToast(`제${recruitment.term}기 모집 공고를 삭제했습니다.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">모집 공고 관리</h2>
          <p className="mt-1 text-xs text-slate-500">
            기수별 접수 기간, 전형 일정, 홍보 책자를 관리합니다.
          </p>
        </div>
        <Btn onClick={openNew} disabled={state.recruitments === null}>
          <Plus size={14} /> 새 모집 공고 등록
        </Btn>
      </div>

      {state.error && <DataLoadFailedNotice onRetry={state.reload} />}
      {state.recruitments === null && !state.error && (
        <p className="text-xs text-slate-500">모집 공고를 불러오는 중입니다.</p>
      )}
      {state.recruitments?.length === 0 && (
        <p className="rounded-md border border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">
          등록된 모집 공고가 없습니다.
        </p>
      )}

      {state.recruitments?.map((recruitment) => {
        const status = STATUS_BADGE[recruitmentStatusOf(recruitment, now)];
        const steps = scheduleStepsOf(recruitment.schedule);
        return (
          <section
            key={recruitment.recruitment_id}
            className="space-y-4 rounded-md border border-slate-200 bg-white p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-800">
                    제{recruitment.term}기
                  </span>
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${status.className}`}>
                    {status.label}
                  </span>
                </div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900">
                  BOAZ 제{recruitment.term}기 정규 신입 부원 모집
                </h3>
                <p className="flex items-center gap-2 text-xs text-slate-600">
                  <Calendar size={13} className="text-slate-500" aria-hidden="true" />
                  접수 기간:
                  <strong className="text-slate-900">
                    {recruitment.start_date.replace('T', ' ')} ~{' '}
                    {recruitment.end_date.replace('T', ' ')}
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {recruitment.brochure_url ? (
                  <a
                    href={recruitment.brochure_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-sm border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <BookOpen size={13} aria-hidden="true" />
                    홍보 책자 (PDF)
                  </a>
                ) : (
                  <span className="text-xs text-slate-500">홍보 책자 미등록</span>
                )}
                <Btn variant="outline" onClick={() => setDraft(draftOf(recruitment))}>
                  <Edit3 size={13} /> 수정
                </Btn>
                <button
                  type="button"
                  onClick={() => void handleDelete(recruitment)}
                  disabled={deletingId === recruitment.recruitment_id}
                  aria-label={`제${recruitment.term}기 모집 공고 삭제`}
                  className={`${ICON_BTN} hover:text-red-600 disabled:opacity-40`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {steps.length > 0 && (
              <div className="space-y-2 border-t border-slate-100 pt-4">
                <p className="flex items-center gap-1 text-xs font-bold text-slate-700">
                  <Clock size={13} className="text-slate-500" aria-hidden="true" />
                  전형별 상세 일정
                </p>
                <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {steps.map((step, index) => (
                    <li
                      key={`${step.step}-${index}`}
                      className="rounded-md border border-slate-200 p-2 text-xs"
                    >
                      <p className="font-bold text-slate-800">{step.step}</p>
                      <p className="mt-1 text-slate-500">
                        {step.startDate === step.endDate
                          ? step.startDate
                          : `${step.startDate} ~ ${step.endDate}`}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        );
      })}

      {draft && (
        <RecruitingDialog
          title={draft.recruitmentId === null ? '새 모집 공고 등록' : '모집 공고 수정'}
          isSaving={isSaving}
          onClose={() => setDraft(null)}
          onSave={() => void handleSave()}
        >
          <div>
            <label htmlFor="post-term" className={FIELD_LABEL}>
              모집 기수
            </label>
            <input
              id="post-term"
              type="number"
              min={1}
              value={draft.term}
              onChange={(event) => setDraft({ ...draft, term: event.target.value })}
              className={FIELD_INPUT}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="post-start" className={FIELD_LABEL}>
                접수 시작일 (0시부터)
              </label>
              <input
                id="post-start"
                type="date"
                value={draft.startDate}
                onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <label htmlFor="post-end" className={FIELD_LABEL}>
                접수 마감일 (23시 59분까지)
              </label>
              <input
                id="post-end"
                type="date"
                value={draft.endDate}
                onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                className={FIELD_INPUT}
              />
            </div>
          </div>
          <div>
            <label htmlFor="post-brochure" className={FIELD_LABEL}>
              홍보 책자 PDF 주소 (선택)
            </label>
            <input
              id="post-brochure"
              type="url"
              value={draft.brochureUrl}
              onChange={(event) => setDraft({ ...draft, brochureUrl: event.target.value })}
              placeholder="https://..."
              className={FIELD_INPUT}
            />
          </div>
        </RecruitingDialog>
      )}
    </div>
  );
}
