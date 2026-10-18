import { useCallback, useMemo, useState } from 'react';
import {
  ChevronRight,
  ChevronsRight,
  GripVertical,
  Maximize2,
  Minimize2,
  Search,
  X,
} from 'lucide-react';

import type {
  AccountHolder,
  AdminAccount,
  PermissionCatalog,
} from '@/entities/admin-account/model/types';
import { useSplitRatio } from '@/pages/system-accounts/model/useSplitRatio';
import { AccountPermissionEditor } from '@/pages/system-accounts/ui/AccountPermissionEditor';
import { AdminInfoCard, HolderInfoCard } from '@/pages/system-accounts/ui/HolderInfoCard';
import { HostSummaryCard } from '@/pages/system-accounts/ui/HostSummaryCard';
import { PermissionMatrix } from '@/pages/system-accounts/ui/PermissionMatrix';
import { TABLE_BOX } from '@/pages/system-accounts/ui/systemStyles';

interface AccountPermissionsTabProps {
  catalog: PermissionCatalog;
  me: AdminAccount;
  /** 계정을 가진 사람 전체(운영진 + HOST). */
  holders: readonly AccountHolder[];
  /** 운영진 계정 전체. 마지막 보유자 회수를 막는 데 쓴다. */
  accounts: readonly AdminAccount[];
  canEdit: boolean;
  /** 고른 사람(AccountHolder.key). 계정 표에서 권한 버튼으로 들어오면 그 사람이 골라져 있다. */
  selectedKey: string | null;
  onSelect: (holderKey: string) => void;
  onSave: (account: AdminAccount, permissions: string[]) => Promise<boolean>;
}

/** 저장된 예외가 바뀌면 편집기를 새로 만들도록 key에 넣는다. */
const overridesSignature = (account: AdminAccount): string =>
  Object.entries(account.overrides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, isGranted]) => `${key}:${isGranted ? 1 : 0}`)
    .join(',');

/**
 * 계정 통합 관리 탭. 목록 맨 위의 권한 매트릭스(자리별 기본 권한)가 처음 열려 있고, 그 아래에
 * 계정(운영진·HOST)을 가진 사람을 이름순으로 보여 준다. 사람을 고르면 고른 사람의 기본 정보(기수·부문·
 * 소속 팀·역할), 맡은 그룹(HOST), 운영 권한을 함께 보여 준다. 팀별로 보는 일은 운영진 계정 관리 표가 맡는다.
 * 운영 권한은 운영진 계정이 있을 때 기본 권한에서 더하거나 빼서 저장한다.
 */
