import type { ButtonHTMLAttributes } from 'react';
import { Plus } from 'lucide-react';

interface CreateButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'children'
> {
  /** 버튼 글자. 짧게 쓴다. 예: '새 행사', '출결 생성'. */
  label: string;
}

/**
 * 새 항목을 만드는 버튼(출결 생성, 새 행사, 새 규칙 등). 모든 화면의 생성 버튼이 이 모양을 쓴다.
 * GitHub의 'New', Linear의 'New issue'처럼 + 아이콘과 짧은 글자를 함께 두는 테두리 버튼이다.
 * 높이 36px(반기 선택 등 위쪽 도구와 같음) · 4px 모서리이며, + 아이콘은 글자와 같은 색·굵기다.
 * className은 너비처럼 자리에 따라 달라지는 것만 덧붙인다.
 */
export function CreateButton({ label, className = '', ...rest }: CreateButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-sm border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 ${className}`}
    >
      <Plus size={14} strokeWidth={2.25} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
