import { useCallback, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import { AccountPermissionEditor } from '@/pages/system-accounts/ui/AccountPermissionEditor';
import { TABLE_BOX, TOOLBAR_FIELD } from '@/pages/system-accounts/ui/systemStyles';

interface AccountPermissionsTabProps {
  catalog: PermissionCatalog;
  me: AdminAccount;
  accounts: readonly AdminAccount[];
  canEdit: boolean;
  /** 고른 계정. 계정 표에서 권한 버튼으로 들어오면 그 계정이 골라져 있다. */
  selectedId: number | null;
  onSelect: (accountId: number) => void;
  onSave: (account: AdminAccount, permissions: string[]) => Promise<boolean>;
}

/** 저장된 예외가 바뀌면 편집기를 새로 만들도록 key에 넣는다. */
const overridesSignature = (account: AdminAccount): string =>
  Object.entries(account.overrides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, isGranted]) => `${key}:${isGranted ? 1 : 0}`)
    .join(',');

/**
 * 계정별 권한 관리 탭(SYS-PERM). 왼쪽에서 운영진 계정을 고르고, 오른쪽에서 그 계정의 권한을
 * 기본 권한에서 더하거나 빼서 저장한다. 저장하지 않은 변경이 있으면 다른 계정으로 옮길 때 확인한다.
 */
export function AccountPermissionsTab({
  catalog,
  me,
  accounts,
  canEdit,
  selectedId,
  onSelect,
  onSave,
}: AccountPermissionsTabProps) {
  const [query, setQuery] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const handleDirtyChange = useCallback((value: boolean) => setIsDirty(value), []);

  const selected = accounts.find((account) => account.id === selectedId) ?? null;
  const matched = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return accounts;
    return accounts.filter(
      (account) =>
        account.name.toLowerCase().includes(text) ||
        account.username.toLowerCase().includes(text) ||
        account.teamName.toLowerCase().includes(text),
    );
  }, [accounts, query]);

  const select = (accountId: number) => {
    if (accountId === selectedId) return;
    if (
      isDirty &&
      !window.confirm('저장하지 않은 변경이 있습니다. 저장하지 않고 다른 계정으로 옮길까요?')
    ) {
      return;
    }
    setIsDirty(false);
    onSelect(accountId);
  };

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className={`${TABLE_BOX} lg:sticky lg:top-4`} aria-label="운영진 계정 목록">
        <div className="border-b border-slate-200 p-3">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름·아이디·팀 검색"
              aria-label="운영진 계정 검색"
              className={`${TOOLBAR_FIELD} w-full pl-8 pr-3`}
            />
          </div>
        </div>
        <ul className="max-h-[70vh] overflow-y-auto">
          {matched.length === 0 && (
            <li className="py-8 text-center text-xs text-slate-400">맞는 계정이 없습니다.</li>
          )}
          {matched.map((account) => {
            const isSelected = account.id === selectedId;
            const adjustedCount = Object.keys(account.overrides).length;
            return (
              <li key={account.id}>
                <button
                  type="button"
                  onClick={() => select(account.id)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`flex w-full cursor-pointer items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-left transition-colors last:border-b-0 ${
                    isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-slate-900">
                      {account.name}
                      {account.id === me.id && (
                        <span className="ml-1 font-semibold text-slate-400">(나)</span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {account.teamName} · {account.role}
                    </span>
                  </span>
                  {adjustedCount > 0 && (
                    <span className="shrink-0 rounded-sm bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      조정 {adjustedCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {selected ? (
        <AccountPermissionEditor
          key={`${selected.id}|${overridesSignature(selected)}`}
          catalog={catalog}
          account={selected}
          me={me}
          accounts={accounts}
          canEdit={canEdit}
          onSave={(permissions) => onSave(selected, permissions)}
          onDirtyChange={handleDirtyChange}
        />
      ) : (
        <div className={`${TABLE_BOX} py-16 text-center text-xs text-slate-400`}>
          왼쪽에서 권한을 바꿀 운영진 계정을 고르세요.
        </div>
      )}
    </div>
  );
}
