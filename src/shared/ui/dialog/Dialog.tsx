import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

import { useDialogKeyboard } from '@/shared/lib/useDialogKeyboard';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';

/** 팝업 너비. 입력칸 몇 개면 md, 표·목록이 들어가면 lg 이상. */
const WIDTH_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-5xl',
} as const;

export interface DialogProps {
  /** 머리글 제목. 창의 이름(aria-labelledby)이 된다. */
  title: ReactNode;
  /** 제목 아래 한 줄 설명. */
  description?: ReactNode;
  /**
   * 닫기 버튼·Escape·바깥 누르기로 닫을 때 부른다. 저장하지 않은 입력이 있으면 부르는 쪽에서 확인한다(R12-14).
   * 없으면 닫을 수 없는 창이다(로그인 전 로그인 창). 닫기 버튼이 빠지고 Escape·바깥 누르기가 무시된다.
   */
  onClose?: () => void;
  /** 제목 왼쪽 그림(로고 등). */
  icon?: ReactNode;
  /** 바닥글(취소·확인 버튼 등). 위에 구분선을 그린다. 없으면 바닥글을 그리지 않는다. */
  footer?: ReactNode;
  width?: keyof typeof WIDTH_CLASS;
  /** 머리글 아래 구분선. 설정 목록처럼 본문이 스스로 줄을 나누는 창(내 계정 창)은 false로 끈다. */
  headerDivider?: boolean;
  /** 닫기 버튼의 화면 읽기 이름. 예: "내 계정 창 닫기". */
  closeLabel?: string;
  children: ReactNode;
}

/**
 * 창 안에서 고르거나 입력하는 팝업의 공통 틀(R12-17). 출결 화면의 생성 팝업(스터디 생성 등)과 같은 카드 모양이다:
 * 머리글(제목·닫기)과 바닥글 구분선, 흰 카드(MODAL_SURFACE), 8px 모서리(rounded-lg).
 *   · role="dialog", aria-modal, aria-labelledby(R12-12)
 *   · Escape로 닫고 Tab은 창 안에서만 돈다. 팝업이 겹치면 맨 위 창만 반응한다(R12-11·R12-13, useDialogKeyboard)
 *   · 열면 첫 입력칸(없으면 창 자체)으로 포커스를 옮기고, 닫으면 열기 전 요소로 되돌린다
 * 확인·안내만 하는 창은 이 틀이 아니라 브라우저 기본 창(window.confirm·window.alert)을 쓴다(R12-15·R12-16).
 */
export function Dialog({
  title,
  description,
  onClose,
  icon,
  footer,
  width = 'md',
  headerDivider = true,
  closeLabel = '창 닫기',
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // 닫을 수 없는 창도 Tab이 창 안에서만 돌게 키보드 처리는 건다. Escape는 아무 일도 하지 않는다.
  useDialogKeyboard(panelRef, onClose ?? (() => {}));
  useEffect(() => {
    const previous = document.activeElement;
    const panel = panelRef.current;
    // 입력칸이 없으면 창 자체에 포커스를 둔다. 닫기 버튼에 두면 열자마자 포커스 테두리가 가장 눈에 띈다.
    (panel?.querySelector<HTMLElement>('input, select, textarea') ?? panel)?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-90 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full outline-none ${WIDTH_CLASS[width]} space-y-5 rounded-lg p-6 font-sans ${MODAL_SURFACE}`}
      >
        <div
          className={`flex items-start justify-between gap-3 ${headerDivider ? 'border-b border-slate-100 pb-3' : ''}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <div className="min-w-0">
              <h3 id={titleId} className="text-base font-bold text-slate-900">
                {title}
              </h3>
              {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="shrink-0 cursor-pointer rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        {children}

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
