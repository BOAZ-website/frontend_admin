import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import type { RosterKind } from '@/entities/cohort/model/dto';
import type { SeasonInput } from '@/entities/cohort/model/season';
import { useDialogKeyboard } from '@/shared/lib/useDialogKeyboard';
import {
  FIELD_TEXT_BTN,
  MODAL_CANCEL_BTN,
  MODAL_CLOSE_BTN,
  MODAL_CONFIRM_BTN,
} from '@/shared/ui/systemStyles';

import { useSeasonPreview } from '../model/useSeasonPreview';
import { RosterSection } from './RosterSection';

interface RosterConfirmDialogProps {
  /** 적용할 반기 입력. 이 값으로 서버가 자동 명단을 계산한다(ATT-82). */
  input: SeasonInput;
  kindOf: (term: number) => RosterKind;
  isSaving: boolean;
  onCancel: () => void;
  /** 진행 예정 반기를 만든다(적용). */
  onConfirm: () => void;
}

/**
 * 새 반기 명단 확인 창. BASE·ADV 기수의 활동 중 회원으로 만들어질 명단을 보여 주고 적용한다.
 * 빼거나 더하는 일은 반기를 만든 뒤 반기 화면의 「명단」에서 한다(백엔드 ATT-03은 명단을 받지 않는다).
 */
export function RosterConfirmDialog({
  input,
  kindOf,
  isSaving,
  onCancel,
  onConfirm,
}: RosterConfirmDialogProps) {
  const preview = useSeasonPreview(input);
  const semesterName = input.name;
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // 적용 요청 중에는 닫지 않는다(고른 명단을 잃는 일을 막는다).
  const requestClose = () => {
    if (!isSaving) onCancel();
  };
  useDialogKeyboard(panelRef, requestClose);
  // 열 때 창으로 포커스를 옮기고, 닫히면 창을 연 버튼으로 돌려준다.
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-confirm-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div
        ref={panelRef}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h3 id="roster-confirm-title" className="truncate text-base font-bold text-slate-900">
            {semesterName} 명단 확인
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={requestClose}
            disabled={isSaving}
            aria-label="창 닫기"
            className={`shrink-0 ${MODAL_CLOSE_BTN}`}
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-4">
          {preview.error && (
            <p role="status" className="text-xs text-red-600">
              명단을 불러오지 못했습니다.{' '}
              <button type="button" className={FIELD_TEXT_BTN} onClick={preview.reload}>
                다시 불러오기
              </button>
            </p>
          )}
          {preview.conflict && (
            <p role="status" className="text-xs text-red-600">
              {preview.conflict}
            </p>
          )}
          {preview.members ? (
            <RosterSection
              saved={preview.members}
              excludedIds={new Set()}
              added={[]}
              kindOf={kindOf}
              isReadOnly
              isSaving={isSaving}
            />
          ) : (
            !preview.error && (
              <p role="status" className="text-xs text-slate-500">
                명단을 불러오는 중입니다.
              </p>
            )
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <span className="mr-auto text-xs text-slate-500">
            <span className="font-semibold tabular-nums text-slate-900">
              {preview.members?.length ?? 0}
            </span>
            명으로 적용
          </span>
          <button
            type="button"
            className={MODAL_CANCEL_BTN}
            disabled={isSaving}
            onClick={requestClose}
          >
            취소
          </button>
          <button
            type="button"
            className={MODAL_CONFIRM_BTN}
            disabled={isSaving || !preview.members || preview.conflict !== null}
            onClick={onConfirm}
          >
            {isSaving ? '적용하는 중' : '적용'}
          </button>
        </div>
      </div>
    </div>
  );
}
