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
  const can = (key: string) => me.effectivePermissions.includes(key);
  const isSelf = (account: AdminAccount) => account.id === me.id;
  const canWriteOthers = can('ADMIN_ACCOUNT_WRITE');
  const canWriteSelf = canWriteOthers || can('ADMIN_ACCOUNT_SELF_WRITE');
  const canChangePassword = (account: AdminAccount) =>
    isSelf(account) ? canWriteSelf : canWriteOthers;
  const actions: AccountActions = {
    canEdit: (account) => (isSelf(account) ? canWriteSelf : canWriteOthers),
    canDelete: (account) => !isSelf(account) && can('ADMIN_ACCOUNT_CREATE_DELETE'),
  };
  const pageTitle = accounts ? '운영진 계정 관리' : '내 계정 정보';

  /** API 요청을 보내고 성공하면 데이터를 다시 읽는다. 실패하면 서버가 돌려준 사유를 알린다. */
  const run = async (work: () => Promise<unknown>, successMessage?: string): Promise<boolean> => {
    try {
      await work();
      reload();
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

        {can('ADMIN_ACCOUNT_CREATE_DELETE') && (
          <CreateButton
            label="계정"
            aria-label="새 운영진 계정 발급"
            onClick={() => setFormTarget({ mode: 'create' })}
          />
        )}
      </div>

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
