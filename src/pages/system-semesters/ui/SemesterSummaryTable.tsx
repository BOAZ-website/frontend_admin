import type { SemesterActivity, SemesterDto } from '@/entities/cohort/model/dto';
import { ACTIVITY_WEEK_COUNT } from '@/entities/cohort/model/schedule';
import { monthDayOf } from '@/shared/lib/date';

import { activitySpansOf, calendarMarksOf } from '../model/calendarMarks';
import { ACTIVITIES, invalidKey, type ScheduleForm } from '../model/scheduleForm';

const TD = 'whitespace-nowrap py-2 pr-6 text-sm tabular-nums';
const WEEK_NUMBERS = Array.from({ length: ACTIVITY_WEEK_COUNT }, (_, index) => index + 1);

interface SemesterSummaryTableProps {
  semester: SemesterDto;
  /** 일정. 읽는 중이면 null이고, 그동안은 아무것도 보이지 않는다. */
  form: ScheduleForm | null;
}

/** 'YYYY-MM-DD ~ MM-DD'. 연도가 다르면 끝도 연도까지 쓴다. 정하지 않았으면 null. */
const rangeText = ({ startDate, endDate }: { startDate: string; endDate: string }) => {
  if (!startDate || !endDate) return null;
  const end = startDate.slice(0, 4) === endDate.slice(0, 4) ? monthDayOf(endDate) : endDate;
  return `${startDate} ~ ${end}`;
};

/**
 * 고칠 수 없는 반기(진행 중·종료)의 요약. 방학·학기 묶음별로 활동(기수)·기간·휴동을 둔다.
 * 활동 기간은 달력과 같은 계산(첫 세션 ~ 마지막 세션)이라 달력에 찍힌 날짜와 맞는다.
 */
export function SemesterSummaryTable({ semester, form }: SemesterSummaryTableProps) {
  const termOf: Partial<Record<SemesterActivity, number | null>> = {
    BASE: semester.cohort,
    ADV: semester.advTerm,
  };
  const spans = form ? activitySpansOf(calendarMarksOf(form)) : {};
  // 첫 세션이 방학 안이면 방학 묶음, 아니면 학기 묶음에 둔다. 시작일을 정하지 않은 활동은 뺀다.
  const isInVacation = (first: string) =>
    !!form?.vacation.endDate && first <= form.vacation.endDate;
  const groups = form
    ? (
        [
          ['방학', form.vacation, true],
          ['학기', form.term, false],
        ] as const
      ).map(([label, range, isVacation]) => ({
        label,
        range: rangeText(range),
        activities: ACTIVITIES.filter(({ value }) => {
          const span = spans[value];
          return span && isInVacation(span.first) === isVacation;
        }),
      }))
    : [];

  return (
    <div className="space-y-4">
      {form && (
        <table className="w-full">
          {groups.map(({ label, range, activities }) => (
            <tbody key={label}>
              <tr className="border-b border-slate-200">
                <th
                  scope="colgroup"
                  colSpan={3}
                  className="whitespace-nowrap pb-2 pt-4 text-left text-sm font-semibold text-slate-900"
                >
                  {label}
                  <span className="ml-2 font-normal tabular-nums text-slate-500">
                    {range ?? '기간 미정'}
                  </span>
                </th>
              </tr>
              {activities.length === 0 && (
                <tr>
                  <td colSpan={3} className={`${TD} text-slate-500`}>
                    정한 활동 없음
                  </td>
                </tr>
              )}
              {activities.map(({ value, label: activityLabel }) => {
                const span = spans[value];
                const term = termOf[value];
                const breaks = WEEK_NUMBERS.filter(
                  (weekNum) => invalidKey(value, weekNum) in form.invalid,
                ).map((weekNum) => ({ weekNum, reason: form.invalid[invalidKey(value, weekNum)] }));
                return (
                  <tr key={value} className="border-b border-slate-100 last:border-b-0">
                    <th scope="row" className={`${TD} text-left font-medium text-slate-900`}>
                      {activityLabel}
                      {term && <span className="ml-2 font-normal text-slate-500">{term}기</span>}
                    </th>
                    <td className={`${TD} text-slate-900`}>
                      {span && `${monthDayOf(span.first)} ~ ${monthDayOf(span.last)}`}
                    </td>
                    <td className={`${TD} pr-0`}>
                      {breaks.length > 0 ? (
                        <span className="text-slate-900">
                          휴동{' '}
                          {breaks
                            .map(({ weekNum, reason }) =>
                              reason ? `${weekNum}주차 (${reason})` : `${weekNum}주차`,
                            )
                            .join(', ')}
                        </span>
                      ) : (
                        <span className="text-slate-500">휴동 없음</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      )}
    </div>
  );
}
