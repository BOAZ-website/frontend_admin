import { useMemo, useState } from 'react';
import { ChevronLeft, Plus, Search, X } from 'lucide-react';

import { baseSetLabelIn, isInBaseOf, permissionsIn } from '@/entities/admin-account/model/catalog';
import type { PermissionDef } from '@/entities/admin-account/model/permissions';
import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import { PermissionLabel } from '@/pages/system-accounts/ui/PermissionMatrixTable';
import {
  MODAL_BACKDROP,
  MODAL_CANCEL_BTN,
  MODAL_CLOSE_BTN,
  MODAL_CONFIRM_BTN,
  TABLE_BOX,
} from '@/pages/system-accounts/ui/systemStyles';
import { CreateButton } from '@/shared/ui/CreateButton';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';

interface AccountPermissionEditorProps {
  catalog: PermissionCatalog;
  account: AdminAccount;
  onBack: () => void;
  /** 권한의 최종 집합(맡은 그룹 권한 제외)을 저장한다. 실패하면 false. */
  onSave: (permissions: string[]) => Promise<boolean>;
}

const SMALL_TAG = 'rounded-sm px-1.5 py-0.5 text-[10px] font-semibold';

/**
 * 운영진 한 명의 권한. 지금 가진 권한을 영역별로 보여 주고, 권한마다 빼거나 새 권한을 추가한다.
 * 바꿀 때마다 최종 집합을 저장하고, 기본 권한과의 차이 계산은 서버가 한다.
 * 맡은 그룹에서 자동으로 붙는 권한은 뺄 수 없다.
 */
