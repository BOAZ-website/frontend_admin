import { useEffect, useState } from 'react';

import {
  assignOperator,
  changeAdminPassword,
  deleteAdminAccount,
  saveAccountPermissions,
} from '@/entities/admin-account/api/adminAccountApi';
import type { AdminPasswordRequest } from '@/entities/admin-account/model/dto';
import { can } from '@/entities/admin-account/model/can';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import type { ClubMember } from '@/entities/club-member/model/types';
import { useAdminConsole } from '@/pages/system-accounts/model/useAdminConsole';
import { AccountPermissionDialog } from '@/pages/system-accounts/ui/AccountPermissionDialog';
import { AccountsTab } from '@/pages/system-accounts/ui/AccountsTab';
import type { AccountActions } from '@/pages/system-accounts/ui/OperatorRosterTable';
import {
  CredentialIssueModal,
  type IssueCredentials,
} from '@/pages/system-accounts/ui/CredentialIssueModal';
import { MyAccountCard } from '@/pages/system-accounts/ui/MyAccountCard';
import { PasswordModal } from '@/pages/system-accounts/ui/PasswordModal';
import { ApiError } from '@/shared/api/apiError';
import { buildAccountDelivery } from '@/shared/config/accountDeliveryMessages';
import { alertApiError } from '@/shared/lib/alertApiError';
import { AccountDeliveryDialog } from '@/shared/ui/AccountDeliveryDialog';
import { CreateButton } from '@/shared/ui/CreateButton';
import { PasswordResetDialog } from '@/shared/ui/PasswordResetDialog';
import { PageLoadingState } from '@/widgets/page-loading/ui/PageLoadingState';

/** 권한 관리 화면의 주소 이름. 권한 창을 연 사람은 '/' 뒤에 붙인다. */
const ACCOUNTS_HASH = 'system-accounts';

/** 권한 없음 응답. HOST 세션으로 /admin/accounts/me를 부르면 받는다. */
const HTTP_FORBIDDEN = 403;

