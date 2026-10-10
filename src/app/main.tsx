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
          <div className="max-w-sm w-full bg-white rounded-2xl p-7 border border-slate-200/80 shadow-[0_12px_36px_rgba(0,0,0,0.04)] text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Soft Pastel Badge Icon */}
            <div className="w-12 h-12 rounded-2xl bg-rose-50/80 border border-rose-100/80 flex items-center justify-center text-rose-400 mx-auto shadow-2xs">
              <AlertCircle size={22} strokeWidth={1.8} />
            </div>

            {/* Title & Description */}
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-slate-800 tracking-tight">
                일시적인 오류가 발생했습니다
              </h2>
              <p className="text-xs text-slate-500 font-normal leading-relaxed">
                여기서 문제가 지속될 경우 서비스운영팀에 문의해주세요.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
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
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-sky-500 hover:bg-sky-600 active:scale-[0.99] transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={13} />
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
