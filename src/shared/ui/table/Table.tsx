import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

/**
 * 관리자 화면 표의 기본 조각. 표가 "어떻게 생겼는지"(테두리·머리 칸·세로줄·모서리·글자)만 정하고,
 * 어떤 열·행이 있는지는 쓰는 화면이 정한다. 행·열 수, 칸 합치기(rowSpan·colSpan)는 자유롭다.
 *
 *   <Table>
 *     <TableHead><Tr><Th>활동</Th><Th>기간</Th></Tr></TableHead>
 *     <TableBody><Tr><Th scope="row">BASE</Th><Td>07-08 ~ 08-31</Td></Tr></TableBody>
 *   </Table>
 *
 * 줄마다 같은 열을 그리는 목록 표는 열 정의 배열을 받는 DataTable을 쓴다.
 */

export type CellAlign = 'left' | 'center' | 'right';

const ALIGN_CLASS: Record<CellAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * 세로줄은 줄의 첫 칸을 뺀 모든 칸의 왼쪽 선으로 긋는다. 오른쪽 선(divide-x)으로 그으면
 * 위 줄에서 rowSpan으로 내려온 칸 옆 줄의 마지막 칸에 선이 빠지기 때문이다.
 */
const ROW_LINES = '[&>*:not(:first-child)]:border-l [&>*]:border-slate-200';

interface TableProps {
  children: ReactNode;
  /** 화면 낭독기용 표 이름. 보이지 않는다. */
  caption?: string;
  /**
   * 표 상자에 덧붙일 클래스. 높이를 정해 세로로 넘기려면 `max-h-96 overflow-y-auto`,
   * 좁을 때 가로로 넘기려면 `overflow-x-auto`처럼 넣는다.
   */
  className?: string;
  /** 표에 덧붙일 클래스. 가로로 넘길 최소 너비(`min-w-[920px]`)나 열 너비 고정(`table-fixed`)을 넣는다. */
  tableClassName?: string;
  /**
   * 칸 안의 목록(드롭다운 등)이 표 밖으로 펼쳐져야 하면 true. 상자가 내용을 자르지 않고,
   * 머리 칸 양 끝을 둥글게 해 모서리를 맞춘다. 가로·세로 넘기기와 함께 쓰지 않는다.
   */
  isOverflowVisible?: boolean;
}

export function Table({
  children,
  caption,
  className = '',
  tableClassName = '',
  isOverflowVisible = false,
}: TableProps) {
  return (
    <div
      // relative: 숨긴 표 제목(sr-only, absolute)이 이 상자 안에 머물게 한다. 없으면 넘기는 상자 밖에 놓여 화면 전체가 길어진다.
      className={`relative rounded-md border border-slate-200 bg-white ${
        isOverflowVisible
          ? '[&_thead_tr>*:first-child]:rounded-tl-md [&_thead_tr>*:last-child]:rounded-tr-md'
          : 'overflow-hidden'
      } ${className}`}
    >
      <table className={`w-full border-collapse text-xs ${tableClassName}`}>
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

interface TableHeadProps {
  children: ReactNode;
  /** 세로로 넘기는 표에서 머리 줄을 위에 붙여 둔다. */
  isSticky?: boolean;
}

export function TableHead({ children, isSticky = false }: TableHeadProps) {
  return (
    <thead
      className={`select-none [&>tr]:border-b [&>tr]:border-slate-200 ${isSticky ? 'sticky top-0 z-10 bg-white' : ''}`}
    >
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

interface TrProps {
  children: ReactNode;
  /** 줄 바탕·글자 등 덧붙일 클래스(예: 제외한 줄은 `bg-slate-50`). */
  className?: string;
  /** 마우스를 올리면 바탕을 연하게 칠한다(목록 표). */
  isHoverable?: boolean;
}

export function Tr({ children, className = '', isHoverable = false }: TrProps) {
  return (
    <tr
      className={`h-10 ${ROW_LINES} ${
        isHoverable ? 'transition-colors hover:bg-slate-50/70' : ''
      } ${className}`}
    >
      {children}
    </tr>
  );
}

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: CellAlign;
  /** 핵심 열(활동·이름 등) 머리는 글자를 진하게 한다. 줄 머리(`scope="row"`)에는 쓰지 않는다. */
  isKey?: boolean;
}

/**
 * 머리 칸. `scope="col"`(기본)은 회색 바탕의 열 머리, `scope="row"`는 본문 줄의 첫 칸(굵은 글자)이다.
 */
export function Th({
  align = 'center',
  isKey = false,
  scope = 'col',
  className = '',
  children,
  ...rest
}: ThProps) {
  const look =
    scope === 'row'
      ? 'px-2 py-2 font-semibold text-slate-900'
      : `bg-slate-100/90 px-2 py-1 font-bold ${isKey ? 'text-slate-900' : 'text-slate-700'}`;
  return (
    <th
      scope={scope}
      className={`${look} ${ALIGN_CLASS[align]} text-xs whitespace-nowrap ${className}`}
      {...rest}
    >
      {children}
    </th>
  );
}

interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: CellAlign;
  /** 긴 글자를 줄바꿈한다(참여 그룹·비고처럼 길어질 수 있는 칸). */
  isWrapped?: boolean;
}

export function Td({
  align = 'center',
  isWrapped = false,
  className = '',
  children,
  ...rest
}: TdProps) {
  return (
    <td
      className={`px-2 py-2 text-xs ${ALIGN_CLASS[align]} ${
        isWrapped ? 'whitespace-normal' : 'whitespace-nowrap'
      } ${className}`}
      {...rest}
    >
      {children}
    </td>
  );
}
