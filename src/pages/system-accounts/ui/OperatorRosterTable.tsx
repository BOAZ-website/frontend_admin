import { Fragment, type ReactNode } from 'react';
import { KeyRound, ShieldCheck, Trash2 } from 'lucide-react';

import { NEXT_PRESIDENT_TEAM, TEAMS_WITHOUT_LEAD } from '@/entities/admin-account/model/teams';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import { ICON_BTN, ID_CHIP } from '@/pages/system-accounts/ui/systemStyles';
import { Tooltip } from '@/shared/ui/Tooltip';

/**
 * 운영진 행의 관리 버튼(비밀번호 재설정·삭제)을 쓸 수 없는 사유. null이면 쓸 수 있다.
 * 버튼은 줄마다 같은 자리에 늘 보이고, 쓸 수 없으면 흐리게 두어 마우스를 올리면 사유를 보인다.
 * 권한 버튼은 늘 쓸 수 있다(권한을 바꿀 수 없는 사람에게는 권한 창이 보기 전용으로 열린다).
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

interface OperatorRosterTableProps {
  /** 팀 순서대로 묶은 운영진. 팀 안의 순서도 부르는 쪽이 정한다(대표진 묶음은 대표진 → 차기대표진). */
  teamGroups: readonly { teamName: string; members: readonly AdminAccount[] }[];
  actions: AccountActions;
  /** 이름이나 권한 버튼을 누르면 그 사람의 권한 창을 연다. */
  onPermissions: (account: AdminAccount) => void;
  onResetPassword: (account: AdminAccount) => void;
  onDelete: (account: AdminAccount) => void;
}

/** 열 너비는 비율로 나눈다. 합계 100%. 관리 열은 오른쪽 끝이다. */
const COLUMNS: readonly { label: string; width: string; isKey?: boolean }[] = [
  { label: '팀', width: 'w-[14%]', isKey: true },
  { label: '구분', width: 'w-[12%]' },
  { label: '이름', width: 'w-[15%]', isKey: true },
  { label: '기수', width: 'w-[8%]' },
  { label: '부문', width: 'w-[12%]' },
  { label: '아이디', width: 'w-[23%]' },
  { label: '관리', width: 'w-[16%]' },
];

/**
 * 구분 칸의 글자. 팀장을 두지 않는 팀(대표진 묶음)은 대표진·차기대표진, 다른 팀은 팀장·팀원이다.
 * 대표진·팀장은 진하게, 차기대표진·팀원은 옅게 쓴다(배지 없이 글자만).
 */
function seatOf(account: AdminAccount, hasLead: boolean): { label: string; isPrimary: boolean } {
  if (!hasLead) {
    const isNextPresident = account.teamName === NEXT_PRESIDENT_TEAM;
    return { label: account.teamName, isPrimary: !isNextPresident };
  }
  return account.isTeamLead
    ? { label: '팀장', isPrimary: true }
    : { label: '팀원', isPrimary: false };
}

/*
 * 출결 스터디 표(InternalCategoryAttendancePage의 스터디별 표)와 같은 모양이다:
 * 진한 회색 머리 칸, 46px 줄, 옅은 세로 구분선(출결 표보다 조금 진하게), 묶음(팀)이 끝나는 줄 아래의 진한 가로선,
 * 이름은 굵게.
 */
const TH = 'px-2 py-1 text-center font-bold bg-slate-100/90';
const CELL = 'px-2 py-1.5 text-center text-xs';
/** 팀이 끝나는 줄 아래 선. 출결 표에서 한 사람(멘멘·친바 두 줄)이 끝날 때 긋는 선과 같다. */
const GROUP_END = 'border-b border-b-slate-300';
/** 팀 열 오른쪽 선. 다른 세로선과 같은 색이다. 팀 칸이 여러 줄에 걸쳐 있어 줄마다 붙는 세로선(divide-x)이 닿지 않는 곳까지 긋는다. */
const DIVIDER_RIGHT = 'border-r border-r-slate-200/70';

