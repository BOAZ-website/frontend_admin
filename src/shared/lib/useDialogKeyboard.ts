import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** 지금 열려 있는 창의 순서. 마지막이 맨 위 창이다. 창이 겹치면 맨 위 창만 키보드를 처리한다. */
const openDialogs: symbol[] = [];

/**
 * 떠 있는 창(aria-modal)의 키보드 처리.
 *   · Escape: 포커스가 창 안 어디에 있든(빈 곳을 눌러 포커스가 body로 가도) onEscape를 부른다.
 *     창 안 드롭다운처럼 먼저 Escape를 처리한 요소가 preventDefault하면 부르지 않는다.
 *   · Tab: 포커스를 창 안에서만 돈다. 마지막 요소에서 Tab이면 처음으로, 처음에서 Shift+Tab이면 마지막으로 간다.
 *   · 창 위에 다른 창이 열려 있으면(예: 권한 창 위의 전달문 창) 위 창만 반응한다.
 */
export function useDialogKeyboard(
  containerRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
): void {
  // 렌더 중에는 ref를 바꾸지 않는다. 화면에 반영된 뒤의 onEscape만 쓴다.
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });

  useEffect(() => {
    const id = Symbol('dialog');
    openDialogs.push(id);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || openDialogs[openDialogs.length - 1] !== id) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const isInside = active instanceof Node && container.contains(active);
      if (event.shiftKey && (active === first || !isInside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !isInside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openDialogs.splice(openDialogs.indexOf(id), 1);
    };
  }, [containerRef]);
}
