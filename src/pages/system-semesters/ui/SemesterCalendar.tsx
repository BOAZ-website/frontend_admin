import { Fragment, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { SemesterActivity } from '@/entities/cohort/model/dto';
import type { UserTrack } from '@/entities/user/model/types';
import { TRACK_IMAGE } from '@/entities/user/model/trackImage';
import { calendarDaysOf, isoOfLocalDate } from '@/shared/lib/calendar';
import { Tooltip } from '@/shared/ui/Tooltip';

import { type CalendarMark, calendarMarksOf, initialCalendarMonth } from '../model/calendarMarks';
import { commonWeeksOfForm, type ScheduleForm } from '../model/scheduleForm';

/** 요일 이름(Date.getDay() 순서, 0=일요일). */
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
/** 달력은 구글 달력처럼 월요일부터 시작한다. */
const FIRST_WEEKDAY = 1;
const HEADER_WEEKDAYS = [...WEEKDAYS.slice(FIRST_WEEKDAY), ...WEEKDAYS.slice(0, FIRST_WEEKDAY)];

const ACTIVITY_LABEL: Record<SemesterActivity, string> = {
  BASE: 'BASE',
  ADV: 'ADV',
  STUDY_VACATION: '방학 스터디',
  STUDY_TERM: '학기 스터디',
};

/* 트랙 세션은 트랙 캐릭터(TRACK_IMAGE)로 보인다. BASE와 ADV는 같은 캐릭터이고 뒤의 둥근 네모 바탕색으로 가른다. */
/** 스터디는 아이콘 없이 월요일 칸 바탕색으로 보인다. 방학은 하늘, 학기는 분홍. */
const STUDY_CELL_BG: Partial<Record<SemesterActivity, string>> = {
  STUDY_VACATION: 'bg-sky-100',
  STUDY_TERM: 'bg-pink-100',
};
/** 앞뒤 달 날짜 칸의 스터디 바탕: 이번 달 칸보다 옅게. */
const STUDY_CELL_BG_FAINT: Partial<Record<SemesterActivity, string>> = {
  STUDY_VACATION: 'bg-sky-50',
  STUDY_TERM: 'bg-pink-50',
};
/** 그날 활동이 모두 휴강이면 칸 바탕을 회색으로 칠한다. 범례·휴강 주차 칸과 같은 색이다. */
const BREAK_CELL_BG = 'bg-slate-200/50';
/** 트랙 캐릭터 뒤 둥근 네모: BASE는 흰 바탕(흰 칸에서도 보이게 테두리), ADV는 검은 바탕. */
const SESSION_CHIP_BG: Partial<Record<SemesterActivity, string>> = {
  BASE: 'border border-slate-200 bg-white',
  ADV: 'bg-slate-900',
};

const NAV_BTN =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900';

/** 'YYYY-MM'에 달 수를 더한다. */
const shiftMonth = (month: string, delta: number): string => {
  const [year, monthIndex] = month.split('-').map(Number);
  return isoOfLocalDate(new Date(year, monthIndex - 1 + delta, 1)).slice(0, 7);
};

const describe = (date: string, marks: readonly CalendarMark[]) =>
  `${date} ${marks
    .map((m) =>
      m.isInvalid
        ? `${ACTIVITY_LABEL[m.activity]}${m.track ? ` ${m.track}` : ''} 휴강`
        : `${ACTIVITY_LABEL[m.activity]} ${m.weekNum}주차${m.track ? ` ${m.track}` : ''}`,
    )
    .join(', ')}`;

/** 달력 한 줄(월~일)의 BASE·ADV 주차 글자. 둘이 같으면 'N주차', 다르면 활동마다 한 줄. 세션이 없는 주(휴강 등)는 빈 배열. */
const rowWeekLabels = (
  rowDates: readonly string[],
  marks: Readonly<Record<string, CalendarMark[]>>,
): string[] => {
  const weekOf = (activity: SemesterActivity) =>
    rowDates
      .flatMap((date) => marks[date] ?? [])
      .find((m) => m.activity === activity && !m.isInvalid)?.weekNum;
  const base = weekOf('BASE');
  const adv = weekOf('ADV');
  if (base === adv) return base === undefined ? [] : [`${base}주차`];
  return [
    ...(base === undefined ? [] : [`BASE ${base}`]),
    ...(adv === undefined ? [] : [`ADV ${adv}`]),
  ];
};

/** 트랙 세션 표시 하나: BASE·ADV 바탕색 네모 안의 트랙 캐릭터. */
// 모서리 4px: 이 프로젝트의 rounded-sm(8px)은 20px 네모에 너무 둥글고 rounded-xs(2px)는 너무 각져서 값을 직접 준다.
function SessionIcon({
  activity,
  track,
  isInvalid,
}: {
  activity: SemesterActivity;
  track: UserTrack;
  isInvalid: boolean;
}) {
  return (
    <span
      className={`inline-flex size-4 items-center justify-center rounded-[4px] ${
        SESSION_CHIP_BG[activity] ?? ''
      } ${isInvalid ? 'opacity-40' : ''}`}
    >
      <img
        src={TRACK_IMAGE[track]}
        alt=""
        width={12}
        height={12}
        className="size-3 object-contain"
      />
    </span>
  );
}

interface SemesterCalendarProps {
  form: ScheduleForm;
  /** 처음 보일 달(`YYYY-MM`). 휴강 주차를 고르면 그 달을 보이게 한다. 바뀔 때 다시 보이려면 key도 바꾼다. */
  focusMonth?: string;
}

/**
 * 활동별 1주차 시작일에서 7일씩 더한 주차를 달력에 찍는다. 날짜는 화면에서 계산하고 서버 값은 시작일·휴강만 쓴다.
 * BASE·ADV는 트랙 세션 요일마다 트랙 캐릭터를 찍고, 스터디는 월요일 칸 바탕색으로 보인다. 휴강 주차는 흐리게, 날짜는 취소선으로 보인다.
 */
export function SemesterCalendar({ form, focusMonth }: SemesterCalendarProps) {
  const marks = calendarMarksOf(form);
  const voidWeeks = commonWeeksOfForm(form).filter((week) => week.isVoid);
  const firstMonth = initialCalendarMonth(marks, isoOfLocalDate(new Date()));
  const [month, setMonth] = useState<string | null>(null);
  const shownMonth = month ?? focusMonth ?? firstMonth;
  if (!shownMonth) return null;

  const [year, monthNumber] = shownMonth.split('-').map(Number);
  const days = calendarDaysOf(year, monthNumber - 1, FIRST_WEEKDAY);

  return (
    <div className="w-full @min-[42rem]:w-[18rem] @min-[51rem]:w-[22rem]">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className={NAV_BTN}
          aria-label="이전 달"
          onClick={() => setMonth(shiftMonth(shownMonth, -1))}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="text-base font-semibold tabular-nums text-slate-900" aria-live="polite">
          {year}년 {monthNumber}월
        </span>
        <button
          type="button"
          className={NAV_BTN}
          aria-label="다음 달"
          onClick={() => setMonth(shiftMonth(shownMonth, 1))}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      {/* 가로 칸 사이를 띄우지 않아 휴강 주(월~일)가 한 줄의 회색 띠로 이어진다. */}
      {/* 맨 앞 열은 그 줄(월~일)의 BASE·ADV 주차다. */}
      <div className="grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-y-1 text-center text-sm">
        <span className="py-1 text-xs text-slate-400">주차</span>
        {HEADER_WEEKDAYS.map((day) => (
          <span key={day} className="py-1 text-slate-500">
            {day}
          </span>
        ))}
        {days.map((date, index) => {
          const isOtherMonth = date.slice(0, 7) !== shownMonth;
          // 한 줄 전체가 다른 달이면 날짜를 보이지 않는다. 줄은 그대로 두어 달력 높이(6줄)가 달마다 바뀌지 않게 한다.
          const rowStart = index - (index % HEADER_WEEKDAYS.length);
          const isOtherMonthRow = days
            .slice(rowStart, rowStart + HEADER_WEEKDAYS.length)
            .every((day) => day.slice(0, 7) !== shownMonth);
          // 휴강은 공통 주차(월~일) 단위라 그 주 전체를 회색 띠로 보인다. 다른 달 날짜 칸도 칠해 띠가 끊기지 않게 하고, 양 끝만 둥글게 한다.
          const isVoidDay = voidWeeks.some(
            (week) => week.startDate <= date && date <= week.endDate,
          );
          const weekday = index % HEADER_WEEKDAYS.length;
          // 앞뒤 달 날짜도 그 줄이 보이면 세션을 흐리게 찍는다. 줄 전체가 다른 달이면 찍지 않는다.
          const dayMarks = isOtherMonthRow ? [] : (marks[date] ?? []);
          const isAllInvalid = dayMarks.length > 0 && dayMarks.every((m) => m.isInvalid);
          const study = dayMarks.find((m) => !m.track);
          const studyBg =
            study && (isOtherMonth ? STUDY_CELL_BG_FAINT : STUDY_CELL_BG)[study.activity];
          // 휴강 주 안의 스터디 칸: 회색 띠 안에 스터디 색 상자를 둔다.
          const hasStudyBox = isVoidDay && study !== undefined;
          const dayNumber = (
            <span
              className={`inline-flex w-10 justify-center tabular-nums ${
                isOtherMonthRow
                  ? 'text-transparent'
                  : isOtherMonth
                    ? 'text-slate-300'
                    : isAllInvalid || (isVoidDay && !hasStudyBox)
                      ? 'text-slate-500'
                      : 'text-slate-900'
              }`}
            >
              {Number(date.slice(8))}
            </span>
          );
          const rowDates = days.slice(rowStart, rowStart + HEADER_WEEKDAYS.length);
          return (
            <Fragment key={date}>
              {weekday === 0 && (
                <span className="flex h-14 flex-col items-center justify-center text-[11px] leading-tight tabular-nums text-slate-500">
                  {!isOtherMonthRow &&
                    rowWeekLabels(rowDates, marks).map((label) => <span key={label}>{label}</span>)}
                </span>
              )}
              {/* 휴강 주는 칸 전체를 회색 띠로 칠한다. 그 주의 스터디 칸은 회색 띠 안에 스터디 색 상자로 따로 보인다.
                  스터디 휴강은 스터디장이 출결 입력 탭에서 정하므로 공통 휴강에 묶이지 않기 때문이다. */}
              <div
                className={`h-14 w-full ${
                  isVoidDay
                    ? `${BREAK_CELL_BG} ${weekday === 0 ? 'rounded-l-md' : ''} ${
                        weekday === HEADER_WEEKDAYS.length - 1 ? 'rounded-r-md' : ''
                      } ${hasStudyBox ? 'p-1' : ''}`
                    : ''
                }`}
              >
                <div
                  className={`flex h-full w-full flex-col items-center justify-start gap-1 rounded-md ${
                    hasStudyBox ? '' : 'pt-1'
                  } ${
                    hasStudyBox
                      ? (studyBg ?? '')
                      : isVoidDay
                        ? ''
                        : isAllInvalid
                          ? BREAK_CELL_BG
                          : study && !study.isInvalid
                            ? (studyBg ?? '')
                            : ''
                  }`}
                >
                  {/* 스터디는 날짜 숫자 줄에 말풍선을 붙인다. 아이콘 말풍선과 겹치지 않게 아이콘 줄과 나눈다. */}
                  {study ? (
                    <Tooltip
                      label={`${ACTIVITY_LABEL[study.activity]} ${study.weekNum}주차`}
                      side="top"
                    >
                      {dayNumber}
                    </Tooltip>
                  ) : (
                    dayNumber
                  )}
                  <span
                    className={`flex gap-0.5 ${isOtherMonth ? 'opacity-40' : ''}`}
                    aria-hidden="true"
                  >
                    {/* 아이콘마다 공용 말풍선을 붙여 '활동 트랙'(예: 'BASE 엔지니어링')을 보인다. 주차는 칸의 숨긴 글자(sr-only)에 남긴다. */}
                    {dayMarks.map(
                      ({ activity, track, isInvalid }) =>
                        track && (
                          <Tooltip
                            key={activity}
                            label={`${ACTIVITY_LABEL[activity]} ${track}`}
                            side="top"
                          >
                            <SessionIcon activity={activity} track={track} isInvalid={isInvalid} />
                          </Tooltip>
                        ),
                    )}
                  </span>
                  {/* 아이콘·말풍선은 화면 낭독기에 닿지 않으므로 활동·주차·트랙을 숨긴 글자로 읽힌다. */}
                  {dayMarks.length > 0 && (
                    <span className="sr-only">{describe(date, dayMarks)}</span>
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>

      {/* 범례는 활동 색과 휴강만 둔다. 트랙·요일은 칸에 마우스를 올리면 말풍선으로 보인다. */}
      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        {(['BASE', 'ADV'] as const).map((activity) => (
          <li key={activity} className="flex items-center gap-1">
            <span className={`inline-block size-3 rounded-sm ${SESSION_CHIP_BG[activity]}`} />
            {activity}
          </li>
        ))}
        {(['STUDY_VACATION', 'STUDY_TERM'] as const).map((activity) => (
          <li key={activity} className="flex items-center gap-1">
            <span className={`inline-block size-3 rounded-sm ${STUDY_CELL_BG[activity]}`} />
            {ACTIVITY_LABEL[activity]}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className={`inline-block size-3 rounded-sm ${BREAK_CELL_BG}`} />
          휴강
        </li>
      </ul>
    </div>
  );
}
