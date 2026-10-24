import type { AccountHolder } from '@/entities/admin-account/model/types';

/** 값이 없을 때 표시. */
const EMPTY = '-';

/** 열 너비는 비율로 나눈다. 그룹 이름이 긴 ADV·스터디 권한 열을 넓게 둔다. 합계 100%. */
const COLUMNS: readonly { label: string; width: string }[] = [
  { label: '기수', width: 'w-[12%]' },
  { label: '부문', width: 'w-[13%]' },
  { label: '소속 운영진', width: 'w-[17%]' },
  { label: 'ADV 권한', width: 'w-[29%]' },
  { label: '스터디 권한', width: 'w-[29%]' },
];

/*
 * 출결 스터디 표·운영진 계정 표와 같은 모양이다: 위쪽 회색 머리 칸, 머리 칸·줄 모두 44px(아래 운영 권한 표와 같은 높이), 옅은 세로 구분선, 가운데 정렬.
 */
const TH = 'px-2 py-1 text-center font-bold bg-slate-100/90 text-slate-700';
const CELL = 'px-3 py-1.5 text-center text-xs';

/**
 * 고른 사람의 인적 사항 표: 기수, 부문, 소속 운영진(팀), ADV 권한(팀장인 ADV 팀), 스터디 권한(스터디장인 스터디).
 * 표는 한 줄이고, ADV 팀이나 스터디가 여러 개면 그 칸 안에서만 줄을 나눈다. 두 열은 서로 줄을 나눠 갖지 않아서,
 * 스터디가 두 개여도 ADV 칸은 한 칸 그대로다(가운데에 놓인다). 값이 없으면 "-"를 보인다. ADV·스터디 권한은 출결 입력 권한(맡은 그룹에서 자동)이 생기는 근거이며,
 * 출결의 그룹 계정 관리에서 바꾼다.
 */
export function HolderProfileTable({ holder }: { holder: AccountHolder }) {
  const groupNamesOf = (groupType: 'ADV' | 'STUDY') =>
    holder.leaderGroups.filter((group) => group.groupType === groupType).map((group) => group.name);
  const advNames = groupNamesOf('ADV');
  const studyNames = groupNamesOf('STUDY');
  const plainCells = [
    holder.term ? `${holder.term}기` : EMPTY,
    holder.track || EMPTY,
    holder.adminAccount?.teamName ?? EMPTY,
  ];

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[520px] table-fixed border-collapse text-xs"
          aria-label="인적 사항"
        >
          <colgroup>
            {COLUMNS.map((column) => (
              <col key={column.label} className={column.width} />
            ))}
          </colgroup>
          <thead className="select-none bg-slate-50/80">
            <tr className="h-11 divide-x divide-slate-200/70 border-b border-slate-200 text-xs whitespace-nowrap">
              {COLUMNS.map((column) => (
                <th key={column.label} scope="col" className={TH}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="h-11 divide-x divide-slate-200/70">
              {plainCells.map((value, cellIndex) => (
                <td
                  key={COLUMNS[cellIndex].label}
                  className={`${CELL} ${value === EMPTY ? 'text-slate-500' : 'text-slate-800'} ${
                    cellIndex === 0 ? 'font-mono' : ''
                  }`}
                >
                  {value}
                </td>
              ))}
              <GroupCell names={advNames} />
              <GroupCell names={studyNames} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * ADV·스터디 권한 칸. 그룹이 여러 개면 이 칸 안에서만 44px 줄로 나누고(옅은 가로선), 다른 칸과 줄을 나눠 갖지 않는다.
 * 그룹이 하나뿐이거나 없으면("-") 칸 높이의 가운데에 놓인다.
 */
function GroupCell({ names }: { names: readonly string[] }) {
  if (names.length === 0) {
    return <td className={`${CELL} text-slate-500`}>{EMPTY}</td>;
  }
  return (
    <td className="p-0 align-middle text-xs text-slate-800">
      <ul className="divide-y divide-slate-100">
        {names.map((name, index) => (
          <li
            key={`${name}-${index}`}
            className="flex h-11 items-center justify-center px-3 text-center"
          >
            {name}
          </li>
        ))}
      </ul>
    </td>
  );
}
