import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { login } from '@/entities/auth/api/authApi';
import type { AuthSession } from '@/entities/auth/model/types';
import { MODAL_PRIMARY_BTN } from '@/shared/ui/modalStyles';

interface LoginModalProps {
  /** 없으면 닫을 수 없는 창이다(로그인 전 화면). Escape·바깥 누르기·닫기 버튼이 모두 빠진다. */
  onClose?: () => void;
  /** 로그인에 성공하면 서버가 돌려준 세션을 그대로 넘긴다. 역할 대응은 부르는 쪽(App)이 한다. */
  onLoginSuccess: (session: AuthSession) => void;
}

/**
 * 임시 DB 시드(db/seed.sql)에 들어 있는 예시 계정. 누르면 입력칸을 채운다(로그인은 서버가 판정한다).
 * 시드 값이 바뀌면 함께 바꾼다. 개발 모드(npm run dev)에서만 두고, 배포 빌드에서는 빈 목록이라 화면에도 코드에도 남지 않는다.
 */
const EXAMPLE_ACCOUNTS: readonly { label: string; username: string; password: string }[] =
  import.meta.env.DEV
    ? [
        { label: '테스트계정', username: 'boaz_dev_all', password: 'Boaz!2026' },
        { label: '서비스운영팀장', username: 'boaz_master', password: 'Boaz!2026' },
        { label: '대표진', username: 'boaz_president_1', password: 'Boaz!2026' },
        { label: '운영지원팀', username: 'boaz_ops_1', password: 'Boaz!2026' },
        { label: '서비스운영팀', username: 'boaz_service_1', password: 'Boaz!2026' },
        { label: '스터디장(HOST)', username: 'host_a', password: 'boaz2026!a' },
        { label: 'ADV 팀장(HOST)', username: 'host_adv_ana1', password: 'boaz2026!adv1' },
      ]
    : [];

const FIELD_LABEL = 'mb-1 block text-xs font-semibold text-slate-600';
const FIELD_INPUT =
  'h-9 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-400';
const CLOSE_BTN =
  'rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer';

/**
 * 콘솔 로그인 창. 아이디·비밀번호를 로그인 API(POST /api/v1/auth/login)로 보내고, 성공하면 세션을 넘긴다.
 * 운영진 계정과 HOST 계정 판정은 서버가 한다. 실패하면 서버가 돌려준 사유를 보인다.
 * onClose를 넘기면 Escape나 바깥을 눌러 닫는다.
 */
export function LoginModal({ onClose, onLoginSuccess }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setErrorMessage('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }
    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const session = await login({ username: trimmedUsername, password });
      onLoginSuccess(session);
      onClose?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '로그인하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose?.();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 id="login-title" className="text-base font-bold text-slate-900">
            로그인
          </h3>
          {onClose && (
            <button type="button" onClick={onClose} aria-label="창 닫기" className={CLOSE_BTN}>
              <X size={16} />
            </button>
          )}
        </div>

        <form onSubmit={(event) => void handleLogin(event)} className="space-y-4">
          <div>
            <label htmlFor="login-username" className={FIELD_LABEL}>
              아이디
            </label>
            <input
              id="login-username"
              ref={usernameRef}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              spellCheck={false}
              className={FIELD_INPUT}
            />
          </div>
          <div>
            <label htmlFor="login-password" className={FIELD_LABEL}>
              비밀번호
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className={FIELD_INPUT}
            />
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600"
            >
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className={`h-9 w-full cursor-pointer rounded-sm text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${MODAL_PRIMARY_BTN}`}
          >
            {isSubmitting ? '로그인 중' : '로그인'}
          </button>
        </form>

        {/* 임시 DB의 예시 계정(개발 모드에서만). 누르면 입력칸을 채운다. */}
        {EXAMPLE_ACCOUNTS.length > 0 && (
          <div className="space-y-2 border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-600">예시 계정</p>
            <ul className="divide-y divide-slate-100 text-xs">
              {EXAMPLE_ACCOUNTS.map((account) => (
                <li key={account.username}>
                  <button
                    type="button"
                    onClick={() => {
                      setUsername(account.username);
                      setPassword(account.password);
                      setErrorMessage('');
                    }}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 py-2 text-left transition-colors hover:text-slate-900"
                  >
                    <span className="text-slate-500">{account.label}</span>
                    <span className="text-slate-800">
                      {account.username} / {account.password}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
