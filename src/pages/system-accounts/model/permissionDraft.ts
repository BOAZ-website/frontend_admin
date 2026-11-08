/**
 * 계정별 권한 편집(SYS-PERM)의 화면 계산. 저장 전 체크 상태(draft)를 기본 권한·저장된 상태와 비교한다.
 * 기본 권한과의 차이(추가·제외) 계산은 서버가 하므로, 여기서는 표시와 버튼 상태만 정한다.
 */
import { isInBaseOf, permissionsIn } from '@/entities/admin-account/model/catalog';
import {
  LOCKOUT_GUARDED_PERMISSIONS,
  type PermissionDef,
} from '@/entities/admin-account/model/permissions';
import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';

/** 기본 권한과 비교한 표시. added: 기본에 없는데 체크 · removed: 기본에 있는데 체크 해제 */
export type PermissionChangeMark = 'added' | 'removed' | null;

/**
 * 이 계정의 기본 권한인지. 담당 그룹 권한(_OWN_GROUP_)은 그 종류의 그룹을 맡았으면 기본으로 생기는 권한으로 본다.
 */
const isInAccountBase = (
  catalog: PermissionCatalog,
  account: AdminAccount,
  permission: PermissionDef,
): boolean =>
  permission.ownGroup
    ? account.leadership.includes(permission.ownGroup)
    : isInBaseOf(catalog, permission, account.baseSetKey);

/**
 * 화면에서 켜고 끌 수 있는 권한. 담당 그룹 권한은 그 종류의 그룹을 맡은 계정에서만 끌(회수할) 수 있다.
 * 맡지 않은 계정에는 그룹을 맡아야 생기므로 추가할 수 없다.
 */
export const isEditablePermission = (account: AdminAccount, permission: PermissionDef): boolean =>
  !permission.ownGroup || account.leadership.includes(permission.ownGroup);

const editablePermissions = (catalog: PermissionCatalog, account: AdminAccount): PermissionDef[] =>
  permissionsIn(catalog).filter((permission) => isEditablePermission(account, permission));

/** 저장된 체크 상태: 유효 권한 중 화면에서 켜고 끌 수 있는 것. */
export const savedCheckedOf = (catalog: PermissionCatalog, account: AdminAccount): string[] =>
  editablePermissions(catalog, account)
    .filter((permission) => account.effectivePermissions.includes(permission.key))
    .map((permission) => permission.key);

/** 기본 권한만 체크한 상태. "기본 권한으로 되돌리기"에 쓴다. */
export const baseCheckedOf = (catalog: PermissionCatalog, account: AdminAccount): string[] =>
  editablePermissions(catalog, account)
    .filter((permission) => isInAccountBase(catalog, account, permission))
    .map((permission) => permission.key);

export const changeMarkOf = (
  catalog: PermissionCatalog,
  account: AdminAccount,
  permission: PermissionDef,
  checked: ReadonlySet<string>,
): PermissionChangeMark => {
  if (!isEditablePermission(account, permission)) return null;
  const isInBase = isInAccountBase(catalog, account, permission);
  const isChecked = checked.has(permission.key);
  if (isChecked && !isInBase) return 'added';
  if (!isChecked && isInBase) return 'removed';
  return null;
};

/** 기본 권한 대비 추가·제외 개수. */
export const changeCountsOf = (
  catalog: PermissionCatalog,
  account: AdminAccount,
  checked: ReadonlySet<string>,
): { added: number; removed: number } => {
  const marks = editablePermissions(catalog, account).map((permission) =>
    changeMarkOf(catalog, account, permission, checked),
  );
  return {
    added: marks.filter((mark) => mark === 'added').length,
    removed: marks.filter((mark) => mark === 'removed').length,
  };
};

/** 저장된 상태와 다른 권한 개수. 0이면 저장할 것이 없다. */
export const unsavedCountOf = (saved: readonly string[], checked: ReadonlySet<string>): number => {
  const savedSet = new Set(saved);
  const turnedOff = saved.filter((key) => !checked.has(key)).length;
  const turnedOn = [...checked].filter((key) => !savedSet.has(key)).length;
  return turnedOff + turnedOn;
};

/**
 * 체크를 풀 수 없는 권한의 사유. 서버의 잠금 방지 규칙(PERM-05)과 같고, 최종 판정은 서버가 한다.
 * "타 계정 정보 수정"·"권한 부여(커스텀)" 권한은 본인에게서, 또 그 권한을 가진 마지막 계정에게서 회수할 수 없다.
 */
export const lockReasonOf = (
  permission: PermissionDef,
  account: AdminAccount,
  me: Pick<AdminAccount, 'id'>,
  accounts: readonly AdminAccount[],
): string | null => {
  if (!LOCKOUT_GUARDED_PERMISSIONS.includes(permission.key)) return null;
  if (!account.effectivePermissions.includes(permission.key)) return null;
  if (account.id === me.id) return '본인 계정의 이 권한은 회수할 수 없습니다.';
  const holders = accounts.filter((other) => other.effectivePermissions.includes(permission.key));
  if (holders.length <= 1) return '이 권한을 가진 마지막 계정이라 회수할 수 없습니다.';
  return null;
};

/**
 * 저장 전에 보여 줄 변경 요약. 저장된 상태와 비교해 더한 권한·뺀 권한을 카탈로그 순서로 늘어놓는다.
 * 자주 하지 않고 영향이 큰 작업이라 저장 버튼을 누르면 한 번 더 확인한다.
 */
export function saveSummaryOf(
  catalog: PermissionCatalog,
  saved: readonly string[],
  checked: ReadonlySet<string>,
): string {
  const savedSet = new Set(saved);
  const permissions = permissionsIn(catalog);
  const turnedOn = permissions.filter((p) => checked.has(p.key) && !savedSet.has(p.key));
  const turnedOff = permissions.filter((p) => !checked.has(p.key) && savedSet.has(p.key));
  const lines = ['다음 변경을 저장할까요?'];
  if (turnedOn.length > 0) {
    lines.push('', `추가 ${turnedOn.length}개`, ...turnedOn.map((p) => `- ${p.label}`));
  }
  if (turnedOff.length > 0) {
    lines.push('', `제외 ${turnedOff.length}개`, ...turnedOff.map((p) => `- ${p.label}`));
  }
  return lines.join('\n');
}

/**
 * 기본 권한으로 되돌린 체크 상태. 잠긴 권한(본인·마지막 보유자의 회수 불가 권한)은 지금 켜져 있으면 그대로 둔다.
 * 개별 빼기 버튼과 같은 규칙이다.
 */
export function resetToBaseChecked(
  catalog: PermissionCatalog,
  account: AdminAccount,
  me: Pick<AdminAccount, 'id'>,
  accounts: readonly AdminAccount[],
  current: ReadonlySet<string>,
): Set<string> {
  const next = new Set(baseCheckedOf(catalog, account));
  for (const permission of permissionsIn(catalog)) {
    const isLocked = lockReasonOf(permission, account, me, accounts) !== null;
    if (isLocked && current.has(permission.key)) next.add(permission.key);
  }
  return next;
}
