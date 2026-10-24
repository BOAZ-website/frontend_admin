import { Component } from 'react';
import { createRoot } from 'react-dom/client';
import type { ErrorInfo, ReactNode } from 'react';

import App from './App.tsx';

import './styles/index.css';

/** 오류로 새로고침한 직후인지 표시하는 키. 새로고침해도 같은 오류가 나면 다시 새로고침하지 않는다. */
const ERROR_RELOAD_KEY = 'boaz_error_reloaded';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

/** 화면에서 처리하지 못한 오류를 브라우저 기본 알림창으로 알리고 새로고침한다. */
class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
    window.alert('오류가 발생했습니다.\n문제가 계속되면 서비스운영팀에 문의해 주세요.');
    void this.resetAndReload();
  }

  /** 화면 상태를 저장한 값과 캐시를 지우고 새로고침한다. 방금 이렇게 새로고침했으면 다시 하지 않는다. */
  private async resetAndReload() {
    try {
      if (sessionStorage.getItem(ERROR_RELOAD_KEY)) return;
      sessionStorage.setItem(ERROR_RELOAD_KEY, '1');
      localStorage.removeItem('boaz_sidebar_open_v2');
      localStorage.removeItem('boaz_sidebar_open');
      localStorage.removeItem('boaz_sidebar_expanded_sections');
      localStorage.removeItem('boaz_active_page');
      if ('caches' in window) {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
      }
    } catch {
      // 저장소를 쓸 수 없어도 새로고침은 한다.
    }
    window.location.reload();
  }

  public render() {
    return this.state.hasError ? null : this.props.children;
  }
}

// 오류 없이 화면을 그렸으면 다음 오류 때 다시 새로고침할 수 있게 표시를 지운다.
window.setTimeout(() => {
  try {
    sessionStorage.removeItem(ERROR_RELOAD_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 표시도 남지 않는다.
  }
}, 5000);

createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>,
);
