import type { ReactNode } from 'react';
import { Lock, Minus, Plus, RotateCcw } from 'lucide-react';

import type { PermissionDef, PermissionGroup } from '@/entities/admin-account/model/permissions';
import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import { Tooltip } from '@/shared/ui/Tooltip';
import { MODAL_CANCEL_BTN, MODAL_CONFIRM_BTN } from '@/shared/ui/systemStyles';

import { changeMarkOf, isEditablePermission, lockReasonOf } from '../model/permissionDraft';
import { usePermissionDraft } from '../model/usePermissionDraft';
import { PermissionLabel } from './PermissionLabel';

interface AccountPermissionEditorProps {
  catalog: PermissionCatalog;
  account: AdminAccount;
  /** 로그인한 계정. 본인 권한 회수를 막는 데 쓴다. */
  me: Pick<AdminAccount, 'id'>;
  /** 전체 운영진 계정. 마지막 보유자 회수를 막는 데 쓴다. */
  accounts: readonly AdminAccount[];
  /** 권한 부여(커스텀) 권한이 없으면 false. 빼기·추가 버튼이 사라지고 조회만 된다. */
  canEdit: boolean;
  /** 가진 권한의 최종 집합(맡은 그룹 권한 제외)을 저장한다. 실패하면 false. */
  onSave: (permissions: string[]) => Promise<boolean>;
  /** 저장하지 않은 변경이 있는지 알린다. 다른 계정으로 옮길 때 확인에 쓴다. */
  onDirtyChange?: (isDirty: boolean) => void;
}

interface Tag {
  text: string;
  className: string;
}

/** 기본값과 달라진 표시. 바탕·테두리 없이 글자 색만 쓴다(반기 명단 화면과 같다). */
const SMALL_TAG = 'text-xs font-semibold whitespace-nowrap';
const ADDED_TAG: Tag = { text: '추가', className: 'text-emerald-700' };
const REMOVED_TAG: Tag = { text: '기본에서 제외', className: 'text-red-600' };
/** 이 표들은 패널 안에 놓이므로 공통 표 상자(TABLE_BOX)와 달리 그림자 없이 테두리만 둔다. */
const LIST_BOX = 'overflow-hidden rounded-md border border-slate-200 bg-white';

const ACTION_BTN =
  'inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm border transition-colors disabled:cursor-not-allowed disabled:opacity-40';
/** 두 버튼 모두 평소 회색 테두리다. 빼기만 마우스를 올리면 빨강이 된다. */
const ACTION = {
  remove: {
    label: '빼기',
    Icon: Minus,
    className:
      'border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600',
  },
  add: {
    label: '추가',
    Icon: Plus,
    className: 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-900',
  },
} as const;

