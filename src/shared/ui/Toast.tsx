import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/** 토스트 하나. id가 바뀌면 같은 문구라도 표시 시간을 다시 센다. */
export interface ToastMessage {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

const TOAST_DURATION_MS = 3000;

const TONE_CLASS: Record<ToastMessage['tone'], string> = {
  success: 'bg-slate-800 text-white',
  error: 'bg-rose-700 text-white',
};

/**
 * 화면 아래쪽에 잠깐 떴다 사라지는 알림. 저장 성공·일반 저장 실패처럼 화면을 막지 않을 안내에 쓴다.
 * 화면별 스타일(예: 서류 평가의 `.evaluation-page`)의 영향을 받지 않도록 body에 그린다.
 */
export function Toast({ toast, onClose }: ToastProps) {
  // 부모가 그릴 때마다 새 onClose를 넘겨도 표시 시간이 다시 시작되지 않게 최신 함수만 기억한다.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => onCloseRef.current(), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return createPortal(
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={`fixed bottom-6 left-1/2 z-70 -translate-x-1/2 rounded-md px-4 py-3 text-sm font-medium shadow-lg ${TONE_CLASS[toast.tone]}`}
    >
      {toast.message}
    </div>,
    document.body,
  );
}
