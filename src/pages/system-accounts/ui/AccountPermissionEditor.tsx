import { useEffect, useState } from 'react';
import { Lock, RotateCcw } from 'lucide-react';

import { baseSetLabelIn, isInBaseOf } from '@/entities/admin-account/model/catalog';
import type { PermissionDef } from '@/entities/admin-account/model/permissions';
import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import {
  baseCheckedOf,
  changeCountsOf,
  changeMarkOf,
  lockReasonOf,
  savedCheckedOf,
  unsavedCountOf,
} from '@/pages/system-accounts/model/permissionDraft';
import { PermissionLabel } from '@/pages/system-accounts/ui/PermissionLabel';
import {
  MODAL_CANCEL_BTN,
  MODAL_CONFIRM_BTN,
  TABLE_BOX,
} from '@/pages/system-accounts/ui/systemStyles';
import { Tooltip } from '@/shared/ui/Tooltip';

interface AccountPermissionEditorProps {
  catalog: PermissionCatalog;
  account: AdminAccount;
  /** 로그인한 계정. 본인 권한 회수를 막는 데 쓴다. */
  me: Pick<AdminAccount, 'id'>;
  /** 전체 운영진 계정. 마지막 보유자 회수를 막는 데 쓴다. */
  accounts: readonly AdminAccount[];
  /** 권한 부여(커스텀) 권한이 없으면 false. 체크박스와 저장 버튼이 비활성화된다. */
  canEdit: boolean;
  /** 체크된 최종 집합(맡은 그룹 권한 제외)을 저장한다. 실패하면 false. */
  onSave: (permissions: string[]) => Promise<boolean>;
  /** 저장하지 않은 변경이 있는지 알린다. 다른 계정으로 옮길 때 확인에 쓴다. */
  onDirtyChange?: (isDirty: boolean) => void;
}

