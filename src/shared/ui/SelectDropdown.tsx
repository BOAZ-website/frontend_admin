import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export interface SelectDropdownOption<T extends string> {
  value: T;
  label: string;
}

interface SelectDropdownProps<T extends string> {
  /** 버튼과 목록의 접근성 이름. 예: '김서하 3주차 출결'. */
  ariaLabel: string;
  value: T;
  options: readonly SelectDropdownOption<T>[];
  onChange: (value: T) => void;
  /** 버튼 크기·정렬(예: 'h-[30px] w-full text-center'). 모양(테두리·글씨·그림자)은 공용이다. */
  buttonClassName?: string;
}

/** 목록 자리. 버튼 아래로 열면 top, 위로 열면 bottom(화면 아래에서의 거리)을 쓴다. */
interface ListPosition {
  top?: number;
  bottom?: number;
  left: number;
  minWidth: number;
  /** 여는 쪽에 남은 화면 높이에 맞춘 목록 최대 높이. 넘치면 목록 안에서 스크롤한다. */
  maxHeight: number;
}

const LIST_MAX_HEIGHT = 256;
/** 버튼 아래 공간이 아주 좁아도 이만큼은 보이게 한다. */
const LIST_MIN_HEIGHT = 120;
const LIST_GAP = 6;
const VIEWPORT_MARGIN = 8;

/**
 * 선택 드롭다운. 행사 출결의 기수·출결 필터 드롭다운(FilterDropdown)과 같은 모양이다.
 * 목록은 화면 맨 위층(document.body)에 띄워, 표처럼 스크롤되는 영역 안에서도 잘리지 않는다.
 * 바깥을 누르거나 Escape를 누르면 닫힌다. 화면이나 표를 스크롤하면 닫지 않고 버튼을 따라 움직인다.
 */
export function SelectDropdown<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  buttonClassName = '',
}: SelectDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ListPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;

  // 버튼 위치를 재어 목록 자리를 정한다. 보통은 버튼 아래로 열고, 아래 공간이 모자라고 위가 더 넓으면 위로 연다.
  // 위로 열 때는 transform으로 끌어올리지 않고 bottom으로 자리를 잡는다. transform을 쓰면 나타나는 애니메이션이
  // transform을 덮어써, 목록이 버튼 아래에서 위로 올라가는 것처럼 보인다.
  // 열려 있는 동안 화면·표가 스크롤되거나 창 크기가 바뀌면 다시 재어 버튼을 따라간다.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const measure = () => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - LIST_GAP - VIEWPORT_MARGIN;
      const spaceAbove = rect.top - LIST_GAP - VIEWPORT_MARGIN;
      const isAbove = spaceBelow < LIST_MAX_HEIGHT && spaceAbove > spaceBelow;
      const space = isAbove ? spaceAbove : spaceBelow;
      setPosition({
        ...(isAbove
          ? { bottom: window.innerHeight - rect.top + LIST_GAP }
          : { top: rect.bottom + LIST_GAP }),
        left: rect.left,
        minWidth: rect.width,
        maxHeight: Math.max(LIST_MIN_HEIGHT, Math.min(LIST_MAX_HEIGHT, space)),
      });
    };
    measure();
    let frame = 0;
    const scheduleMeasure = (event: Event) => {
      // 목록 자체를 스크롤할 때는 자리가 바뀌지 않는다.
      if (event.target instanceof Node && listRef.current?.contains(event.target)) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener('scroll', scheduleMeasure, true);
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleMeasure, true);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !listRef.current?.contains(target)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`relative cursor-pointer rounded-sm border border-slate-200 bg-white pl-2.5 pr-7 text-xs font-semibold text-slate-800 shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400 ${buttonClassName}`}
      >
        {selectedLabel}
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen &&
        position &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              top: position.top,
              bottom: position.bottom,
              left: position.left,
              minWidth: position.minWidth,
              maxHeight: position.maxHeight,
            }}
            className="fixed z-[9999] w-max overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.28)] animate-in fade-in duration-150"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  buttonRef.current?.focus();
                }}
                className={`flex w-full items-center border-b border-slate-100 px-4 py-2.5 text-left text-xs whitespace-nowrap transition-colors duration-150 last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none cursor-pointer ${
                  option.value === value
                    ? 'bg-slate-100 font-semibold text-slate-950'
                    : 'text-slate-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
