import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { KeyRound, Trash2 } from 'lucide-react';

import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import {
  TEAMS_WITHOUT_LEAD,
  displayTeamOf,
  byLeadThenTermThenTrack,
  sortTeamNames,
} from '@/pages/system-accounts/model/teamOrder';
import { OperatorRosterTable } from '@/pages/system-accounts/ui/OperatorRosterTable';
import { SplitListItem, SplitView } from '@/pages/system-accounts/ui/SplitView';
import {
  ICON_BTN,
  ID_CHIP,
  O_MARK,
  LIST_SECTION_TITLE,
  ROW_CLASS,
  TABLE_BOX,
  TD_CLASS,
  TH_CLASS,
} from '@/pages/system-accounts/ui/systemStyles';
import { Tooltip } from '@/shared/ui/Tooltip';

/**
 * 운영진 행의 관리 버튼(비밀번호 재설정·삭제)을 쓸 수 없는 사유. null이면 쓸 수 있다.
 * 버튼은 줄마다 같은 자리에 늘 보이고, 쓸 수 없으면 흐리게 두어 마우스를 올리면 사유를 보인다.
 */
export interface AccountActions {
  passwordResetBlockReason: (account: AdminAccount) => string | null;
  deleteBlockReason: (account: AdminAccount) => string | null;
}

/** 쓸 수 없을 때 흐리게 두는 아이콘 버튼. */
const ACTION_BTN = `${ICON_BTN} disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent`;

interface IconActionProps {
  label: string;
  /** 쓸 수 없는 사유. 있으면 버튼을 흐리게 두고 말풍선에 사유를 보인다. */
  blockReason: string | null;
  onClick: () => void;
  children: ReactNode;
  isDanger?: boolean;
  align?: 'center' | 'end';
}