const SMALL_TAG = 'rounded-sm px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap';
const MARK_TAG = {
  added: { text: '추가', className: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200' },
  removed: { text: '제외', className: 'bg-red-50 text-red-600 ring-1 ring-inset ring-red-200' },
} as const;

/**
 * 운영진 한 명의 권한 편집(SYS-PERM). 권한 전체를 묶음별 체크박스로 보여 준다.
 * 기본 권한은 처음부터 체크되어 있고, 기본값과 달라진 항목(추가·제외)을 표시한다.
 * 맡은 그룹에서 자동으로 붙는 권한은 읽기 전용이다. 저장은 체크된 최종 집합을 한 번에 보낸다.
 */
export function AccountPermissionEditor({
  catalog,
  account,
  me,
  accounts,
  canEdit,
  onSave,
  onDirtyChange,
}: AccountPermissionEditorProps) {
  const saved = savedCheckedOf(catalog, account);
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(saved));
  const [isSaving, setIsSaving] = useState(false);

  const unsavedCount = unsavedCountOf(saved, checked);
  const isDirty = unsavedCount > 0;
  const { added, removed } = changeCountsOf(catalog, account, checked);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const toggle = (key: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const resetToBase = () => setChecked(new Set(baseCheckedOf(catalog, account)));
  const discard = () => setChecked(new Set(saved));

  // 저장에 성공하면 부모가 계정을 다시 읽고, 바뀐 예외로 key가 달라져 이 편집기가 새 상태로 다시 만들어진다.
  // 실패하면 체크 상태를 그대로 두어 고쳐서 다시 저장할 수 있다.
  const save = async () => {
    setIsSaving(true);
    await onSave([...checked]);
    setIsSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-900">
            {account.name}
            <span className="ml-2 font-mono text-xs font-normal text-slate-400">
              {account.username}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {account.teamName} · {account.role} · 기본 권한{' '}
            <strong className="font-semibold text-slate-700">
              {baseSetLabelIn(catalog, account.baseSetKey)}
            </strong>
          </p>
        </div>
        <p className="text-xs text-slate-500">
          기본 권한에서 <span className="font-semibold text-blue-700">추가 {added}</span> ·{' '}
          <span className="font-semibold text-red-600">제외 {removed}</span>
        </p>
      </div>

      {!canEdit && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          권한을 바꾸려면 &quot;운영진 계정 권한 부여(커스텀)&quot; 권한이 필요합니다. 지금은 조회만
          할 수 있습니다.
        </p>
      )}

      <div className="space-y-3">
        {catalog.groups.map((group) => (
          <section
            key={group.title}
            className={TABLE_BOX}
            aria-labelledby={`perm-group-${group.title}`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2">
              <h2 id={`perm-group-${group.title}`} className="text-xs font-bold text-slate-700">
                {group.title}
              </h2>
              <span className="text-[11px] font-semibold text-slate-400">기본</span>
            </div>
            <ul>
              {group.permissions.map((permission) => (
                <PermissionRow
                  key={permission.key}
                  catalog={catalog}
                  account={account}
                  permission={permission}
                  isChecked={
                    permission.ownGroup
                      ? account.effectivePermissions.includes(permission.key)
                      : checked.has(permission.key)
                  }
                  mark={changeMarkOf(catalog, account, permission, checked)}
                  lockReason={
                    checked.has(permission.key)
                      ? lockReasonOf(permission, account, me, accounts)
                      : null
                  }
                  isDisabled={!canEdit || isSaving}
                  onToggle={() => toggle(permission.key)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {canEdit && (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-xs">
          <span className="mr-auto text-xs text-slate-500">
            {isDirty ? (
              <>
                저장하지 않은 변경{' '}
                <strong className="font-semibold text-slate-900">{unsavedCount}</strong>건
              </>
            ) : (
              '저장된 상태입니다.'
            )}
          </span>
          <button
            type="button"
            onClick={resetToBase}
            disabled={isSaving}
            className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-sm px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
          >
            <RotateCcw size={12} aria-hidden="true" />
            기본 권한으로 되돌리기
          </button>
          <button
            type="button"
            onClick={discard}
            disabled={!isDirty || isSaving}
            className={`${MODAL_CANCEL_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            변경 취소
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!isDirty || isSaving}
            className={MODAL_CONFIRM_BTN}
          >
            {isSaving ? '저장 중…' : '저장'}
          </button>
        </div>
      )}
    </div>
  );
}

interface PermissionRowProps {
  catalog: PermissionCatalog;
  account: AdminAccount;
  permission: PermissionDef;
  isChecked: boolean;
  mark: 'added' | 'removed' | null;
  /** 체크를 풀 수 없는 사유. 있으면 체크박스를 잠근다. */
  lockReason: string | null;
  isDisabled: boolean;
  onToggle: () => void;
}

/** 권한 한 줄: 체크박스 · 이름 · 기본값과의 차이 표시 · 기본 권한 여부. */
function PermissionRow({
  catalog,
  account,
  permission,
  isChecked,
  mark,
  lockReason,
  isDisabled,
  onToggle,
}: PermissionRowProps) {
  const isAuto = Boolean(permission.ownGroup);
  const isInBase = !isAuto && isInBaseOf(catalog, permission, account.baseSetKey);
  const inputId = `perm-${account.id}-${permission.key}`;
  const isLocked = isAuto || lockReason !== null;

  return (
    <li
      className={`flex h-10 items-center gap-3 border-b border-slate-100 px-4 text-xs last:border-b-0 ${
        mark ? 'bg-slate-50/60' : ''
      }`}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        disabled={isDisabled || isLocked}
        className="size-4 shrink-0 cursor-pointer accent-slate-700 disabled:cursor-not-allowed"
      />
      <label htmlFor={inputId} className="flex min-w-0 flex-1 items-center gap-2 text-xs">
        <PermissionLabel permission={permission} />
        {mark && (
          <span className={`${SMALL_TAG} ${MARK_TAG[mark].className}`}>{MARK_TAG[mark].text}</span>
        )}
        {isAuto && <span className={`${SMALL_TAG} text-slate-400`}>맡은 그룹에서 자동</span>}
        {lockReason && (
          <Tooltip label={lockReason}>
            <span className="inline-flex text-slate-400" aria-label={lockReason}>
              <Lock size={12} aria-hidden="true" />
            </span>
          </Tooltip>
        )}
      </label>
      <span
        className={`w-8 shrink-0 text-center text-[11px] font-semibold ${
          isInBase ? 'text-slate-600' : 'text-slate-300'
        }`}
        aria-label={isInBase ? '기본 권한에 포함' : '기본 권한에 없음'}
      >
        {isAuto ? '자동' : isInBase ? '●' : '–'}
      </span>
    </li>
  );
}
