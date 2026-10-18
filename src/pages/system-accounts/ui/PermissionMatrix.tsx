import { Fragment } from 'react';
import { Check } from 'lucide-react';

import { isInBaseOf } from '@/entities/admin-account/model/catalog';
import type { PermissionCatalog } from '@/entities/admin-account/model/types';
import { PermissionLabel } from '@/pages/system-accounts/ui/PermissionLabel';
import { TABLE_BOX, TH_CLASS } from '@/pages/system-accounts/ui/systemStyles';
import { Tooltip } from '@/shared/ui/Tooltip';

/**
 * 권한 매트릭스(읽기 전용): 권한 41개 × 기본 권한 세트 7개. 칸의 ✓는 그 자리의 기본 권한에 들어 있다는 뜻이고, 없으면 칸을 비워 둔다.
 * 맡은 그룹에서 자동으로 붙는 권한은 그룹리더 열에 '자동'으로 보인다. 계정마다 더하고 뺀 권한은 사람을 골라서 본다.
 */
export function PermissionMatrix({ catalog }: { catalog: PermissionCatalog }) {
  const columnCount = catalog.baseSets.length + 2;

  return (
    <div>
      <div className={TABLE_BOX}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] table-fixed border-collapse text-xs">
            <colgroup>
              <col className="w-[96px]" />
              <col />
              {catalog.baseSets.map((column) => (
                <col key={column.key} className="w-[64px]" />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 select-none">
              <tr className="h-11 divide-x divide-slate-200 border-b border-slate-200 text-[11px]">
                <th className={`${TH_CLASS} text-slate-900`}>영역</th>
                <th className={`${TH_CLASS} text-slate-900`}>권한</th>
                {catalog.baseSets.map((column) => (
                  <th key={column.key} className={TH_CLASS}>
                    <Tooltip label={column.keyLabel}>
                      <span className="cursor-help">{column.label}</span>
                    </Tooltip>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalog.groups.map((group) => (
                <Fragment key={group.title}>
                  {group.permissions.map((permission, index) => (
                    <tr
                      key={permission.key}
                      className={`h-10 divide-x divide-slate-200 transition-colors hover:bg-slate-50/70 ${
                        index === 0
                          ? 'border-t border-slate-200 first:border-t-0'
                          : 'border-t border-slate-100'
                      }`}
                    >
                      {index === 0 && (
                        <th
                          scope="rowgroup"
                          rowSpan={group.permissions.length}
                          className="bg-white px-2 text-center align-middle text-xs font-bold text-slate-900"
                        >
                          {group.title}
                        </th>
                      )}
                      <td className="px-3">
                        <PermissionLabel permission={permission} />
                      </td>
                      {catalog.baseSets.map((column) => {
                        const isAuto = Boolean(permission.ownGroup) && column.key === 'groupLeader';
                        const isIn =
                          !permission.ownGroup && isInBaseOf(catalog, permission, column.key);
                        return (
                          <td
                            key={column.key}
                            className={`text-center text-[11px] font-semibold ${
                              isIn ? 'text-slate-700' : isAuto ? 'text-slate-400' : 'text-slate-200'
                            }`}
                            aria-label={isIn ? '기본 권한' : isAuto ? '맡은 그룹에서 자동' : '없음'}
                          >
                            {isIn ? (
                              <Check
                                size={14}
                                strokeWidth={2.5}
                                className="mx-auto"
                                aria-hidden="true"
                              />
                            ) : isAuto ? (
                              '자동'
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
              {catalog.groups.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="py-8 text-center text-slate-400">
                    권한 정보가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
