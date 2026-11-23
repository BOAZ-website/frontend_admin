import type { ReactNode } from 'react';

import type { CommonWeekDto, SemesterActivity } from '@/entities/cohort/model/dto';
import type { Season } from '@/entities/cohort/model/season';
import { monthDayOf } from '@/shared/lib/date';
import { Table, TableBody, TableHead, Td, Th, Tr } from '@/shared/ui/table/Table';

import { activityRowsOf, calendarMarksOf } from '../model/calendarMarks';
import { ACTIVITIES, type ScheduleForm } from '../model/scheduleForm';

interface SemesterSummaryTableProps {
  season: Season;
  /** 일정. 읽는 중이면 null이고, 그동안은 아무것도 보이지 않는다. */
  form: ScheduleForm | null;
  /**
   * 주면 기간 표마다 활동 기간 오른쪽에 「휴강」 열을 두고, BASE·ADV 줄을 합친 칸에 이 내용(휴강 주차 고르기)을 넣는다.
   * 스터디 줄은 `-`다.
   */
  renderVoidCell?: (periodType: CommonWeekDto['periodType']) => ReactNode;
}

/** 표의 열. 휴강 열은 renderVoidCell을 줄 때만 붙인다. */
const COLUMNS = [
  { label: '활동', width: 'w-28', isKey: true },
  { label: '기수', width: 'w-16', isKey: false },
  { label: '활동 기간', width: 'w-32', isKey: false },
] as const;
// 요약 표는 달력 옆에 두므로 공용 표 줄 높이(h-10)보다 낮게 한다.
const ROW_HEIGHT = 'h-8!';
const VOID_COLUMN = { label: '휴강', width: 'w-32', isKey: false } as const;

const PERIODS = [
  { key: 'vacation', type: 'VACATION', label: '방학' },
  { key: 'term', type: 'SEMESTER', label: '학기' },
] as const;

/**
 * 고칠 수 없는 반기(진행 중·종료)의 요약. 방학·학기 구역마다 그 기간의 날짜·주 수를 제목 줄에 두고,
 * 그 기간에 세션이 있는 활동(BASE·ADV·스터디)을 한 줄씩 보인다.
 * BASE·ADV는 방학·학기를 이어 진행하므로 두 구역에 모두 나오고, 활동 기간은 그 기간 안의 첫 세션 ~ 마지막 세션이다.
 * 활동 기간은 달력과 같은 계산이라 달력에 찍힌 날짜와 맞는다.
 */
export function SemesterSummaryTable({ season, form, renderVoidCell }: SemesterSummaryTableProps) {
  if (!form) return null;
  const termOf: Partial<Record<SemesterActivity, number | null>> = {
    BASE: season.baseTerm,
    ADV: season.advTerm,
  };
  const marks = calendarMarksOf(form);
  const isTrackActivity = (activity: SemesterActivity) => activity === 'BASE' || activity === 'ADV';
  const labelOf = (activity: SemesterActivity) =>
    ACTIVITIES.find(({ value }) => value === activity)?.label ?? activity;

  return (
    // 표는 내용 높이만 쓴다(옆 달력 높이에 맞춰 늘이지 않는다).
    <div className="flex flex-col gap-6">
      {PERIODS.map(({ key, type, label }) => {
        const range = form[key];
        const rows = activityRowsOf(marks, range);
        const columns = renderVoidCell ? [...COLUMNS, VOID_COLUMN] : COLUMNS;
        // 휴강은 BASE·ADV에만 고른다. 스터디는 무효 회차를 따로 다뤄 여기서 고르지 않는다.
        const trackRowCount = rows.filter(({ activity }) => isTrackActivity(activity)).length;
        return (
          <section key={key} aria-label={`${label} 활동`} className="flex flex-col gap-2">
            <h4 className="text-base font-semibold text-slate-900">{label}</h4>
            {/* 「휴강」 칸의 목록이 표 밖으로 펼쳐지도록 상자가 내용을 자르지 않게 한다. */}
            <Table caption={`${label} 활동`} tableClassName="table-fixed" isOverflowVisible>
              <colgroup>
                {columns.map((column) => (
                  <col key={column.label} className={column.width} />
                ))}
              </colgroup>
              <TableHead>
                <Tr className={ROW_HEIGHT}>
                  {columns.map((column) => (
                    <Th key={column.label} isKey={column.isKey}>
                      {column.label}
                    </Th>
                  ))}
                </Tr>
              </TableHead>
              <TableBody>
                {rows.length === 0 && (
                  <Tr className={ROW_HEIGHT}>
                    <Td colSpan={columns.length} className="text-slate-500">
                      정한 활동 없음
                    </Td>
                  </Tr>
                )}
                {rows.map(({ activity, first, last }, index) => {
                  const term = termOf[activity];
                  return (
                    <Tr key={activity} className={ROW_HEIGHT}>
                      <Th scope="row">{labelOf(activity)}</Th>
                      {/* 기수는 BASE·ADV에만 있다. 스터디는 여러 기수가 함께 한다. */}
                      <Td className="tabular-nums text-slate-600">{term ? `${term}기` : '-'}</Td>
                      <Td className="tabular-nums text-slate-900">
                        {`${monthDayOf(first)} ~ ${monthDayOf(last)}`}
                      </Td>
                      {renderVoidCell &&
                        (isTrackActivity(activity) ? (
                          index === 0 && (
                            <Td rowSpan={trackRowCount} align="left" className="py-1.5">
                              {renderVoidCell(type)}
                            </Td>
                          )
                        ) : (
                          <Td className="text-slate-500">-</Td>
                        ))}
                    </Tr>
                  );
                })}
              </TableBody>
            </Table>
          </section>
        );
      })}
    </div>
  );
}