/**
 * 운영진 한 명의 권한 편집(SYS-PERM). 왼쪽은 지금 가진 권한, 오른쪽은 추가할 수 있는 권한이다.
 * 권한은 양쪽 다 카탈로그 묶음과 순서를 그대로 지켜, 옮겨도 같은 자리에 들어간다.
 * 기본 권한에 없는데 더한 권한은 왼쪽에 "추가", 기본 권한인데 뺀 권한은 오른쪽에 "기본에서 제외"로 표시한다.
 * 맡은 그룹에서 붙는 담당 그룹 권한은 뺄(회수할) 수 있지만, 그룹을 맡지 않은 계정에 더할 수는 없다.
 * 회수할 수 없는 권한(잠금 방지)은 뺄 수 없다. 저장은 가진 권한의 최종 집합을 한 번에 보낸다.
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
  const {
    checked,
    isSaving,
    isDirty,
    unsavedCount,
    added,
    removed,
    handleToggle,
    handleResetToBase,
    handleDiscard,
    handleSave,
  } = usePermissionDraft({ catalog, account, me, accounts, onSave, onDirtyChange });

  const isHeld = (permission: PermissionDef): boolean => checked.has(permission.key);
  // 담당 그룹 권한은 그룹을 맡아야 생기므로, 맡은 계정에서 회수한 것을 되돌릴 때만 추가할 수 있다.
  const isAddable = (permission: PermissionDef): boolean =>
    isEditablePermission(account, permission) && !checked.has(permission.key);

  const renderHeld = (permission: PermissionDef) => {
    const lockReason = lockReasonOf(permission, account, me, accounts);
    const canRemove = canEdit && lockReason === null;
    const mark = changeMarkOf(catalog, account, permission, checked);
    return (
      <PermissionItem
        key={permission.key}
        permission={permission}
        tag={mark === 'added' ? ADDED_TAG : null}
        lockReason={lockReason}
        action={canRemove ? 'remove' : null}
        onAction={() => handleToggle(permission.key)}
        isDisabled={isSaving}
      />
    );
  };

  const renderAddable = (permission: PermissionDef) => {
    const isRemoved = changeMarkOf(catalog, account, permission, checked) === 'removed';
    return (
      <PermissionItem
        key={permission.key}
        permission={permission}
        tag={isRemoved ? REMOVED_TAG : null}
        lockReason={null}
        action={canEdit ? 'add' : null}
        onAction={() => handleToggle(permission.key)}
        isDisabled={isSaving}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h4 className="text-sm font-bold text-slate-900">운영 권한</h4>
        {canEdit && (added > 0 || removed > 0) && (
          <button
            type="button"
            onClick={handleResetToBase}
            disabled={isSaving}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-sm px-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
          >
            <RotateCcw size={12} aria-hidden="true" />
            기본 권한으로 되돌리기
          </button>
        )}
      </div>

      {!canEdit && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          권한을 바꾸려면 &quot;운영진 계정 권한 부여(커스텀)&quot; 권한이 필요합니다. 지금은 조회만
          할 수 있습니다.
        </p>
      )}

      {/* 패널 폭으로 판단한다. 넓으면 좌우 두 단, 좁으면 가진 권한 아래에 추가할 수 있는 권한을 둔다. */}
      <div className="@container">
        <div className="grid items-start gap-4 @2xl:grid-cols-2">
          <PermissionColumn
            title="가진 권한"
            groups={catalog.groups}
            filter={isHeld}
            renderItem={renderHeld}
            emptyText="가진 권한이 없습니다."
          />
          <PermissionColumn
            title="추가할 수 있는 권한"
            groups={catalog.groups}
            filter={isAddable}
            renderItem={renderAddable}
            emptyText="추가할 수 있는 권한이 없습니다."
          />
        </div>
      </div>

      {/* 저장 바는 바꾼 것이 있을 때만 나타난다. */}
      {canEdit && isDirty && (
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="mr-auto text-xs text-slate-500">
            저장하지 않은 변경{' '}
            <strong className="font-semibold text-slate-900">{unsavedCount}</strong>건
          </span>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!isDirty || isSaving}
            className={`${MODAL_CANCEL_BTN} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            변경 취소
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
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

interface PermissionColumnProps {
  title: string;
  groups: readonly PermissionGroup[];
  filter: (permission: PermissionDef) => boolean;
  renderItem: (permission: PermissionDef) => ReactNode;
  emptyText: string;
}

/** 권한 목록 한 단. 카탈로그 묶음별로 나누고, 해당하는 권한이 없는 묶음은 뺀다. */
function PermissionColumn({ title, groups, filter, renderItem, emptyText }: PermissionColumnProps) {
  const visibleGroups = groups
    .map((group) => ({ title: group.title, permissions: group.permissions.filter(filter) }))
    .filter((group) => group.permissions.length > 0);
  const count = visibleGroups.reduce((sum, group) => sum + group.permissions.length, 0);

  return (
    <section className={LIST_BOX} aria-label={title}>
      {/* 출결 표의 머리 칸처럼 회색 바탕에 굵은 글자다. */}
      <div className="flex h-11 items-center justify-between gap-2 border-b border-slate-200 bg-slate-100/90 px-4">
        <h3 className="text-xs font-bold text-slate-900">{title}</h3>
        <span className="text-xs font-semibold tabular-nums text-slate-500">{count}개</span>
      </div>
      {visibleGroups.length === 0 ? (
        <p className="px-4 py-8 text-xs text-slate-500">{emptyText}</p>
      ) : (
        visibleGroups.map((group) => (
          // 묶음 이름은 왼쪽 칸 가운데에 두고, 그 묶음의 권한 줄들이 오른쪽에 이어진다.
          // 권한 매트릭스의 "영역" 칸(세로 병합 칸)과 같은 모양이다.
          <div
            key={group.title}
            className="grid grid-cols-[96px_minmax(0,1fr)] border-t border-slate-200 first:border-t-0"
          >
            <h4 className="flex items-center justify-center border-r border-slate-200 bg-slate-50/80 px-2 text-center text-xs font-bold break-keep text-slate-900">
              {group.title}
            </h4>
            <ul className="min-w-0">{group.permissions.map(renderItem)}</ul>
          </div>
        ))
      )}
    </section>
  );
}

interface PermissionItemProps {
  permission: PermissionDef;
  tag: Tag | null;
  /** 뺄 수 없는 사유. 있으면 자물쇠와 말풍선으로 보여 준다. */
  lockReason: string | null;
  /** −(빼기)·+(추가) 버튼. 조회만 가능하거나 잠긴 권한이면 null이다. */
  action: keyof typeof ACTION | null;
  onAction: () => void;
  isDisabled: boolean;
}

/** 권한 한 줄: 이름 · 표시 태그 · 잠금 사유 · −/+ 버튼. */
function PermissionItem({
  permission,
  tag,
  lockReason,
  action,
  onAction,
  isDisabled,
}: PermissionItemProps) {
  const button = action ? ACTION[action] : null;

  return (
    <li className="flex h-11 items-center gap-3 border-t border-slate-200 px-4 text-xs transition-colors first:border-t-0 hover:bg-slate-50/70">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <PermissionLabel permission={permission} />
        {tag && <span className={`${SMALL_TAG} ${tag.className}`}>{tag.text}</span>}
        {lockReason && (
          <Tooltip label={lockReason}>
            <span tabIndex={0} className="inline-flex text-slate-500" aria-label={lockReason}>
              <Lock size={12} aria-hidden="true" />
            </span>
          </Tooltip>
        )}
      </span>
      {button && (
        <button
          type="button"
          onClick={onAction}
          disabled={isDisabled}
          className={`${ACTION_BTN} ${button.className}`}
          aria-label={`${permission.label} ${button.label}`}
          title={button.label}
        >
          <button.Icon size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
