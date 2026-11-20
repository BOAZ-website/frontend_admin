import { useRef } from 'react';
import { X } from 'lucide-react';

import { useDialogKeyboard } from '@/shared/lib/useDialogKeyboard';

import { applicantInfoFields, displayValue } from '../model/applicantList';
import type { ApplicantAnswerDto, ApplicantEvaluationDto } from '../model/types';
import { ApplicantAnswersSection } from './ApplicantAnswersSection';

interface ApplicantDetailModalProps {
  applicant: ApplicantEvaluationDto;
  fetchAnswers: (applicantIdKey: string) => Promise<ApplicantAnswerDto[]>;
  onClose: () => void;
  /** 지원서가 없어졌을 때(404) 창을 닫고 목록을 다시 읽는다. */
  onMissing: () => void;
  /** 제출 완료 지원서를 개인 평가 화면에서 연다. 없거나 DRAFT면 버튼을 두지 않는다(합격자 부원 등록은 조회만). */
  onEvaluate?: (applicantId: number) => void;
}

/** 지원서 상세(APP-06). 기본 정보와 답변을 보여 주는 조회 전용 창이다. 전체 지원 현황과 합격자 부원 등록이 쓴다. */
export function ApplicantDetailModal({
  applicant,
  fetchAnswers,
  onClose,
  onMissing,
  onEvaluate,
}: ApplicantDetailModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // 바깥 배경에서 누르기 시작해 바깥에서 뗐을 때만 닫는다. 창 안에서 글자를 끌어 선택하다 바깥에서 떼도 닫히지 않는다.
  const isBackdropPressRef = useRef(false);
  useDialogKeyboard(panelRef, onClose);
  const titleId = `applicant-detail-${applicant.id}`;

  const fields = applicantInfoFields(applicant);

  return (
    <div
      className="evaluation-detail-overlay fixed inset-0 z-60 flex items-center justify-center p-4"
      onMouseDown={(event) => {
        isBackdropPressRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (isBackdropPressRef.current && event.target === event.currentTarget) onClose();
      }}
    >
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

          <ApplicantAnswersSection
            applicantId={applicant.id}
            fetchAnswers={fetchAnswers}
            missingAction={{ label: '닫고 목록 새로고침', onClick: onMissing }}
            deniedAction={{ label: '상세 닫기', onClick: onClose }}
          />
        </div>

        {onEvaluate && applicant.status === 'SUBMITTED' && (
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
