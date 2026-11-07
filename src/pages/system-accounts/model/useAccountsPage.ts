import { useEffect, useState } from 'react';

import {
  assignOperator,
  changeAdminPassword,
  deleteAdminAccount,
  saveAccountPermissions,
} from '@/entities/admin-account/api/adminAccountApi';
import { can } from '@/entities/admin-account/model/can';
import type { AdminPasswordRequest } from '@/entities/admin-account/model/dto';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import type { ClubMember } from '@/entities/club-member/model/types';
import { buildAccountDelivery } from '@/features/account-delivery/model/accountDeliveryMessages';
import { ApiError } from '@/shared/api/apiError';
import { alertApiError } from '@/shared/lib/alertApiError';

import type { IssueCredentials } from '../ui/CredentialIssueModal';
import type { AccountActions } from '../ui/OperatorRosterTable';
import { type AdminConsoleData, useAdminConsole } from './useAdminConsole';

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

/** 계정 발급·비밀번호 재설정 뒤 띄우는 전달문. */
interface Delivery {
  title: string;
  text: string;
}

/**
 * 권한 관리 화면 상태와 처리 함수. 쓰기는 API로 보내고 성공하면 목록을 다시 읽는다(R7-6).
 * 데이터에서 계산하는 값(권한별 버튼 막기 이유, 권한 창 대상 등)은 derive(data)로 얻는다.
 */
export function useAccountsPage() {
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
  const [delivery, setDelivery] = useState<Delivery | null>(null);

  /** 그룹 리더(HOST) 세션이면 /admin/accounts/me가 403이다. 이 화면은 운영진 계정 전용이다. */
  const isForbidden = !data && error instanceof ApiError && error.status === HTTP_FORBIDDEN;

  /** 읽은 데이터에서 화면이 쓰는 값과 처리 함수를 만든다. */
  const derive = (loaded: AdminConsoleData) => {
    const { me, accounts, holders } = loaded;
    const isSelf = (account: AdminAccount) => account.id === me.id;
    const canWriteOthers = can(me, 'ADMIN_ACCOUNT_WRITE');
    const canWriteSelf = canWriteOthers || can(me, 'ADMIN_ACCOUNT_SELF_WRITE');
    const canManagePermissions = can(me, 'ADMIN_PERMISSION_WRITE');
    const canIssueAccounts = can(me, 'ADMIN_ACCOUNT_CREATE_DELETE');
    const canChangePassword = (account: AdminAccount) =>
      isSelf(account) ? canWriteSelf : canWriteOthers;
    const actions: AccountActions = {
      passwordResetBlockReason: (account) => {
        // 서버도 400 CANNOT_MODIFY_MASTER_CREDENTIALS로 막는다. 비밀번호를 입력하기 전에 버튼에서 알린다.
        if (account.role === 'MASTER' && !isSelf(account)) {
          return '서비스운영팀장(MASTER) 계정의 비밀번호는 본인만 바꿀 수 있습니다.';
        }
        if (!canChangePassword(account))
          return '다른 운영진의 비밀번호를 재설정할 권한이 없습니다.';
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

    const handleOpenPermissions = (account: AdminAccount) => setPermissionTargetKey(account.userId);

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
    const handleSubmitOwnPassword = (request: AdminPasswordRequest) =>
      passwordTarget
        ? run(() => changeAdminPassword(passwordTarget.id, request), '비밀번호를 변경했습니다.')
        : Promise.resolve(false);

    /**
     * 다른 계정의 비밀번호 재설정. 출결의 그룹 계정 관리와 같은 흐름이다:
     * 새 비밀번호 입력 → 한 번 더 확인 → 재설정 → 본인에게 보낼 전달문 창.
     * 비밀번호 규칙 검사는 서버가 한다.
     */
    const handleResetOthersPassword = async (newPassword: string) => {
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
    const handleIssueCredentials = async (
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
    const handleChangeOperator = async (
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

    const handleDeleteAccount = (account: AdminAccount) => {
      if (!window.confirm(`운영진 '${account.username} (${account.name})'을(를) 삭제할까요?`)) {
        return;
      }
      void run(() => deleteAdminAccount(account.id), '계정을 삭제했습니다.');
    };

    const handleSavePermissions = (account: AdminAccount, permissions: string[]) =>
      run(() => saveAccountPermissions(account.id, { permissions }));

    return {
      actions,
      pageTitle,
      permissionHolder,
      groupLeaders,
      canWriteSelf,
      canManagePermissions,
      canIssueAccounts,
      isSelf,
      handleOpenPermissions,
      handleSubmitOwnPassword,
      handleResetOthersPassword,
      handleIssueCredentials,
      handleChangeOperator,
      handleDeleteAccount,
      handleSavePermissions,
    };
  };

  return {
    data,
    error,
    reload,
    isForbidden,
    derive,
    permissionTargetKey,
    setPermissionTargetKey,
    passwordTarget,
    setPasswordTarget,
    isIssueOpen,
    setIsIssueOpen,
    delivery,
    setDelivery,
    handleChangeDeliveryText: (text: string) =>
      setDelivery((current) => (current ? { ...current, text } : current)),
  };
}
