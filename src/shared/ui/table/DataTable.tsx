import type { ReactNode } from 'react';

import { type CellAlign, Table, TableBody, TableHead, Td, Th, Tr } from './Table';

/**
 * 목록 표의 열 하나(컬럼 정의). 이름은 TanStack Table의 ColumnDef 관례를 따른다:
 * id·header·accessorKey·accessorFn·cell·size, 그 밖의 화면 설정은 meta에 둔다.
 * 나중에 정렬·필터가 필요해 TanStack Table을 들이면 이 배열을 거의 그대로 옮길 수 있게 하기 위해서다.
 */
export interface DataTableColumn<Row> {
  /** 열을 구분하는 값(React key). 화면 안에서 겹치지 않게 한다. */
  id: string;
  header: ReactNode;
  /** 칸 값을 그대로 꺼낼 행의 필드. cell이 없으면 이 값을 글자로 보인다. */
  accessorKey?: keyof Row & string;
  /** 칸 값을 계산해 꺼낸다. accessorKey보다 먼저 쓴다. */
  accessorFn?: (row: Row) => unknown;
  /** 칸 내용. 없으면 getValue()(accessorFn·accessorKey 값)를 글자로 보인다. */
  cell?: (context: DataTableCellContext<Row>) => ReactNode;
  /** 열 너비(px). 비우면 남는 너비를 나눠 쓴다. */
  size?: number;
  /** 화면 설정(TanStack의 meta 자리). */
  meta?: DataTableColumnMeta<Row>;
}

export interface DataTableCellContext<Row> {
  /** 이 줄의 원래 데이터(TanStack의 row.original). */
  row: Row;
  /** 화면에 보이는 순서(0부터). */
  index: number;
  /** accessorFn 또는 accessorKey로 꺼낸 값. */
  getValue: () => unknown;
}

export interface DataTableColumnMeta<Row> {
  /** 칸 내용 정렬. 머리 칸은 늘 가운데다. */
  align?: CellAlign;
  /** 핵심 열 머리를 진하게 한다. */
  isKey?: boolean;
  /** 긴 글자를 줄바꿈한다. */
  isWrapped?: boolean;
  /** 칸에 덧붙일 클래스(글자 색 등). 줄마다 다르면 함수로 준다. */
  cellClassName?: string | ((row: Row) => string);
}

interface DataTableProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  /** 표에 그릴 데이터(TanStack의 data). */
  data: readonly Row[];
  /** 줄을 구분하는 값(TanStack의 getRowId). */
  getRowId: (row: Row) => string;
  /** 줄이 없을 때 보일 글자. 없으면 머리 줄만 보인다. */
  empty?: ReactNode;
  /** 줄마다 덧붙일 클래스(예: 제외한 줄 바탕). */
  rowClassName?: (row: Row) => string;
  caption?: string;
  /** Table의 className과 같다(높이·넘기기). */
  className?: string;
  /** Table의 tableClassName과 같다(최소 너비 등). */
  tableClassName?: string;
  /** 세로로 넘길 때 머리 줄을 위에 붙여 둔다. */
  isHeadSticky?: boolean;
}

function valueOf<Row>(column: DataTableColumn<Row>, row: Row): unknown {
  if (column.accessorFn) return column.accessorFn(row);
  return column.accessorKey === undefined ? undefined : row[column.accessorKey];
}

/** 값이 없으면 '-', 있으면 글자로 보인다(cell이 없는 열). */
const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '';

function textOf(value: unknown): ReactNode {
  return isEmptyValue(value) ? '-' : String(value);
}

/** 줄마다 같은 열을 그리는 목록 표. 열 정의(columns)를 화면이 넘기고, 모양은 Table이 정한다. */
export function DataTable<Row>({
  columns,
  data,
  getRowId,
  empty,
  rowClassName,
  caption,
  className,
  tableClassName,
  isHeadSticky = false,
}: DataTableProps<Row>) {
  return (
    <Table caption={caption} className={className} tableClassName={tableClassName}>
      <TableHead isSticky={isHeadSticky}>
        <Tr>
          {columns.map((column) => (
            // 머리 칸은 늘 가운데 정렬이다(칸 내용 정렬과 따로 둔다).
            <Th
              key={column.id}
              isKey={column.meta?.isKey}
              style={column.size === undefined ? undefined : { width: column.size }}
            >
              {column.header}
            </Th>
          ))}
        </Tr>
      </TableHead>
      <TableBody>
        {data.length === 0 && empty !== undefined && (
          <Tr>
            <Td colSpan={columns.length} className="text-slate-500">
              {empty}
            </Td>
          </Tr>
        )}
        {data.map((row, index) => (
          <Tr key={getRowId(row)} isHoverable className={rowClassName?.(row) ?? ''}>
            {columns.map((column) => {
              const getValue = () => valueOf(column, row);
              const cellClassName = column.meta?.cellClassName;
              // 빈 값의 「-」는 왼쪽 정렬 열에서도 가운데에 둔다. 다른 열의 「-」와 줄을 맞추기 위해서다.
              const isEmpty = !column.cell && isEmptyValue(getValue());
              return (
                <Td
                  key={column.id}
                  align={isEmpty ? 'center' : column.meta?.align}
                  isWrapped={column.meta?.isWrapped}
                  className={
                    typeof cellClassName === 'function' ? cellClassName(row) : (cellClassName ?? '')
                  }
                >
                  {column.cell ? column.cell({ row, index, getValue }) : textOf(getValue())}
                </Td>
              );
            })}
          </Tr>
        ))}
      </TableBody>
    </Table>
  );
}
