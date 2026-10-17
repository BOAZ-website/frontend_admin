import { useMemo, useState } from 'react';
import { AlertTriangle, Eye, EyeOff, RefreshCw, Search, X } from 'lucide-react';

import {
  baseSetKeyIn,
  baseSetLabelIn,
  isValidCombinationIn,
} from '@/entities/admin-account/model/catalog';
import type { AdminAccountCreateRequest } from '@/entities/admin-account/model/dto';
import type {
  AdminAccount,
  AdminRole,
  PermissionCatalog,
} from '@/entities/admin-account/model/types';
import type { ClubMember } from '@/entities/club-member/model/types';
import {
  ROLE_DESCRIPTIONS,
  ROLE_OPTIONS,
  randomPassword,
} from '@/pages/system-accounts/ui/accountLabels';
import {
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_READONLY,
  FIELD_TEXT_BTN,
  MODAL_BACKDROP,
  MODAL_CANCEL_BTN,
  MODAL_CLOSE_BTN,
  MODAL_CONFIRM_BTN,
} from '@/pages/system-accounts/ui/systemStyles';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';

type AccountForm = AdminAccountCreateRequest;

interface AccountFormModalProps {
  catalog: PermissionCatalog;
  /** 없으면 새 계정 발급, 있으면 그 계정 수정. */
  account?: AdminAccount;
  /** 발급할 때 고를 수 있는 회원(아직 운영진 계정이 없는 동아리원). */
  members?: readonly ClubMember[];
  /** 역할·부서를 바꿀 수 있는지(발급이거나, 타 계정 정보 수정 권한이 있고 본인 계정이 아닐 때). */
  canChangeRole: boolean;
  onClose: () => void;
  /** 수정 팝업에서 비밀번호 재설정 팝업을 연다. 권한이 없으면 넘기지 않는다. */
  onResetPassword?: () => void;
  /** 저장에 성공하면 true. 실패하면 팝업을 그대로 둔다. */
  onSubmit: (form: AccountForm) => Promise<boolean>;
}

const emptyForm = (catalog: PermissionCatalog): AccountForm => ({
  userId: '',
  username: '',
  password: randomPassword(),
  role: 'TEAM',
  teamName: catalog.teamNames.includes('서비스운영팀') ? '서비스운영팀' : catalog.teamNames[0],
});

const formOf = (account: AdminAccount): AccountForm => ({
  userId: account.userId,
  username: account.username,
  password: '',
  role: account.role,
  teamName: account.teamName,
});

/** 회원 한 줄 표시: 이름 · 기수 · 부문 */
const memberLine = (member: Pick<ClubMember, 'name' | 'term'> & { track: string }) =>
  `${member.name} · ${member.term}기 · ${member.track}`;

/**
 * 운영진 계정 발급·수정 팝업. 운영진은 모두 회원이므로, 발급할 때는 동아리원을 골라 계정을 만든다.
 * 이름·기수·부문은 회원 정보를 그대로 쓰고(동아리원 관리에서 고친다), 여기서는 역할·부서만 정한다.
 */
