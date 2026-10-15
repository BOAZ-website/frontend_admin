import { useState } from 'react';

import {
  applyPermissionsInBulk,
  changeAdminPassword,
  createAdminAccount,
  deleteAdminAccount,
  saveAccountPermissions,
  updateAdminAccount,
} from '@/entities/admin-account/api/adminAccountApi';
import type {
  AdminAccountCreateRequest,
  AdminPasswordRequest,
} from '@/entities/admin-account/model/dto';
import type { PermissionChange } from '@/entities/admin-account/model/permissions';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import { useAdminConsole } from '@/pages/system-accounts/model/useAdminConsole';
import { AccountFormModal } from '@/pages/system-accounts/ui/AccountFormModal';
import { AccountPermissionEditor } from '@/pages/system-accounts/ui/AccountPermissionEditor';
import { AccountsTable, type AccountActions } from '@/pages/system-accounts/ui/AccountsTable';
import { AuditLogTable } from '@/pages/system-accounts/ui/AuditLogTable';
import { MyAccountCard } from '@/pages/system-accounts/ui/MyAccountCard';
import { PasswordModal } from '@/pages/system-accounts/ui/PasswordModal';
import { PermissionGrantPanel } from '@/pages/system-accounts/ui/PermissionGrantPanel';
import { PermissionMatrixTable } from '@/pages/system-accounts/ui/PermissionMatrixTable';
import { alertApiError } from '@/shared/lib/alertApiError';
import { CreateButton } from '@/shared/ui/CreateButton';

type SystemSubTab = 'accounts' | 'permissions' | 'grant' | 'audit';

const PAGE_TITLES: Record<SystemSubTab, string> = {
  accounts: '운영진 계정 관리',
  permissions: '권한 매트릭스',
  grant: '권한 부여',
  audit: '보안 감사 로그',
};

/** 계정 발급·수정 팝업 대상. */
type FormTarget = { mode: 'create' } | { mode: 'edit'; account: AdminAccount };

/** 권한이 없어 화면을 보여줄 수 없을 때의 안내. */
function NoAccessNotice({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
      {message}
    </p>
  );
}

interface SystemAccountsPageProps {
  /** 사이드바에서 고른 화면. 화면 전환은 사이드바가 맡는다. */
  initialSubTab?: SystemSubTab;
}

/**
 * 시스템·계정 화면(운영진 계정 관리·권한 매트릭스·권한 부여·보안 감사 로그).
 * 데이터는 모두 API(백엔드 연결 전에는 임시 API)로 읽고 쓴다. 메뉴·버튼은 로그인한 계정의
 * 유효 권한(/me)으로 보이거나 숨기고, 최종 판정은 서버가 한다(권한이 없으면 403).
 */
export function SystemAccountsPage({ initialSubTab = 'accounts' }: SystemAccountsPageProps) {
  const subTab = initialSubTab;
  const { data, error, reload } = useAdminConsole();
  const [permissionTargetId, setPermissionTargetId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<AdminAccount | null>(null);

  // 사이드바에서 다른 화면으로 옮기면 권한 관리 화면을 닫는다.
  const [prevSubTab, setPrevSubTab] = useState(subTab);
  if (prevSubTab !== subTab) {
    setPrevSubTab(subTab);
    setPermissionTargetId(null);
  }

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

  const { me, catalog, accounts, auditLogs, members } = data;
  // 계정 발급 때 고를 수 있는 동아리원: 아직 운영진 계정이 없는 회원.
  const linkedUserIds = new Set(accounts?.map((account) => account.userId) ?? [me.userId]);
  const selectableMembers = (members ?? []).filter((member) => !linkedUserIds.has(member.id));
  const can = (key: string) => me.effectivePermissions.includes(key);
  const isSelf = (account: AdminAccount) => account.id === me.id;
  const canWriteOthers = can('ADMIN_ACCOUNT_WRITE');
  const canWriteSelf = canWriteOthers || can('ADMIN_ACCOUNT_SELF_WRITE');
  const canManagePermissions = can('ADMIN_PERMISSION_WRITE');
  const canChangePassword = (account: AdminAccount) =>
    isSelf(account) ? canWriteSelf : canWriteOthers;
  const actions: AccountActions = {
    canEdit: (account) => (isSelf(account) ? canWriteSelf : canWriteOthers),
    canManagePermissions,
    canDelete: (account) => !isSelf(account) && can('ADMIN_ACCOUNT_CREATE_DELETE'),
  };

  const permissionTarget =
    canManagePermissions && permissionTargetId !== null
      ? (accounts?.find((account) => account.id === permissionTargetId) ?? null)
      : null;
  const pageTitle =
    subTab === 'accounts' && permissionTarget
      ? '계정별 권한 관리'
      : subTab === 'accounts' && !accounts
        ? '내 계정 정보'
        : PAGE_TITLES[subTab];

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

  const savePermissions = (account: AdminAccount, permissions: string[]) =>
    run(() => saveAccountPermissions(account.id, { permissions }));

  const applyBulk = (accountIds: number[], permissions: string[], change: PermissionChange) =>
    run(
      () => applyPermissionsInBulk({ accountIds, permissions, change }),
      `계정 ${accountIds.length}명의 권한을 반영했습니다.`,
    );

  return (
    <div className="space-y-6">
      {/* 1. 상단 제목 영역 */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{pageTitle}</h1>

        {subTab === 'accounts' && !permissionTarget && can('ADMIN_ACCOUNT_CREATE_DELETE') && (
          <CreateButton
            label="계정"
            aria-label="새 운영진 계정 발급"
            onClick={() => setFormTarget({ mode: 'create' })}
          />
        )}
      </div>

      {/* ─── 운영진 계정 관리: 목록 조회 권한이 있으면 전체 계정, 없으면 본인 정보 ─── */}
      {subTab === 'accounts' &&
        (permissionTarget ? (
          <AccountPermissionEditor
            key={permissionTarget.id}
            catalog={catalog}
            account={permissionTarget}
            onBack={() => setPermissionTargetId(null)}
            onSave={(permissions) => savePermissions(permissionTarget, permissions)}
          />
        ) : accounts ? (
          <AccountsTable
            catalog={catalog}
            accounts={accounts}
            actions={actions}
            onEdit={(account) => setFormTarget({ mode: 'edit', account })}
            onPermissions={(account) => setPermissionTargetId(account.id)}
            onDelete={deleteAccount}
          />
        ) : (
          <MyAccountCard
            catalog={catalog}
            me={me}
            canEditSelf={canWriteSelf}
            onChangePassword={() => setPasswordTarget(me)}
          />
        ))}

      {/* ─── 권한 매트릭스(기본 권한 세트, 읽기 전용) ─── */}
      {subTab === 'permissions' && <PermissionMatrixTable catalog={catalog} />}

      {/* ─── 권한 부여: 권한을 묶어서 여러 계정에 한 번에 부여·회수 ─── */}
      {subTab === 'grant' &&
        (canManagePermissions && accounts ? (
          <PermissionGrantPanel catalog={catalog} accounts={accounts} onApply={applyBulk} />
        ) : (
          <NoAccessNotice message='권한 부여에는 "운영진 계정 권한 부여(커스텀)" 권한이 필요합니다.' />
        ))}

      {/* ─── 보안 감사 로그 ─── */}
      {subTab === 'audit' &&
        (auditLogs ? (
          <AuditLogTable logs={auditLogs} />
        ) : (
          <NoAccessNotice message='보안 감사 로그를 보려면 "보안 감사 로그 조회" 권한이 필요합니다.' />
        ))}

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
