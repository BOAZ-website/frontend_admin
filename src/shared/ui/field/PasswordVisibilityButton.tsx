import { Eye } from 'lucide-react';

interface PasswordVisibilityButtonProps {
  /** 지금 비밀번호가 글자로 보이는지. */
  isVisible: boolean;
  onToggle: () => void;
  /** 보이고 가릴 입력칸의 id. */
  controls: string;
}

/**
 * 비밀번호 칸 오른쪽 끝의 보기·숨기기 버튼. 로그인 창과 내 계정 창이 함께 쓴다.
 * 네이버처럼 가려져 있을 때 눈 위에 사선을 긋는다. lucide의 EyeOff는 눈 모양이 끊겨 보여 쓰지 않는다.
 */
export function PasswordVisibilityButton({
  isVisible,
  onToggle,
  controls,
}: PasswordVisibilityButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
      aria-pressed={isVisible}
      aria-controls={controls}
      className="cursor-pointer rounded-sm p-1.5 text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-slate-400"
    >
      <span aria-hidden="true" className="relative block">
        <Eye size={16} strokeWidth={1.5} />
        {!isVisible && (
          <span className="absolute top-1/2 left-1/2 h-px w-[19px] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-current" />
        )}
      </span>
    </button>
  );
}