/**
 * 운영진 계정: 모든 팀의 운영진을 한 표로 본다. 왼쪽 팀 칸이 소속 인원 수만큼 세로로 이어지고,
 * 팀 사이는 진한 선으로 나눈다. 구분 칸은 대표진 묶음이면 대표진·차기대표진, 다른 팀이면 팀장·팀원이다.
 * 이름이나 권한 버튼을 누르면 그 사람의 권한 창이 열리고, 관리 칸에서 비밀번호 재설정·계정 삭제를 한다.
 */
export function OperatorRosterTable({
  teamGroups,
  actions,
  onPermissions,
  onResetPassword,
  onDelete,
}: OperatorRosterTableProps) {
  if (teamGroups.length === 0) {
    return <p className="py-8 text-center text-xs text-slate-500">운영진 계정이 없습니다.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-xs">
          <colgroup>
            {COLUMNS.map((column) => (
              <col key={column.label} className={column.width} />
            ))}
          </colgroup>
          <thead className="select-none bg-slate-50/80">
            <tr className="h-11 divide-x divide-slate-200/70 border-b border-slate-200 text-[11px] font-semibold whitespace-nowrap text-slate-700">
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  className={`${TH} ${column.isKey ? 'text-slate-900' : 'text-slate-700'} ${
                    column.label === '팀' ? DIVIDER_RIGHT : ''
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {teamGroups.map(({ teamName, members }, groupIndex) => {
              const isLastGroup = groupIndex === teamGroups.length - 1;
              const hasLead = !TEAMS_WITHOUT_LEAD.includes(teamName);
              return (
                <Fragment key={teamName}>
                  {members.map((account, index) => {
                    const isGroupEnd = !isLastGroup && index === members.length - 1;
                    const seat = seatOf(account, hasLead);
                    return (
                      <tr
                        key={account.id}
                        className={`h-[46px] divide-x divide-slate-200/70 transition-colors hover:bg-slate-50/70 ${
                          isGroupEnd ? '[&>td]:border-b [&>td]:border-b-slate-300' : ''
                        }`}
                      >
                        {/* 팀 칸: 팀 이름이 소속 인원 수만큼 세로로 이어진다. */}
                        {index === 0 && (
                          <th
                            scope="rowgroup"
                            rowSpan={members.length}
                            className={`bg-white px-2 py-1.5 text-center align-middle text-xs font-bold break-keep text-slate-900 ${DIVIDER_RIGHT} ${
                              isLastGroup ? '' : GROUP_END
                            }`}
                          >
                            {teamName}
                          </th>
                        )}
                        <td
                          className={`${CELL} ${
                            seat.isPrimary ? 'font-semibold text-slate-900' : 'text-slate-500'
                          }`}
                        >
                          {seat.label}
                        </td>
                        <td className={`${CELL} font-bold text-slate-900`}>
                          <button
                            type="button"
                            onClick={() => onPermissions(account)}
                            aria-label={`${account.name} 권한 보기`}
                            className="cursor-pointer text-xs font-bold leading-normal underline-offset-2 hover:underline"
                          >
                            {account.name}
                          </button>
                        </td>
                        <td className={`${CELL} tabular-nums text-slate-600`}>{account.term}기</td>
                        <td className={`${CELL} text-slate-600`}>{account.track || '-'}</td>
                        <td className={CELL}>
                          <span className={ID_CHIP}>{account.username}</span>
                        </td>
                        <td className={CELL}>
                          <div className="flex items-center justify-center gap-0.5">
                            <IconAction
                              label="권한"
                              blockReason={null}
                              onClick={() => onPermissions(account)}
                            >
                              <ShieldCheck size={14} aria-hidden="true" />
                            </IconAction>
                            <IconAction
                              label="비밀번호 재설정"
                              blockReason={actions.passwordResetBlockReason(account)}
                              onClick={() => onResetPassword(account)}
                            >
                              <KeyRound size={14} aria-hidden="true" />
                            </IconAction>
                            <IconAction
                              label="계정 삭제"
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
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
