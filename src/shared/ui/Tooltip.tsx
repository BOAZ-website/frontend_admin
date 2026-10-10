import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Ban } from 'lucide-react';

interface TooltipProps {
  /** 말풍선에 보일 글자. 예: 'CSV 추출'. */
  label: string;
  /**
   * 말풍선 가로 위치. 'center'는 버튼 가운데, 'end'는 버튼 오른쪽 끝에 맞춘다.
   * 화면 오른쪽 끝에 붙은 버튼은 'end'로 두면 말풍선이 화면 밖으로 나가지 않는다.
   */
  align?: 'center' | 'end';
  /** 말풍선 세로 위치. 기본은 버튼 아래(bottom), 'top'은 버튼 위다. */
  side?: 'bottom' | 'top';
  /**
   * true면 버튼을 지금 쓸 수 없다는 뜻으로, 말풍선 앞에 금지 표시를 붙이고 label에 그 이유를 쓴다.
   * 쓸 수 없는(disabled) 버튼은 마우스 동작을 받지 않으므로, 말풍선은 버튼을 감싼 칸에서 띄운다.
   */
  isBlocked?: boolean;
  children: ReactNode;
}

const GAP = 6;

/**
 * 아이콘 버튼 등에 붙이는 말풍선. 브라우저 기본 말풍선(title)은 한참 뒤에 뜨므로,
 * 마우스를 올리거나 키보드로 버튼에 오면 바로 뜨는 말풍선을 쓴다.
 * 말풍선은 화면 맨 위층(document.body)에 띄워, 표·목록처럼 스크롤되거나 고정된 영역 안의 버튼이라도
 * 잘리거나 다른 요소에 가리지 않는다. 버튼에는 화면 읽기 프로그램용 이름(aria-label)을 따로 붙인다.
 */
export function Tooltip({
  label,
  align = 'center',
  side = 'bottom',
  isBlocked = false,
  children,
}: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // 열릴 때 버튼 위치를 재어 말풍선 자리를 정한다.
  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) {
      setPosition(null);
      return;
    }
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      top: side === 'top' ? rect.top - GAP : rect.bottom + GAP,
      left: align === 'end' ? rect.right : rect.left + rect.width / 2,
    });
  }, [isOpen, align, side]);

  const translateX = align === 'end' ? '-100%' : '-50%';
  const translateY = side === 'top' ? '-100%' : '0';

  return (
    <span
      ref={anchorRef}
      className={`relative inline-flex ${isBlocked ? 'cursor-not-allowed' : ''}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
      // 누르면 닫아, 버튼이 다른 화면을 열 때 말풍선이 남지 않게 한다.
      onMouseDown={() => setIsOpen(false)}
    >
      {children}
      {isOpen &&
        position &&
        createPortal(
          <span
            role="tooltip"
            style={{
              top: position.top,
              left: position.left,
              transform: `translate(${translateX}, ${translateY})`,
            }}
            className="pointer-events-none fixed z-[10000] inline-flex items-center gap-1 whitespace-nowrap rounded-sm bg-slate-800 px-2 py-1 text-[11px] font-medium text-white shadow-sm"
          >
            {isBlocked && <Ban size={11} className="shrink-0 text-rose-300" aria-hidden="true" />}
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
