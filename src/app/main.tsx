import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

import App from './App.tsx';

import './styles/index.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen bg-slate-50 flex items-center justify-center p-6 select-none"
          style={{
            fontFamily:
              "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
          }}
        >
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 animate-in fade-in duration-150">
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <AlertCircle size={18} className="shrink-0 text-red-600" aria-hidden="true" />
              일시적인 오류가 발생했습니다
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              새로고침해도 같은 화면이 나오면 아래 오류 내용과 함께 서비스운영팀에 문의해 주세요.
            </p>

            {/* 문의할 때 전달할 수 있도록 오류 메시지를 그대로 보여 준다. */}
            {this.state.error?.message && (
              <p className="mt-4 line-clamp-3 select-text break-all rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
                {this.state.error.message}
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  try {
                    localStorage.removeItem('boaz_sidebar_open_v2');
                    localStorage.removeItem('boaz_sidebar_open');
                    localStorage.removeItem('boaz_sidebar_expanded_sections');
                    localStorage.removeItem('boaz_active_page');
                    await Promise.all(
                      'caches' in window
                        ? (await window.caches.keys()).map((cacheName) =>
                            window.caches.delete(cacheName),
                          )
                        : [],
                    );
                  } finally {
                    window.location.reload();
                  }
                }}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-sm bg-slate-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                <RotateCcw size={14} aria-hidden="true" />
                <span>페이지 새로고침</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>,
);
