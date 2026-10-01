import type { Database } from 'sql.js';

import { execute, inTransaction, queryAll } from '@/shared/db/createDatabase';

/**
 * 임시 DB의 cohorts 테이블에서 활동 기수 목록을 큰 기수부터 읽는다.
 * 백엔드가 붙으면 이 함수만 기수 목록 API 호출로 바꾸면 되고, 반환 형태(number[])는 그대로 둔다.
 */
export function loadCohorts(db: Database): number[] {
  return queryAll<{ cohort: number }>(db, 'SELECT cohort FROM cohorts ORDER BY cohort DESC').map(
    (row) => row.cohort,
  );
}

/** 기수 → (주차 번호 → YYYY-MM-DD). 날짜를 정하지 않은 주차는 없다. */
export type CohortWeekDates = Record<number, Record<number, string>>;

/** 임시 DB의 cohort_week_dates에서 기수별 주차 날짜를 읽는다. 백엔드가 붙으면 이 함수만 API 호출로 바꾼다. */
export function loadWeekDates(db: Database): CohortWeekDates {
  const result: CohortWeekDates = {};
  queryAll<{ cohort: number; week_num: number; date: string }>(
    db,
    'SELECT cohort, week_num, date FROM cohort_week_dates ORDER BY cohort, week_num',
  ).forEach((row) => {
    result[row.cohort] = { ...(result[row.cohort] ?? {}), [row.week_num]: row.date };
  });
  return result;
}

/** 화면 상태의 변경(이전 값 → 다음 값)을 받아 바뀐 기수·주차만 DB에 저장한다(없어진 주차는 삭제). */
export function persistWeekDates(db: Database, prev: CohortWeekDates, next: CohortWeekDates): void {
  inTransaction(db, () => {
    const cohorts = new Set([...Object.keys(prev), ...Object.keys(next)].map(Number));
    cohorts.forEach((cohort) => {
      const before = prev[cohort] ?? {};
      const after = next[cohort] ?? {};
      Object.keys(before)
        .map(Number)
        .filter((week) => !(week in after))
        .forEach((week) =>
          execute(db, 'DELETE FROM cohort_week_dates WHERE cohort = ? AND week_num = ?', [
            cohort,
            week,
          ]),
        );
      Object.entries(after)
        .filter(([week, date]) => before[Number(week)] !== date)
        .forEach(([week, date]) =>
          execute(
            db,
            `INSERT INTO cohort_week_dates (cohort, week_num, date) VALUES (?, ?, ?)
             ON CONFLICT(cohort, week_num) DO UPDATE SET date = excluded.date`,
            [cohort, Number(week), date],
          ),
        );
    });
  });
}
