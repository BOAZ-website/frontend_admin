import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface CohortSelectProps {
  value: number;
  /** 큰 기수부터 정렬된 선택 가능한 기수. */
  cohorts: readonly number[];
  onChange: (cohort: number) => void;
}

/** 조회할 활동 기수를 고르는 드롭다운. */
export function CohortSelect({ value, cohorts, onChange }: CohortSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="기수 선택"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex min-w-[5.5rem] cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white py-1.5 pl-3 pr-2 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 focus-visible:border-slate-400 focus-visible:outline-none"
      >
        {value}기
        <ChevronDown size={13} className="text-slate-400" />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-30 mt-1 max-h-60 min-w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {cohorts.map((cohort) => {
            const isSelected = cohort === value;
            return (
              <li key={cohort} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(cohort);
                    setIsOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 whitespace-nowrap px-3 py-1.5 text-left text-xs font-semibold transition-colors ${
                    isSelected ? 'bg-[#1E6F94] text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {cohort}기
                  {isSelected && <Check size={12} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