/** 주소 '#system-accounts/<key>'의 사람 key(회원 id). 없으면 null. */
function holderKeyOfHash(): string | null {
  const [page, key] = window.location.hash.replace(/^#/, '').split('/');
  if (page !== ACCOUNTS_HASH || !key) return null;
  try {
    return decodeURIComponent(key);
  } catch {
    return null;
  }
}

/**
 * 권한 관리 화면. 운영진 표에서 이름이나 권한 버튼을, 그룹 리더 계정 표에서 이름을 누르면 그 사람의 권한 창이 열린다.
 * 데이터는 모두 API(백엔드 연결 전에는 임시 API)로 읽고 쓴다. 메뉴·버튼은 로그인한 계정의
 * 유효 권한(/me)으로 보이거나 숨기고, 최종 판정은 서버가 한다(권한이 없으면 403).
 */
export function SystemAccountsPage() {
  const { data, error, reload } = useAdminConsole();
  /**
   * 권한 창을 연 사람(AccountHolder.key, 회원 id). 주소 '#system-accounts/<key>'에 남겨,
   * 새로고침하거나 다른 화면(감사 로그의 이름)에서 그 주소로 들어와도 창이 열린 채 시작한다.
   * 창을 닫으면 주소를 '#system-accounts'로 되돌린다.
   */
  const [permissionTargetKey, setPermissionTargetKey] = useState<string | null>(holderKeyOfHash);
  useEffect(() => {
    const hash = permissionTargetKey
      ? `#${ACCOUNTS_HASH}/${encodeURIComponent(permissionTargetKey)}`
      : `#${ACCOUNTS_HASH}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [permissionTargetKey]);
  const [passwordTarget, setPasswordTarget] = useState<AdminAccount | null>(null);
  /** "+ 계정"으로 여는 계정 발급 창. */
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  /** 계정을 발급하거나 다른 계정의 비밀번호를 재설정한 뒤 띄우는 전달문. */
  const [delivery, setDelivery] = useState<{ title: string; text: string } | null>(null);

  // 그룹 리더(HOST) 세션이면 /admin/accounts/me가 403이다. 이 화면은 운영진 계정 전용이라 안내만 보인다.
  if (!data && error instanceof ApiError && error.status === HTTP_FORBIDDEN) {
    return (
      <div className="space-y-6">
        <div className="flex min-h-11 items-center border-b border-slate-200/80 pb-2">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">권한 관리</h1>
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
              className="ml-3 cursor-pointer rounded-sm border border-red-200 bg-white px-2.5 py-1 font-semibold hover:bg-red-100"
            >
              다시 시도
            </button>
          )
        }
      />
    );
  }

  const { me, catalog, accounts, holders } = data;
  const isSelf = (account: AdminAccount) => account.id === me.id;
  const canWriteOthers = can(me, 'ADMIN_ACCOUNT_WRITE');
  const canWriteSelf = canWriteOthers || can(me, 'ADMIN_ACCOUNT_SELF_WRITE');
  const canManagePermissions = can(me, 'ADMIN_PERMISSION_WRITE');
  const canChangePassword = (account: AdminAccount) =>
    isSelf(account) ? canWriteSelf : canWriteOthers;
  const actions: AccountActions = {
    passwordResetBlockReason: (account) => {
      // 서버도 400 CANNOT_MODIFY_MASTER_CREDENTIALS로 막는다. 비밀번호를 입력하기 전에 버튼에서 알린다.
      if (account.role === 'MASTER' && !isSelf(account)) {
        return '서비스운영팀장(MASTER) 계정의 비밀번호는 본인만 바꿀 수 있습니다.';
      }
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
  const pageTitle = accounts ? '권한 관리' : '내 계정 정보';
  /** 권한 창에 보일 사람(운영진 또는 HOST 계정만 있는 사람). 계정 목록에 없으면 창을 열지 않는다. */
  const permissionHolder = holders?.find((holder) => holder.key === permissionTargetKey) ?? null;
  /** 그룹 리더 계정 표의 사람: 그룹을 맡았거나 HOST 계정이 있는 사람(운영진 여부와 관계없이), 이름순. */
  const groupLeaders = (holders ?? [])
    .filter((holder) => holder.leaderGroups.length > 0 || holder.hostLogins.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  // 주소에 계정이 없는 사람이 들어오면 창 없이 권한 관리 화면만 열고, 주소도 '#system-accounts'로 되돌린다.
  if (permissionTargetKey !== null && holders && !permissionHolder) {
    setPermissionTargetKey(null);
  }

  const openPermissions = (account: AdminAccount) => setPermissionTargetKey(account.userId);

  /**
   * API 요청을 보내고 성공하면 데이터를 다시 읽는다. 실패하면 서버가 돌려준 사유를 알린다.
   * 다시 읽기가 끝난 뒤에 돌아가므로, 화면은 갱신된 데이터로 다음 동작을 받는다.
   */
  const run = async (work: () => Promise<unknown>, successMessage?: string): Promise<boolean> => {
    try {
      await work();
    } catch (requestError) {
      alertApiError(requestError);
      return false;
    }
    // 저장은 끝났으므로 true를 돌려준다. 목록을 다시 읽지 못했으면 화면이 최신이 아니라는 것을 따로 알린다.
    const isReloaded = await reload();
    if (!isReloaded) {
      window.alert(
        `${successMessage ?? '저장했습니다.'} 다만 목록을 다시 불러오지 못해 화면이 최신이 아닙니다. 위쪽 "다시 시도"를 눌러 주세요.`,
      );
    } else if (successMessage) {
      window.alert(successMessage);
    }
    return true;
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
    setDelivery(
      buildAccountDelivery('passwordReset', {
        name: target.name,
        username: target.username,
        password: newPassword,
      }),
    );
  };

  /**
   * 운영진 계정 발급. 출결의 그룹 계정 발급처럼, 발급한 뒤 본인에게 보낼 전달문 창을 띄운다.
   * 운영진이 아닌 동아리원을 고른 팀의 운영진으로 지정하면서 계정을 한 번에 만든다.
   * 아이디 형식·중복과 비밀번호 규칙 검사는 서버가 한다.
   */
  const issueCredentials = async (
    member: ClubMember,
    request: IssueCredentials,
    teamName: string,
  ) => {
    const isIssued = await run(() => assignOperator(member.id, { teamName, ...request }));
    if (isIssued) {
      setDelivery(
        buildAccountDelivery('issue', {
          name: member.name,
          username: request.username,
          password: request.password,
        }),
      );
    }
    return isIssued;
  };

  /**
   * 이미 운영진인 사람의 팀·아이디·비밀번호를 바꾼다(발급 창에서 운영진을 고른 경우). 한 번의 요청으로 처리하고,
   * 아이디나 비밀번호가 바뀌면 본인에게 보낼 전달문을 띄운다. 팀을 옮기면 개별 권한 예외는 서버가 지운다.
   */
  const changeOperator = async (
    account: AdminAccount,
    teamName: string,
    change: { username: string; password: string | null },
  ) => {
    const isTeamChanged = teamName !== account.teamName;
    const isUsernameChanged = change.username !== account.username;
    const hasLoginChange = isUsernameChanged || change.password !== null;
    const isDone = await run(
      () =>
        assignOperator(account.userId, {
          teamName,
          username: change.username,
          ...(change.password !== null ? { password: change.password } : {}),
        }),
      hasLoginChange ? undefined : `${account.name}님을 ${teamName}으로 옮겼습니다.`,
    );
    if (isDone && hasLoginChange) {
      // 팀을 옮기지 않았으면 팀 자리를 비워 '• 팀:' 줄을 뺀다.
      setDelivery(
        buildAccountDelivery(
          change.password !== null ? 'changeWithPassword' : 'changeUsernameOnly',
          {
            name: account.name,
            fromTeam: isTeamChanged ? account.teamName : null,
            toTeam: isTeamChanged ? teamName : null,
            username: change.username,
            password: change.password,
          },
        ),
      );
    }
    return isDone;
  };

  const deleteAccount = (account: AdminAccount) => {
    if (!window.confirm(`운영진 '${account.username} (${account.name})'을(를) 삭제할까요?`)) {
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

        {can(me, 'ADMIN_ACCOUNT_CREATE_DELETE') && (
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

      {/* 계정 목록 조회 권한이 있어야 운영진 표를 본다. 없으면 내 계정 정보만 보인다. */}
      {accounts ? (
        <AccountsTab
          catalog={catalog}
          accounts={accounts}
          actions={actions}
          onResetPassword={setPasswordTarget}
          onPermissions={openPermissions}
          onDelete={deleteAccount}
          groupLeaders={groupLeaders}
          onOpenHolder={(holder) => setPermissionTargetKey(holder.key)}
        />
      ) : (
        <MyAccountCard
          catalog={catalog}
          me={me}
          canEditSelf={canWriteSelf}
          onChangePassword={() => setPasswordTarget(me)}
        />
      )}

      {permissionHolder && accounts && (
        <AccountPermissionDialog
          catalog={catalog}
          me={me}
          holder={permissionHolder}
          account={permissionHolder.adminAccount}
          accounts={accounts}
          canEdit={canManagePermissions}
          onSave={savePermissions}
          onClose={() => setPermissionTargetKey(null)}
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
          teamNames={catalog.teamNames}
          accounts={accounts}
          onClose={() => setIsIssueOpen(false)}
          onSubmit={issueCredentials}
          onMove={changeOperator}
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
