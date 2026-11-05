/** 활동별 주차 날짜 계산. 화면 미리보기와 임시 API가 같은 함수를 쓴다. */

/** 활동마다 주차 수(기존 weeks 표: 방학 1~8, 학기 9~16주차와 같은 8주). */
export const ACTIVITY_WEEK_COUNT = 8;

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;

/** 시작일에서 7일씩 더한 주차별 날짜. 시작일이 날짜 형식이 아니면 빈 배열. */
export function activityWeekDates(startDate: string): { weekNum: number; date: string }[] {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start)) return [];
  return Array.from({ length: ACTIVITY_WEEK_COUNT }, (_, index) => ({
    weekNum: index + 1,
    date: new Date(start + index * WEEK_DAYS * DAY_MS).toISOString().slice(0, 10),
  }));
}
