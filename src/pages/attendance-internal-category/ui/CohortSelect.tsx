import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { cohortLabelOf } from '@/entities/cohort/model/lib';

interface CohortSelectProps {
  value: number;
  /** 큰 기수부터 정렬된 선택 가능한 기수. */
  cohorts: readonly number[];
  /** 기수 → 반기 표기(반기 API 응답). */
  labels: Readonly<Record<number, string>>;
  onChange: (cohort: number) => void;
  /** 다음 반기가 이미 있는지. 버튼은 있든 없든 '+ 생성' 하나로 보여 주므로 지금은 쓰지 않는다. */
  canCreateNextSemester: boolean;
  onAdvanceSemester: () => Promise<void>;
}

/** 조회할 활동 기수를 고르는 드롭다운. */
export function CohortSelect({
  value,
  cohorts,
  labels,
  onChange,
  onAdvanceSemester,
}: CohortSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
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
          <li role="none" className="border-b border-slate-100">
            <button
              type="button"
              disabled={isAdvancing}
              onClick={async () => {
                if (
                  !window.confirm(
                    '새 반기를 시작할까요?\n다음 반기가 현재 반기가 됩니다. 출결 및 점수 시스템의 HOST 계정만 정리되며 다른 관리 탭의 데이터는 유지됩니다.',
                  )
                )
                  return;
                setIsAdvancing(true);
                try {
                  await onAdvanceSemester();
                  setIsOpen(false);
                } catch (error) {
                  alert(
                    `반기를 전환하지 못했습니다. (${error instanceof Error ? error.message : String(error)})`,
                  );
                } finally {
                  setIsAdvancing(false);
                }
              }}
              className="flex w-full cursor-pointer items-center gap-1.5 whitespace-nowrap px-4 py-2.5 text-left text-xs font-semibold text-slate-700 transition-colors duration-150 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none disabled:cursor-wait disabled:text-slate-400"
            >
              {/* 생성 버튼(CreateButton)과 같이 + 아이콘은 글자와 같은 색·굵기 */}
              <Plus size={13} strokeWidth={2.25} aria-hidden="true" />
              {isAdvancing ? '처리 중...' : '생성'}
            </button>
          </li>
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