/** 관리 칸의 아이콘 버튼 하나. 줄마다 같은 자리에 두어 버튼 위치가 어긋나지 않게 한다. */
function IconAction({ label, blockReason, onClick, children, isDanger, align }: IconActionProps) {
  const isBlocked = blockReason !== null;
  return (
    <Tooltip label={blockReason ?? label} isBlocked={isBlocked} align={align}>
      <button
        type="button"
        onClick={onClick}
        disabled={isBlocked}
        aria-label={isBlocked ? `${label}: ${blockReason}` : label}
        className={`${ACTION_BTN} ${isDanger ? 'enabled:hover:bg-red-50 enabled:hover:text-red-600' : ''}`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

interface AccountsTabProps {
  catalog: PermissionCatalog;
  accounts: readonly AdminAccount[];
  actions: AccountActions;
  onResetPassword: (account: AdminAccount) => void;
  onDelete: (account: AdminAccount) => void;
}

/**
 * 팀 표의 열. 팀장 열은 대표진(차기대표진 포함) 표에서 빠진다(팀장을 두지 않는다).
 * 너비는 비율(share)로 나눈다. 보이는 열의 share 합을 100%로 환산해, 한 열(아이디)만 남는 폭을 다 차지하지 않게 한다.
 */
const COLUMNS: readonly { key: string; label: string; share: number; isKey?: boolean }[] = [
  { key: 'name', label: '이름', share: 18, isKey: true },
  { key: 'lead', label: '팀장', share: 10 },
  { key: 'term', label: '기수', share: 12 },
  { key: 'track', label: '부문', share: 16 },
  { key: 'username', label: '아이디', share: 26 },
  { key: 'actions', label: '관리', share: 18 },
];

/**
 * 운영진 계정 관리. 출결 화면과 같은 분할 화면이다.
 * 왼쪽 맨 위는 운영진 목록(모든 팀을 한 표로), 그 아래는 운영진 팀 목록(대표진이 맨 위·차기대표진은 대표진에 포함, 나머지는 가나다순,
 * 사람이 없는 팀은 숨김)이다. 오른쪽은 운영진 목록 표 또는 고른 팀에 속한 사람의 표다. 처음에는 운영진 목록이 열려 있다.
 * 팀 안에서는 팀장이 맨 위, 그다음 기수 순, 같은 기수 안에서는 부문 순이다.
 */
export function AccountsTab({
  catalog,
  accounts,
  actions,
  onResetPassword,
  onDelete,
}: AccountsTabProps) {
  // 팀·사람 순서는 model/teamOrder.ts를 따른다. 사람이 없는 팀(예: 차기대표진이 정해지기 전)은 보이지 않는다.
  // 카탈로그에 없는 새 팀도 가나다 순서에 맞게 끼어든다.
  const teamGroups = useMemo(() => {
    const teamNames = sortTeamNames([
      ...catalog.teamNames,
      ...accounts.map((account) => account.teamName),
    ]);
    return teamNames
      .map((teamName) => ({
        teamName,
        members: accounts
          .filter((account) => displayTeamOf(account.teamName) === teamName)
          .sort(byLeadThenTermThenTrack),
      }))
      .filter((group) => group.members.length > 0);
  }, [accounts, catalog.teamNames]);

  // 오른쪽 패널에 여는 것. 화면에 들어오면 운영진 목록(모든 팀을 한 표로)이 먼저 열린다.
  // 운영진 목록에서 이름을 누르면 그 사람의 팀 표로 옮기고, 그 사람 줄(focusId)을 표시한다.
  const [peek, setPeek] = useState<
    { kind: 'roster' } | { kind: 'team'; teamName: string; focusId?: number } | null
  >({ kind: 'roster' });
  const isRosterOpen = peek?.kind === 'roster';
  // 팀의 마지막 사람이 삭제되면 그 팀이 목록에서 사라지고 패널도 닫힌다.
  const selected =
    peek?.kind === 'team'
      ? (teamGroups.find((group) => group.teamName === peek.teamName) ?? null)
      : null;

  return (
    <SplitView
      listLabel="운영진 팀 목록"
      list={
        // 출결 ADV 목록의 "분석 트랙" 묶음처럼, 작은 제목으로 전체 운영진과 팀별을 나눈다.
        <div className="space-y-4">
          <section className="space-y-2" aria-labelledby="accounts-all-heading">
            <h2 id="accounts-all-heading" className={LIST_SECTION_TITLE}>
              전체 운영진
            </h2>
            <SplitListItem
              label="운영진 목록"
              isSelected={isRosterOpen}
              onSelect={() => setPeek({ kind: 'roster' })}
            />
          </section>

          <section className="space-y-2" aria-labelledby="accounts-team-heading">
            <h2 id="accounts-team-heading" className={LIST_SECTION_TITLE}>
              팀별
            </h2>
            {teamGroups.length === 0 ? (
              <p className="px-1 py-1 text-xs text-slate-500">운영진 계정이 없습니다.</p>
            ) : (
              <ul className="space-y-2.5">
                {teamGroups.map(({ teamName }) => (
                  <li key={teamName}>
                    <SplitListItem
                      label={teamName}
                      isSelected={selected?.teamName === teamName}
                      onSelect={() => setPeek({ kind: 'team', teamName })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      }
      isOpen={isRosterOpen || selected !== null}
      panelTitle={isRosterOpen ? '운영진 목록' : (selected?.teamName ?? '')}
      onClose={() => setPeek(null)}
    >
      {isRosterOpen && (
        <OperatorRosterTable
          teamGroups={teamGroups}
          teamsWithoutLead={TEAMS_WITHOUT_LEAD}
          onSelectMember={(account) =>
            setPeek({
              kind: 'team',
              teamName: displayTeamOf(account.teamName),
              focusId: account.id,
            })
          }
        />
      )}
      {selected && (
        <MembersTable
          key={selected.teamName}
          hasLeadColumn={!TEAMS_WITHOUT_LEAD.includes(selected.teamName)}
          focusId={peek?.kind === 'team' ? peek.focusId : undefined}
          members={selected.members}
          actions={actions}
          onResetPassword={onResetPassword}
          onDelete={onDelete}
        />
      )}
    </SplitView>
  );
}

interface MembersTableProps extends Omit<AccountsTabProps, 'catalog' | 'accounts'> {
  /** 팀장 열을 보일지. 대표진 표에서는 false다. */
  hasLeadColumn: boolean;
  /** 운영진 목록에서 이름을 눌러 들어왔을 때 표시할 사람. 그 줄로 스크롤하고 바탕을 칠한다. */
  focusId?: number;
  members: readonly AdminAccount[];
}

/** 고른 팀에 속한 운영진 표. 출결 표처럼 회색 머리 칸과 칸 구분선을 쓴다. */
function MembersTable({
  hasLeadColumn,
  focusId,
  members,
  actions,
  onResetPassword,
  onDelete,
}: MembersTableProps) {
  const columns = COLUMNS.filter((column) => hasLeadColumn || column.key !== 'lead');
  const totalShare = columns.reduce((sum, column) => sum + column.share, 0);
  const focusedRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    focusedRowRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusId]);

  return (
    <div className={TABLE_BOX}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] table-fixed border-collapse text-xs">
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={{ width: `${(column.share / totalShare) * 100}%` }} />
            ))}
          </colgroup>
          <thead className="select-none">
            <tr className="h-11 divide-x divide-slate-200 border-b border-slate-200">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${TH_CLASS} text-xs ${column.isKey ? 'text-slate-900' : ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((account) => (
              <tr
                key={account.id}
                ref={account.id === focusId ? focusedRowRef : undefined}
                aria-current={account.id === focusId ? 'true' : undefined}
                className={`${ROW_CLASS} border-t border-slate-200 first:border-t-0 ${
                  account.id === focusId ? 'bg-blue-50 hover:bg-blue-50' : ''
                }`}
              >
                <td className={`${TD_CLASS} font-bold text-slate-900`}>{account.name}</td>
                {hasLeadColumn && (
                  <td className={TD_CLASS} aria-label={account.isTeamLead ? '팀장' : '팀원'}>
                    {account.isTeamLead && (
                      <span aria-hidden="true" className={O_MARK}>
                        O
                      </span>
                    )}
                  </td>
                )}
                <td className={`${TD_CLASS} text-slate-600`}>{account.term}기</td>
                <td className={`${TD_CLASS} text-slate-600`}>{account.track || '-'}</td>
                <td className={TD_CLASS}>
                  {/* 계정을 아직 발급하지 않았으면 비워 둔다. 발급은 위쪽 "+ 계정" 버튼으로 한다. */}
                  {account.username && <span className={ID_CHIP}>{account.username}</span>}
                </td>
                <td className={TD_CLASS}>
                  <div className="flex items-center justify-center gap-0.5">
                    <IconAction
                      label="비밀번호 재설정"
                      blockReason={actions.passwordResetBlockReason(account)}
                      onClick={() => onResetPassword(account)}
                    >
                      <KeyRound size={14} aria-hidden="true" />
                    </IconAction>
                    <IconAction
                      label="삭제"
                      blockReason={actions.deleteBlockReason(account)}
                      onClick={() => onDelete(account)}
                      isDanger
                      align="end"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </IconAction>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
