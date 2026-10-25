import { permissionSummaryIn } from '@/entities/admin-account/model/catalog';
import type { PermissionCatalog } from '@/entities/admin-account/model/types';

const LEVEL_STYLE = {
  manage: { suffix: '관리', className: 'bg-slate-100 text-slate-700' },
  read: { suffix: '조회', className: 'bg-white text-slate-500 ring-1 ring-inset ring-slate-200' },
} as const;

interface PermissionChipsProps {
  catalog: PermissionCatalog;
  effectivePermissions: readonly string[];
}

/**
 * 지금 가진 권한을 영역별 칩으로 보여준다. 회색 칩은 관리(수정·삭제 포함), 테두리만 있는 칩은 조회다.
 * 누구나 가진 권한(본인 계정 수정)은 뺀다.
 */
export function PermissionChips({ catalog, effectivePermissions }: PermissionChipsProps) {
  const areas = permissionSummaryIn(catalog, effectivePermissions);
  if (areas.length === 0) {
    return <span className="text-[11px] text-slate-400">본인 계정만</span>;
  }
  return (
    <ul className="flex flex-wrap gap-1" aria-label="가진 권한">
      {areas.map(({ area, level }) => {
        const style = LEVEL_STYLE[level];
        return (
          <li
            key={area}
            className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${style.className}`}
          >
            {area} {style.suffix}
          </li>
        );
      })}
    </ul>
  );
}
