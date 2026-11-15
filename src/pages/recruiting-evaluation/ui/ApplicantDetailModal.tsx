import { useRef } from 'react';
import { X } from 'lucide-react';

import { ApiError } from '@/shared/api/apiError';
import { dateTimeTextOf } from '@/shared/lib/date';
import { useDialogKeyboard } from '@/shared/lib/useDialogKeyboard';
import { useLoaded } from '@/shared/lib/useLoaded';

import { displayValue } from '../model/applicantList';
import {
  type ApplicantAnswerDto,
  type ApplicantEvaluationDto,
  APPLICATION_STATUS_LABELS,
  MILITARY_STATUS_LABELS,
  TRACK_LABELS,
} from '../model/types';
import { ApplicantAnswerList } from './ApplicantAnswerList';

interface ApplicantDetailModalProps {
  applicant: ApplicantEvaluationDto;
  fetchAnswers: (applicantIdKey: string) => Promise<ApplicantAnswerDto[]>;
  onClose: () => void;
  /** 지원서가 없어졌을 때(404) 창을 닫고 목록을 다시 읽는다. */
  onMissing: () => void;
  /** 제출 완료 지원서를 개인 평가 화면에서 연다. DRAFT에는 버튼을 두지 않는다. */
  onEvaluate: (applicantId: number) => void;
}

/** 전체 지원 현황의 지원서 상세(APP-06). 기본 정보와 답변을 보여 주는 조회 전용 창이다. */
export function ApplicantDetailModal({
  applicant,
  fetchAnswers,
  onClose,
  onMissing,
  onEvaluate,
}: ApplicantDetailModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogKeyboard(panelRef, onClose);
  const answers = useLoaded(String(applicant.id), fetchAnswers);
  const errorCode = answers.error instanceof ApiError ? answers.error.code : null;
  const titleId = `applicant-detail-${applicant.id}`;

  const fields: [string, string][] = [
    ['트랙', applicant.track ? TRACK_LABELS[applicant.track] : '-'],
    ['상태', APPLICATION_STATUS_LABELS[applicant.status]],
    ['이메일', displayValue(applicant.email)],
    ['전화번호', displayValue(applicant.phone)],
    ['대학교', displayValue(applicant.university)],
    ['전공', displayValue(applicant.major)],
    ['부·복수전공', displayValue(applicant.minor_double_major)],
    ['마지막 학기', displayValue(applicant.last_semester)],
    ['졸업 예정', displayValue(applicant.graduation_date)],
    ['병역', applicant.military_status ? MILITARY_STATUS_LABELS[applicant.military_status] : '-'],
    ['생년월일', displayValue(applicant.birth_date)],
    ['대학원 진학 계획', displayValue(applicant.grad_school_plan)],
    ['제출일', applicant.submitted_at ? dateTimeTextOf(applicant.submitted_at) : '-'],
  ];

  return (
    <div className="evaluation-detail-overlay fixed inset-0 z-60 flex items-center justify-center p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="evaluation-detail flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <div className="evaluation-detail-header flex items-center justify-between border-b border-slate-200">
          <h2 id={titleId} className="text-base font-bold">
            {displayValue(applicant.name)}
          </h2>
          <button type="button" aria-label="지원서 상세 닫기" onClick={onClose} className="px-2">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4">
          <div className="review-meta">
            {fields.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                {value}
              </div>
            ))}
          </div>

          {answers.isLoading && !answers.data && !answers.error && (
            <p className="review-answer py-6">지원서를 불러오는 중입니다.</p>
          )}
          {answers.error && (
            <div role="alert" className="flex flex-col items-start gap-3 py-6">
              <p className="text-sm font-semibold">
                {errorCode === 'APPLICATION_NOT_FOUND'
                  ? '지원서를 찾을 수 없습니다.'
                  : errorCode === 'ACCESS_DENIED'
                    ? '해당 지원서를 열람할 권한이 없습니다.'
                    : '지원서를 불러오지 못했습니다.'}
              </p>
              {errorCode === 'APPLICATION_NOT_FOUND' ? (
                <button type="button" onClick={onMissing} className="px-3">
                  닫고 목록 새로고침
                </button>
              ) : errorCode === 'ACCESS_DENIED' ? (
                <button type="button" onClick={onClose} className="px-3">
                  상세 닫기
                </button>
              ) : (
                <button type="button" onClick={answers.reload} className="px-3">
                  다시 시도
                </button>
              )}
            </div>
          )}
          {answers.data && !answers.error && <ApplicantAnswerList answers={answers.data} />}
        </div>

        {applicant.status === 'SUBMITTED' && (
          <div className="flex justify-end border-t border-slate-200 px-6 py-3">
            <button type="button" onClick={() => onEvaluate(applicant.id)} className="px-4">
              평가하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
