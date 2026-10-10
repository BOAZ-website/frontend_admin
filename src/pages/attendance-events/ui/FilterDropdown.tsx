import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FilterDropdownOption<T extends string> {
  value: T;
  label: string;
}

interface FilterDropdownProps<T extends string> {
  /** 버튼과 목록의 접근성 이름. 예: '기수 필터'. */
  ariaLabel: string;
  /** 첫 번째 선택지(전체)를 고른 상태에서 버튼에 보일 이름. 예: '기수'. */
  title: string;
  value: T;
  /** 첫 번째 선택지는 거르지 않는 '전체' 값이다. */
  options: readonly FilterDropdownOption<T>[];
  onChange: (value: T) => void;
  /** 입력 칸처럼 너비를 꽉 채운다(참가자 추가 창의 부문 등). */
  isFullWidth?: boolean;
}

/**
 * 표 위 도구 줄의 필터 드롭다운. 그룹 계정 관리의 팀 선택 드롭다운과 같은 모양이다.
 * 바깥으로 포커스가 나가거나 Escape를 누르면 닫힌다.
 */
export function FilterDropdown<T extends string>({
  ariaLabel,
  title,
  value,
  options,
  onChange,
  isFullWidth = false,
}: FilterDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel =
    value === options[0]?.value
      ? title
      : (options.find((option) => option.value === value)?.label ?? title);

  return (
    <div
      className={`relative ${isFullWidth ? 'w-full' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`h-9 min-w-24 ${isFullWidth ? 'w-full' : ''} rounded-sm border border-slate-200 bg-white pl-3 pr-9 text-left text-xs font-semibold text-slate-800 shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400 cursor-pointer`}
      >
        {selectedLabel}
      </button>
      <ChevronDown
        size={14}
        aria-hidden="true"
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
      />
      {isOpen && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-30 mt-1.5 max-h-64 min-w-full w-max overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.28)] animate-in fade-in slide-in-from-top-1 duration-150"
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
        </div>
      )}
    </div>
  );
}
