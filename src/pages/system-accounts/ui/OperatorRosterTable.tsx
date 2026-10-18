import { Fragment } from 'react';

import type { AdminAccount } from '@/entities/admin-account/model/types';
import { ID_CHIP, O_MARK } from '@/pages/system-accounts/ui/systemStyles';

interface OperatorRosterTableProps {
  /** 팀 목록과 같은 순서로 묶은 운영진. 팀 안의 순서도 부르는 쪽이 정한다. */
  teamGroups: readonly { teamName: string; members: readonly AdminAccount[] }[];
  /** 팀장 칸을 비워 두는 팀(대표진·차기대표진). */
  teamsWithoutLead: readonly string[];
  /** 이름을 누르면 그 사람의 팀 표로 옮긴다. */
  onSelectMember: (account: AdminAccount) => void;
}

/** 열 너비는 비율로 나눈다. 한 열(이름)만 남는 폭을 다 차지해 넓게 비지 않게 한다. 합계 100%. */
const COLUMNS: readonly { label: string; width: string; isKey?: boolean }[] = [
  { label: '구분', width: 'w-[18%]', isKey: true },
  { label: '기수', width: 'w-[12%]' },
  { label: '부문', width: 'w-[15%]' },
  { label: '이름', width: 'w-[17%]', isKey: true },
  { label: '아이디', width: 'w-[25%]' },
  { label: '팀장', width: 'w-[13%]' },
];

/*
 * 출결 스터디 표(InternalCategoryAttendancePage의 스터디별 표)와 같은 모양이다:
 * 진한 회색 머리 칸, 46px 줄, 옅은 세로 구분선(출결 표보다 조금 진하게), 묶음(팀)이 끝나는 줄 아래의 진한 가로선,
 * 숫자 칸은 고정폭 글자, 이름은 굵게.
 */
const TH = 'px-2 py-1 text-center font-bold bg-slate-100/90';
const CELL = 'px-2 py-1.5 text-center text-xs';
/** 팀이 끝나는 줄 아래 선. 출결 표에서 한 사람(멘멘·친바 두 줄)이 끝날 때 긋는 선과 같다. */
const GROUP_END = 'border-b border-b-slate-300';
/** 구분(팀) 열 오른쪽 선. 다른 세로선과 같은 색이다. 구분 칸이 여러 줄에 걸쳐 있어 줄마다 붙는 세로선(divide-x)이 닿지 않는 곳까지 긋는다. */
const DIVIDER_RIGHT = 'border-r border-r-slate-200/70';

/**
 * 운영진 목록: 모든 팀의 운영진을 한 표로 본다. 왼쪽 구분 칸(팀)이 소속 인원 수만큼 세로로 이어지고,
 * 팀 사이는 진한 선으로 나눈다. 계정(아이디)을 아직 발급하지 않은 사람은 아이디 칸이 비어 있어 바로 눈에 띈다
 * (출결 그룹 계정 관리 표와 같다). 이름을 누르면 그 사람의 팀 표로 옮겨 관리 버튼을 본다.
 */
export function OperatorRosterTable({
  teamGroups,
  teamsWithoutLead,
  onSelectMember,
}: OperatorRosterTableProps) {
  if (teamGroups.length === 0) {
    return <p className="py-8 text-center text-xs text-slate-500">운영진 계정이 없습니다.</p>;
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] table-fixed border-collapse text-xs">
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
                    column.label === '구분' ? DIVIDER_RIGHT : ''
                  }`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {teamGroups.map(({ teamName, members }, groupIndex) => {
              const isLastGroup = groupIndex === teamGroups.length - 1;
              const hasLead = !teamsWithoutLead.includes(teamName);
              return (
                <Fragment key={teamName}>
                  {members.map((account, index) => {
                    const isGroupEnd = !isLastGroup && index === members.length - 1;
                    return (
                      <tr
                        key={account.id}
                        className={`h-[46px] divide-x divide-slate-200/70 transition-colors hover:bg-slate-50/70 ${
                          isGroupEnd ? '[&>td]:border-b [&>td]:border-b-slate-300' : ''
                        }`}
                      >
                        {/* 구분 칸: 팀 이름이 소속 인원 수만큼 세로로 이어진다. */}
                        {index === 0 && (
                          <th
                            scope="rowgroup"
                            rowSpan={members.length}
                            className={`bg-white px-2 py-1.5 text-center align-middle font-sans text-xs font-bold break-keep text-slate-900 ${DIVIDER_RIGHT} ${
                              isLastGroup ? '' : GROUP_END
                            }`}
                          >
                            {teamName}
                          </th>
                        )}
                        <td className={`${CELL} text-slate-600`}>{account.term}기</td>
                        <td className={`${CELL} font-sans text-slate-600`}>
                          {account.track || '-'}
                        </td>
                        <td className={`${CELL} font-sans font-bold text-slate-900`}>
                          <button
                            type="button"
                            onClick={() => onSelectMember(account)}
                            aria-label={`${account.name} — ${teamName} 표에서 보기`}
                            className="cursor-pointer text-xs font-bold leading-normal underline-offset-2 hover:underline"
                          >
                            {account.name}
                          </button>
                        </td>
                        <td className={CELL}>
                          {account.username && <span className={ID_CHIP}>{account.username}</span>}
                        </td>
                        <td
                          className={CELL}
                          aria-label={hasLead ? (account.isTeamLead ? '팀장' : '팀원') : undefined}
                        >
                          {account.isTeamLead && (
                            <span aria-hidden="true" className={O_MARK}>
                              O
                            </span>
                          )}
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