export function AccountFormModal({
  catalog,
  account,
  members = [],
  canChangeRole,
  onClose,
  onResetPassword,
  onSubmit,
}: AccountFormModalProps) {
  const isCreate = !account;
  const [form, setForm] = useState<AccountForm>(() =>
    account ? formOf(account) : emptyForm(catalog),
  );
  const [memberQuery, setMemberQuery] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const update = (patch: Partial<AccountForm>) => setForm((current) => ({ ...current, ...patch }));

  const selectedMember = members.find((member) => member.id === form.userId);
  const matchedMembers = useMemo(() => {
    const text = memberQuery.trim();
    return text ? members.filter((member) => member.name.includes(text)) : members;
  }, [memberQuery, members]);

  const isValidCombination = isValidCombinationIn(catalog, form.role, form.teamName);
  const isChanged = !account || form.role !== account.role || form.teamName !== account.teamName;
  // 역할·부서가 바뀌면 기본 권한 세트가 같아도 서버가 따로 조정한 권한을 모두 지운다.
  const exceptionsToDrop = account && isChanged ? Object.keys(account.overrides).length : 0;
  const canSave =
    !isSaving &&
    isChanged &&
    isValidCombination &&
    (!isCreate ||
      (Boolean(form.userId) && Boolean(form.username.trim()) && Boolean(form.password)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave) return;
    if (
      exceptionsToDrop > 0 &&
      !window.confirm(
        `역할·부서를 바꾸면 이 계정에 따로 조정한 권한 ${exceptionsToDrop}개가 모두 지워지고 기본 권한으로 돌아갑니다. 저장할까요?`,
      )
    ) {
      return;
    }
    setIsSaving(true);
    const isSaved = await onSubmit({ ...form, username: form.username.trim() });
    setIsSaving(false);
    if (isSaved) onClose();
  };

  const titleId = isCreate ? 'create-account-title' : 'edit-account-title';
  const baseKey = baseSetKeyIn(catalog, form.role, form.teamName);

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
        aria-labelledby={titleId}
        className={`w-full max-w-lg space-y-4 rounded-lg p-6 animate-in fade-in duration-150 ${MODAL_SURFACE}`}
      >
        <div className="flex items-center justify-between">
          <h3 id={titleId} className="text-base font-bold text-slate-900">
            {isCreate ? '운영진 계정 발급' : '운영진 계정'}
          </h3>
          <button type="button" onClick={onClose} className={MODAL_CLOSE_BTN} aria-label="창 닫기">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-x-4 gap-y-5 text-xs sm:grid-cols-2">
          {/* 회원: 발급할 때는 동아리원을 고르고, 수정할 때는 보여 주기만 한다. */}
          <div className="sm:col-span-2">
            <span className={FIELD_LABEL}>회원</span>
            {account ? (
              <div className={FIELD_READONLY}>{memberLine(account)}</div>
            ) : (
              <>
                <div className="overflow-hidden rounded-sm border border-slate-200">
                  <div className="relative border-b border-slate-200">
                    <Search
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      value={memberQuery}
                      onChange={(event) => setMemberQuery(event.target.value)}
                      placeholder="이름으로 동아리원 찾기"
                      aria-label="동아리원 이름 검색"
                      className="h-9 w-full pl-8 pr-3 text-sm outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <ul
                    role="listbox"
                    aria-label="동아리원"
                    className="max-h-44 overflow-y-auto py-1"
                  >
                    {matchedMembers.length === 0 && (
                      <li className="px-3 py-3 text-center text-slate-400">
                        계정을 만들 수 있는 동아리원이 없습니다.
                      </li>
                    )}
                    {matchedMembers.map((member) => {
                      const isSelected = member.id === form.userId;
                      return (
                        <li key={member.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => update({ userId: member.id })}
                            className={`flex w-full cursor-pointer items-center px-3 py-2 text-left text-sm transition-colors ${
                              isSelected
                                ? 'bg-slate-100 font-semibold text-slate-950'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {memberLine(member)}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {selectedMember && (
                  <p className="mt-1.5 text-[11px] font-semibold text-slate-700">
                    선택: {memberLine(selectedMember)}
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            {isCreate ? (
              <>
                <label htmlFor="account-username" className={FIELD_LABEL}>
                  아이디
                </label>
                <input
                  id="account-username"
                  value={form.username}
                  onChange={(event) => update({ username: event.target.value })}
                  placeholder="예: boaz_team2"
                  autoComplete="off"
                  className={`${FIELD_INPUT} font-mono`}
                />
              </>
            ) : (
              <>
                <span className={FIELD_LABEL}>아이디</span>
                <div className={`${FIELD_READONLY} font-mono`}>{form.username}</div>
              </>
            )}
          </div>

          {isCreate ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label
                  htmlFor="account-password"
                  className="text-[11px] font-semibold text-slate-500"
                >
                  초기 비밀번호
                </label>
                <button
                  type="button"
                  onClick={() => update({ password: randomPassword() })}
                  className={FIELD_TEXT_BTN}
                >
                  <RefreshCw size={11} aria-hidden="true" />
                  새로 만들기
                </button>
              </div>
              <div className="relative">
                <input
                  id="account-password"
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => update({ password: event.target.value })}
                  autoComplete="new-password"
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
          ) : (
            <div />
          )}

          <div>
            <span className={FIELD_LABEL}>역할</span>
            {canChangeRole ? (
              <SelectDropdown<AdminRole>
                ariaLabel="역할"
                value={form.role}
                options={ROLE_OPTIONS}
                onChange={(role) => update({ role })}
                buttonClassName="h-10 w-full"
              />
            ) : (
              <div className={FIELD_READONLY}>
                {form.role} ({ROLE_DESCRIPTIONS[form.role]})
              </div>
            )}
          </div>
          <div>
            <span className={FIELD_LABEL}>소속 부서</span>
            {canChangeRole ? (
              <SelectDropdown<string>
                ariaLabel="소속 부서"
                value={form.teamName}
                options={catalog.teamNames.map((team) => ({ value: team, label: team }))}
                onChange={(teamName) => update({ teamName })}
                buttonClassName="h-10 w-full"
              />
            ) : (
              <div className={FIELD_READONLY}>{form.teamName}</div>
            )}
          </div>
        </div>

        {isValidCombination ? (
          <p className="text-[11px] text-slate-500">
            기본 권한{' '}
            <strong className="font-semibold text-slate-900">
              {baseSetLabelIn(catalog, baseKey)}
            </strong>
            {exceptionsToDrop > 0 && (
              <span className="text-amber-700">
                {' '}
                · 저장하면 따로 조정한 권한 {exceptionsToDrop}개가 기본값으로 돌아갑니다
              </span>
            )}
          </p>
        ) : (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] text-amber-800"
          >
            <AlertTriangle size={13} aria-hidden="true" />이 역할·부서 조합은 만들 수 없습니다.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3.5">
          {onResetPassword && (
            <button type="button" onClick={onResetPassword} className={`mr-auto ${FIELD_TEXT_BTN}`}>
              비밀번호 재설정
            </button>
          )}
          <button type="button" onClick={onClose} className={MODAL_CANCEL_BTN}>
            {canChangeRole ? '취소' : '닫기'}
          </button>
          {canChangeRole && (
            <button type="submit" disabled={!canSave} className={MODAL_CONFIRM_BTN}>
              {isCreate ? '발급' : '저장'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
