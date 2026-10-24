import { useMemo, useState } from 'react';

import { NEXT_PRESIDENT_TEAM, displayTeamOf } from '@/entities/admin-account/model/teams';
import type {
  AccountHolder,
  AdminAccount,
  PermissionCatalog,
} from '@/entities/admin-account/model/types';
import { FilterDropdown } from '@/pages/attendance-events/ui/FilterDropdown';
import { byLeadThenTermThenTrack, sortTeamNames } from '@/pages/system-accounts/model/teamOrder';
import { GroupLeaderTable } from '@/pages/system-accounts/ui/GroupLeaderTable';
import {
  type AccountActions,
  OperatorRosterTable,
} from '@/pages/system-accounts/ui/OperatorRosterTable';
import { PermissionMatrix } from '@/pages/system-accounts/ui/PermissionMatrix';
import { SplitListItem, SplitView } from '@/pages/system-accounts/ui/SplitView';
import { LIST_SECTION_TITLE } from '@/pages/system-accounts/ui/systemStyles';

interface AccountsTabProps {
  catalog: PermissionCatalog;
  accounts: readonly AdminAccount[];
  actions: AccountActions;
  onResetPassword: (account: AdminAccount) => void;
  onPermissions: (account: AdminAccount) => void;
  onDelete: (account: AdminAccount) => void;
  /** 그룹(ADV 팀·스터디)을 맡았거나 HOST 계정이 있는 사람, 이름순. 운영진도 들어간다. */
  groupLeaders: readonly AccountHolder[];
  /** 그룹 리더 계정 표에서 이름을 누르면 그 사람의 권한 창을 연다. */
  onOpenHolder: (holder: AccountHolder) => void;
}

/**
 * 권한 관리 화면의 본문. 분할 화면이다.
 * 왼쪽 "권한" 묶음은 권한 매트릭스(자리별 기본 권한), "계정" 묶음은 운영진 계정(모든 팀을 한 표로)과
 * 그룹 리더 계정(그룹을 맡은 사람 표, 운영진 포함)이다. 오른쪽은 고른 항목의 표다. 처음에는 운영진 계정이 열려 있다.
 * 운영진 계정 표에서 이름이나 권한 버튼을, 그룹 리더 계정 표에서 이름을 누르면 그 사람의 권한 창이 열린다.
 * 팀 순서는 대표진(차기대표진 포함)이 맨 위, 나머지는 가나다순이고, 사람이 없는 팀은 숨긴다.
 * 팀 안에서는 팀장이 맨 위, 그다음 기수 순, 같은 기수 안에서는 부문 순이다(대표진 묶음은 대표진 → 차기대표진).
 */
export function AccountsTab({
  catalog,
  accounts,
  actions,
  onResetPassword,
  onPermissions,
  onDelete,
  groupLeaders,
  onOpenHolder,
}: AccountsTabProps) {
  // 팀 목록(catalog.teamNames)은 서버가 코드 팀과 DB 팀을 합쳐 화면 순서로 준다. 차기대표진은 대표진에 묶는다.
  const teamGroups = useMemo(
    () =>
      sortTeamNames(catalog.teamNames)
        .map((teamName) => ({
          teamName,
          members: accounts
            .filter((account) => displayTeamOf(account.teamName) === teamName)
            .sort(
              (a, b) =>
                Number(a.teamName === NEXT_PRESIDENT_TEAM) -
                  Number(b.teamName === NEXT_PRESIDENT_TEAM) || byLeadThenTermThenTrack(a, b),
            ),
        }))
        .filter((group) => group.members.length > 0),
    [accounts, catalog.teamNames],
  );

  /** 운영진 계정 표의 팀 필터. 'ALL'이면 모든 팀, 아니면 그 팀(대표진은 차기대표진 포함)만 보인다. */
  const [teamFilter, setTeamFilter] = useState('ALL');
  const teamOptions = useMemo(
    () => [
      { value: 'ALL', label: '전체' },
      ...teamGroups.map(({ teamName }) => ({ value: teamName, label: teamName })),
    ],
    [teamGroups],
  );
  // 고른 팀이 목록에서 사라지면(마지막 사람 삭제 등) 전체로 돌아간다.
  const shownTeamGroups =
    teamFilter === 'ALL' ? teamGroups : teamGroups.filter((group) => group.teamName === teamFilter);
  if (teamFilter !== 'ALL' && shownTeamGroups.length === 0 && teamGroups.length > 0) {
    setTeamFilter('ALL');
  }

  // 오른쪽 패널에 여는 것. 화면에 들어오면 운영진 계정(모든 팀을 한 표로)이 먼저 열린다.
  const [peek, setPeek] = useState<'roster' | 'hosts' | 'matrix' | null>('roster');

  return (
    <SplitView
      listLabel="권한 관리 목록"
      list={
        // 출결 ADV 목록의 "분석 트랙" 묶음처럼, 작은 제목으로 권한·계정을 나눈다.
        <div className="space-y-4">
          <section className="space-y-2" aria-labelledby="accounts-permission-heading">
            <h2 id="accounts-permission-heading" className={LIST_SECTION_TITLE}>
              권한
            </h2>
            <SplitListItem
              label="권한 매트릭스"
              isSelected={peek === 'matrix'}
              onSelect={() => setPeek('matrix')}
            />
          </section>

          <section className="space-y-2" aria-labelledby="accounts-all-heading">
            <h2 id="accounts-all-heading" className={LIST_SECTION_TITLE}>
              계정
            </h2>
            <ul className="space-y-2.5">
              <li>
                <SplitListItem
                  label="운영진 계정"
                  isSelected={peek === 'roster'}
                  onSelect={() => setPeek('roster')}
                />
              </li>
              <li>
                <SplitListItem
                  label="그룹 리더 계정"
                  isSelected={peek === 'hosts'}
                  onSelect={() => setPeek('hosts')}
                />
              </li>
            </ul>
          </section>
        </div>
      }
      isOpen={peek !== null}
      panelTitle={
        peek === 'roster'
          ? '운영진 계정'
          : peek === 'hosts'
            ? '그룹 리더 계정'
            : peek === 'matrix'
              ? '권한 매트릭스'
              : ''
      }
      onClose={() => setPeek(null)}
    >
      {peek === 'roster' && (
        // 팀 필터 줄은 늘 자리를 지킨다(목록이 비어도 그대로 둔다).
        <div className="flex justify-end">
          <FilterDropdown
            ariaLabel="팀 필터"
            title="팀"
            value={teamFilter}
            options={teamOptions}
            onChange={setTeamFilter}
          />
        </div>
      )}
      {peek === 'roster' && (
        <OperatorRosterTable
          teamGroups={shownTeamGroups}
          actions={actions}
          onPermissions={onPermissions}
          onResetPassword={onResetPassword}
          onDelete={onDelete}
        />
      )}
      {peek === 'hosts' && <GroupLeaderTable holders={groupLeaders} onOpen={onOpenHolder} />}
      {peek === 'matrix' && <PermissionMatrix catalog={catalog} />}
    </SplitView>
  );
}
