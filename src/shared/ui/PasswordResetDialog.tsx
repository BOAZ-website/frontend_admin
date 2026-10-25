import { useRef, useState } from 'react';
import { X } from 'lucide-react';

import { useDialogKeyboard } from '@/shared/lib/useDialogKeyboard';

interface PasswordResetDialogProps {
  onClose: () => void;
  /** 입력한 새 비밀번호로 재설정한다. 확인 질문·API 호출·전달문 띄우기는 부르는 쪽이 한다. */
  onSubmit: (newPassword: string) => void;
}

/**
 * 비밀번호 재생성 창. 새 비밀번호 한 칸을 관리자가 직접 입력한다.
 * 출결의 그룹 계정 관리(HOST 계정) 창과 같은 모양·흐름으로 만들었다. 지금은 운영진 계정 관리가 쓰고, 출결 화면은 자체 창을 쓴다.
 * 재설정이 끝나면 부르는 쪽이 AccountDeliveryDialog로 전달문을 띄운다.
 */
export function PasswordResetDialog({ onClose, onSubmit }: PasswordResetDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  // Escape는 창 안 빈 곳을 눌러 포커스가 빠져도 받고, Tab 포커스는 창 안에서만 돈다.
  const panelRef = useRef<HTMLFormElement>(null);
  useDialogKeyboard(panelRef, onClose);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newPassword.trim()) return;
    onSubmit(newPassword);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-reset-title"
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <form
        ref={panelRef}
        onSubmit={submit}
        className="w-full max-w-sm overflow-hidden rounded-md border border-slate-200 bg-white shadow-[0_24px_60px_-18px_rgba(15,23,42,0.38)]"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 id="password-reset-title" className="text-sm font-bold text-slate-900">
            비밀번호 재생성
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="비밀번호 재생성 창 닫기"
            className="flex size-9 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div>
            <label
              htmlFor="password-reset-input"
              className="mb-1.5 block text-xs font-semibold text-slate-700"
            >
              새 비밀번호
            </label>
            <input
              id="password-reset-input"
              type="text"
              required
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="새 비밀번호 직접 입력"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-sm border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={!newPassword.trim()}
            className="w-full rounded-sm border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            비밀번호 재생성
          </button>
        </div>
      </form>
    </div>
  );
}
