import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

interface ScoreInputProps {
  value: number;
  onChange: (value: number) => void;
  /** 화면 읽기 프로그램용 이름. 예: '정규활동 지각 배점'. */
  ariaLabel: string;
  /** 값 뒤에 붙는 단위. 배점은 '점', 횟수는 '회'. */
  unit?: string;
  /** −·+ 버튼 한 번에 바뀌는 양. */
  step?: number;
  /** 가장 작은 값(횟수처럼 음수가 없는 값). */
  min?: number;
  /** 배점이면 가점은 초록, 감점은 빨강으로 보인다(규칙 표와 같은 색). 횟수는 색을 입히지 않는다. */
  isSigned?: boolean;
}

/** 소수 계산 오차(예: 0.1 + 0.2)를 없애 한 자리까지로 맞춘다. */
const round = (value: number) => Math.round(value * 10) / 10;

/**
 * 규칙 생성 창의 배점·횟수 입력칸. − · 값 · + 가 한 덩어리인 작은 입력칸이다.
 * 값은 직접 입력하거나 −·+로 바꾸고, 배점은 규칙 표처럼 부호에 따라 색이 달라진다.
 */
export function ScoreInput({
  value,
  onChange,
  ariaLabel,
  unit = '점',
  step = 1,
  min,
  isSigned = true,
}: ScoreInputProps) {
  // 입력 중인 글자('-'만 친 상태 등)는 따로 들고 있다가, 숫자가 되면 바로 반영한다.
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (next: number) => (min === undefined ? next : Math.max(min, next));
  const change = (next: number) => onChange(clamp(round(next)));

  const colorClass = !isSigned
    ? 'text-slate-800'
    : value > 0
      ? 'text-emerald-600'
      : value < 0
        ? 'text-rose-600'
        : 'text-slate-500';
  const shown = draft ?? (isSigned && value > 0 ? `+${value}` : String(value));
  const isAtMin = min !== undefined && value <= min;

  return (
    <div className="inline-flex h-8 items-center rounded-sm border border-slate-200 bg-white shadow-2xs transition-colors focus-within:border-slate-400 hover:border-slate-300">
      <button
        type="button"
        onClick={() => change(value - step)}
        disabled={isAtMin}
        aria-label={`${ariaLabel} ${step} 내리기`}
        className="flex h-full w-7 cursor-pointer items-center justify-center text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:cursor-default disabled:text-slate-200 disabled:hover:bg-transparent"
      >
        <Minus size={12} strokeWidth={2.25} aria-hidden="true" />
      </button>
      {/* 값과 단위를 한 칸에 둔다. */}
      <label className="flex h-full items-center border-x border-slate-100 pr-2">
        <input
          type="text"
          inputMode="decimal"
          value={shown}
          aria-label={ariaLabel}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const text = event.target.value.trim();
            setDraft(text);
            const parsed = Number(text);
            if (text !== '' && text !== '-' && text !== '+' && Number.isFinite(parsed))
              change(parsed);
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              change(value + step);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              change(value - step);
            }
          }}
          className={`h-full w-10 bg-transparent text-right text-xs font-semibold tabular-nums outline-none ${colorClass}`}
        />
        <span className="pl-0.5 text-[11px] text-slate-400" aria-hidden="true">
          {unit}
        </span>
      </label>
      <button
        type="button"
        onClick={() => change(value + step)}
        aria-label={`${ariaLabel} ${step} 올리기`}
        className="flex h-full w-7 cursor-pointer items-center justify-center text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
      >
        <Plus size={12} strokeWidth={2.25} aria-hidden="true" />
      </button>
    </div>
  );
}
