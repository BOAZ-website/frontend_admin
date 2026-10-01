import { Inbox } from 'lucide-react';

interface DataLoadFailedNoticeProps {
  onRetry: () => void;
}

/**
 * 데이터를 불러오지 못했을 때 화면 틀은 그대로 두고, 본문 위에 "등록된 내용이 없습니다"로 알리는 안내.
 * 서버 오류 문구는 보여주지 않는다.
 */
export function DataLoadFailedNotice({ onRetry }: DataLoadFailedNoticeProps) {
  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs"
    >
      <Inbox size={20} strokeWidth={1.4} className="shrink-0 text-slate-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-700">등록된 내용이 없습니다</p>
        <p className="text-xs text-slate-500">
          데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-800"
      >
        다시 불러오기
      </button>
    </div>
  );
}
