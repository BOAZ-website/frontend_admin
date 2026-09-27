import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

import { formatDateInput, isValidIsoDate } from '@/shared/lib/date';

const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length;

interface DateTextInputProps {
  /** YYYY-MM-DD 또는 빈 문자열. 완성되지 않았거나 없는 날짜를 입력 중일 때는 빈 문자열로 알린다. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/**
 * yyyy-mm-dd를 직접 타이핑하거나(숫자만 쳐도 형식이 자동으로 맞춰진다) 오른쪽 달력 버튼으로 고르는 날짜 입력.
 * 비어 있을 때는 회색 "yyyy-mm-dd" 안내가 보이고, 존재하지 않는 날짜(예: 2026-02-30)는 붉은 테두리로 알린다.
 */
export function DateTextInput({ value, onChange, ariaLabel }: DateTextInputProps) {
  const [text, setText] = useState(value);
  const pickerRef = useRef<HTMLInputElement>(null);

  // 달력에서 고르거나 부모가 값을 바꾸면 입력창 글자도 맞춘다(입력 중인 미완성 글자는 지우지 않는다).
  useEffect(() => {
    setText((current) => (current === value || (!value && !isValidIsoDate(current)) ? current : value));
  }, [value]);

  const isInvalid = text.length === ISO_DATE_LENGTH && !isValidIsoDate(text);

  function handleTextChange(raw: string) {
    const next = formatDateInput(raw, text);
    setText(next);
    onChange(isValidIsoDate(next) ? next : '');
  }

  function openCalendar() {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === 'function') picker.showPicker();
    else picker.click();
  }

  return (
    <div className="relative">
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
        className={`w-full rounded-md border bg-slate-50 py-1.5 pl-1.5 pr-7 text-center font-mono text-[11px] font-bold text-slate-900 outline-none transition-all placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:ring-1 ${
          isInvalid
            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-400'
            : 'border-slate-200 focus:border-slate-900 focus:ring-slate-900'
        }`}
      />
      <button
        type="button"
        onClick={openCalendar}
        className="absolute right-1 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700"
        title="달력에서 선택"
        aria-label={`${ariaLabel} 달력에서 선택`}
      >
        <Calendar size={14} aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={isValidIsoDate(text) ? text : ''}
        onChange={(event) => {
          setText(event.target.value);
          onChange(event.target.value);
        }}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </div>
  );
}
