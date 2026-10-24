import { PERMISSION_GROUPS } from '@/entities/admin-account/model/permissions';

import type { AuditFilterOptions } from './dto';
import { AUDIT_CATEGORIES, type AuditCategory, type AuditUsedPermission } from './types';

/**
 * 감사 로그 필터 선택지(서버 쪽). 분류와 권한 매트릭스 묶음의 대응을 여기서 정하고,
 * GET /api/v1/admin/audit-logs/filters가 이 결과를 그대로 준다. 화면은 이 응답으로 선택지를 만든다.
 */

/** 권한 필터에서 "권한 매트릭스에 항목이 없는 작업"을 고르는 값. */
export const NO_MATRIX_PERMISSION = 'NONE';

/**
 * 분류마다 권한 필터에 보일 권한 매트릭스 묶음(PERMISSION_GROUPS의 title)과, 다른 묶음에 있지만 이 분류의
 * 작업에 쓰는 권한. 정회원 승격·지원서 삭제는 매트릭스에서는 리크루팅 묶음이지만 사이드바에서는 서류 평가 메뉴다.
 */
const CATEGORY_PERMISSION_SOURCES: Readonly<
  Record<AuditCategory, { groups: readonly string[]; extraKeys: readonly string[] }>
> = {
  CONTENT: { groups: ['콘텐츠'], extraKeys: [] },
  RECRUITING: { groups: ['리크루팅'], extraKeys: [] },
  EVALUATION: {
    groups: ['서류 평가·합불'],
    extraKeys: ['MEMBER_PROMOTION_WRITE', 'APPLICATION_DELETE_ALL'],
  },
  ATTENDANCE: { groups: ['출결 관리', '출결 입력', '출결 설정'], extraKeys: [] },
  SYSTEM: { groups: ['계정·보안'], extraKeys: [] },
};

/** 분류 가운데 권한 매트릭스에 항목이 없는 작업(동아리원 관리·반기 관리)이 있는 분류. */
const CATEGORIES_WITH_UNMATCHED: readonly AuditCategory[] = ['SYSTEM', 'ATTENDANCE'];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions);

/** 권한 필터의 "매트릭스에 없음" 선택지. 이 값으로 거르면 권한 매트릭스에 항목이 없는 작업만 남는다. */
const NO_MATRIX_OPTION: AuditUsedPermission = {
  key: NO_MATRIX_PERMISSION,
  label: '매트릭스에 없음',
};

/**
 * 분류 하나의 권한 선택지. 권한 매트릭스 순서이며, 매트릭스에 없는 작업이 있는 분류는 맨 끝에 "매트릭스에 없음"을 둔다.
 * 조회 권한은 기록이 남지 않지만(쓰기만 기록한다) 매트릭스와 같은 목록을 보이려고 함께 둔다.
 */
function permissionsOf(category: AuditCategory): AuditUsedPermission[] {
  const { groups, extraKeys } = CATEGORY_PERMISSION_SOURCES[category];
  const picked = ALL_PERMISSIONS.filter(
    (permission) =>
      PERMISSION_GROUPS.some(
        (group) => groups.includes(group.title) && group.permissions.includes(permission),
      ) || extraKeys.includes(permission.key),
  ).map((permission) => ({ key: permission.key, label: permission.label }));
  return CATEGORIES_WITH_UNMATCHED.includes(category) ? [...picked, NO_MATRIX_OPTION] : picked;
}

/** GET /api/v1/admin/audit-logs/filters 응답. 분류는 AUDIT_CATEGORIES 순서다. */
export const auditFilterOptions = (): AuditFilterOptions => ({
  categories: AUDIT_CATEGORIES.map((category) => ({
    key: category.id,
    label: category.label,
    permissions: permissionsOf(category.id),
  })),
});

/** 권한 필터 값이 올바른지(매트릭스의 권한 이름이거나 NONE). */
export const isPermissionFilter = (value: string): boolean =>
  value === NO_MATRIX_PERMISSION || ALL_PERMISSIONS.some((permission) => permission.key === value);
