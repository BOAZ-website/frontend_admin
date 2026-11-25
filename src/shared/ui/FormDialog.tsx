import { useId, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { MODAL_SURFACE } from '@/shared/ui/modalStyles';
import {
  MODAL_BACKDROP,
  MODAL_CANCEL_BTN,
  MODAL_CLOSE_BTN,
  MODAL_CONFIRM_BTN,
} from '@/shared/ui/systemStyles';

interface FormDialogProps {
  title: ReactNode;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  /** 입력칸 영역. 칸 배치(grid 등)는 호출부에서 정한다. */
  children: ReactNode;
  submitLabel?: string;
  submitDisabled?: boolean;
}

/**
 * 입력 팝업의 공통 틀: 어두운 배경, 제목과 닫기 버튼, 입력칸 영역, 취소·저장 버튼.
 * 배경을 누르거나 닫기·취소 버튼을 누르면 onClose를 부른다.
 */
export function FormDialog({
  title,
  onClose,
  onSubmit,
  children,
  submitLabel = '저장',
  submitDisabled,
}: FormDialogProps) {
  const titleId = useId();

  return (
    <div
      className={MODAL_BACKDROP}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full max-w-xl space-y-4 rounded-lg p-6 animate-in fade-in duration-150 ${MODAL_SURFACE}`}
      >
        <div className="flex items-center justify-between">
          <h3 id={titleId} className="text-base font-bold text-slate-900">
            {title}
          </h3>
          <button type="button" onClick={onClose} className={MODAL_CLOSE_BTN} aria-label="창 닫기">
            <X size={18} />
          </button>
        </div>

        {children}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className={MODAL_CANCEL_BTN}>
            취소
          </button>
          <button type="submit" disabled={submitDisabled} className={MODAL_CONFIRM_BTN}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
