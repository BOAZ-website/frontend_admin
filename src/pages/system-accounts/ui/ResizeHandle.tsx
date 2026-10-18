import type { MouseEvent as ReactMouseEvent } from 'react';

interface ResizeHandleProps {
  isActive: boolean;
  onMouseDown: (event: ReactMouseEvent<HTMLElement>) => void;
  /** 놓일 자리(표 머리 칸이면 absolute -right-2 top-0 bottom-0 등). */
  className?: string;
}

/** 가로 너비 조절 손잡이. 출결 표의 열 너비 손잡이와 같은 모양이다(가는 막대, 끄는 동안 진하게 길어짐). */
export function ResizeHandle({ isActive, onMouseDown, className = '' }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      title="너비 조절"
      className={`group z-20 w-4 cursor-col-resize touch-none select-none items-center justify-center ${className}`}
    >
      <div
        className={`w-[2px] rounded-full transition-all ${
          isActive
            ? 'h-full bg-slate-700'
            : 'h-3 bg-slate-200 group-hover:h-4.5 group-hover:bg-slate-400'
        }`}
      />
    </div>
  );
}
