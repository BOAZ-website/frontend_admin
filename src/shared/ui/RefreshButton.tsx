import { RefreshCw } from 'lucide-react';

import { ICON_BTN } from './systemStyles';

interface RefreshButtonProps {
  /** 버튼의 접근성 이름. 기본은 '목록 새로고침'. */
  ariaLabel?: string;
  /** 읽는 중이면 아이콘이 돌고 누를 수 없다. */
  isLoading: boolean;
  onClick: () => void;
}

/** 아이콘만 있는 새로고침 버튼. 표 위 도구 줄과 상세 화면 제목 옆에 둔다. */
export function RefreshButton({
  ariaLabel = '목록 새로고침',
  isLoading,
  onClick,
}: RefreshButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title="새로고침"
      disabled={isLoading}
      onClick={onClick}
      className={ICON_BTN}
    >
      <RefreshCw size={14} aria-hidden="true" className={isLoading ? 'animate-spin' : ''} />
    </button>
  );
}
