/**
 * 출석 표의 컬럼 구성(표시 순서). 출석 표와 컬럼 설정 창이 같은 함수로 컬럼을 만들어, 두 화면의 컬럼이 항상 같다.
 * 순서: 앞쪽 추가 컬럼 → 이름 → 출결 열(1차·2차, 행사별 열 등) → 뒤쪽 추가 컬럼 → 비고.
 * 출결 열이 오는 자리는 행사의 statusColumnIndex(그 앞에 오는 추가 컬럼 수)다.
 */
import type { AttendanceEvent, CustomFormField } from '@/entities/event/model/types';

import { isBaseColumnHidden, NAME_COLUMN_NAME } from './baseColumns';
import { statusColumnsOf, type StatusColumn } from './statusColumns';

type TableColumnSource = Pick<
  AttendanceEvent,
  | 'attendanceFormat'
  | 'customFields'
  | 'hiddenColumns'
  | 'sessionLabels'
  | 'statusColumnIndex'
  | 'statusOptions'
>;

export type TableColumn =
  | { kind: 'field'; key: string; label: string; field: CustomFormField }
  | { kind: 'name'; key: 'name'; label: string }
  | { kind: 'status'; key: string; label: string; status: StatusColumn }
  | { kind: 'memo'; key: 'memo'; label: string };

/** 표에 따로 있는 열(이름·비고·출결)과 이름이 같은 추가 컬럼은 표에 두지 않는다. */
const BUILT_IN_FIELD_LABELS: readonly string[] = ['이름', '비고', '출석 상태', '출석상태'];

/** 출석 표의 추가 컬럼. 컨퍼런스 외부 참석자 시트는 이름·출석·비고만 관리하므로 추가 컬럼이 없다. */
export function extraFieldsOf(
  event: Pick<AttendanceEvent, 'customFields'>,
  isExternalSheet: boolean,
): CustomFormField[] {
  return isExternalSheet
    ? []
    : (event.customFields ?? []).filter((field) => !BUILT_IN_FIELD_LABELS.includes(field.label));
}

/** 출결 열 앞에 오는 추가 컬럼 수. 정하지 않았으면 추가 컬럼 뒤(맨 끝)다. */
export function statusColumnAtOf(
  event: Pick<AttendanceEvent, 'statusColumnIndex'>,
  extraFieldCount: number,
): number {
  return Math.min(Math.max(event.statusColumnIndex ?? extraFieldCount, 0), extraFieldCount);
}

/** 출석 표의 컬럼을 표시 순서대로. 지운 기본 열(출결·비고)은 빠진다. */
export function tableColumnsOf(event: TableColumnSource, isExternalSheet: boolean): TableColumn[] {
  const fields = extraFieldsOf(event, isExternalSheet);
  const statusAt = statusColumnAtOf(event, fields.length);
  const toColumn = (field: CustomFormField): TableColumn => ({
    kind: 'field',
    key: `custom_${field.id}`,
    label: field.label,
    field,
  });
  return [
    ...fields.slice(0, statusAt).map(toColumn),
    { kind: 'name', key: 'name', label: NAME_COLUMN_NAME },
    ...statusColumnsOf(event, isExternalSheet).map((status): TableColumn => ({
      kind: 'status',
      key: status.key,
      label: status.label,
      status,
    })),
    ...fields.slice(statusAt).map(toColumn),
    ...(isBaseColumnHidden(event, 'MEMO')
      ? []
      : [{ kind: 'memo', key: 'memo', label: '비고' } as const]),
  ];
}

/**
 * 컬럼 설정 창에서 추가 컬럼 하나를 끌어 옮긴 결과. 이름·출결 열은 한 묶음으로 제자리에 있고,
 * 추가 컬럼만 그 앞뒤로 옮길 수 있다. 비고는 늘 맨 끝이라 옮길 자리에 들지 않는다.
 * fromIndex·toSlot은 비고를 뺀 컬럼 목록 기준이다(toSlot은 그 칸 앞에 넣는 자리).
 */
export function movedTableColumn(
  event: TableColumnSource,
  fromIndex: number,
  toSlot: number,
): Pick<AttendanceEvent, 'customFields' | 'statusColumnIndex'> | undefined {
  const columns = tableColumnsOf(event, false).filter((column) => column.kind !== 'memo');
  const moving = columns[fromIndex];
  if (!moving || moving.kind !== 'field' || toSlot === fromIndex || toSlot === fromIndex + 1) {
    return undefined;
  }
  const reordered = [...columns];
  reordered.splice(fromIndex, 1);
  reordered.splice(toSlot > fromIndex ? toSlot - 1 : toSlot, 0, moving);

  const fields = reordered.flatMap((column) => (column.kind === 'field' ? [column.field] : []));
  const nameAt = reordered.findIndex((column) => column.kind === 'name');
  const statusColumnIndex = reordered
    .slice(0, nameAt)
    .filter((column) => column.kind === 'field').length;
  // 표에 두지 않는 추가 컬럼(이름·비고와 같은 이름)은 원래대로 뒤에 둔다.
  const hiddenFields = (event.customFields ?? []).filter((field) => !fields.includes(field));
  return { customFields: [...fields, ...hiddenFields], statusColumnIndex };
}
