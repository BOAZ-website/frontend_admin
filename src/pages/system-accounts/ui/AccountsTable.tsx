import { Fragment, useMemo, useState } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';

import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import { useResizableWidths } from '@/pages/system-accounts/model/useResizableWidths';
import { PermissionChips } from '@/pages/system-accounts/ui/PermissionChips';
import { ResizeHandle } from '@/pages/system-accounts/ui/ResizeHandle';
import {
  ICON_BTN,
  ROW_CLASS,
  TABLE_BOX,
  TD_CLASS,
  TH_CLASS,
  TOOLBAR_FIELD,
  USERNAME_CHIP,
} from '@/pages/system-accounts/ui/systemStyles';
import { Tooltip } from '@/shared/ui/Tooltip';

/** 행마다 보일 관리 버튼. 로그인한 계정의 유효 권한으로 정한다. */
export interface AccountActions {
  canEdit: (account: AdminAccount) => boolean;
  canDelete: (account: AdminAccount) => boolean;
}

interface AccountsTableProps {
  catalog: PermissionCatalog;
  accounts: readonly AdminAccount[];
  actions: AccountActions;
  onEdit: (account: AdminAccount) => void;
  onDelete: (account: AdminAccount) => void;
}

type ColumnKey =
  'team' | 'name' | 'username' | 'role' | 'track' | 'term' | 'permissions' | 'actions';

/**
 * 표의 열. 출결 표처럼 머리 칸 오른쪽 손잡이를 끌어 너비를 바꾼다. 핵심 열(isKey)은 머리 글자를 진하게 둔다.
 * 권한 열(isFluid)은 남는 너비를 모두 차지해서, 표가 화면보다 넓어지지 않는다(가로 스크롤 없음).
 * COLUMN_WIDTHS의 권한 값은 그 열이 줄어들 수 있는 최소 너비다.
 */
const COLUMNS: readonly { key: ColumnKey; label: string; isKey?: boolean; isFluid?: boolean }[] = [
  { key: 'team', label: '운영진', isKey: true },
  { key: 'name', label: '이름', isKey: true },
  { key: 'username', label: '아이디' },
  { key: 'role', label: '역할' },
  { key: 'track', label: '부문' },
  { key: 'term', label: '기수' },
  { key: 'permissions', label: '권한', isFluid: true },
  { key: 'actions', label: '관리' },
];
// 기본 너비 합계(910px)가 1280px 화면의 표 영역(약 960px)보다 작아서 처음에는 가로 스크롤이 없다.
const COLUMN_WIDTHS: Record<ColumnKey, number> = {
  team: 110,
  name: 100,
  username: 160,
  role: 80,
  track: 90,
  term: 60,
  permissions: 200,
  actions: 110,
};
const COLUMN_LIMITS: Partial<Record<ColumnKey, { min: number }>> = {
  team: { min: 90 },
  name: { min: 80 },
  username: { min: 110 },
  role: { min: 60 },
  track: { min: 60 },
  term: { min: 50 },
  actions: { min: 100 },
};

/**
 * 운영진 계정 표. 출결 표와 같은 모양이며, 왼쪽 운영진 칸(팀)이 소속 인원 수만큼 세로로 이어진다.
 * 팀 순서는 카탈로그의 팀 순서이고, 팀 안에서는 생성일 순이다.
 */
