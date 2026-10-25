import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import type {
  AccountHolder,
  AdminAccount,
  PermissionCatalog,
} from '@/entities/admin-account/model/types';
import { AccountPermissionEditor } from '@/pages/system-accounts/ui/AccountPermissionEditor';
import { HolderProfileTable } from '@/pages/system-accounts/ui/HolderProfileTable';
import { MODAL_CLOSE_BTN, TABLE_BOX } from '@/pages/system-accounts/ui/systemStyles';
import { registerLeaveGuard } from '@/shared/lib/leaveGuard';
import { useDialogKeyboard } from '@/shared/lib/useDialogKeyboard';

interface AccountPermissionDialogProps {
  catalog: PermissionCatalog;
  me: AdminAccount;
  /** 권한을 보는 사람(운영진 또는 HOST 계정만 있는 사람). */
  holder: AccountHolder;
  /** 그 사람의 운영진 계정. 없으면(HOST 계정만 있으면) 운영 권한 대신 안내만 보이는 보기 전용 창이다. */
  account: AdminAccount | null;
  /** 운영진 계정 전체. 마지막 보유자 회수를 막는 데 쓴다. */
  accounts: readonly AdminAccount[];
  canEdit: boolean;
  onSave: (account: AdminAccount, permissions: string[]) => Promise<boolean>;
  onClose: () => void;
}

/** 저장된 예외가 바뀌면 편집기를 새로 만들도록 key에 넣는다. */
const overridesSignature = (account: AdminAccount): string =>
  Object.entries(account.overrides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, isGranted]) => `${key}:${isGranted ? 1 : 0}`)
    .join(',');

/**
 * 한 사람의 권한 창. 권한 관리 화면의 운영진 표에서 이름이나 권한 버튼을, 그룹 리더 계정 표에서 이름을 누르면 열린다.
 * 위에 기본 정보(기수·부문·소속 운영진·ADV 권한·스터디 권한), 아래에 운영 권한 편집기를 둔다.
 * 운영 권한은 기본 권한에서 더하거나 빼서 저장한다. 저장하지 않은 변경이 있으면 닫기·다른 메뉴 이동 전에 묻는다.
 */
export function AccountPermissionDialog({
  catalog,
  me,
  holder,
  account,
  accounts,
  canEdit,
  onSave,
  onClose,
}: AccountPermissionDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const [isDirty, setIsDirty] = useState(false);
  const handleDirtyChange = useCallback((value: boolean) => setIsDirty(value), []);

  /** 저장하지 않은 권한 변경이 있으면 버려도 되는지 묻는다. */
  const canLeave = () =>
    !isDirty || window.confirm('저장하지 않은 변경이 있습니다. 저장하지 않고 닫을까요?');
  const requestClose = () => {
    if (canLeave()) onClose();
  };

  // 사이드바로 다른 메뉴로 옮길 때도 같은 확인을 거친다. 등록한 함수가 늘 최신 isDirty를 보도록 ref에 둔다.
  const canLeaveRef = useRef(canLeave);
  canLeaveRef.current = canLeave;
  useEffect(() => registerLeaveGuard(() => canLeaveRef.current()), []);

  // Escape는 창 안 빈 곳을 눌러 포커스가 빠져도 받고, Tab 포커스는 창 안에서만 돈다.
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogKeyboard(panelRef, requestClose);

  // 새로고침·탭 닫기: 브라우저가 직접 '사이트에서 나가시겠습니까?'를 묻는다(문구는 바꿀 수 없다).
  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-permission-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div
        ref={panelRef}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h3 id="account-permission-title" className="truncate text-base font-bold text-slate-900">
            {holder.name} 권한
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={requestClose}
            aria-label="창 닫기"
            className={`shrink-0 ${MODAL_CLOSE_BTN}`}
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-4">
          <HolderProfileTable holder={holder} />
          {account ? (
            <AccountPermissionEditor
              key={`${account.id}|${overridesSignature(account)}`}
              catalog={catalog}
              account={account}
              me={me}
              accounts={accounts}
              canEdit={canEdit}
              onSave={(permissions) => onSave(account, permissions)}
              onDirtyChange={handleDirtyChange}
            />
          ) : (
            <section className={`${TABLE_BOX} px-5 py-4`} aria-label="운영 권한">
              <h4 className="text-sm font-bold text-slate-900">운영 권한</h4>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                운영진 계정이 없어 운영 권한이 없습니다. 그룹 리더 계정(HOST)은 본인 계정 수정과
                맡은 그룹의 출결 입력만 할 수 있습니다. 운영 권한을 주려면 동아리원 명단의 정보
                수정에서 운영진 팀을 정해 주세요.
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
