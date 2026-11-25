interface ListLoadErrorProps {
  isRetrying: boolean;
  onRetry: () => void;
}

/** 지원자 목록 조회 실패 안내(명세 §3.6). 빈 목록과 구분해 페이지 안에 보여 주고 다시 시도할 수 있게 한다. */
export function ListLoadError({ isRetrying, onRetry }: ListLoadErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md border border-slate-200 bg-white p-6"
    >
      <p className="text-sm font-semibold">지원자 목록을 불러오지 못했습니다.</p>
      <p className="text-xs">잠시 후 다시 시도해 주세요.</p>
      <button type="button" onClick={onRetry} disabled={isRetrying} className="px-4">
        {isRetrying ? '불러오는 중…' : '다시 시도'}
      </button>
    </div>
  );
}
