/** 활동별 주차 날짜·공통 주차 계산. 화면 미리보기와 임시 API가 같은 함수를 쓴다. */
import type { CommonWeek, DateRange, SemesterActivity } from './dto';

/** 스터디(방학·학기 따로)의 주차 수. */
export const ACTIVITY_WEEK_COUNT = 8;
/** BASE·ADV의 주차 수: 방학·학기를 이어 1~16주차(기존 weeks 표와 같다). */
export const TERM_WEEK_COUNT = 16;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;

const isoOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** 날짜가 든 주의 월요일(UTC 기준 날짜 계산). 날짜 형식이 아니면 NaN. */
const mondayOf = (date: string): number => {
  const ms = Date.parse(`${date}T00:00:00Z`);
  const weekday = new Date(ms).getUTCDay(); // 0=일
  return ms - ((weekday + 6) % WEEK_DAYS) * DAY_MS;
};

/**
 * 방학·학기 기간을 월~일 주로 나눈 공통 주차. 기간의 시작일·종료일이 걸친 주를 모두 넣고, 반기 전체에 이어 번호를 매긴다.
 * 방학과 학기 사이의 빈 주는 주차가 아니다(백엔드 ATT-03 season_week와 같은 규칙). 기간이 비었거나 형식이 틀리면 그 기간은 빠진다.
 */
export function commonWeeksOf(vacation: DateRange, term: DateRange): CommonWeek[] {
  const weeks: CommonWeek[] = [];
  const periods = [
    ['VACATION', vacation],
    ['SEMESTER', term],
  ] as const;
  for (const [periodType, { startDate, endDate }] of periods) {
    const first = mondayOf(startDate);
    const last = Date.parse(`${endDate}T00:00:00Z`);
    if (Number.isNaN(first) || Number.isNaN(last) || first > last) continue;
    for (let monday = first; monday <= last; monday += WEEK_DAYS * DAY_MS) {
      // 앞 기간과 같은 주는 다시 세지 않는다(방학 끝 주와 학기 첫 주가 겹칠 때).
      if (weeks.some((week) => week.startDate === isoOf(monday))) continue;
      weeks.push({
        weekNo: weeks.length + 1,
        periodType,
        startDate: isoOf(monday),
        endDate: isoOf(monday + (WEEK_DAYS - 1) * DAY_MS),
      });
    }
  }
  return weeks;
}

/** 확정 전(새 반기 만들기) 고를 수 있는 휴강 주차 수(백엔드 ATT-82·03). 확정 뒤에는 한도가 없다. */
export const MAX_VOID_WEEKS_BEFORE_CONFIRM = 2;

/** 시작일에서 7일씩 더한 주차별 날짜(weekCount주). 시작일이 날짜 형식이 아니면 빈 배열. */
export function activityWeekDates(
  startDate: string,
  weekCount: number = ACTIVITY_WEEK_COUNT,
): { weekNum: number; date: string }[] {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start)) return [];
  return Array.from({ length: weekCount }, (_, index) => ({
    weekNum: index + 1,
    date: new Date(start + index * WEEK_DAYS * DAY_MS).toISOString().slice(0, 10),
  }));
}

/**
 * 1주차 시작일을 따로 정하는 활동과 주차 수. BASE·ADV는 방학·학기를 이어 시작일 하나로 1~16주차
 * (출결 화면의 방학 1~8, 학기 9~16주차와 같다), 스터디는 방학·학기 따로 1~8주차다.
 */
export const SEMESTER_ACTIVITY_INFO: readonly {
  value: SemesterActivity;
  label: string;
  weekCount: number;
}[] = [
  { value: 'BASE', label: 'BASE', weekCount: TERM_WEEK_COUNT },
  { value: 'ADV', label: 'ADV', weekCount: TERM_WEEK_COUNT },
  { value: 'STUDY_VACATION', label: '방학 스터디', weekCount: ACTIVITY_WEEK_COUNT },
  { value: 'STUDY_TERM', label: '학기 스터디', weekCount: ACTIVITY_WEEK_COUNT },
];

/** 활동의 주차 수(BASE·ADV 16, 스터디 8). */
export const weekCountOf = (activity: SemesterActivity): number =>
  SEMESTER_ACTIVITY_INFO.find(({ value }) => value === activity)?.weekCount ?? ACTIVITY_WEEK_COUNT;

/** 기간의 최소 길이(주). 방학은 7주, 학기는 10주보다 짧게 정할 수 없다. */
export const MIN_PERIOD_WEEKS = { vacation: 7, term: 10 } as const;

const DAYS_PER_WEEK = 7;

/** 기간(시작일·종료일 포함)이 weeks주보다 짧은지. 날짜 형식이 아니면 false(형식 검사는 따로 한다). */
export function isShorterThanWeeks({ startDate, endDate }: DateRange, weeks: number): boolean {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return (end - start) / DAY_MS + 1 < weeks * DAYS_PER_WEEK;
}
