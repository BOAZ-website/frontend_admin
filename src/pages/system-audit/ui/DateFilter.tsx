import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

import { isoDateOf, twoDigitYearOf } from '@/shared/lib/date';

import { calendarGridOf, dateOfIso } from '../model/calendar';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
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
 * 화면을 막지 않는 펼침 달력이라 aria-modal과 포커스 가두기는 두지 않는다(팝업 규칙 R12-11·12는 모달 창 대상).
 */
export function DateFilter({ value, onChange, ariaLabel }: DateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const today = isoDateOf(new Date());
  const [shown, setShown] = useState(() => dateOfIso(value || today));
  const year = shown.getFullYear();
  const month = shown.getMonth();

  const handleOpen = () => {
    setShown(dateOfIso(value || today));
    setIsOpen(true);
  };
  const handlePick = (iso: string) => {
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
        onClick={() => (isOpen ? setIsOpen(false) : handleOpen())}
        className={`h-9 min-w-28 cursor-pointer rounded-sm border border-slate-200 bg-white pl-3 pr-9 text-left text-xs font-semibold outline-none transition-colors hover:border-slate-300 focus:border-slate-400 ${
          value ? 'tabular-nums text-slate-800' : 'text-slate-500'
        }`}
      >
        {value ? twoDigitYearOf(value) : '날짜'}
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
          className="absolute right-0 top-full z-30 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.28)] animate-in fade-in slide-in-from-top-1 duration-150"
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
              <span key={weekday} className="py-1 text-xs font-semibold text-slate-500">
                {weekday}
              </span>
            ))}
            {calendarGridOf(year, month).map((date) => {
              const iso = isoDateOf(date);
              const isSelected = iso === value;
              const isToday = iso === today;
              const isOtherMonth = date.getMonth() !== month;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handlePick(iso)}
                  aria-label={iso}
                  aria-pressed={isSelected}
                  className={`h-8 cursor-pointer rounded-sm text-xs tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-slate-800 font-bold text-white'
                      : `hover:bg-slate-100 ${
                          isOtherMonth ? 'text-slate-500' : 'text-slate-800'
                        } ${isToday ? 'font-bold ring-1 ring-inset ring-slate-300' : ''}`
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button type="button" onClick={() => handlePick('')} className={FOOTER_BTN}>
              날짜 지우기
            </button>
            <button type="button" onClick={() => handlePick(today)} className={FOOTER_BTN}>
              오늘 선택
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
