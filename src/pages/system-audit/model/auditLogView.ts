import type { AuditFilterOptions } from '@/entities/audit-log/model/dto';
import { AUDIT_CATEGORIES, type AuditCategory } from '@/entities/audit-log/model/types';

/** 왼쪽 목록에서 고르는 단위. 'ALL'은 모든 분류다. 분류는 사이드바 메뉴 묶음과 같다. */
export type AuditSheet = AuditCategory | 'ALL';

/** 화면 주소의 감사 로그 화면 이름. */
export const AUDIT_HASH = 'system-audit';
/** 쪽 번호를 한 번에 몇 개까지 보일지. */
const MAX_PAGE_NUMBERS = 5;

/** 필터 선택지 한 개. */
export interface AuditFilterOption {
  value: string;
  label: string;
}

/** 보일 쪽 번호. 지금 쪽이 가운데 오도록 최대 5개를 고른다. */
export function pageNumbersOf(current: number, last: number): number[] {
  const count = Math.min(MAX_PAGE_NUMBERS, last);
  const start = Math.min(Math.max(1, current - Math.floor(count / 2)), last - count + 1);
  return Array.from({ length: count }, (_, index) => start + index);
}

/** 주소 '#system-audit/<분류>'에서 고른 분류를 읽는다. 없거나 모르는 값이면 전체다. */
export function sheetOfHash(hash: string): AuditSheet {
  const [page, sheet] = hash.replace(/^#/, '').split('/');
  if (page !== AUDIT_HASH || !sheet) return 'ALL';
  return AUDIT_CATEGORIES.find((item) => item.id === sheet)?.id ?? 'ALL';
}

/** 분류를 주소에 남기는 값. 패널을 닫았으면(null) 화면 이름만 남긴다. */
export const hashOfSheet = (sheet: AuditSheet | null): string =>
  sheet ? `#${AUDIT_HASH}/${sheet === 'ALL' ? 'all' : sheet}` : `#${AUDIT_HASH}`;

/**
 * 권한 필터 선택지: 서버가 정한 분류별 권한(매트릭스 순서, 매트릭스에 없는 작업이 있으면 맨 끝에 '매트릭스에 없음').
 * 분류를 고르지 않았으면(전체) 모든 분류의 권한을 순서대로 합치고 겹치는 것은 하나만 남긴다.
 * 읽는 동안에는 '전체'만 두어 필터 자리는 그대로 남긴다.
 */
export function permissionOptionsOf(
  filters: AuditFilterOptions | null,
  sheet: AuditSheet | null,
): AuditFilterOption[] {
  const categories = filters?.categories ?? [];
  const picked =
    sheet && sheet !== 'ALL' ? categories.filter((category) => category.key === sheet) : categories;
  const seen = new Set<string>();
  const permissions = picked
    .flatMap((category) => category.permissions)
    .filter((permission) => {
      if (seen.has(permission.key)) return false;
      seen.add(permission.key);
      return true;
    });
  return [
    { value: 'ALL', label: '전체' },
    ...permissions.map((permission) => ({ value: permission.key, label: permission.label })),
  ];
}
