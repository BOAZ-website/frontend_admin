import { useState } from 'react';

import {
  changeAdminPassword,
  createAdminAccount,
  deleteAdminAccount,
  issueAdminCredentials,
  saveAccountPermissions,
  updateAdminAccount,
} from '@/entities/admin-account/api/adminAccountApi';
import type {
  AdminAccountCreateRequest,
  AdminCredentialsRequest,
  AdminPasswordRequest,
} from '@/entities/admin-account/model/dto';
import { can } from '@/entities/admin-account/model/can';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import { useAdminConsole } from '@/pages/system-accounts/model/useAdminConsole';
import { AccountFormModal } from '@/pages/system-accounts/ui/AccountFormModal';
import { AccountPermissionsTab } from '@/pages/system-accounts/ui/AccountPermissionsTab';
import { AccountsTab, type AccountActions } from '@/pages/system-accounts/ui/AccountsTab';
import { CredentialIssueModal } from '@/pages/system-accounts/ui/CredentialIssueModal';
import { MyAccountCard } from '@/pages/system-accounts/ui/MyAccountCard';
import { PasswordModal } from '@/pages/system-accounts/ui/PasswordModal';
import { alertApiError } from '@/shared/lib/alertApiError';
import { AccountDeliveryDialog } from '@/shared/ui/AccountDeliveryDialog';
import { CreateButton } from '@/shared/ui/CreateButton';
import { PasswordResetDialog } from '@/shared/ui/PasswordResetDialog';

/** 계정 발급·수정 팝업 대상. */
type FormTarget = { mode: 'create' } | { mode: 'edit'; account: AdminAccount };

/** 사이드바에서 고른 화면: 운영진 계정 관리 또는 계정별 권한 관리. */
export type SystemAccountsView = 'accounts' | 'permissions';

interface SystemAccountsPageProps {
  view?: SystemAccountsView;
  /** 계정 표의 권한 버튼처럼 화면 안에서 다른 화면으로 옮길 때 사이드바 선택도 함께 바꾼다. */
  onViewChange?: (view: SystemAccountsView) => void;
}

/**
 * 운영진 계정 관리와 계정별 권한 관리 화면. 두 화면이 같은 데이터를 쓰므로 한 컴포넌트에서 그린다.
 * 데이터는 모두 API(백엔드 연결 전에는 임시 API)로 읽고 쓴다. 메뉴·버튼은 로그인한 계정의
 * 유효 권한(/me)으로 보이거나 숨기고, 최종 판정은 서버가 한다(권한이 없으면 403).
 */
