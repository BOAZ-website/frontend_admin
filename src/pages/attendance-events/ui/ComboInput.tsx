import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface ComboInputOption {
  /** 고르면 칸에 들어가는 값. */
  value: string;
  /** 목록에 보이는 이름. */
  label: string;
}

interface ComboInputProps {
  /** 입력 칸과 목록의 접근성 이름. 예: '기수'. */
  ariaLabel: string;
  value: string;
  /** 목록에서 고를 수 있는 값. 목록에 없는 값도 직접 입력할 수 있다. */
  options: readonly ComboInputOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** 형식이 틀렸으면 테두리를 빨갛게 한다. */
  hasError?: boolean;
}

/**
 * 직접 입력도 되고 목록에서 고를 수도 있는 칸. 모양은 필터 드롭다운(FilterDropdown)과 같다.
 * 오른쪽 화살표를 누르거나 칸에 포커스가 가면 목록이 열리고, 바깥으로 포커스가 나가거나 Escape를 누르면 닫힌다.
 */
export function ComboInput({
  ariaLabel,
  value,
  options,
  onChange,
  placeholder,
  hasError = false,
}: ComboInputProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className="relative w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setIsOpen(false);
      }}
    >
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        role="combobox"
        placeholder={placeholder}
        aria-invalid={hasError}
        className={`h-9 w-full rounded-sm border bg-white pl-3 pr-9 text-left text-xs font-semibold text-slate-800 shadow-2xs outline-none transition-colors placeholder:font-medium placeholder:text-slate-400 ${
          hasError
            ? 'border-red-400 focus:border-red-500'
            : 'border-slate-200 hover:border-slate-300 focus:border-slate-400'
        }`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${ariaLabel} 목록 ${isOpen ? '닫기' : '열기'}`}
        onClick={() => setIsOpen((open) => !open)}
        className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-600"
      >
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && options.length > 0 && (
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
