import { useEffect, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

import {
  calendarDaysOf,
  isoOfLocalDate,
  isWithinRange,
  localDateOfIso,
} from '@/shared/lib/calendar';
import { formatDateInput, isValidIsoDate } from '@/shared/lib/date';

import { FIELD_INPUT } from './systemStyles';

const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const NAV_BTN =
  'inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900';
const FOOTER_BTN =
  'h-7 cursor-pointer rounded-sm px-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40';

interface DatePickerFieldProps {
  /** 'YYYY-MM-DD' 또는 빈 문자열. 입력 중인 미완성 날짜는 빈 문자열로 알린다. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  /** 고를 수 있는 첫날('YYYY-MM-DD'). 달력에서 이 날짜 앞은 막는다. */
  min?: string;
  /** 고를 수 있는 마지막 날. */
  max?: string;
}

/**
 * 날짜 입력칸과 화면 안에 그린 달력. 숫자만 쳐도 yyyy-mm-dd로 맞춰지고, 달력 버튼을 누르면 아래에 달력이 열린다.
 * 브라우저 기본 달력은 브라우저마다 모양이 달라 직접 그린다. 바깥으로 포커스가 나가거나 Escape를 누르면 닫힌다.
 */
export function DatePickerField({ value, onChange, ariaLabel, min, max }: DatePickerFieldProps) {
  const [text, setText] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const today = isoOfLocalDate(new Date());
  const [shown, setShown] = useState(() => localDateOfIso(value || min || today));
  const year = shown.getFullYear();
  const month = shown.getMonth();

  // 부모가 값을 바꾸면 입력칸 글자도 맞춘다(입력 중인 미완성 글자는 지우지 않는다).
  useEffect(() => {
    setText((current) =>
      current === value || (!value && !isValidIsoDate(current)) ? current : value,
    );
  }, [value]);

  const isInvalid = text.length === ISO_DATE_LENGTH && !isValidIsoDate(text);

  const handleTextChange = (raw: string) => {
    const next = formatDateInput(raw, text);
    setText(next);
    onChange(isValidIsoDate(next) ? next : '');
  };
  const handleToggle = () => {
    if (!isOpen) setShown(localDateOfIso(value || min || today));
    setIsOpen(!isOpen);
  };
  const handlePick = (iso: string) => {
    setText(iso);
    onChange(iso);
    setIsOpen(false);
  };

  return (
    <div
      className="relative w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault();
          setIsOpen(false);
        }
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        onChange={(event) => handleTextChange(event.target.value)}
        placeholder="yyyy-mm-dd"
        maxLength={ISO_DATE_LENGTH}
        aria-label={ariaLabel}
        aria-invalid={isInvalid}
        title={isInvalid ? '존재하지 않는 날짜입니다' : undefined}
        className={`${FIELD_INPUT} pr-10 tabular-nums ${isInvalid ? 'border-red-400 focus:border-red-500' : ''}`}
      />
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`${ariaLabel} 달력 열기`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
      >
        <Calendar size={16} aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          role="dialog"
          aria-label={`${ariaLabel} 달력`}
          className="absolute left-0 top-full z-30 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.28)]"
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
            {calendarDaysOf(year, month).map((iso) => {
              const isSelected = iso === value;
              const isToday = iso === today;
              const isOtherMonth = localDateOfIso(iso).getMonth() !== month;
              const isEnabled = isWithinRange(iso, min, max);
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handlePick(iso)}
                  disabled={!isEnabled}
                  aria-label={iso}
                  aria-pressed={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  className={`h-8 cursor-pointer rounded-sm text-xs tabular-nums transition-colors disabled:cursor-not-allowed disabled:text-slate-300 ${
                    isSelected
                      ? 'bg-slate-200 font-bold text-slate-900'
                      : `hover:bg-slate-100 ${isOtherMonth ? 'text-slate-500' : 'text-slate-800'} ${isToday ? 'font-bold' : ''}`
                  }`}
                >
                  {localDateOfIso(iso).getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button type="button" onClick={() => handlePick('')} className={FOOTER_BTN}>
              날짜 지우기
            </button>
            <button
              type="button"
              onClick={() => handlePick(today)}
              disabled={!isWithinRange(today, min, max)}
              className={FOOTER_BTN}
            >
              오늘 선택
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