export function SystemAccountsPage({ view = 'accounts', onViewChange }: SystemAccountsPageProps) {
  const { data, error, reload } = useAdminConsole();
  /** 계정별 권한 관리에서 고른 사람(AccountHolder.key, 보통 회원 id). */
  const [permissionTargetKey, setPermissionTargetKey] = useState<string | null>(null);
  // 운영진 계정 화면으로 돌아오면 고른 사람을 지운다. 그래야 메뉴로 권한 관리에 들어올 때 권한 매트릭스가
  // 먼저 열리고, 계정 표의 권한 버튼으로 들어올 때만 그 사람이 열린다.
  const [prevView, setPrevView] = useState(view);
  if (view !== prevView) {
    setPrevView(view);
    if (view === 'accounts') setPermissionTargetKey(null);
  }
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AdminAccount | null>(null);
  /** "+ 계정"으로 여는 계정 발급 창. */
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  /** 계정을 발급하거나 다른 계정의 비밀번호를 재설정한 뒤 띄우는 전달문. */
  const [delivery, setDelivery] = useState<{ title: string; text: string } | null>(null);

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

  const { me, catalog, accounts, holders, members } = data;
  // 계정 발급 때 고를 수 있는 동아리원: 아직 운영진 계정이 없는 회원.
  const linkedUserIds = new Set(accounts?.map((account) => account.userId) ?? [me.userId]);
  const selectableMembers = (members ?? []).filter((member) => !linkedUserIds.has(member.id));
  const isSelf = (account: AdminAccount) => account.id === me.id;
  const canWriteOthers = can(me, 'ADMIN_ACCOUNT_WRITE');
  const canWriteSelf = canWriteOthers || can(me, 'ADMIN_ACCOUNT_SELF_WRITE');
  const canManagePermissions = can(me, 'ADMIN_PERMISSION_WRITE');
  const canChangePassword = (account: AdminAccount) =>
    isSelf(account) ? canWriteSelf : canWriteOthers;
  const actions: AccountActions = {
    permissionBlockReason: canManagePermissions
      ? null
      : '운영진 계정 권한 부여(커스텀) 권한이 있어야 바꿀 수 있습니다.',
    passwordResetBlockReason: (account) => {
      // 계정을 아직 발급하지 않은 운영진은 바꿀 비밀번호가 없다.
      if (account.username === null) return '계정을 발급하지 않아 재설정할 비밀번호가 없습니다.';
      if (!canChangePassword(account)) return '다른 운영진의 비밀번호를 재설정할 권한이 없습니다.';
      return null;
    },
    deleteBlockReason: (account) => {
      if (account.role === 'MASTER') return '서비스운영팀장(MASTER) 계정은 삭제할 수 없습니다.';
      if (isSelf(account)) return '본인 계정은 삭제할 수 없습니다.';
      if (!can(me, 'ADMIN_ACCOUNT_CREATE_DELETE')) return '운영진 계정을 삭제할 권한이 없습니다.';
      return null;
    },
  };
  const isPermissionsView = view === 'permissions';
  const pageTitle = isPermissionsView
    ? '계정별 권한 관리'
    : accounts
      ? '운영진 계정 관리'
      : '내 계정 정보';

  const openPermissions = (account: AdminAccount) => {
    setPermissionTargetKey(account.userId);
    onViewChange?.('permissions');
  };

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

  /** 본인 비밀번호 변경. 현재 비밀번호를 확인하고, 끝나면 알림만 띄운다. */
  const submitOwnPassword = (request: AdminPasswordRequest) =>
    passwordTarget
      ? run(() => changeAdminPassword(passwordTarget.id, request), '비밀번호를 변경했습니다.')
      : Promise.resolve(false);

  /**
   * 다른 계정의 비밀번호 재설정. 출결의 그룹 계정 관리와 같은 흐름이다:
   * 새 비밀번호 입력 → 한 번 더 확인 → 재설정 → 본인에게 보낼 전달문 창.
   * 비밀번호 규칙 검사는 서버가 한다.
   */
  const resetOthersPassword = async (newPassword: string) => {
    if (!passwordTarget) return;
    const target = passwordTarget;
    if (!window.confirm(`${target.name}님 계정의 비밀번호를 정말 재설정할까요?`)) return;
    const isReset = await run(() => changeAdminPassword(target.id, { newPassword }));
    if (!isReset) return;
    setPasswordTarget(null);
    setDelivery({
      title: `${target.name} 비밀번호 재설정`,
      text: `[BOAZ 운영진 계정 비밀번호 재설정 안내]

• 로그인 아이디: ${target.username ?? ''}
• 새 비밀번호: ${newPassword}

로그인 후 새 비밀번호로 접속해 주세요.`,
    });
  };

  /**
   * 운영진 계정 발급. 출결의 그룹 계정 발급처럼, 발급한 뒤 본인에게 보낼 전달문 창을 띄운다.
   * 아이디 형식·중복과 비밀번호 규칙 검사는 서버가 한다.
   */
  const issueCredentials = async (account: AdminAccount, request: AdminCredentialsRequest) => {
    const isIssued = await run(() => issueAdminCredentials(account.id, request));
    if (isIssued) {
      setDelivery({
        title: `${account.name} 계정 발급`,
        text: `[BOAZ 운영진 계정 발급 안내]

• 로그인 아이디: ${request.username}
• 초기 비밀번호: ${request.password}

로그인 후 비밀번호를 바꿔 주세요.`,
      });
    }
    return isIssued;
  };

  const deleteAccount = (account: AdminAccount) => {
    const label = account.username ? `${account.username} (${account.name})` : account.name;
    if (!window.confirm(`운영진 '${label}'을(를) 삭제할까요?`)) {
      return;
    }
    void run(() => deleteAdminAccount(account.id), '계정을 삭제했습니다.');
  };

  const savePermissions = (account: AdminAccount, permissions: string[]) =>
    run(() => saveAccountPermissions(account.id, { permissions }));

  return (
    <div className="space-y-6">
      {/* 1. 상단 제목 영역 */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{pageTitle}</h1>

        {!isPermissionsView && can(me, 'ADMIN_ACCOUNT_CREATE_DELETE') && (
          <CreateButton
            label="계정"
            aria-label="새 운영진 계정 발급"
            onClick={() => setIsIssueOpen(true)}
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

      {/* 계정별 권한 관리: 계정 목록 조회 권한이 있어야 계정을 고를 수 있다 */}
      {isPermissionsView ? (
        accounts && holders ? (
          <AccountPermissionsTab
            catalog={catalog}
            me={me}
            holders={holders}
            accounts={accounts}
            canEdit={canManagePermissions}
            selectedKey={permissionTargetKey}
            onSelect={setPermissionTargetKey}
            onSave={savePermissions}
          />
        ) : (
          <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
            계정별 권한을 보려면 &quot;운영진 계정 목록 조회&quot; 권한이 필요합니다.
          </p>
        )
      ) : accounts ? (
        <AccountsTab
          catalog={catalog}
          accounts={accounts}
          actions={actions}
          onResetPassword={setPasswordTarget}
          onPermissions={openPermissions}
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

      {passwordTarget &&
        (isSelf(passwordTarget) ? (
          <PasswordModal
            account={passwordTarget}
            isSelf
            onClose={() => setPasswordTarget(null)}
            onSubmit={submitOwnPassword}
          />
        ) : (
          <PasswordResetDialog
            onClose={() => setPasswordTarget(null)}
            onSubmit={(newPassword) => void resetOthersPassword(newPassword)}
          />
        ))}

      {isIssueOpen && accounts && (
        <CredentialIssueModal
          pendingAccounts={accounts.filter((account) => account.username === null)}
          onClose={() => setIsIssueOpen(false)}
          onSubmit={issueCredentials}
        />
      )}

      {delivery && (
        <AccountDeliveryDialog
          title={delivery.title}
          text={delivery.text}
          onTextChange={(text) => setDelivery({ ...delivery, text })}
          onClose={() => setDelivery(null)}
        />
      )}
    </div>
  );
}
