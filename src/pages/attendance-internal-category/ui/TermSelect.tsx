import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

interface TermSelectProps {
  value: number | null;
  terms: readonly number[];
  onChange: (term: number | null) => void;
}

/** 기수 선택 드롭다운. 브라우저 기본 select는 선택 색을 바꿀 수 없어 직접 구현한다. */
export function TermSelect({ value, terms, onChange }: TermSelectProps) {
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

  const options: { key: string; label: string; term: number | null }[] = [
    { key: 'all', label: '전체', term: null },
    ...terms.map((term) => ({ key: String(term), label: `${term}기`, term })),
  ];

  const select = (term: number | null) => {
    onChange(term);
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex min-w-[4.5rem] cursor-pointer items-center justify-between gap-1.5 rounded-sm border border-slate-300 bg-white py-1 pl-2 pr-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:border-slate-400 focus-visible:outline-none"
      >
        {value === null ? '전체' : `${value}기`}
        <ChevronDown size={12} className="text-slate-400" />
      </button>

      {isOpen && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-10 mt-1 max-h-40 min-w-full overflow-y-auto rounded-sm border border-slate-300 bg-white py-0.5 shadow-md"
        >
          {options.map((option) => {
            const isSelected = option.term === value;
            return (
              <li key={option.key} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onClick={() => select(option.term)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 px-2 py-1 text-left text-[11px] font-semibold transition-colors ${
                    isSelected ? 'bg-[#1E6F94] text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {option.label}
                  {isSelected && <Check size={11} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
