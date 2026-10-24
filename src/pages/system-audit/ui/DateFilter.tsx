import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const DAYS_IN_GRID = 42;

const pad = (value: number) => String(value).padStart(2, '0');
const isoOf = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
/** 'YYYY-MM-DD'를 그날 0시(로컬 시간)로 읽는다. */
const dateOf = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** 달력에 보일 6주(42칸). 그달 1일이 있는 주의 일요일부터 시작한다. */
function gridOf(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  return Array.from(
    { length: DAYS_IN_GRID },
    (_, index) => new Date(year, month, 1 - first.getDay() + index),
  );
}

const NAV_BTN =
  'inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900';
const FOOTER_BTN =
  'h-7 cursor-pointer rounded-sm px-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900';

interface DateFilterProps {
  /** 'YYYY-MM-DD' 또는 빈 문자열(날짜로 거르지 않음). */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/**
 * 표 위 도구 줄의 날짜 필터. 권한 필터(FilterDropdown)와 같은 버튼을 누르면 달력이 열리고, 하루를 고르면 닫힌다.
 * 브라우저 기본 달력은 모양을 바꿀 수 없어 직접 그린다. 바깥으로 포커스가 나가거나 Escape를 누르면 닫힌다.
 */
export function DateFilter({ value, onChange, ariaLabel }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const today = isoOf(new Date());
  const [shown, setShown] = useState(() => dateOf(value || today));
  const year = shown.getFullYear();
  const month = shown.getMonth();

  const open = () => {
    setShown(dateOf(value || today));
    setIsOpen(true);
  };
  const pick = (iso: string) => {
    onChange(iso);
    setIsOpen(false);
  };

  return (
    <div
      className="relative"
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
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? setIsOpen(false) : open())}
        className={`h-9 min-w-28 cursor-pointer rounded-sm border border-slate-200 bg-white pl-3 pr-9 text-left text-xs font-semibold shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400 ${
          value ? 'tabular-nums text-slate-800' : 'text-slate-500'
        }`}
      >
        {value ? value.slice(2) : '날짜'}
      </button>
      <Calendar
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      {isOpen && (
        <div
          role="dialog"
          aria-label={ariaLabel}
          className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.28)] animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="pl-1 text-sm font-bold tabular-nums text-slate-900">
              {year}년 {month + 1}월
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShown(new Date(year, month - 1, 1))}
                aria-label="이전 달"
                className={NAV_BTN}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setShown(new Date(year, month + 1, 1))}
                aria-label="다음 달"
                className={NAV_BTN}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="py-1 text-[11px] font-semibold text-slate-500">
                {weekday}
              </span>
            ))}
            {gridOf(year, month).map((date) => {
              const iso = isoOf(date);
              const isSelected = iso === value;
              const isToday = iso === today;
              const isOtherMonth = date.getMonth() !== month;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => pick(iso)}
                  aria-label={iso}
                  aria-pressed={isSelected}
                  className={`h-8 cursor-pointer rounded-sm text-xs tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-slate-800 font-bold text-white'
                      : `hover:bg-slate-100 ${
                          isOtherMonth ? 'text-slate-400' : 'text-slate-700'
                        } ${isToday ? 'font-bold ring-1 ring-inset ring-slate-300' : ''}`
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button type="button" onClick={() => pick('')} className={FOOTER_BTN}>
              지우기
            </button>
            <button type="button" onClick={() => pick(today)} className={FOOTER_BTN}>
              오늘
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