export function AccountPermissionEditor({
  catalog,
  account,
  onBack,
  onSave,
}: AccountPermissionEditorProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const all = useMemo(() => permissionsIn(catalog), [catalog]);
  const isHeld = (p: PermissionDef) => account.effectivePermissions.includes(p.key);
  const heldEditableKeys = all.filter((p) => !p.ownGroup && isHeld(p)).map((p) => p.key);
  const addable = all.filter((p) => !p.ownGroup && !isHeld(p));
  const adjustedCount = Object.keys(account.overrides).length;

  const save = async (permissions: string[]) => {
    setIsSaving(true);
    const isSaved = await onSave(permissions);
    setIsSaving(false);
    return isSaved;
  };

  const remove = (permission: PermissionDef) => {
    if (!window.confirm(`'${permission.label}' 권한을 뺄까요?`)) return;
    void save(heldEditableKeys.filter((key) => key !== permission.key));
  };

  const resetToBase = () => {
    if (!window.confirm('따로 추가하거나 뺀 권한을 모두 기본 권한으로 되돌릴까요?')) return;
    void save(
      all
        .filter((p) => !p.ownGroup && isInBaseOf(catalog, p, account.baseSetKey))
        .map((p) => p.key),
    );
  };

  const heldGroups = catalog.groups
    .map((group) => ({ title: group.title, permissions: group.permissions.filter(isHeld) }))
    .filter((group) => group.permissions.length > 0);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900"
      >
        <ChevronLeft size={14} aria-hidden="true" />
        운영진 계정
      </button>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-900">{account.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {account.teamName} · {account.role} · 기본 권한{' '}
            {baseSetLabelIn(catalog, account.baseSetKey)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {adjustedCount > 0 && (
            <button
              type="button"
              onClick={resetToBase}
              disabled={isSaving}
              className="cursor-pointer text-xs font-semibold text-slate-500 underline-offset-2 transition-colors hover:text-slate-900 hover:underline disabled:opacity-40"
            >
              기본 권한으로 되돌리기
            </button>
          )}
          <CreateButton
            label="권한 추가"
            onClick={() => setIsAddOpen(true)}
            disabled={isSaving || addable.length === 0}
          />
        </div>
      </div>

      <section className={TABLE_BOX} aria-labelledby="held-permissions-title">
        <h2
          id="held-permissions-title"
          className="border-b border-slate-200 bg-slate-50/80 px-5 py-2.5 text-xs font-bold text-slate-700"
        >
          가진 권한
          <span className="ml-1.5 font-semibold tabular-nums text-slate-400">
            {account.effectivePermissions.length}
          </span>
        </h2>

        {heldGroups.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">가진 권한이 없습니다.</p>
        ) : (
          heldGroups.map((group) => (
            <div key={group.title} className="border-b border-slate-200 last:border-b-0">
              <p className="px-5 pt-3 pb-1 text-[11px] font-bold text-slate-500">{group.title}</p>
              <ul>
                {group.permissions.map((permission) => {
                  const isAuto = Boolean(permission.ownGroup);
                  const isAdded = account.overrides[permission.key] === true;
                  return (
                    <li
                      key={permission.key}
                      className="flex h-10 items-center justify-between gap-3 px-5 text-xs hover:bg-slate-50/70"
                    >
                      <span className="flex items-center gap-2">
                        <PermissionLabel permission={permission} />
                        {isAdded && (
                          <span className={`${SMALL_TAG} bg-slate-100 text-slate-500`}>추가함</span>
                        )}
                      </span>
                      {isAuto ? (
                        <span className={`${SMALL_TAG} text-slate-400`}>맡은 그룹 자동</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => remove(permission)}
                          disabled={isSaving}
                          aria-label={`${permission.label} 권한 빼기`}
                          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-sm px-2 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          <X size={12} aria-hidden="true" />
                          빼기
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      {isAddOpen && (
        <AddPermissionModal
          catalog={catalog}
          addable={addable}
          onClose={() => setIsAddOpen(false)}
          onAdd={async (keys) => {
            const isSaved = await save([...heldEditableKeys, ...keys]);
            if (isSaved) setIsAddOpen(false);
          }}
        />
      )}
    </div>
  );
}

interface AddPermissionModalProps {
  catalog: PermissionCatalog;
  /** 아직 없고 추가할 수 있는 권한. */
  addable: readonly PermissionDef[];
  onClose: () => void;
  onAdd: (keys: string[]) => Promise<void>;
}

/** 권한 추가 팝업: 아직 없는 권한을 영역별로 보여 주고, 여러 개를 골라 한 번에 추가한다. */
function AddPermissionModal({ catalog, addable, onClose, onAdd }: AddPermissionModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const text = query.trim();
  const addableKeys = addable.map((p) => p.key);
  const groups = catalog.groups
    .map((group) => ({
      title: group.title,
      permissions: group.permissions.filter(
        (p) => addableKeys.includes(p.key) && (!text || p.label.includes(text)),
      ),
    }))
    .filter((group) => group.permissions.length > 0);

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );

  const add = async () => {
    setIsAdding(true);
    await onAdd(selected);
    setIsAdding(false);
  };

  return (
    <div
      className={MODAL_BACKDROP}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-permission-title"
        className={`flex max-h-[80vh] w-full max-w-md flex-col rounded-lg animate-in fade-in duration-150 ${MODAL_SURFACE}`}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h3 id="add-permission-title" className="text-base font-bold text-slate-900">
            권한 추가
          </h3>
          <button type="button" onClick={onClose} className={MODAL_CLOSE_BTN} aria-label="창 닫기">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-3">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="권한 검색"
              aria-label="권한 검색"
              className="h-9 w-full rounded-sm border border-slate-200 pl-8 pr-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-y border-slate-100">
          {groups.length === 0 && (
            <p className="py-10 text-center text-xs text-slate-400">추가할 권한이 없습니다.</p>
          )}
          {groups.map((group) => (
            <div key={group.title}>
              <p className="sticky top-0 bg-slate-50 px-6 py-1.5 text-[11px] font-bold text-slate-500">
                {group.title}
              </p>
              <ul>
                {group.permissions.map((permission) => {
                  const inputId = `add-perm-${permission.key}`;
                  return (
                    <li key={permission.key}>
                      <label
                        htmlFor={inputId}
                        className="flex cursor-pointer items-center gap-3 px-6 py-2.5 text-xs hover:bg-slate-50/70"
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={selected.includes(permission.key)}
                          onChange={() => toggle(permission.key)}
                          className="size-4 shrink-0 cursor-pointer accent-slate-700"
                        />
                        <PermissionLabel permission={permission} />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3.5">
          <span className="mr-auto text-xs text-slate-500">{selected.length}개 선택</span>
          <button type="button" onClick={onClose} className={MODAL_CANCEL_BTN}>
            취소
          </button>
          <button
            type="button"
            disabled={selected.length === 0 || isAdding}
            onClick={add}
            className={`${MODAL_CONFIRM_BTN} inline-flex items-center gap-1`}
          >
            <Plus size={13} aria-hidden="true" />
            추가
          </button>
        </div>
      </div>
    </div>
  );
}
