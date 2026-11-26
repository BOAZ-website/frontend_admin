import { CircleX } from 'lucide-react';

interface ClearFieldButtonProps {
  /** 화면 읽기 프로그램이 읽을 이름. 예: "아이디 지우기". */
  label: string;
  onClear: () => void;
}

/** 입력칸 오른쪽 끝에 두는, 칸의 글자를 한 번에 지우는 버튼. 로그인 창과 내 계정 창이 함께 쓴다. */
export function ClearFieldButton({ label, onClear }: ClearFieldButtonProps) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={label}
      className="cursor-pointer rounded-sm p-1.5 text-slate-300 transition-colors hover:text-slate-500 focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-slate-400"
    >
      <CircleX size={14} strokeWidth={1.5} aria-hidden="true" />
    </button>
  );
}
