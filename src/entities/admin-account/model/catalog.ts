/**
 * 화면에서 권한 카탈로그(GET /api/v1/admin/permissions 응답)를 읽는 함수.
 * 권한·기본 권한 세트 정의를 화면에 하드코딩하지 않고, 받은 카탈로그만으로 계산한다.
 */
import {
  isValidCombination,
  resolveBaseSetKey,
  type BaseSetKey,
  type PermissionDef,
} from './permissions';
import type { PermissionCatalog } from './types';

/** 권한이 그 기본 권한 세트에 들어 있는지. permission.base는 catalog.baseSets 순서의 O·X다. */
export const isInBaseOf = (
  catalog: PermissionCatalog,
  permission: PermissionDef,
  key: BaseSetKey | null,
): boolean => {
  if (key === null) return false;
  const index = catalog.baseSets.findIndex((column) => column.key === key);
  return index >= 0 && permission.base[index] === 'O';
};

export const baseSetLabelIn = (catalog: PermissionCatalog, key: BaseSetKey | null): string =>
  catalog.baseSets.find((column) => column.key === key)?.label ?? '없음';

export const baseSetKeyIn = (
  catalog: PermissionCatalog,
  role: string,
  teamName: string,
): BaseSetKey | null => resolveBaseSetKey(catalog.rules, role, teamName);

export const isValidCombinationIn = (
  catalog: PermissionCatalog,
  role: string,
  teamName: string,
): boolean => isValidCombination(catalog.rules, role, teamName);

export const permissionsIn = (catalog: PermissionCatalog): PermissionDef[] =>
  catalog.groups.flatMap((group) => group.permissions);

/** 영역별 권한 단계. 수정·삭제 등 쓰기 권한이 하나라도 있으면 관리, 조회 권한만 있으면 조회다. */
export type AccessLevel = 'manage' | 'read';

export interface PermissionAreaSummary {
  /** 영역 이름(카탈로그 묶음 이름의 앞부분). 예: '계정', '리크루팅', '출결 관리' */
  area: string;
  level: AccessLevel;
  /** 그 영역에서 가진 권한 이름. 말풍선에 쓴다. */
  labels: string[];
}

/** 모든 기본 권한 세트에 들어 있는 권한(예: 본인 계정 수정). 누구나 가져서 계정을 구분하는 데 쓰지 않는다. */
const isUniversal = (permission: PermissionDef): boolean => /^O+$/.test(permission.base);

/**
 * 유효 권한을 영역별로 요약한다. 영역 순서는 카탈로그 묶음 순서이고, 가진 권한이 없는 영역은 뺀다.
 * 권한 이름이 _READ로 끝나면 조회, 그 밖(WRITE·DELETE 등)은 관리로 본다.
 */
export const permissionSummaryIn = (
  catalog: PermissionCatalog,
  effectivePermissions: readonly string[],
): PermissionAreaSummary[] =>
  catalog.groups.flatMap((group) => {
    const held = group.permissions.filter(
      (p) => !isUniversal(p) && effectivePermissions.includes(p.key),
    );
    if (held.length === 0) return [];
    return [
      {
        area: group.title.split('·')[0],
        level: held.some((p) => !p.key.endsWith('_READ')) ? 'manage' : 'read',
        labels: held.map((p) => p.label),
      },
    ];
  });

/**
 * 기본 권한 세트 하나가 한 영역(카탈로그 묶음)에서 갖는 수준. 권한 매트릭스의 3단계 표시에 쓴다.
 *   full: 영역의 권한을 모두 가짐(관리) · partial: 쓰기 권한을 일부만 가짐(일부 관리)
 *   read: 조회 권한만 가짐 · ownGroup: 맡은 그룹에서 자동으로 붙는 권한만 가짐 · none: 없음
 * 누구나 가진 권한(본인 계정 수정)은 세지 않는다.
 */
export type AreaLevel = 'full' | 'partial' | 'read' | 'ownGroup' | 'none';

export const areaLevelIn = (
  catalog: PermissionCatalog,
  permissions: readonly PermissionDef[],
  key: BaseSetKey,
): AreaLevel => {
  const counted = permissions.filter((p) => !isUniversal(p));
  const held = counted.filter((p) =>
    p.ownGroup ? key === 'groupLeader' : isInBaseOf(catalog, p, key),
  );
  if (held.length === 0) return 'none';
  if (held.every((p) => p.ownGroup)) return 'ownGroup';
  if (!held.some((p) => !p.key.endsWith('_READ'))) return 'read';
  return held.length === counted.length ? 'full' : 'partial';
};
