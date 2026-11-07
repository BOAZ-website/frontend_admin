import { AccountDeliveryDialog } from '@/features/account-delivery/ui/AccountDeliveryDialog';
import { PAGE_LABELS } from '@/shared/config/pageLabels';
import { CreateButton } from '@/shared/ui/CreateButton';
import { PasswordResetDialog } from '@/shared/ui/PasswordResetDialog';
import { PageLoadingState } from '@/widgets/page-loading/ui/PageLoadingState';

import { useAccountsPage } from '../model/useAccountsPage';
import { AccountPermissionDialog } from './AccountPermissionDialog';
import { AccountsTab } from './AccountsTab';
import { CredentialIssueModal } from './CredentialIssueModal';
import { MyAccountCard } from './MyAccountCard';
import { PasswordModal } from './PasswordModal';

/**
 * 권한 관리 화면. 운영진 표에서 이름이나 권한 버튼을, 그룹 리더 계정 표에서 이름을 누르면 그 사람의 권한 창이 열린다.
 * 데이터는 모두 API(백엔드 연결 전에는 임시 API)로 읽고 쓴다. 메뉴·버튼은 로그인한 계정의
 * 유효 권한(/me)으로 보이거나 숨기고, 최종 판정은 서버가 한다(권한이 없으면 403).
 */
export function SystemAccountsPage() {
  const view = useAccountsPage();
  const { data, error, reload, isForbidden } = view;
  // 그룹 리더(HOST) 세션이면 /admin/accounts/me가 403이다. 이 화면은 운영진 계정 전용이라 안내만 보인다.
  if (isForbidden) {
    return (
      <div className="space-y-6">
        <div className="flex min-h-11 items-center border-b border-slate-200/80 pb-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {PAGE_LABELS['system-accounts']}
          </h1>
        </div>
        <p className="rounded-md border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
          그룹 리더(HOST) 계정은 권한 관리 화면을 쓸 수 없습니다.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <PageLoadingState
        header={
          // 다 읽은 뒤의 제목 줄과 같은 높이로 자리를 잡는다(계정 추가 버튼 h-9 + 아래 여백).
          // 운영진 계정·내 계정 정보 중 어느 제목인지는 읽어야 알 수 있어, 그 전에는 제목을 비워 둔다.
          <div className="flex min-h-11 items-center border-b border-slate-200/80 pb-2" />
        }
        error={error}
        loadingMessage="계정 정보를 불러오는 중입니다."
        errorMessage="계정 정보를 불러오지 못했습니다."
        action={
          error && (
            <button
              type="button"
              onClick={() => void reload()}
              className="ml-3 cursor-pointer rounded-sm border border-red-200 bg-white px-3 py-1 font-semibold hover:bg-red-100"
            >
              다시 시도
            </button>
          )
        }
      />
    );
  }

  const { me, catalog, accounts } = data;
  const page = view.derive(data);
  const {
    actions,
    pageTitle,
    permissionHolder,
    groupLeaders,
    canWriteSelf,
    canManagePermissions,
    isSelf,
  } = page;

  return (
    <div className="space-y-6">
      {/* 1. 상단 제목 영역 */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{pageTitle}</h1>

        {page.canIssueAccounts && (
          <CreateButton
            label="계정"
            aria-label="새 운영진 계정 발급"
            onClick={() => view.setIsIssueOpen(true)}
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
            className="shrink-0 cursor-pointer rounded-sm border border-red-200 bg-white px-3 py-1 font-semibold hover:bg-red-100"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 계정 목록 조회 권한이 있어야 운영진 표를 본다. 없으면 내 계정 정보만 보인다. */}
      {accounts ? (
        <AccountsTab
          catalog={catalog}
          accounts={accounts}
          actions={actions}
          onResetPassword={view.setPasswordTarget}
          onPermissions={page.handleOpenPermissions}
          onDelete={page.handleDeleteAccount}
          groupLeaders={groupLeaders}
          onOpenHolder={(holder) => view.setPermissionTargetKey(holder.key)}
        />
      ) : (
        <MyAccountCard
          catalog={catalog}
          me={me}
          canEditSelf={canWriteSelf}
          onChangePassword={() => view.setPasswordTarget(me)}
        />
      )}

      {permissionHolder && accounts && (
        <AccountPermissionDialog
          catalog={catalog}
          me={me}
          holder={permissionHolder}
          account={permissionHolder.adminAccount}
          accounts={accounts}
          // 서비스운영팀장 권한은 계정별로 고칠 수 없다(서버도 400). 창은 보기 전용으로 연다.
          canEdit={canManagePermissions && permissionHolder.adminAccount?.role !== 'MASTER'}
          onSave={page.handleSavePermissions}
          canEditTeam={page.canIssueAccounts}
          onChangeTeam={page.handleChangeTeam}
          onClose={() => view.setPermissionTargetKey(null)}
        />
      )}

      {view.passwordTarget &&
        (isSelf(view.passwordTarget) ? (
          <PasswordModal
            account={view.passwordTarget}
            isSelf
            onClose={() => view.setPasswordTarget(null)}
            onSubmit={page.handleSubmitOwnPassword}
          />
        ) : (
          <PasswordResetDialog
            onClose={() => view.setPasswordTarget(null)}
            onSubmit={(newPassword) => void page.handleResetOthersPassword(newPassword)}
          />
        ))}

      {view.isIssueOpen && accounts && (
        <CredentialIssueModal
          teamNames={catalog.teamNames}
          accounts={accounts}
          onClose={() => view.setIsIssueOpen(false)}
          onSubmit={page.handleIssueCredentials}
          onMove={page.handleChangeOperator}
        />
      )}

      {view.delivery && (
        <AccountDeliveryDialog
          title={view.delivery.title}
          text={view.delivery.text}
          onTextChange={view.handleChangeDeliveryText}
          onClose={() => view.setDelivery(null)}
        />
      )}
    </div>
  );
}
