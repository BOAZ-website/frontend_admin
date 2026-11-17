import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { useDialogKeyboard } from '@/shared/lib/useDialogKeyboard';
import {
  MODAL_BACKDROP,
  MODAL_CANCEL_BTN,
  MODAL_CLOSE_BTN,
  MODAL_CONFIRM_BTN,
} from '@/shared/ui/systemStyles';

interface RecruitingDialogProps {
  title: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  children: ReactNode;
}

/**
 * 리크루팅 관리 화면의 등록·수정 창 틀. 저장 중에는 닫히지 않고 저장 버튼도 막힌다(R7-8).
 * Escape로 닫히고 Tab 이동은 창 안에서만 돌며, 닫히면 창을 연 버튼으로 포커스가 돌아간다(R12-11).
 */
export function RecruitingDialog({
  title,
  isSaving,
  onClose,
  onSave,
  children,
}: RecruitingDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const requestClose = () => {
    if (!isSaving) onClose();
  };
  useDialogKeyboard(panelRef, requestClose);
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
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      className={MODAL_BACKDROP}
    >
      <div
        ref={panelRef}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h3 id={titleId} className="text-base font-bold text-slate-900">
            {title}
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={requestClose}
            disabled={isSaving}
            aria-label="창 닫기"
            className={MODAL_CLOSE_BTN}
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-4">{children}</div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={requestClose}
            disabled={isSaving}
            className={MODAL_CANCEL_BTN}
          >
            취소
          </button>
          <button type="button" onClick={onSave} disabled={isSaving} className={MODAL_CONFIRM_BTN}>
            {isSaving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
