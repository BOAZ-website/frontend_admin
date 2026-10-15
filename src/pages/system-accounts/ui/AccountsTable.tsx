import { Fragment, useMemo, useState } from 'react';
import { Pencil, Search, ShieldCheck, Trash2 } from 'lucide-react';

import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import { PermissionChips } from '@/pages/system-accounts/ui/PermissionChips';
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
  canManagePermissions: boolean;
  canDelete: (account: AdminAccount) => boolean;
}

interface AccountsTableProps {
  catalog: PermissionCatalog;
  accounts: readonly AdminAccount[];
  actions: AccountActions;
  onEdit: (account: AdminAccount) => void;
  onPermissions: (account: AdminAccount) => void;
  onDelete: (account: AdminAccount) => void;
}

/**
 * 운영진 계정 표. 출결 표와 같은 모양이며, 왼쪽 운영진 칸(팀)이 소속 인원 수만큼 세로로 이어진다.
 * 팀 순서는 카탈로그의 팀 순서이고, 팀 안에서는 생성일 순이다.
 */
export function AccountsTable({
  catalog,
  accounts,
  actions,
  onEdit,
  onPermissions,
  onDelete,
}: AccountsTableProps) {
  const [query, setQuery] = useState('');

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
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <thead className="bg-slate-50/80 select-none">
              <tr className="h-11 divide-x divide-slate-200 border-b border-slate-200 text-[11px]">
                <th className={`${TH_CLASS} w-[140px] text-slate-900`}>운영진</th>
                <th className={`${TH_CLASS} w-[150px] text-slate-900`}>이름</th>
                <th className={`${TH_CLASS} w-[170px]`}>아이디</th>
                <th className={`${TH_CLASS} w-[90px]`}>역할</th>
                <th className={`${TH_CLASS} w-[100px]`}>부문</th>
                <th className={`${TH_CLASS} w-[70px]`}>기수</th>
                <th className={`${TH_CLASS} min-w-[260px]`}>권한</th>
                <th className={`${TH_CLASS} w-[120px]`}>관리</th>
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
                          <td className={`${TD_CLASS} font-bold text-slate-900`}>
                            {actions.canManagePermissions ? (
                              <button
                                type="button"
                                onClick={() => onPermissions(account)}
                                className="cursor-pointer underline-offset-2 hover:underline"
                              >
                                {account.name}
                              </button>
                            ) : (
                              account.name
                            )}
                          </td>
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
                              {actions.canManagePermissions && (
                                <Tooltip label="권한">
                                  <button
                                    type="button"
                                    onClick={() => onPermissions(account)}
                                    aria-label={`${account.name} 권한`}
                                    className={ICON_BTN}
                                  >
                                    <ShieldCheck size={14} aria-hidden="true" />
                                  </button>
                                </Tooltip>
                              )}
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
