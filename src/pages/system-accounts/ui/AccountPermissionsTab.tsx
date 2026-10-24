import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  AccountHolder,
  AdminAccount,
  PermissionCatalog,
} from '@/entities/admin-account/model/types';
import { displayTeamOf } from '@/entities/admin-account/model/teams';
import { byLeadThenTermThenTrack, sortTeamNames } from '@/pages/system-accounts/model/teamOrder';
import { AccountPermissionEditor } from '@/pages/system-accounts/ui/AccountPermissionEditor';
import { HolderProfileTable } from '@/pages/system-accounts/ui/HolderProfileTable';
import { PermissionMatrix } from '@/pages/system-accounts/ui/PermissionMatrix';
import { SplitListItem, SplitView } from '@/pages/system-accounts/ui/SplitView';
import { registerLeaveGuard } from '@/shared/lib/leaveGuard';
import { LIST_SECTION_TITLE, TABLE_BOX } from '@/pages/system-accounts/ui/systemStyles';

interface AccountPermissionsTabProps {
  catalog: PermissionCatalog;
  me: AdminAccount;
  /** 계정을 가진 사람 전체(운영진 + HOST). */
  holders: readonly AccountHolder[];
  /** 운영진 계정 전체. 마지막 보유자 회수를 막는 데 쓴다. */
  accounts: readonly AdminAccount[];
  canEdit: boolean;
  /** 고른 사람(AccountHolder.key). 계정 화면에서 권한 버튼으로 들어오면 그 사람이 골라져 있다. */
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

/** 운영진 계정 없이 HOST 계정만 있는 사람을 모으는 묶음 이름. 팀 묶음 뒤에 둔다. */
const HOST_ONLY_SECTION = '그 외';

/**
 * 계정 통합 관리 탭. 왼쪽 목록은 묶음 제목으로 나눈다: 맨 위 "전체"의 권한 매트릭스(자리별 기본 권한),
 * 그 아래 운영진 팀별 사람(팀·사람 순서는 운영진 계정 관리와 같다), 마지막 "그 외" 묶음에 HOST 계정만 있는 사람(이름순).
 * 처음에는 권한 매트릭스가 열려 있다. 사람을 고르면 고른 사람의 기본 정보(기수·부문·소속 팀·역할),
 * 맡은 그룹(HOST), 운영 권한을 함께 보여 준다. 운영 권한은 운영진 계정이 있을 때 기본 권한에서 더하거나 빼서 저장한다.
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
  // 오른쪽 상세 패널에 여는 것. 탭에 들어오면 권한 매트릭스가 먼저 열리고,
  // 계정 화면의 권한 버튼으로 들어오면 그 사람이 열린 채로 시작한다.
  const [peekTarget, setPeekTarget] = useState<'matrix' | 'holder' | null>(
    selectedKey !== null ? 'holder' : 'matrix',
  );
  const [isDirty, setIsDirty] = useState(false);
  const handleDirtyChange = useCallback((value: boolean) => setIsDirty(value), []);

  const selected = holders.find((holder) => holder.key === selectedKey) ?? null;

  // 운영진은 팀별로 묶고, HOST 계정만 있는 사람은 마지막 묶음에 이름순으로 둔다.
  const holderSections = useMemo(() => {
    const teamSections = sortTeamNames(
      holders.flatMap((holder) => (holder.adminAccount ? [holder.adminAccount.teamName] : [])),
    ).map((teamName) => ({
      title: teamName,
      holders: holders
        .filter(
          (holder) =>
            holder.adminAccount && displayTeamOf(holder.adminAccount.teamName) === teamName,
        )
        .sort((a, b) =>
          a.adminAccount && b.adminAccount
            ? byLeadThenTermThenTrack(a.adminAccount, b.adminAccount)
            : 0,
        ),
    }));
    const hostOnly = holders
      .filter((holder) => !holder.adminAccount)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return hostOnly.length > 0
      ? [...teamSections, { title: HOST_ONLY_SECTION, holders: hostOnly }]
      : teamSections;
  }, [holders]);

  /** 저장하지 않은 권한 변경이 있으면 버려도 되는지 묻는다. */
  const canLeave = () =>
    !isDirty ||
    window.confirm('저장하지 않은 변경이 있습니다. 저장하지 않고 다른 계정으로 옮길까요?');

  // 사이드바로 다른 메뉴로 옮길 때도 같은 확인을 거친다. 등록한 함수가 늘 최신 isDirty를 보도록 ref에 둔다.
  const canLeaveRef = useRef(canLeave);
  canLeaveRef.current = canLeave;
  useEffect(() => registerLeaveGuard(() => canLeaveRef.current()), []);

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
  };

  const peek = peekTarget === 'holder' ? selected : null;
  const isMatrixOpen = peekTarget === 'matrix';

  return (
    <SplitView
      listLabel="계정을 가진 사람 목록"
      list={
        // 출결 ADV 목록의 "분석 트랙" 묶음처럼, 작은 제목으로 전체와 팀을 나눈다.
        <div className="space-y-4">
          <section className="space-y-2" aria-label="전체">
            <h2 className={LIST_SECTION_TITLE}>전체</h2>
            <SplitListItem label="권한 매트릭스" isSelected={isMatrixOpen} onSelect={openMatrix} />
          </section>

          {holderSections.map((section) => (
            <section key={section.title} className="space-y-2" aria-label={section.title}>
              <h2 className={LIST_SECTION_TITLE}>{section.title}</h2>
              <ul className="space-y-2.5">
                {section.holders.map((holder) => (
                  <li key={holder.key}>
                    <SplitListItem
                      label={holder.name}
                      isSelected={peek?.key === holder.key}
                      onSelect={() => select(holder.key)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      }
      isOpen={isMatrixOpen || peek !== null}
      panelTitle={isMatrixOpen ? '권한 매트릭스' : (peek?.name ?? '')}
      onClose={closePeek}
    >
      {peek ? (
        <>
          {/* 기수·부문·소속 운영진·ADV 권한·스터디 권한을 출결 표처럼 회색 이름 칸이 있는 표로 보인다. */}
          <HolderProfileTable holder={peek} />

          {peek.adminAccount ? (
            <AccountPermissionEditor
              key={`${peek.adminAccount.id}|${overridesSignature(peek.adminAccount)}`}
              catalog={catalog}
              account={peek.adminAccount}
              me={me}
              accounts={accounts}
              canEdit={canEdit}
              onSave={(permissions) =>
                peek.adminAccount ? onSave(peek.adminAccount, permissions) : Promise.resolve(false)
              }
              onDirtyChange={handleDirtyChange}
            />
          ) : (
            <section className={`${TABLE_BOX} px-5 py-4`} aria-label="운영 권한">
              <h2 className="text-sm font-bold text-slate-900">운영 권한</h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                운영진 계정이 없어 운영 권한이 없습니다. HOST 계정은 본인 계정 수정과 맡은 그룹의
                출결 입력만 할 수 있습니다. 운영 권한을 주려면 운영진 계정 관리에서 운영진 계정을
                발급해 주세요.
              </p>
            </section>
          )}
        </>
      ) : (
        <PermissionMatrix catalog={catalog} />
      )}
    </SplitView>
  );
}
