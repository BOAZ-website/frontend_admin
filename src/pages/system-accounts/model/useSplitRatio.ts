import { useEffect, useRef, useState } from 'react';

/** 왼쪽 목록이 차지하는 비율(%). 출결(BASE·ADV·스터디) 분할 화면과 같은 값이다. */
const SPLIT_RATIO = { initial: 23, min: 15, max: 65 } as const;

/**
 * 목록 | 상세 분할 화면의 왼쪽 비율. 가운데 막대를 끄는 동안 마우스 위치로 비율을 다시 잡는다.
 * 출결 분할 화면(InternalCategoryAttendancePage)의 드래그 처리와 같다.
 */
export function useSplitRatio() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitRatio, setSplitRatio] = useState<number>(SPLIT_RATIO.initial);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: MouseEvent | TouchEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const ratio = ((clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(Math.max(ratio, SPLIT_RATIO.min), SPLIT_RATIO.max));
    };
    const handlePointerUp = () => setIsDragging(false);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  return { containerRef, splitRatio, isDragging, startDragging: () => setIsDragging(true) };
}
