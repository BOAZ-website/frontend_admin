import type { SemesterActivity } from '@/entities/cohort/model/dto';
import type { UserTrack } from '@/entities/user/model/types';
import { isoOfLocalDate, localDateOfIso } from '@/shared/lib/calendar';

import {
  ACTIVITIES,
  commonWeeksOfForm,
  type ScheduleForm,
  weekDatesByActivity,
} from './scheduleForm';

/** 달력 한 칸에 찍을 활동 표시 하나. */
export interface CalendarMark {
  activity: SemesterActivity;
  weekNum: number;
  /** 세션 날짜가 휴강 공통 주차 안이다. */
  isInvalid: boolean;
  /** BASE·ADV의 트랙 세션이다. 스터디는 없다. */
  track?: UserTrack;
  /** 휴강 주라 열리지 않는 BASE·ADV 세션 자리다. 그 주에 무엇을 쉬는지 흐리게 보이려고 둔다. 주차가 없어 weekNum은 0이다. */
  isBreak?: true;
}

/**
 * BASE·ADV 트랙 세션 요일(0=일요일). BASE와 ADV가 같다.
 * shortcut: 서버에 트랙 요일 값이 없어 화면 상수로 둔다, 반기마다 바뀌게 되면 반기 일정 API로 옮긴다.
 */
export const TRACK_SESSION_DAYS: readonly { track: UserTrack; weekday: number }[] = [
  { track: '시각화', weekday: 1 },
  { track: '엔지니어링', weekday: 3 },
  { track: '분석', weekday: 4 },
];
/** 스터디는 주차마다 월요일 하루만 찍는다. */
const STUDY_SESSION_DAYS: readonly { track?: UserTrack; weekday: number }[] = [{ weekday: 1 }];
const TRACK_ACTIVITIES: ReadonlySet<SemesterActivity> = new Set(['BASE', 'ADV']);
const DAYS_PER_WEEK = 7;

/** 주차 시작일부터 7일 안에서 세션 요일에 해당하는 날짜(트랙 세션이면 트랙도). */
const sessionsOfWeek = (
  weekStart: string,
  sessionDays: readonly { track?: UserTrack; weekday: number }[],
): { date: string; track?: UserTrack }[] => {
  const start = localDateOfIso(weekStart);
  return Array.from({ length: DAYS_PER_WEEK }, (_, offset) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const session = sessionDays.find(({ weekday }) => weekday === day.getDay());
    return session && { date: isoOfLocalDate(day), ...(session.track && { track: session.track }) };
  }).filter((session) => session !== undefined);
};

/**
 * 활동별 1주차 시작일에서 7일씩 더한 주차를 날짜별로 모은다: 'YYYY-MM-DD' → 표시 목록.
 * 주차 시작일부터 7일 안에서 BASE·ADV는 트랙 세션 요일마다, 스터디는 월요일 하루에 찍는다.
 * 시작일을 정하지 않은 활동은 빠진다. 같은 날 여러 활동이면 ACTIVITIES 순서(BASE → ADV → 스터디)로 둔다.
 * 휴강은 공통 주차 단위라, BASE·ADV 세션 날짜가 휴강 주(월~일) 안이면 휴강으로 표시한다.
 * BASE·ADV 기간 안의 휴강 주에는 쉬는 세션 자리를 isBreak 표시로 함께 찍는다(요약 표 범위에는 넣지 않는다).
 * 스터디는 휴강을 스터디장이 출결 입력 탭에서 따로 정하므로 여기서 휴강으로 표시하지 않는다.
 */
export function calendarMarksOf(form: ScheduleForm): Record<string, CalendarMark[]> {
  const datesOf = weekDatesByActivity(form);
  const voidWeeks = commonWeeksOfForm(form).filter((week) => week.isVoid);
  const isVoidDate = (date: string) =>
    voidWeeks.some((week) => week.startDate <= date && date <= week.endDate);
  const marks: Record<string, CalendarMark[]> = {};
  for (const { value: activity } of ACTIVITIES) {
    for (const [week, date] of Object.entries(datesOf[activity])) {
      const weekNum = Number(week);
      const sessions = sessionsOfWeek(
        date,
        TRACK_ACTIVITIES.has(activity) ? TRACK_SESSION_DAYS : STUDY_SESSION_DAYS,
      );
      for (const { date: sessionDate, ...track } of sessions) {
        const mark = {
          activity,
          weekNum,
          isInvalid: TRACK_ACTIVITIES.has(activity) && isVoidDate(sessionDate),
          ...track,
        };
        marks[sessionDate] = [...(marks[sessionDate] ?? []), mark];
      }
    }
    // BASE·ADV는 휴강 주를 건너뛰므로, 활동 기간 안의 휴강 주에는 쉬는 세션 자리를 흐리게 찍는다.
    const dates = Object.values(datesOf[activity]);
    if (!TRACK_ACTIVITIES.has(activity) || dates.length === 0) continue;
    for (const week of voidWeeks.filter(
      (week) => dates[0] <= week.startDate && week.endDate <= dates[dates.length - 1],
    )) {
      for (const { date, ...track } of sessionsOfWeek(week.startDate, TRACK_SESSION_DAYS)) {
        const isMarked = (marks[date] ?? []).some(
          (m) => m.activity === activity && m.track === track.track,
        );
        if (isMarked) continue;
        const mark = { activity, weekNum: 0, isInvalid: true, ...track, isBreak: true as const };
        marks[date] = [...(marks[date] ?? []), mark];
      }
    }
  }
  return marks;
}

/** 달력을 처음 열 달('YYYY-MM'). 오늘이 활동 날짜 범위 안이면 이번 달, 아니면 첫 활동 날짜의 달이다. 활동이 없으면 null. */
export function initialCalendarMonth(
  marks: Readonly<Record<string, CalendarMark[]>>,
  today: string,
): string | null {
  const dates = Object.keys(marks).sort();
  if (dates.length === 0) return null;
  const isTodayInRange = today >= dates[0] && today <= dates[dates.length - 1];
  return (isTodayInRange ? today : dates[0]).slice(0, 7);
}

/** 요약 표 한 행: 활동의 주차 범위와 첫·마지막 세션 날짜(달력에 찍히는 날짜와 같다). */
export interface ActivityRow {
  activity: SemesterActivity;
  firstWeek: number;
  lastWeek: number;
  first: string;
  last: string;
}

/**
 * 시작일을 정한 활동마다 한 행. 순서는 ACTIVITIES와 같고, 시작일이 없는 활동은 빠진다.
 * range를 주면 그 기간(방학·학기) 안의 세션만 보고, 그 기간에 세션이 없는 활동은 빠진다.
 */
export function activityRowsOf(
  marks: Readonly<Record<string, CalendarMark[]>>,
  range?: { startDate: string; endDate: string },
): ActivityRow[] {
  const dates = Object.keys(marks)
    .filter((date) => !range || (range.startDate <= date && date <= range.endDate))
    .sort();
  return ACTIVITIES.flatMap(({ value: activity }) => {
    const sessions = dates.flatMap((date) =>
      marks[date]
        .filter((mark) => mark.activity === activity && !mark.isBreak)
        .map(({ weekNum }) => ({ date, weekNum })),
    );
    if (sessions.length === 0) return [];
    const weeks = sessions.map(({ weekNum }) => weekNum);
    return [
      {
        activity,
        firstWeek: Math.min(...weeks),
        lastWeek: Math.max(...weeks),
        first: sessions[0].date,
        last: sessions[sessions.length - 1].date,
      },
    ];
  });
}
