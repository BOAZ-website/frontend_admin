import { useRef, useState } from 'react';

interface InlineEditableCellProps {
  value: string;
  /** 바뀐 값을 저장한다. 값이 그대로면 부르지 않는다. */
  onCommit: (value: string) => void;
  /** 화면 낭독기용 칸 이름(예: '홍길동 소속'). */
  ariaLabel: string;
  isBold?: boolean;
}

/**
 * 엑셀처럼 칸을 누르면 그 자리에서 입력하고, 다른 곳을 누르거나 Enter를 누르면 저장하는 칸.
 * Esc를 누르면 입력을 취소한다.
 */
export function InlineEditableCell({
  value,
  onCommit,
  ariaLabel,
  isBold = false,
}: InlineEditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Esc로 취소하면 이어지는 blur에서 저장하지 않는다.
  const isCancelledRef = useRef(false);

  const textClass = isBold ? 'font-bold text-slate-900' : 'font-medium text-slate-700';

  function startEditing() {
    setDraft(value);
    isCancelledRef.current = false;
    setIsEditing(true);
  }

  function finishEditing() {
    setIsEditing(false);
    if (isCancelledRef.current) {
      return;
    }
    const next = draft.trim();
    if (next !== value) {
      onCommit(next);
    }
  }

  if (isEditing) {
    return (
      <input
        autoFocus
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finishEditing}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            isCancelledRef.current = true;
            e.currentTarget.blur();
          }
        }}
        className={`w-full h-8 px-2.5 text-center text-xs rounded-md outline-none bg-white border border-slate-300 shadow-2xs focus:border-slate-400 ${textClass}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      aria-label={`${ariaLabel} 입력`}
      className={`w-full h-8 px-2.5 rounded-md border border-transparent text-xs truncate cursor-text transition-colors hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:border-slate-400 ${textClass}`}
    >
      {value || <span className="text-slate-300">-</span>}
    </button>
  );
}
