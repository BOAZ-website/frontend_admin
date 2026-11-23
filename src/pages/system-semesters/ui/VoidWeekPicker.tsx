import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

import type { CommonWeekDto } from '@/entities/cohort/model/dto';
import { monthDayOf } from '@/shared/lib/date';
import { CheckListPopover } from '@/shared/ui/CheckListPopover';

import { type VoidWeekOption, weekRangeText } from '../model/scheduleForm';
import { LabeledRow, READONLY_VALUE } from './SectionBox';

const PERIODS = [
  { type: 'VACATION', label: '방학' },
  { type: 'SEMESTER', label: '학기' },
] as const;

const dateText = (week: CommonWeekDto) =>
  `${monthDayOf(week.startDate)} ~ ${monthDayOf(week.endDate)}`;

/** 고른 주차를 짧게: 없으면 '없음', 여럿이면 '13, 14주차'. */
const pickedText = (picked: readonly VoidWeekOption[]) =>
  weekRangeText(picked.map((week) => week.displayNo));

interface VoidWeekPickerProps {
  /** 반기의 공통 주차와 휴강 여부. 기간을 정하지 않았으면 빈 배열. */
  weeks: readonly VoidWeekOption[];
  /** 고를 수 있는 휴강 수(새 반기 2개). 없으면 한도 없음. */
  limit?: number;
  /** 고칠 수 없는 반기(종료)거나 요청 중이면 고른 주차를 글자로만 보인다. */
  isReadOnly: boolean;
  onChange: (weekNo: number, isVoid: boolean) => void;
  /** 주면 그 기간(방학·학기) 하나만 이름표 없이 그린다(진행·종료 반기 요약 표의 「휴강」 행). */
  periodType?: CommonWeekDto['periodType'];
}

/** 휴강 공통 주차: 방학·학기마다 목록을 열어 주차를 고른다(고른 줄은 바탕색으로 보인다). 휴강은 모든 활동에 적용된다. */
export function VoidWeekPicker({
  weeks,
  limit,
  isReadOnly,
  onChange,
  periodType,
}: VoidWeekPickerProps) {
  if (weeks.length === 0) return null;
  const isFull = limit !== undefined && weeks.filter((week) => week.isVoid).length >= limit;
  return (
    <div className="space-y-2">
      {PERIODS.filter(({ type }) => !periodType || type === periodType).map(({ type, label }) => {
        const periodWeeks = weeks.filter((week) => week.periodType === type);
        const picked = periodWeeks.filter((week) => week.isVoid);
        const value = isReadOnly ? (
          <span className={READONLY_VALUE}>
            {picked.length === 0 ? '없음' : weekRangeText(picked.map((week) => week.displayNo))}
          </span>
        ) : (
          <WeekCheckDropdown
            label={`${label} 휴강 주차`}
            weeks={periodWeeks}
            isFull={isFull}
            onChange={onChange}
            isCompact={periodType !== undefined}
          />
        );
        // 표 행 안에서는 행 이름(「휴강」)이 이름표 구실을 해서 값만 그린다.
        return periodType ? (
          <div key={type} className="text-center">
            {value}
          </div>
        ) : (
          <LabeledRow key={type} label={label}>
            {value}
          </LabeledRow>
        );
      })}
    </div>
  );
}

interface WeekCheckDropdownProps {
  label: string;
  weeks: readonly VoidWeekOption[];
  /** 한도에 닿았다. 체크하지 않은 주차는 고를 수 없다. */
  isFull: boolean;
  onChange: (weekNo: number, isVoid: boolean) => void;
  /** 표 칸 안에 둘 때: 입력칸 대신 칸 전체를 버튼 하나로 그린다(노션 속성처럼). */
  isCompact?: boolean;
}

/** 여러 주를 고르는 펼침 목록. 공용 체크박스 목록(CheckListPopover)에 주차를 넣고, 바뀐 주 하나를 알린다. */
function WeekCheckDropdown({
  label,
  weeks,
  isFull,
  onChange,
  isCompact = false,
}: WeekCheckDropdownProps) {
  const picked = weeks.filter((week) => week.isVoid);
  const pickedValues = picked.map((week) => String(week.weekNo));
  // 공용 목록은 고른 값 전체를 넘기므로, 이전 값과 비교해 바뀐 주 하나를 찾아 알린다.
  const handleValueChange = (values: string[]) => {
    const added = values.find((value) => !pickedValues.includes(value));
    const removed = pickedValues.find((value) => !values.includes(value));
    if (added) onChange(Number(added), true);
    else if (removed) onChange(Number(removed), false);
  };
  const options = weeks.map((week) => ({
    value: String(week.weekNo),
    isDisabled: isFull && !week.isVoid,
    // 날짜는 옆 달력에 보이므로 목록에는 주차만 둔다. 화면 낭독기에는 날짜를 함께 읽힌다.
    label: (
      <>
        {week.displayNo}주차<span className="sr-only">{dateText(week)}</span>
      </>
    ),
  }));
  const list = (trigger: ReactNode) => (
    <CheckListPopover
      label={label}
      options={options}
      value={pickedValues}
      onValueChange={handleValueChange}
      trigger={trigger}
      align={isCompact ? 'center' : 'start'}
      isTriggerWidth={!isCompact}
    />
  );
  // 표 칸 안에서는 노션 속성처럼 칸 전체를 버튼 하나로 둔다: 비어 있으면 연한 회색 「비어 있음」,
  // 고르면 주차 글자다. 목록은 글자가 아니라 칸에 붙어 열려, 글자 길이가 바뀌어도 옆으로 움직이지 않는다.
  return isCompact
    ? list(
        <button
          type="button"
          aria-label={`${label}: ${picked.length === 0 ? '비어 있음' : pickedText(picked)}`}
          className="flex min-h-8 w-full cursor-pointer items-center justify-center rounded-sm px-2 text-xs tabular-nums transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 data-[state=open]:bg-slate-100"
        >
          {picked.length === 0 ? (
            <span className="text-slate-400">비어 있음</span>
          ) : (
            <span className="text-slate-900">{pickedText(picked)}</span>
          )}
        </button>,
      )
    : list(
        <button
          type="button"
          aria-label={label}
          className="group relative h-10 w-40 cursor-pointer rounded-sm border border-slate-200 bg-white pl-3 pr-9 text-left text-sm tabular-nums text-slate-800 shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400"
        >
          {pickedText(picked)}
          <ChevronDown
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180"
          />
        </button>,
      );
}