export function AccountsTable({
  catalog,
  accounts,
  actions,
  onEdit,
  onDelete,
}: AccountsTableProps) {
  const [query, setQuery] = useState('');
  const { widths, resizingKey, startResize } = useResizableWidths(COLUMN_WIDTHS, COLUMN_LIMITS);
  // 이 너비보다 좁은 화면에서만 가로 스크롤이 생긴다(권한 열이 최소 너비까지 줄어든 뒤).
  const tableMinWidth = COLUMNS.reduce((sum, column) => sum + widths[column.key], 0);

  // 사람이 없는 팀은 보이지 않는다. 목록에 없는 새 팀은 맨 뒤에 붙는다.
  const teamGroups = useMemo(() => {
    const text = query.trim().toLowerCase();
    const matched = accounts.filter(
      (account) =>
        !text ||
        [account.username, account.name].some((value) => value.toLowerCase().includes(text)),
    );
    const teamOrder = [
      ...catalog.teamNames,
      ...matched.map((account) => account.teamName).filter((t) => !catalog.teamNames.includes(t)),
    ];
    return [...new Set(teamOrder)]
      .map((teamName) => ({
        teamName,
        members: matched.filter((account) => account.teamName === teamName),
      }))
      .filter((group) => group.members.length > 0);
  }, [accounts, catalog.teamNames, query]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">
          전체{' '}
          <span className="text-sm font-bold tabular-nums text-slate-900">{accounts.length}</span>명
        </p>
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름·아이디 검색"
            aria-label="이름, 아이디 검색"
            className={`w-44 pl-8 pr-3 font-medium placeholder:font-normal placeholder:text-slate-400 ${TOOLBAR_FIELD}`}
          />
        </div>
      </div>

      <div className={TABLE_BOX}>
        <div className="overflow-x-auto">
          <table
            className="w-full table-fixed border-collapse text-xs"
            style={{ minWidth: `${tableMinWidth}px` }}
          >
            <thead className="bg-slate-50/80 select-none">
              <tr className="h-11 divide-x divide-slate-200 border-b border-slate-200 text-[11px]">
                {COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    style={column.isFluid ? undefined : { width: `${widths[column.key]}px` }}
                    className={`${TH_CLASS} relative ${column.isKey ? 'text-slate-900' : ''}`}
                  >
                    {column.label}
                    {!column.isFluid && (
                      <ResizeHandle
                        isActive={resizingKey === column.key}
                        onMouseDown={(event) => startResize(event, column.key)}
                        className="absolute -right-2 top-0 bottom-0 flex"
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                teamGroups.map(({ teamName, members }) => (
                  <Fragment key={teamName}>
                    {members.map((account, index) => {
                      return (
                        <tr
                          key={account.id}
                          className={`${ROW_CLASS} border-t border-slate-200 first:border-t-0`}
                        >
                          {/* 운영진 칸: 팀 이름이 소속 인원 수만큼 세로로 이어진다. */}
                          {index === 0 && (
                            <td
                              rowSpan={members.length}
                              className={`${TD_CLASS} bg-white font-bold text-slate-900`}
                            >
                              {teamName}
                            </td>
                          )}
                          <td className={`${TD_CLASS} font-bold text-slate-900`}>{account.name}</td>
                          <td className={TD_CLASS}>
                            <code className={USERNAME_CHIP}>{account.username}</code>
                          </td>
                          <td className={`${TD_CLASS} text-slate-600`}>{account.role}</td>
                          <td className={`${TD_CLASS} text-slate-600`}>{account.track}</td>
                          <td className={`${TD_CLASS} text-slate-600`}>{account.term}기</td>
                          <td className="px-3 py-2">
                            <PermissionChips
                              catalog={catalog}
                              effectivePermissions={account.effectivePermissions}
                            />
                          </td>
                          <td className={TD_CLASS}>
                            <div className="flex items-center justify-center gap-0.5">
                              {actions.canEdit(account) && (
                                <Tooltip label="수정">
                                  <button
                                    type="button"
                                    onClick={() => onEdit(account)}
                                    aria-label={`${account.name} 수정`}
                                    className={ICON_BTN}
                                  >
                                    <Pencil size={14} aria-hidden="true" />
                                  </button>
                                </Tooltip>
                              )}
                              {actions.canDelete(account) && (
                                <Tooltip label="삭제" align="end">
                                  <button
                                    type="button"
                                    onClick={() => onDelete(account)}
                                    aria-label={`${account.name} 삭제`}
                                    className={`${ICON_BTN} hover:bg-red-50 hover:text-red-600`}
                                  >
                                    <Trash2 size={14} aria-hidden="true" />
                                  </button>
                                </Tooltip>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
