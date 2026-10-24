/**
 * 계정별 권한 편집(SYS-PERM)의 화면 계산. 저장 전 체크 상태(draft)를 기본 권한·저장된 상태와 비교한다.
 * 기본 권한과의 차이(추가·제외) 계산은 서버가 하므로, 여기서는 표시와 버튼 상태만 정한다.
 */
import { isInBaseOf, permissionsIn } from '@/entities/admin-account/model/catalog';
import {
  LOCKOUT_GUARDED_PERMISSION,
  type PermissionDef,
} from '@/entities/admin-account/model/permissions';
import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';

/** 기본 권한과 비교한 표시. added: 기본에 없는데 체크 · removed: 기본에 있는데 체크 해제 */
export type PermissionChangeMark = 'added' | 'removed' | null;

/** 화면에서 켜고 끌 수 있는 권한. 맡은 그룹에서 자동으로 붙는 권한(_OWN_GROUP_)은 뺀다. */
const editablePermissions = (catalog: PermissionCatalog): PermissionDef[] =>
  permissionsIn(catalog).filter((permission) => !permission.ownGroup);

/** 저장된 체크 상태: 유효 권한 중 화면에서 켜고 끌 수 있는 것. */
export const savedCheckedOf = (catalog: PermissionCatalog, account: AdminAccount): string[] =>
  editablePermissions(catalog)
    .filter((permission) => account.effectivePermissions.includes(permission.key))
    .map((permission) => permission.key);

/** 기본 권한만 체크한 상태. "기본 권한으로 되돌리기"에 쓴다. */
export const baseCheckedOf = (catalog: PermissionCatalog, account: AdminAccount): string[] =>
  editablePermissions(catalog)
    .filter((permission) => isInBaseOf(catalog, permission, account.baseSetKey))
    .map((permission) => permission.key);

export const changeMarkOf = (
  catalog: PermissionCatalog,
  account: AdminAccount,
  permission: PermissionDef,
  checked: ReadonlySet<string>,
): PermissionChangeMark => {
  if (permission.ownGroup) return null;
  const isInBase = isInBaseOf(catalog, permission, account.baseSetKey);
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
  const marks = editablePermissions(catalog).map((permission) =>
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
 * "타 계정 정보 수정" 권한은 본인에게서, 또 그 권한을 가진 마지막 계정에게서 회수할 수 없다.
 */
export const lockReasonOf = (
  permission: PermissionDef,
  account: AdminAccount,
  me: Pick<AdminAccount, 'id'>,
  accounts: readonly AdminAccount[],
): string | null => {
  if (permission.key !== LOCKOUT_GUARDED_PERMISSION) return null;
  if (!account.effectivePermissions.includes(permission.key)) return null;
  if (account.id === me.id) return '본인 계정의 이 권한은 회수할 수 없습니다.';
  const holders = accounts.filter((other) => other.effectivePermissions.includes(permission.key));
  if (holders.length <= 1) return '이 권한을 가진 마지막 계정이라 회수할 수 없습니다.';
  return null;
};
