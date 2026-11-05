import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cohortLabelOf } from '@/entities/cohort/model/lib';

interface CohortSelectProps {
  value: number;
  /** 큰 기수부터 정렬된 선택 가능한 기수. */
  cohorts: readonly number[];
  /** 기수 → 반기 표기(반기 API 응답). */
  labels: Readonly<Record<number, string>>;
  onChange: (cohort: number) => void;
}

/** 조회할 활동 기수를 고르는 드롭다운. */
export function CohortSelect({ value, cohorts, labels, onChange }: CohortSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
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
    <div ref={rootRef} className="relative">
      {/* 행사 출결의 기수·출결 필터(그룹 계정 관리의 팀 선택)와 같은 모양의 드롭다운 */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="반기 선택"
        onClick={() => setIsOpen((prev) => !prev)}
        className="h-9 min-w-24 cursor-pointer rounded-sm border border-slate-200 bg-white pl-3 pr-9 text-left text-xs font-semibold text-slate-800 shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400"
      >
        {cohortLabelOf(labels, value)}
      </button>
      <ChevronDown
        size={14}
        aria-hidden="true"
        className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
      />

      {isOpen && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-30 mt-1.5 max-h-64 min-w-full w-max overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.28)] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {cohorts.map((cohort) => {
            const isSelected = cohort === value;
            return (
              <li
                key={cohort}
                role="option"
                aria-selected={isSelected}
                className="border-b border-slate-100 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(cohort);
                    setIsOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center whitespace-nowrap px-4 py-2.5 text-left text-xs transition-colors duration-150 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${
                    isSelected ? 'bg-slate-100 font-semibold text-slate-950' : 'text-slate-700'
                  }`}
                >
                  {cohortLabelOf(labels, cohort)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
