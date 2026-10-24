import type { AccountHolder, LeaderGroup } from '@/entities/admin-account/model/types';
import { ID_CHIP, TABLE_BOX, TD_CLASS, TH_CLASS } from '@/pages/system-accounts/ui/systemStyles';

/** 값이 없을 때 표시. */
const EMPTY = '-';

/**
 * 열 너비는 비율로 나눈다(운영진 표와 같은 방식). 아이디·ADV·스터디는 여러 개일 수 있어 넓게 둔다.
 * 운영진 칸은 운영진 팀 이름(차기대표진은 그대로 '차기대표진')이고, 운영진이 아니면 '-'다.
 * ADV·스터디 열은 권한 창의 인적 사항 표(ADV 권한·스터디 권한)와 같은 값이다.
 */
const COLUMNS: readonly { key: string; label: string; share: number; isKey?: boolean }[] = [
  { key: 'name', label: '이름', share: 12, isKey: true },
  { key: 'term', label: '기수', share: 8 },
  { key: 'track', label: '부문', share: 11 },
  { key: 'username', label: '아이디', share: 17 },
  { key: 'operator', label: '운영진', share: 14 },
  { key: 'adv', label: 'ADV', share: 19 },
  { key: 'study', label: '스터디', share: 19 },
];
const TOTAL_SHARE = COLUMNS.reduce((sum, column) => sum + column.share, 0);
/** 여러 줄이 들어가는 칸(아이디·ADV·스터디). 줄바꿈을 막지 않는다. */
const MULTI_CELL = 'px-2 py-1.5 text-center text-xs';

interface GroupLeaderTableProps {
  /** 그룹(ADV 팀·스터디)을 맡았거나 HOST 계정이 있는 사람(운영진 여부와 관계없이). 부르는 쪽이 이름순으로 넘긴다. */
  holders: readonly AccountHolder[];
  /** 이름을 누르면 그 사람의 권한 창을 연다(운영진이면 권한을 바꿀 수 있고, 아니면 보기 전용). */
  onOpen: (holder: AccountHolder) => void;
}

/**
 * 그룹을 맡은 사람 표: 이름 · 기수 · 부문 · 아이디(HOST 로그인) · 운영진(팀) · ADV(맡은 ADV 팀) · 스터디(맡은 스터디).
 * 운영진이면서 그룹을 맡은 사람도 함께 나온다. 운영진 표와 같은 회색 머리 칸·칸 구분선을 쓴다.
 * HOST 계정의 비밀번호 재설정·삭제·발급은 출결의 그룹 계정 관리에서 한다.
 */
export function GroupLeaderTable({ holders, onOpen }: GroupLeaderTableProps) {
  return (
    <div className={TABLE_BOX}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-xs">
          <colgroup>
            {COLUMNS.map((column) => (
              <col key={column.key} style={{ width: `${(column.share / TOTAL_SHARE) * 100}%` }} />
            ))}
          </colgroup>
          <thead className="select-none">
            <tr className="h-11 divide-x divide-slate-200 border-b border-slate-200">
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={`${TH_CLASS} text-xs ${column.isKey ? 'text-slate-900' : ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          {holders.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={COLUMNS.length} className="py-10 text-center text-xs text-slate-500">
                  그룹을 맡은 사람이 없습니다.
                </td>
              </tr>
            </tbody>
          ) : (
            holders.map((holder) => <HolderRows key={holder.key} holder={holder} onOpen={onOpen} />)
          )}
        </table>
      </div>
    </div>
  );
}

/** 칸 사이 세로선. 사람 한 명이 여러 줄을 쓰면 divide-x가 줄마다 첫 칸을 빼먹으므로 칸마다 직접 준다. */
const CELL_BORDER = 'border-l border-slate-200';

/**
 * 한 사람의 줄 묶음. ADV·스터디를 여러 개 맡았으면 그 칸만 한 줄에 하나씩 나누고,
 * 이름·기수·부문·아이디·운영진 칸은 세로로 합친다(rowSpan). 마우스를 올리면 묶음 전체가 함께 칠해진다.
 */
function HolderRows({
  holder,
  onOpen,
}: {
  holder: AccountHolder;
  onOpen: (holder: AccountHolder) => void;
}) {
  const advNames = namesOf(holder.leaderGroups, 'ADV');
  const studyNames = namesOf(holder.leaderGroups, 'STUDY');
  const rowCount = Math.max(advNames.length, studyNames.length, 1);
  return (
    <tbody className="group border-t border-slate-200 first-of-type:border-t-0">
      {Array.from({ length: rowCount }, (_, rowIndex) => (
        <tr
          key={rowIndex}
          className={`h-[46px] transition-colors group-hover:bg-slate-50/70 ${
            rowIndex > 0 ? 'border-t border-slate-100' : ''
          }`}
        >
          {rowIndex === 0 && (
            <>
              <td rowSpan={rowCount} className={`${TD_CLASS} font-bold text-slate-900`}>
                <button
                  type="button"
                  onClick={() => onOpen(holder)}
                  className="cursor-pointer text-xs font-bold leading-normal underline-offset-2 hover:underline"
                >
                  {holder.name}
                </button>
              </td>
              <td rowSpan={rowCount} className={`${TD_CLASS} ${CELL_BORDER} text-slate-600`}>
                {holder.term ? `${holder.term}기` : EMPTY}
              </td>
              <td rowSpan={rowCount} className={`${TD_CLASS} ${CELL_BORDER} text-slate-600`}>
                {holder.track || EMPTY}
              </td>
              <td rowSpan={rowCount} className={`${MULTI_CELL} ${CELL_BORDER}`}>
                {holder.hostLogins.length > 0 ? (
                  <span className="flex flex-wrap justify-center gap-1">
                    {holder.hostLogins.map((login) => (
                      <span key={login.id} className={ID_CHIP}>
                        {login.username}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="text-slate-500">{EMPTY}</span>
                )}
              </td>
              <td rowSpan={rowCount} className={`${TD_CLASS} ${CELL_BORDER} text-slate-800`}>
                {holder.adminAccount?.teamName ?? <span className="text-slate-500">{EMPTY}</span>}
              </td>
            </>
          )}
          <GroupCell names={advNames} rowIndex={rowIndex} rowCount={rowCount} />
          <GroupCell names={studyNames} rowIndex={rowIndex} rowCount={rowCount} />
        </tr>
      ))}
    </tbody>
  );
}

/** 그 종류(ADV·스터디)로 맡은 그룹 이름. */
const namesOf = (groups: readonly LeaderGroup[], groupType: LeaderGroup['groupType']) =>
  groups.filter((group) => group.groupType === groupType).map((group) => group.name);

/**
 * 맡은 그룹 칸 하나. rowIndex번째 이름을 쓴다. 이름이 줄 수보다 적으면 마지막 이름 칸이 남은 줄을 세로로 합치고,
 * 하나도 없으면 첫 줄에 '-' 칸 하나가 모든 줄을 합친다. 합쳐진 줄에서는 칸을 그리지 않는다.
 */
function GroupCell({
  names,
  rowIndex,
  rowCount,
}: {
  names: readonly string[];
  rowIndex: number;
  rowCount: number;
}) {
  const lastIndex = Math.max(names.length - 1, 0);
  if (rowIndex > lastIndex) return null;
  const rowSpan = rowIndex === lastIndex ? rowCount - lastIndex : 1;
  return (
    <td rowSpan={rowSpan} className={`${TD_CLASS} ${CELL_BORDER} text-slate-800`}>
      {names[rowIndex] ?? <span className="text-slate-500">{EMPTY}</span>}
    </td>
  );
}
