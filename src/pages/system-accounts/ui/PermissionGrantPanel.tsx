import { Fragment, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { isInBaseOf } from '@/entities/admin-account/model/catalog';
import type { PermissionChange, PermissionDef } from '@/entities/admin-account/model/permissions';
import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import { AccessTag, PermissionLabel } from '@/pages/system-accounts/ui/PermissionMatrixTable';
import {
  MODAL_CONFIRM_BTN,
  TABLE_BOX,
  TH_CLASS,
  TOOLBAR_FIELD,
} from '@/pages/system-accounts/ui/systemStyles';

interface PermissionGrantPanelProps {
  catalog: PermissionCatalog;
  accounts: readonly AdminAccount[];
  /** 고른 계정들에 고른 권한들을 반영한다. 락아웃 방지 등으로 거부되면 false를 돌려준다. */
  onApply: (
    accountIds: number[],
    permissionKeys: string[],
    change: PermissionChange,
  ) => Promise<boolean>;
}

const CHANGE_LABELS: Record<PermissionChange, string> = {
  grant: '부여',
  revoke: '회수',
  reset: '기본값으로 되돌리기',
};

const SECTION_HEADER =
  'flex h-14 items-center justify-between gap-2 border-b border-slate-200 px-4';
const SECTION_TITLE = 'text-sm font-bold text-slate-900';
const COUNT = 'ml-1.5 text-xs font-semibold tabular-nums text-slate-400';

/** 예외로 바뀐 권한인지(기본 세트와 다른지). */
const isException = (
  catalog: PermissionCatalog,
  permission: PermissionDef,
  account: AdminAccount,
): boolean =>
  permission.key in account.overrides &&
  account.overrides[permission.key] !== isInBaseOf(catalog, permission, account.baseSetKey);

const toggle = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/**
 * 권한 부여. 권한 41개는 고정이고, 권한(여러 개를 묶어서)과 받을 계정(여러 명)을 골라 한 번에 부여·회수한다.
 * 결과는 계정별 예외로 저장된다. 맡은 그룹에서 계산되는 권한은 부여할 수 없어 목록에서 뺀다.
 */
export function PermissionGrantPanel({ catalog, accounts, onApply }: PermissionGrantPanelProps) {
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const groups = useMemo(() => {
    const text = query.trim().toLowerCase();
    return catalog.groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter(
          (p) => !p.ownGroup && (!text || p.label.toLowerCase().includes(text)),
        ),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [catalog, query]);

  const selectedPermissions = catalog.groups
    .flatMap((group) => group.permissions)
    .filter((p) => selectedPermissionKeys.includes(p.key));
  const single = selectedPermissions.length === 1 ? selectedPermissions[0] : null;
  const canApply = !isApplying && selectedPermissions.length > 0 && selectedAccountIds.length > 0;
  const isAllAccounts = accounts.length > 0 && selectedAccountIds.length === accounts.length;

  const toggleGroup = (permissions: readonly PermissionDef[]) => {
    const keys = permissions.map((p) => p.key);
    const isAll = keys.every((key) => selectedPermissionKeys.includes(key));
    setSelectedPermissionKeys((current) =>
      isAll
        ? current.filter((key) => !keys.includes(key))
        : [...current, ...keys.filter((key) => !current.includes(key))],
    );
  };

  const apply = async (change: PermissionChange) => {
    const message = `권한 ${selectedPermissions.length}개를 ${selectedAccountIds.length}명에게 ${CHANGE_LABELS[change]}할까요?`;
    if (!window.confirm(message)) return;
    setIsApplying(true);
    await onApply(selectedAccountIds, selectedPermissionKeys, change);
    setIsApplying(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* 1. 권한 */}
        <section className={TABLE_BOX} aria-labelledby="grant-permissions-title">
          <div className={SECTION_HEADER}>
            <h2 id="grant-permissions-title" className={SECTION_TITLE}>
              권한<span className={COUNT}>{selectedPermissions.length}</span>
            </h2>
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="검색"
                aria-label="권한 검색"
                className={`w-36 pl-8 pr-3 font-medium placeholder:font-normal placeholder:text-slate-400 ${TOOLBAR_FIELD}`}
              />
            </div>
          </div>

          <div className="max-h-[540px] overflow-y-auto">
            {groups.length === 0 && (
              <p className="py-10 text-center text-xs text-slate-400">검색 결과가 없습니다.</p>
            )}
            {groups.map((group) => {
              const isGroupSelected = group.permissions.every((p) =>
                selectedPermissionKeys.includes(p.key),
              );
              return (
                <Fragment key={group.title}>
                  <div className="sticky top-0 z-10 flex items-center justify-between border-y border-slate-200 bg-slate-50 px-4 py-1.5 first:border-t-0">
                    <span className="text-[11px] font-bold text-slate-500">{group.title}</span>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.permissions)}
                      className="cursor-pointer text-[11px] font-semibold text-slate-400 transition-colors hover:text-slate-900"
                    >
                      {isGroupSelected ? '해제' : '모두'}
                    </button>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {group.permissions.map((permission) => {
                      const inputId = `grant-perm-${permission.key}`;
                      const isSelected = selectedPermissionKeys.includes(permission.key);
                      return (
                        <li key={permission.key} className={isSelected ? 'bg-slate-100/70' : ''}>
                          <label
                            htmlFor={inputId}
                            className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-xs hover:bg-slate-50/70"
                          >
                            <input
                              id={inputId}
                              type="checkbox"
                              checked={isSelected}
                              onChange={() =>
                                setSelectedPermissionKeys((current) =>
                                  toggle(current, permission.key),
                                )
                              }
                              className="size-4 shrink-0 cursor-pointer accent-slate-700"
                            />
                            <PermissionLabel permission={permission} />
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </Fragment>
              );
            })}
          </div>
        </section>

        {/* 2. 계정 */}
        <section className={TABLE_BOX} aria-labelledby="grant-accounts-title">
          <div className={SECTION_HEADER}>
            <h2 id="grant-accounts-title" className={SECTION_TITLE}>
              계정<span className={COUNT}>{selectedAccountIds.length}</span>
            </h2>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead className="bg-slate-50/80">
              <tr className="h-10 border-b border-slate-200 text-[11px]">
                <th scope="col" className="w-10 px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={isAllAccounts}
                    onChange={() =>
                      setSelectedAccountIds(isAllAccounts ? [] : accounts.map((a) => a.id))
                    }
                    aria-label="모든 계정 선택"
                    className="size-4 cursor-pointer accent-slate-700"
                  />
                </th>
                <th scope="col" className={`${TH_CLASS} text-left text-slate-900`}>
                  이름
                </th>
                <th scope="col" className={`${TH_CLASS} w-[96px]`}>
                  보유
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {accounts.map((account) => {
                const inputId = `grant-account-${account.id}`;
                const isSelected = selectedAccountIds.includes(account.id);
                const heldCount = selectedPermissions.filter((p) =>
                  account.effectivePermissions.includes(p.key),
                ).length;
                return (
                  <tr
                    key={account.id}
                    className={`h-[52px] transition-colors ${
                      isSelected ? 'bg-slate-100/70' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <td className="px-3 py-2 text-center">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          setSelectedAccountIds((current) => toggle(current, account.id))
                        }
                        className="size-4 cursor-pointer accent-slate-700"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <label htmlFor={inputId} className="block cursor-pointer">
                        <span className="block font-bold text-slate-900">{account.name}</span>
                        <span className="text-[11px] text-slate-400">{account.teamName}</span>
                      </label>
                    </td>
                    <td className="px-4 py-2 text-center whitespace-nowrap">
                      {single ? (
                        <span className="inline-flex items-center justify-center gap-1.5">
                          {heldCount > 0 ? (
                            <AccessTag permission={single} kind="allowed" />
                          ) : (
                            <span className="text-[11px] text-slate-300">없음</span>
                          )}
                          {isException(catalog, single, account) && (
                            <span className="rounded-full border border-slate-300 px-1.5 py-px text-[10px] font-semibold text-slate-500">
                              조정됨
                            </span>
                          )}
                        </span>
                      ) : selectedPermissions.length > 0 ? (
                        <span
                          className={`tabular-nums ${
                            heldCount === selectedPermissions.length
                              ? 'font-semibold text-slate-900'
                              : 'text-slate-400'
                          }`}
                        >
                          {heldCount}/{selectedPermissions.length}
                        </span>
                      ) : (
                        <span className="text-slate-300">–</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      {/* 반영. 결과는 계정별 예외로 저장된다. */}
      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white/95 py-3 backdrop-blur-xs">
        <span className="mr-auto text-xs font-medium text-slate-500">
          {canApply
            ? `권한 ${selectedPermissions.length}개 · ${selectedAccountIds.length}명`
            : '권한과 계정을 고르세요'}
        </span>
        <button
          type="button"
          onClick={() => apply('reset')}
          disabled={!canApply}
          className="h-9 cursor-pointer px-2 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          기본값으로
        </button>
        <button
          type="button"
          onClick={() => apply('revoke')}
          disabled={!canApply}
          className={MODAL_CONFIRM_BTN}
        >
          회수
        </button>
        <button
          type="button"
          onClick={() => apply('grant')}
          disabled={!canApply}
          className="h-9 cursor-pointer rounded-sm bg-slate-800 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          부여
        </button>
      </div>
    </div>
  );
}
