import { useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

/**
 * 끌어서 바꾸는 가로 너비들(px). 출결 표의 열 너비 조절과 같은 방식이다:
 * 손잡이를 누른 채 움직인 거리만큼 너비를 바꾸고, 최소·최대 너비를 넘지 않는다.
 */
export function useResizableWidths<K extends string>(
  defaults: Record<K, number>,
  limits: Partial<Record<K, { min: number; max?: number }>>,
) {
  const [widths, setWidths] = useState<Record<K, number>>(defaults);
  const [resizingKey, setResizingKey] = useState<K | null>(null);

  const startResize = (event: ReactMouseEvent<HTMLElement>, key: K) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widths[key];
    const { min = 40, max = Number.POSITIVE_INFINITY } = limits[key] ?? {};
    setResizingKey(key);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const next = Math.min(max, Math.max(min, startWidth + moveEvent.clientX - startX));
      setWidths((current) => ({ ...current, [key]: next }));
    };
    const handleMouseUp = () => {
      setResizingKey(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return { widths, resizingKey, startResize };
}
