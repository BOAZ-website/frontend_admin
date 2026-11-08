import { Fragment, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { SemesterActivity } from '@/entities/cohort/model/dto';
import type { UserTrack } from '@/entities/user/model/types';
import trackAnalysis from '@/shared/assets/tracks/track-analysis.png';
import trackEngineering from '@/shared/assets/tracks/track-engineering.png';
import trackVisualization from '@/shared/assets/tracks/track-visualization.png';
import { calendarDaysOf, isoOfLocalDate } from '@/shared/lib/calendar';
import { Tooltip } from '@/shared/ui/Tooltip';

import {
  type CalendarMark,
  calendarMarksOf,
  initialCalendarMonth,
  semesterWeekOf,
  TRACK_SESSION_DAYS,
} from '../model/calendarMarks';
import type { ScheduleForm } from '../model/scheduleForm';

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

/** 트랙 세션은 트랙 캐릭터로 보인다. BASE와 ADV는 같은 캐릭터이고 뒤의 둥근 네모 바탕색으로 가른다. */
const TRACK_IMAGE: Record<UserTrack, string> = {
  분석: trackAnalysis,
  시각화: trackVisualization,
  엔지니어링: trackEngineering,
};
/** 스터디는 아이콘 없이 월요일 칸 바탕색으로 보인다. 방학은 하늘, 학기는 분홍. 휴동 주차는 더 옅게. */
const STUDY_CELL_BG: Partial<Record<SemesterActivity, { active: string; invalid: string }>> = {
  STUDY_VACATION: { active: 'bg-sky-100', invalid: 'bg-sky-50' },
  STUDY_TERM: { active: 'bg-pink-100', invalid: 'bg-pink-50' },
};
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
    .map(
      (m) =>
        `${ACTIVITY_LABEL[m.activity]} ${m.weekNum}주차${m.track ? ` ${m.track}` : ''}${
          m.isInvalid ? ' 휴동' : ''
        }`,
    )
    .join(', ')}`;

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
      className={`inline-flex size-5 items-center justify-center rounded-[4px] ${
        SESSION_CHIP_BG[activity] ?? ''
      } ${isInvalid ? 'opacity-40' : ''}`}
    >
      <img
        src={TRACK_IMAGE[track]}
        alt=""
        width={16}
        height={16}
        className="size-4 object-contain"
      />
    </span>
  );
}

interface SemesterCalendarProps {
  form: ScheduleForm;
}

/**
 * 활동별 1주차 시작일에서 7일씩 더한 주차를 달력에 찍는다. 날짜는 화면에서 계산하고 서버 값은 시작일·휴동만 쓴다.
 * BASE·ADV는 트랙 세션 요일마다 트랙 캐릭터를 찍고, 스터디는 월요일 칸 바탕색으로 보인다. 휴동 주차는 흐리게, 날짜는 취소선으로 보인다.
 */
export function SemesterCalendar({ form }: SemesterCalendarProps) {
  const marks = calendarMarksOf(form);
  const firstMonth = initialCalendarMonth(marks, isoOfLocalDate(new Date()));
  const [month, setMonth] = useState<string | null>(null);
  const shownMonth = month ?? firstMonth;
  if (!shownMonth) return null;

  const [year, monthNumber] = shownMonth.split('-').map(Number);
  const days = calendarDaysOf(year, monthNumber - 1, FIRST_WEEKDAY);

  return (
    <div className="w-full lg:w-96">
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

      {/* 맨 왼쪽 열은 반기 주차(반기 시작일이 든 줄이 1주차)다. 달의 주차가 아니다. */}
      <div className="grid grid-cols-[1.5rem_repeat(7,minmax(0,1fr))] gap-1 text-center text-sm">
        <span className="py-1 text-xs text-slate-500" aria-hidden="true" />
        {HEADER_WEEKDAYS.map((day) => (
          <span key={day} className="py-1 text-slate-500">
            {day}
          </span>
        ))}
        {days.map((date, index) => {
          const isOtherMonth = date.slice(0, 7) !== shownMonth;
          const dayMarks = isOtherMonth ? [] : (marks[date] ?? []);
          const isAllInvalid = dayMarks.length > 0 && dayMarks.every((m) => m.isInvalid);
          const study = dayMarks.find((m) => !m.track);
          const studyBg = study && STUDY_CELL_BG[study.activity];
          const dayNumber = (
            <span
              className={`inline-flex w-10 justify-center tabular-nums ${
                isOtherMonth
                  ? 'text-transparent'
                  : isAllInvalid
                    ? 'text-slate-400 line-through'
                    : 'text-slate-900'
              }`}
            >
              {Number(date.slice(8))}
            </span>
          );
          const semesterWeek =
            index % HEADER_WEEKDAYS.length === 0
              ? semesterWeekOf(date, form.vacation.startDate, form.term.endDate)
              : undefined;
          return (
            <Fragment key={date}>
              {semesterWeek !== undefined && (
                // 이름표(aria-label)는 일반 span에서 화면 낭독기가 읽지 않으므로 숨긴 글자로 뜻을 붙인다.
                <span className="pt-1 text-xs tabular-nums text-slate-500">
                  {semesterWeek !== null && <span className="sr-only">반기 </span>}
                  {semesterWeek}
                  {semesterWeek !== null && <span className="sr-only">주차</span>}
                </span>
              )}
              <div
                className={`flex h-14 w-full flex-col items-center justify-start gap-1 rounded-md pt-1 ${
                  studyBg ? (study.isInvalid ? studyBg.invalid : studyBg.active) : ''
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
                <span className="flex gap-1" aria-hidden="true">
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
                {dayMarks.length > 0 && <span className="sr-only">{describe(date, dayMarks)}</span>}
              </div>
            </Fragment>
          );
        })}
      </div>

      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        {(['BASE', 'ADV'] as const).map((activity) => (
          <li key={activity} className="flex items-center gap-1">
            <span className={`inline-block size-3 rounded-sm ${SESSION_CHIP_BG[activity]}`} />
            {activity}
          </li>
        ))}
        {TRACK_SESSION_DAYS.map(({ track, weekday }) => (
          <li key={track} className="flex items-center gap-1">
            <img src={TRACK_IMAGE[track]} alt="" width={14} height={14} className="size-3.5" />
            {WEEKDAYS[weekday]} {track}
          </li>
        ))}
        {(['STUDY_VACATION', 'STUDY_TERM'] as const).map((activity) => (
          <li key={activity} className="flex items-center gap-1">
            <span className={`inline-block size-3 rounded-sm ${STUDY_CELL_BG[activity]?.active}`} />
            월 {ACTIVITY_LABEL[activity]}
          </li>
        ))}
        <li className="flex items-center gap-1">
          <span className="text-slate-400 line-through">7</span>
          휴동
        </li>
      </ul>
    </div>
  );
}
