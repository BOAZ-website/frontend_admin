import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import type { ErrorInfo, ReactNode } from 'react';

import App from './App.tsx';
import { recordErrorReload } from './errorReload.ts';

import './styles/index.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  /** 짧은 시간에 오류가 되풀이되어 새로고침을 멈췄는지. 그러면 안내 화면을 그린다. */
  isStuck: boolean;
}

const RELOAD_BTN =
  'h-9 cursor-pointer rounded-sm bg-slate-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400';

/**
 * 화면에서 처리하지 못한 오류를 브라우저 기본 알림창으로 알리고, 화면 복원용 저장값을 지운 뒤 새로고침한다.
 * 짧은 시간에 오류가 되풀이되면(errorReload.ts의 상한) 새로고침하지 않고 안내 화면과 새로고침 버튼을 그린다.
 */
class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, isStuck: false };

  public static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
    if (!recordErrorReload()) {
      this.setState({ isStuck: true });
      return;
    }
    window.alert('오류가 발생했습니다.\n문제가 계속되면 서비스운영팀에 문의해 주세요.');
    void this.clearCachesAndReload();
  }

  /** 캐시를 지우고 새로고침한다. 화면 복원용 저장값은 recordErrorReload가 이미 지웠다. */
  private async clearCachesAndReload() {
    try {
      if ('caches' in window) {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
      }
    } catch {
      // 캐시를 지우지 못해도 새로고침은 한다.
    }
    window.location.reload();
  }

  public render() {
    if (this.state.isStuck) {
      return (
        <main className="flex h-screen items-center justify-center bg-[#f8fafc] p-4">
          <section
            role="alert"
            className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-6"
          >
            <h1 className="text-base font-bold text-slate-900">화면을 열 수 없습니다</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              같은 오류가 되풀이되어 자동 새로고침을 멈췄습니다. 잠시 뒤 다시 시도하고, 문제가
              계속되면 서비스운영팀에 문의해 주세요.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className={`mt-4 ${RELOAD_BTN}`}
            >
              새로고침
            </button>
          </section>
        </main>
      );
    }
    return this.state.hasError ? null : this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>,
);
