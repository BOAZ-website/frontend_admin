import { useEffect, useRef, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';

/** 복사 완료 표시를 보여 주는 시간. */
const COPIED_NOTICE_MS = 2000;

interface AccountDeliveryDialogProps {
  /** 창 제목 앞부분. 뒤에 '계정 전달문'이 붙는다. 예: '전혜린 비밀번호 재설정' */
  title: string;
  /** 전달문. 보내기 전에 고칠 수 있다. */
  text: string;
  onTextChange: (text: string) => void;
  onClose: () => void;
}

/**
 * 계정 전달문 창(카카오톡·슬랙 전달용). 계정 발급이나 비밀번호 재설정 뒤에 띄워, 아이디·비밀번호 안내를 복사하게 한다.
 * 출결의 그룹 계정 관리(HOST 계정) 창과 같은 모양·흐름으로 만들었다. 지금은 운영진 계정 관리가 쓰고, 출결 화면은 자체 창을 쓴다.
 */
export function AccountDeliveryDialog({
  title,
  text,
  onTextChange,
  onClose,
}: AccountDeliveryDialogProps) {
  const [isCopied, setIsCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isCopied) return undefined;
    const timer = window.setTimeout(() => setIsCopied(false), COPIED_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [isCopied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
    } catch {
      // 브라우저가 클립보드 접근을 막으면 글을 골라 두어 직접 복사하게 한다.
      textRef.current?.select();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-delivery-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_24px_60px_-18px_rgba(15,23,42,0.38)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3
            id="account-delivery-title"
            className="min-w-0 text-sm font-bold text-slate-900 text-wrap-balance"
          >
            {title} 계정 전달문
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="전달문 닫기"
            className="flex size-10 shrink-0 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          <textarea
            ref={textRef}
            rows={11}
            aria-label="계정 전달문 내용"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            className="w-full resize-none rounded-sm border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-700 outline-none transition-[background-color,border-color,box-shadow] focus:border-slate-400 focus:bg-white focus:ring-3 focus:ring-slate-100"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:border-slate-400 hover:bg-slate-50 active:scale-[0.97] cursor-pointer"
            >
              {isCopied ? <Check size={13} /> : <Copy size={13} />}
              <span>{isCopied ? '복사 완료' : '전달문 복사'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