export function AccountPermissionsTab({
  catalog,
  me,
  holders,
  accounts,
  canEdit,
  selectedKey,
  onSelect,
  onSave,
}: AccountPermissionsTabProps) {
  const [query, setQuery] = useState('');
  const { containerRef, splitRatio, isDragging, startDragging } = useSplitRatio();
  // 오른쪽 상세 패널에 여는 것. 탭에 들어오면 권한 매트릭스가 먼저 열리고,
  // 계정 표의 권한 버튼으로 들어오면 그 사람이 열린 채로 시작한다.
  const [peekTarget, setPeekTarget] = useState<'matrix' | 'holder' | null>(
    selectedKey !== null ? 'holder' : 'matrix',
  );
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const handleDirtyChange = useCallback((value: boolean) => setIsDirty(value), []);

  const selected = holders.find((holder) => holder.key === selectedKey) ?? null;

  // 목록은 이름만 가나다순으로 보여 준다. 검색은 아이디·팀·그룹 이름으로도 된다.
  const visibleHolders = useMemo(() => {
    const text = query.trim().toLowerCase();
    const matched = text
      ? holders.filter((holder) =>
          [
            holder.name,
            holder.adminAccount?.username ?? '',
            holder.adminAccount?.teamName ?? '',
            ...holder.hostLogins.map((login) => login.username),
            ...holder.leaderGroups.map((group) => group.name),
          ].some((value) => value.toLowerCase().includes(text)),
        )
      : holders;
    return [...matched].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [holders, query]);

  /** 저장하지 않은 권한 변경이 있으면 버려도 되는지 묻는다. */
  const canLeave = () =>
    !isDirty ||
    window.confirm('저장하지 않은 변경이 있습니다. 저장하지 않고 다른 계정으로 옮길까요?');

  const select = (holderKey: string) => {
    if (holderKey === selectedKey && peekTarget === 'holder') return;
    if (!canLeave()) return;
    setIsDirty(false);
    onSelect(holderKey);
    setPeekTarget('holder');
  };

  const openMatrix = () => {
    if (peekTarget === 'matrix' || !canLeave()) return;
    setIsDirty(false);
    setPeekTarget('matrix');
  };

  const closePeek = () => {
    if (!canLeave()) return;
    setIsDirty(false);
    setPeekTarget(null);
    setIsFullScreen(false);
  };

  const peek = peekTarget === 'holder' ? selected : null;
  const isMatrixOpen = peekTarget === 'matrix';
  const isOpen = isMatrixOpen || peek !== null;
  const panelTitle = isMatrixOpen ? '권한 매트릭스' : (peek?.name ?? '');

  // 출결(BASE·ADV·스터디)의 분할 화면과 같다: 사람을 누르면 오른쪽에 상세 패널이 열리고,
  // 가운데 막대로 너비를 바꾸고, 패널을 전체 화면으로 키우거나 닫을 수 있다. 목록과 패널은 따로 스크롤된다.
  return (
    <div
      ref={containerRef}
      className={`relative h-[calc(100vh-11rem)] min-h-[420px] w-full ${
        isOpen && !isFullScreen ? 'flex min-w-0 flex-row gap-0' : 'block'
      }`}
    >
      {/* 왼쪽: 사람 목록 */}
      {(!isOpen || !isFullScreen) && (
        <aside
          style={{
            width: isOpen ? `${splitRatio}%` : '100%',
            minWidth: isOpen ? '200px' : undefined,
          }}
          className={`flex h-full shrink-0 flex-col gap-2.5 ${isOpen ? 'pr-1.5' : ''}`}
          aria-label="계정을 가진 사람 목록"
        >
          {/* 검색: 평소에는 옅은 바탕, 누르면 흰 바탕과 테두리 강조. 입력이 있으면 지우기 버튼이 생긴다. */}
          <div className="group relative shrink-0">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-slate-700"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setQuery('');
              }}
              placeholder="검색"
              aria-label="계정 검색"
              className="h-11 w-full rounded-sm border border-slate-200 bg-slate-50/70 pl-10 pr-9 text-[13px] font-medium text-slate-900 shadow-2xs outline-none transition-[background-color,border-color,box-shadow] placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="검색어 지우기"
                className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={openMatrix}
            aria-current={isMatrixOpen ? 'true' : undefined}
            className={`group relative flex w-full shrink-0 cursor-pointer select-none items-center justify-between gap-3 rounded-md border p-4 text-left transition-all ${
              isMatrixOpen
                ? 'border-slate-300 bg-slate-100/80 shadow-2xs'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
            }`}
          >
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900 group-hover:text-slate-950">
              권한 매트릭스
            </span>
            <ChevronRight
              size={16}
              aria-hidden="true"
              className={`shrink-0 transition-transform ${
                isMatrixOpen
                  ? 'translate-x-0.5 text-slate-500'
                  : 'text-slate-300 group-hover:text-slate-500'
              }`}
            />
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleHolders.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">맞는 계정이 없습니다.</p>
            ) : (
              <ul className="space-y-2.5">
                {visibleHolders.map((holder) => (
                  <HolderItem
                    key={holder.key}
                    holder={holder}
                    isSelected={peek?.key === holder.key}
                    onSelect={() => select(holder.key)}
                  />
                ))}
              </ul>
            )}
          </div>
        </aside>
      )}

      {/* 가운데: 너비 조절 막대 */}
      {isOpen && !isFullScreen && (
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(event) => {
            event.preventDefault();
            startDragging();
          }}
          onTouchStart={(event) => {
            event.preventDefault();
            startDragging();
          }}
          className={`group z-20 -mx-0.5 flex w-4 shrink-0 cursor-col-resize select-none items-center justify-center self-stretch py-12 transition-colors ${
            isDragging ? 'bg-slate-200/50' : 'hover:bg-slate-100/80'
          }`}
          title="마우스로 드래그하여 패널 너비 조절"
        >
          <div
            className={`flex h-14 w-1 flex-col items-center justify-center rounded-full transition-all ${
              isDragging
                ? 'h-20 bg-slate-700'
                : 'bg-slate-300 group-hover:h-16 group-hover:bg-slate-500'
            }`}
          >
            <GripVertical
              size={10}
              className="text-white opacity-0 transition-opacity group-hover:opacity-100"
            />
          </div>
        </div>
      )}

      {/* 오른쪽: 권한 매트릭스 또는 고른 사람의 상세 패널 */}
      {isOpen && (
        <section
          style={{
            width: isFullScreen ? '100%' : `${100 - splitRatio}%`,
            minWidth: isFullScreen ? undefined : '340px',
          }}
          className="h-full min-w-0 flex-1 space-y-4 overflow-y-auto rounded-md border border-slate-200/90 bg-white p-6 shadow-sm animate-in slide-in-from-right duration-150 [scrollbar-gutter:stable] lg:p-7"
          aria-label={panelTitle}
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <h3 className="min-w-0 truncate text-xl font-black leading-snug tracking-tight text-slate-950 sm:text-2xl">
              {panelTitle}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden cursor-pointer items-center rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:flex"
                title={isFullScreen ? '분할 뷰로 축소' : '전체 화면으로 확장'}
                aria-label={isFullScreen ? '분할 뷰로 축소' : '전체 화면으로 확장'}
              >
                {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                type="button"
                onClick={closePeek}
                className="flex cursor-pointer items-center rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                title="사이드 패널 닫기"
                aria-label="사이드 패널 닫기"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>

          {peek ? (
            <>
              {/* 넓은 패널에서는 기본 정보·운영진 정보·HOST 카드를 나란히 둔다. */}
              <div className="grid items-stretch gap-4 xl:grid-cols-3">
                <HolderInfoCard holder={peek} />
                <AdminInfoCard holder={peek} />
                <HostSummaryCard holder={peek} />
              </div>

              {peek.adminAccount ? (
                <AccountPermissionEditor
                  key={`${peek.adminAccount.id}|${overridesSignature(peek.adminAccount)}`}
                  catalog={catalog}
                  account={peek.adminAccount}
                  me={me}
                  accounts={accounts}
                  canEdit={canEdit}
                  onSave={(permissions) =>
                    peek.adminAccount
                      ? onSave(peek.adminAccount, permissions)
                      : Promise.resolve(false)
                  }
                  onDirtyChange={handleDirtyChange}
                />
              ) : (
                <section className={`${TABLE_BOX} px-5 py-4`} aria-label="운영 권한">
                  <h2 className="text-sm font-bold text-slate-900">운영 권한</h2>
                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    운영진 계정이 없어 운영 권한이 없습니다. HOST 계정은 본인 계정 수정과 맡은
                    그룹의 출결 입력만 할 수 있습니다. 운영 권한을 주려면 운영진 계정 관리에서
                    운영진 계정을 발급해 주세요.
                  </p>
                </section>
              )}
            </>
          ) : (
            <PermissionMatrix catalog={catalog} />
          )}
        </section>
      )}
    </div>
  );
}

interface HolderItemProps {
  holder: AccountHolder;
  isSelected: boolean;
  onSelect: () => void;
}

/** 목록의 한 사람: 이름만 보여 준다. 출결 분할 화면의 팀 카드와 같은 모양이다. */
function HolderItem({ holder, isSelected, onSelect }: HolderItemProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected ? 'true' : undefined}
        className={`group relative flex w-full cursor-pointer select-none items-center justify-between gap-3 rounded-md border p-4 text-left transition-all ${
          isSelected
            ? 'border-slate-300 bg-slate-100/80 shadow-2xs'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate text-sm font-bold ${
            isSelected ? 'text-slate-950' : 'text-slate-900 group-hover:text-slate-950'
          }`}
        >
          {holder.name}
        </span>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className={`shrink-0 transition-transform ${
            isSelected
              ? 'translate-x-0.5 text-slate-500'
              : 'text-slate-300 group-hover:text-slate-500'
          }`}
        />
      </button>
    </li>
  );
}
