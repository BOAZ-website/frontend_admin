import { useState } from 'react';
import { Eye, EyeOff, RefreshCw, X } from 'lucide-react';

import type { AdminPasswordRequest } from '@/entities/admin-account/model/dto';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import { randomPassword } from '@/pages/system-accounts/ui/accountLabels';
import {
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXT_BTN,
  MODAL_BACKDROP,
  MODAL_CANCEL_BTN,
  MODAL_CLOSE_BTN,
  MODAL_CONFIRM_BTN,
} from '@/pages/system-accounts/ui/systemStyles';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';

interface PasswordModalProps {
  account: AdminAccount;
  /** 본인 계정이면 현재 비밀번호를 확인한다. */
  isSelf: boolean;
  onClose: () => void;
  onSubmit: (request: AdminPasswordRequest) => Promise<boolean>;
}

/** 비밀번호 변경(본인)·재설정(다른 계정) 팝업. 비밀번호 정책 검사는 서버가 한다. */
export function PasswordModal({ account, isSelf, onClose, onSubmit }: PasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isMismatch = confirmPassword !== '' && newPassword !== confirmPassword;
  const canSave =
    !isSaving &&
    Boolean(newPassword) &&
    newPassword === confirmPassword &&
    (!isSelf || Boolean(currentPassword));

  const fillRandom = () => {
    const generated = randomPassword();
    setNewPassword(generated);
    setConfirmPassword(generated);
    // 만든 비밀번호를 전달해야 하므로 보이게 바꾼다.
    setIsPasswordVisible(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    setIsSaving(true);
    const isSaved = await onSubmit(isSelf ? { newPassword, currentPassword } : { newPassword });
    setIsSaving(false);
    if (isSaved) onClose();
  };

  return (
    <div
      className={MODAL_BACKDROP}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-modal-title"
        className={`w-full max-w-md space-y-4 rounded-lg p-6 animate-in fade-in duration-150 ${MODAL_SURFACE}`}
      >
        <div className="flex items-center justify-between">
          <h3 id="password-modal-title" className="text-base font-bold text-slate-900">
            {isSelf ? '내 비밀번호 변경' : `비밀번호 재설정 · ${account.name}`}
          </h3>
          <button type="button" onClick={onClose} className={MODAL_CLOSE_BTN} aria-label="창 닫기">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 text-xs">
          {isSelf && (
            <div>
              <label htmlFor="current-password" className={FIELD_LABEL}>
                현재 비밀번호 *
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="현재 사용 중인 비밀번호"
                autoComplete="current-password"
                className={`${FIELD_INPUT} font-mono`}
              />
            </div>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="new-password" className="text-[11px] font-semibold text-slate-500">
                새 비밀번호 *
              </label>
              <button type="button" onClick={fillRandom} className={FIELD_TEXT_BTN}>
                <RefreshCw size={11} aria-hidden="true" />
                임의 비밀번호 생성
              </button>
            </div>
            <div className="relative">
              <input
                id="new-password"
                type={isPasswordVisible ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="8자 이상, 영문·숫자·특수문자(!@#$%^&*) 포함"
                autoComplete="new-password"
                spellCheck={false}
                className={`${FIELD_INPUT} pr-10 font-mono`}
              />
              <button
                type="button"
                onClick={() => setIsPasswordVisible((value) => !value)}
                aria-label={isPasswordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
                className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                {isPasswordVisible ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-password" className={FIELD_LABEL}>
              새 비밀번호 확인 *
            </label>
            <input
              id="confirm-password"
              type={isPasswordVisible ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="새 비밀번호 다시 입력"
              autoComplete="new-password"
              spellCheck={false}
              aria-invalid={isMismatch}
              className={`${FIELD_INPUT} font-mono`}
            />
            {isMismatch && (
              <p className="mt-1.5 text-[11px] text-red-600">새 비밀번호와 같지 않습니다.</p>
            )}
          </div>

          <p className="rounded-md border border-slate-200 bg-slate-50 px-3.5 py-3 text-[11px] leading-5 text-slate-600">
            {isSelf
              ? '현재 비밀번호를 확인한 뒤 변경하며, 변경하면 기존 로그인이 모두 해제됩니다.'
              : '현재 비밀번호 없이 바로 재설정하며, 해당 계정의 기존 로그인이 모두 해제됩니다.'}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3.5">
          <button type="button" onClick={onClose} className={MODAL_CANCEL_BTN}>
            취소
          </button>
          <button type="submit" disabled={!canSave} className={MODAL_CONFIRM_BTN}>
            {isSelf ? '변경' : '재설정'}
          </button>
        </div>
      </form>
    </div>
  );
}
