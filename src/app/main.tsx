import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import type { ErrorInfo, ReactNode } from 'react';

import App from './App.tsx';

import './styles/index.css';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, showDetails: false };
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
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xl shadow-slate-200/50 text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Minimal Modern Icon */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-xs">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                오류가 발생했습니다
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
                서비스 이용 중 일시적인 문제가 발생했습니다.
                <br />
                문제가 지속될 경우{' '}
                <span className="font-bold text-slate-700">관리자(서비스운영팀)</span>에게 문의해
                주세요.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.reload();
                }}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white bg-slate-900 hover:bg-slate-800 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
              >
                페이지 새로고침
              </button>

              <button
                type="button"
                onClick={() => {
                  alert(
                    'BOAZ 서비스운영팀 (카카오톡 채널 @BOAZ 또는 운영진 슬랙)으로 문의해 주시기 바랍니다.',
                  );
                }}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-colors cursor-pointer border border-slate-200"
              >
                관리자(서비스운영팀) 문의
              </button>
            </div>

            {/* Subtle Collapsible Technical Details for Devs */}
            {this.state.error && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                  className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer underline"
                >
                  {this.state.showDetails ? '상세 정보 닫기' : '기술 세부 정보 보기'}
                </button>

                {this.state.showDetails && (
                  <pre className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-left text-rose-600 font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                    {this.state.error.toString()}
                  </pre>
                )}
              </div>
            )}
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
