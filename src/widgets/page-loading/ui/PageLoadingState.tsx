import type { ReactNode } from 'react';

interface PageLoadingStateProps {
  /** 페이지 제목 줄. 다 읽은 뒤의 제목 줄과 같은 자리·높이로 그려서, 읽고 나서 제목이 움직이지 않게 한다. */
  header: ReactNode;
  /** 읽기에 실패했으면 그 오류. 없으면 읽는 중이다. */
  error?: Error | null;
  /** 읽는 중 안내 문구. 예: '출결 정보를 불러오는 중입니다.' */
  loadingMessage: string;
  /** 오류 안내 문구 앞부분. 뒤에 오류 내용을 괄호로 붙인다. 예: '출결 정보를 불러오지 못했습니다.' */
  errorMessage: string;
  /** 페이지 바깥 틀의 클래스. 다 읽은 뒤 페이지의 바깥 틀과 같은 간격을 쓴다. */
  className?: string;
  /** 안내 줄 옆에 둘 버튼 등(예: 다시 시도). */
  action?: ReactNode;
}

type PageLoadingBodyProps = Pick<
  PageLoadingStateProps,
  'error' | 'loadingMessage' | 'errorMessage' | 'action'
>;

/**
 * 페이지 본문 자리에 두는 읽는 중(또는 오류) 안내. 화면 높이만큼 자리를 비워 두어
 * 읽은 뒤 본문이 그려질 때 아래 내용이 위아래로 튀지 않게 한다. 제목 줄은 페이지가 그대로 그린다.
 */
export function PageLoadingBody({
  error = null,
  loadingMessage,
  errorMessage,
  action,
}: PageLoadingBodyProps) {
  return (
    // 헤더(3.5rem)·본문 위아래 여백·제목 줄을 뺀 화면 높이를 비워 둔다.
    <div className="min-h-[calc(100dvh-12rem)]">
      <p
        role="status"
        className={`rounded-md border px-4 py-3 text-xs ${
          error
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-slate-200 bg-white text-slate-500'
        }`}
      >
        {error ? `${errorMessage} (${error.message || '알 수 없는 오류'})` : loadingMessage}
        {action}
      </p>
    </div>
  );
}

/**
 * 페이지 데이터를 처음 읽는 동안(또는 읽기에 실패했을 때) 페이지 전체 대신 보여 주는 틀.
 * 제목 줄은 그대로 두고, 본문 자리는 PageLoadingBody로 화면 높이만큼 비워 둔다.
 */
export function PageLoadingState({
  header,
  className = 'space-y-6',
  ...body
}: PageLoadingStateProps) {
  return (
    <div className={className}>
      {header}
      <PageLoadingBody {...body} />
    </div>
  );
}
