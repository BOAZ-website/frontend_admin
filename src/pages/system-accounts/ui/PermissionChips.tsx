import { permissionSummaryIn } from '@/entities/admin-account/model/catalog';
import type { PermissionCatalog } from '@/entities/admin-account/model/types';

const LEVEL_STYLE = {
  manage: { suffix: '관리', className: 'text-slate-700' },
  read: { suffix: '조회', className: 'text-slate-500' },
} as const;

interface PermissionChipsProps {
  catalog: PermissionCatalog;
  effectivePermissions: readonly string[];
}

/**
 * 지금 가진 권한을 영역별 글자 목록(사이 ·)으로 보여준다. 진한 글자는 관리(수정·삭제 포함), 옅은 글자는 조회다.
 * 누구나 가진 권한(본인 계정 수정)은 뺀다.
 */
export function PermissionChips({ catalog, effectivePermissions }: PermissionChipsProps) {
  const areas = permissionSummaryIn(catalog, effectivePermissions);
  if (areas.length === 0) {
    return <span className="text-xs text-slate-500">본인 계정만</span>;
  }
  return (
    <ul className="flex flex-wrap text-xs" aria-label="가진 권한">
      {areas.map(({ area, level }, index) => {
        const style = LEVEL_STYLE[level];
        return (
          <li key={area} className={`whitespace-nowrap ${style.className}`}>
            {index > 0 && (
              <span aria-hidden="true" className="px-1 text-slate-400">
                ·
              </span>
            )}
            {area} {style.suffix}
          </li>
        );
      })}
    </ul>
  );
}
