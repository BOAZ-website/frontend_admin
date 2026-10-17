import { useState } from 'react';

import {
  changeAdminPassword,
  createAdminAccount,
  deleteAdminAccount,
  updateAdminAccount,
} from '@/entities/admin-account/api/adminAccountApi';
import type {
  AdminAccountCreateRequest,
  AdminPasswordRequest,
} from '@/entities/admin-account/model/dto';
import { can } from '@/entities/admin-account/model/can';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import { useAdminConsole } from '@/pages/system-accounts/model/useAdminConsole';
import { AccountFormModal } from '@/pages/system-accounts/ui/AccountFormModal';
import { AccountsTable, type AccountActions } from '@/pages/system-accounts/ui/AccountsTable';
import { MyAccountCard } from '@/pages/system-accounts/ui/MyAccountCard';
import { PasswordModal } from '@/pages/system-accounts/ui/PasswordModal';
import { alertApiError } from '@/shared/lib/alertApiError';
import { CreateButton } from '@/shared/ui/CreateButton';

/** 계정 발급·수정 팝업 대상. */
type FormTarget = { mode: 'create' } | { mode: 'edit'; account: AdminAccount };

/**
 * 운영진 계정 관리 화면.
 * 데이터는 모두 API(백엔드 연결 전에는 임시 API)로 읽고 쓴다. 메뉴·버튼은 로그인한 계정의
 * 유효 권한(/me)으로 보이거나 숨기고, 최종 판정은 서버가 한다(권한이 없으면 403).
 */
export function SystemAccountsPage() {
  const { data, error, reload } = useAdminConsole();
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AdminAccount | null>(null);

  if (!data) {
    return (
      <p
        role="status"
        className={`rounded-md border px-4 py-3 text-xs ${
          error
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-slate-200 bg-white text-slate-500'
        }`}
      >
        {error
          ? `계정 정보를 불러오지 못했습니다. (${error.message})`
          : '계정 정보를 불러오는 중입니다.'}
      </p>
    );
  }

  const { me, catalog, accounts, members } = data;
  // 계정 발급 때 고를 수 있는 동아리원: 아직 운영진 계정이 없는 회원.
  const linkedUserIds = new Set(accounts?.map((account) => account.userId) ?? [me.userId]);
  const selectableMembers = (members ?? []).filter((member) => !linkedUserIds.has(member.id));
  const isSelf = (account: AdminAccount) => account.id === me.id;
  const canWriteOthers = can(me, 'ADMIN_ACCOUNT_WRITE');
  const canWriteSelf = canWriteOthers || can(me, 'ADMIN_ACCOUNT_SELF_WRITE');
  const canChangePassword = (account: AdminAccount) =>
    isSelf(account) ? canWriteSelf : canWriteOthers;
  const actions: AccountActions = {
    canEdit: (account) => (isSelf(account) ? canWriteSelf : canWriteOthers),
    canDelete: (account) => !isSelf(account) && can(me, 'ADMIN_ACCOUNT_CREATE_DELETE'),
  };
  const pageTitle = accounts ? '운영진 계정 관리' : '내 계정 정보';

  /**
   * API 요청을 보내고 성공하면 데이터를 다시 읽는다. 실패하면 서버가 돌려준 사유를 알린다.
   * 다시 읽기가 끝난 뒤에 돌아가므로, 화면은 갱신된 데이터로 다음 동작을 받는다.
   */
  const run = async (work: () => Promise<unknown>, successMessage?: string): Promise<boolean> => {
    try {
      await work();
      await reload();
      if (successMessage) window.alert(successMessage);
      return true;
    } catch (requestError) {
      alertApiError(requestError);
      return false;
    }
  };

  const submitForm = (form: AdminAccountCreateRequest) => {
    if (!formTarget) return Promise.resolve(false);
    if (formTarget.mode === 'create') {
      return run(() => createAdminAccount(form), '운영진 계정을 발급했습니다.');
    }
    const { account } = formTarget;
    const canChangeRole = canWriteOthers && !isSelf(account);
    if (!canChangeRole) return Promise.resolve(false);
    return run(() => updateAdminAccount(account.id, { role: form.role, teamName: form.teamName }));
  };

  const submitPassword = (request: AdminPasswordRequest) =>
    passwordTarget
      ? run(() => changeAdminPassword(passwordTarget.id, request), '비밀번호를 변경했습니다.')
      : Promise.resolve(false);

  const deleteAccount = (account: AdminAccount) => {
    if (!window.confirm(`운영진 계정 '${account.username} (${account.name})'을(를) 삭제할까요?`)) {
      return;
    }
    void run(() => deleteAdminAccount(account.id), '계정을 삭제했습니다.');
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 제목 영역 */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{pageTitle}</h1>

        {can(me, 'ADMIN_ACCOUNT_CREATE_DELETE') && (
          <CreateButton
            label="계정"
            aria-label="새 운영진 계정 발급"
            onClick={() => setFormTarget({ mode: 'create' })}
          />
        )}
      </div>

      {/* 다시 읽기에 실패하면 화면에 남은 값이 최신이 아닐 수 있다. */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600"
        >
          <span>
            계정 정보를 다시 불러오지 못해 화면이 최신이 아닐 수 있습니다. ({error.message})
          </span>
          <button
            type="button"
            onClick={() => void reload()}
            className="shrink-0 cursor-pointer rounded-sm border border-red-200 bg-white px-2.5 py-1 font-semibold hover:bg-red-100"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 목록 조회 권한이 있으면 전체 계정, 없으면 본인 정보 */}
      {accounts ? (
        <AccountsTable
          catalog={catalog}
          accounts={accounts}
          actions={actions}
          onEdit={(account) => setFormTarget({ mode: 'edit', account })}
          onDelete={deleteAccount}
        />
      ) : (
        <MyAccountCard
          catalog={catalog}
          me={me}
          canEditSelf={canWriteSelf}
          onChangePassword={() => setPasswordTarget(me)}
        />
      )}

      {formTarget && (
        <AccountFormModal
          catalog={catalog}
          account={formTarget.mode === 'edit' ? formTarget.account : undefined}
          members={selectableMembers}
          canChangeRole={
            formTarget.mode === 'create' || (canWriteOthers && !isSelf(formTarget.account))
          }
          onClose={() => setFormTarget(null)}
          onResetPassword={
            formTarget.mode === 'edit' && canChangePassword(formTarget.account)
              ? () => {
                  setPasswordTarget(formTarget.account);
                  setFormTarget(null);
                }
              : undefined
          }
          onSubmit={submitForm}
        />
      )}

      {passwordTarget && (
        <PasswordModal
          account={passwordTarget}
          isSelf={isSelf(passwordTarget)}
          onClose={() => setPasswordTarget(null)}
          onSubmit={submitPassword}
        />
      )}
    </div>
  );
}
