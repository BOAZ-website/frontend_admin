import type { SemesterActivity } from '@/entities/cohort/model/dto';
import type { UserTrack } from '@/entities/user/model/types';
import { isoOfLocalDate, localDateOfIso } from '@/shared/lib/calendar';

import { ACTIVITIES, invalidKey, type ScheduleForm, weekDatesByActivity } from './scheduleForm';

/** 달력 한 칸에 찍을 활동 표시 하나. */
export interface CalendarMark {
  activity: SemesterActivity;
  weekNum: number;
  /** 휴동으로 지정한 주차다. */
  isInvalid: boolean;
  /** BASE·ADV의 트랙 세션이다. 스터디는 없다. */
  track?: UserTrack;
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
 */
export function calendarMarksOf(form: ScheduleForm): Record<string, CalendarMark[]> {
  const datesOf = weekDatesByActivity(form);
  const marks: Record<string, CalendarMark[]> = {};
  for (const { value: activity } of ACTIVITIES) {
    for (const [week, date] of Object.entries(datesOf[activity])) {
      const weekNum = Number(week);
      const isInvalid = invalidKey(activity, weekNum) in form.invalid;
      const sessions = sessionsOfWeek(
        date,
        TRACK_ACTIVITIES.has(activity) ? TRACK_SESSION_DAYS : STUDY_SESSION_DAYS,
      );
      for (const { date: sessionDate, ...track } of sessions) {
        const mark = { activity, weekNum, isInvalid, ...track };
        marks[sessionDate] = [...(marks[sessionDate] ?? []), mark];
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * 월요일부터 시작하는 달력 한 줄의 반기 주차. 반기 시작일(방학 시작일)이 든 줄이 1주차다.
 * 반기 시작일이 없거나, 그 줄이 반기 시작 전이거나 반기 종료일 뒤에 시작하면 null.
 */
export function semesterWeekOf(
  rowMonday: string,
  semesterStart: string,
  semesterEnd: string,
): number | null {
  if (!semesterStart) return null;
  const start = localDateOfIso(semesterStart);
  const startMonday = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() - ((start.getDay() + 6) % 7),
  );
  const days = Math.round(
    (localDateOfIso(rowMonday).getTime() - startMonday.getTime()) / MS_PER_DAY,
  );
  const week = Math.floor(days / DAYS_PER_WEEK) + 1;
  if (week < 1 || (semesterEnd && rowMonday > semesterEnd)) return null;
  return week;
}

/** 활동별 첫 세션·마지막 세션 날짜(달력에 찍히는 날짜와 같다). 시작일을 정하지 않은 활동은 빠진다. */
export function activitySpansOf(
  marks: Readonly<Record<string, CalendarMark[]>>,
): Partial<Record<SemesterActivity, { first: string; last: string }>> {
  const spans: Partial<Record<SemesterActivity, { first: string; last: string }>> = {};
  for (const date of Object.keys(marks).sort()) {
    for (const { activity } of marks[date]) {
      spans[activity] = { first: spans[activity]?.first ?? date, last: date };
    }
  }
  return spans;
}
