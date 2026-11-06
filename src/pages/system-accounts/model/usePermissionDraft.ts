import { useEffect, useState } from 'react';

import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';

import {
  changeCountsOf,
  resetToBaseChecked,
  saveSummaryOf,
  savedCheckedOf,
  unsavedCountOf,
} from './permissionDraft';

interface UsePermissionDraftOptions {
  catalog: PermissionCatalog;
  account: AdminAccount;
  /** 로그인한 계정. 본인 권한 회수를 막는 데 쓴다. */
  me: Pick<AdminAccount, 'id'>;
  /** 전체 운영진 계정. 마지막 보유자 회수를 막는 데 쓴다. */
  accounts: readonly AdminAccount[];
  /** 가진 권한의 최종 집합을 저장한다. 실패하면 false. */
  onSave: (permissions: string[]) => Promise<boolean>;
  onDirtyChange?: (isDirty: boolean) => void;
}

/** usePermissionDraft가 돌려주는 값. */
export interface PermissionDraftState {
  /** 지금 체크한 권한(저장 전 초안). */
  checked: ReadonlySet<string>;
  isSaving: boolean;
  isDirty: boolean;
  unsavedCount: number;
  /** 기본 권한과 비교해 더한·뺀 권한 수. */
  added: number;
  removed: number;
  handleToggle: (key: string) => void;
  handleResetToBase: () => void;
  handleDiscard: () => void;
  handleSave: () => Promise<void>;
}

/** 운영진 한 명의 권한 편집 초안. 저장은 확인을 받은 뒤 최종 집합을 한 번에 보낸다. */
export function usePermissionDraft({
  catalog,
  account,
  me,
  accounts,
  onSave,
  onDirtyChange,
}: UsePermissionDraftOptions): PermissionDraftState {
  // 저장 기준. 처음에는 계정의 유효 권한이고, 저장에 성공하면 그때의 상태로 옮긴다.
  // 저장 뒤 목록을 다시 읽지 못해 계정 값이 예전 그대로여도, 저장한 내용이 "저장하지 않은 변경"으로 남지 않는다.
  const [saved, setSaved] = useState<readonly string[]>(() => savedCheckedOf(catalog, account));
  const [checked, setChecked] = useState<ReadonlySet<string>>(
    () => new Set(savedCheckedOf(catalog, account)),
  );
  const [isSaving, setIsSaving] = useState(false);

  const unsavedCount = unsavedCountOf(saved, checked);
  const isDirty = unsavedCount > 0;
  const { added, removed } = changeCountsOf(catalog, account, checked);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleToggle = (key: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // 기본 권한으로 되돌려도 잠긴 권한(본인·마지막 보유자의 "타 계정 정보 수정")은 빠지지 않는다. 개별 빼기 버튼과 같은 규칙이다.
  const handleResetToBase = () =>
    setChecked((current) => resetToBaseChecked(catalog, account, me, accounts, current));
  const handleDiscard = () => setChecked(new Set(saved));

  // 저장에 성공하면 부모가 계정을 다시 읽고, 바뀐 예외로 key가 달라져 이 편집기가 새 상태로 다시 만들어진다.
  // 실패하면 고른 상태를 그대로 두어 고쳐서 다시 저장할 수 있다.
  const handleSave = async () => {
    if (!window.confirm(saveSummaryOf(catalog, saved, checked))) return;
    setIsSaving(true);
    try {
      const isSaved = await onSave([...checked]);
      if (isSaved) setSaved([...checked]);
    } finally {
      setIsSaving(false);
    }
  };

  return {
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
  };
}
