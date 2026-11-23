/**
 * 반기 관리 임시 DB 함수: 일정(기간·활동별 시작일·공통 주차) 쓰기와 병행 수료 조건.
 * 임시 API(shared/api/mock/routes/seasonRoutes.ts)에서만 부른다(R8-6). 요청 검증은 임시 API가 먼저 한다.
 */
import type { Database } from 'sql.js';

import { execute, queryAll } from '@/shared/db/createDatabase';

import type { DateRange, SemesterActivity } from '../model/dto';
import { commonWeeksOf } from '../model/schedule';

type PeriodType = 'VACATION' | 'SEMESTER';

/** 검증을 마친 일정. 임시 API가 요청 본문을 검사해 만든다. */
export interface SemesterScheduleInput {
  vacation: DateRange;
  term: DateRange;
  starts: Partial<Record<SemesterActivity, string>>;
}

/**
 * 병행 수료 조건 하나: 같은 회원이 그 구분(BASE·ADV)으로, 지금 등록과 같은 병행 부문으로 등록했고 그 반기가 종료됐다.
 * 종료 반기는 진행·진행 예정이 아니고 지우지 않은 반기다.
 */
export const PARALLEL_DONE_SQL = (role: 'BASE' | 'ADV') =>
  `SELECT 1 FROM member_enrollment o JOIN cohorts oc ON oc.cohort = o.activity_season_id
    WHERE o.member_id = e.member_id AND o.season_role = '${role}' AND o.deleted_at IS NULL
      AND o.parallel_track = e.parallel_track
      AND oc.is_current = 0 AND oc.is_preparing = 0 AND oc.deleted_at IS NULL`;

/**
 * 기간·시작일을 통째로 저장한다. 출결 화면의 주차(semester_weeks·cohort_week_dates)와는 따로 관리한다.
 * 기간이 줄어 없어진 공통 주차의 휴강은 지운다.
 */
export function updateSemesterSchedule(
  db: Database,
  cohort: number,
  schedule: SemesterScheduleInput,
): void {
  const { vacation, term, starts } = schedule;
  execute(db, 'UPDATE cohorts SET start_date = ?, end_date = ? WHERE cohort = ?', [
    vacation.startDate,
    term.endDate,
    cohort,
  ]);
  execute(
    db,
    `UPDATE cohorts SET base_start_on = ?, adv_start_on = ?, vacation_study_start_on = ?,
                        semester_study_start_on = ?
      WHERE cohort = ?`,
    [
      starts.BASE ?? null,
      starts.ADV ?? null,
      starts.STUDY_VACATION ?? null,
      starts.STUDY_TERM ?? null,
      cohort,
    ],
  );
  // 기간과 공통 주차를 다시 만든다. 같은 주차 번호의 휴강은 남기고, 없어진 주차의 휴강은 버린다.
  const voidWeekNos = new Set(
    queryAll<{ week_no: number }>(
      db,
      'SELECT week_no FROM season_week WHERE activity_season_id = ? AND is_void = 1',
      [cohort],
    ).map((row) => row.week_no),
  );
  execute(db, 'DELETE FROM season_week WHERE activity_season_id = ?', [cohort]);
  execute(db, 'DELETE FROM season_period WHERE activity_season_id = ?', [cohort]);
  const periodIds: Record<PeriodType, number> = { VACATION: 0, SEMESTER: 0 };
  (
    [
      ['VACATION', vacation],
      ['SEMESTER', term],
    ] as const
  ).forEach(([periodType, range]) => {
    execute(
      db,
      `INSERT INTO season_period (activity_season_id, period_type, start_date, end_date)
       VALUES (?, ?, ?, ?)`,
      [cohort, periodType, range.startDate, range.endDate],
    );
    periodIds[periodType] = queryAll<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')[0].id;
  });
  commonWeeksOf(vacation, term).forEach((week) =>
    execute(
      db,
      `INSERT INTO season_week (activity_season_id, period_id, week_no, start_date, end_date, is_void)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        cohort,
        periodIds[week.periodType],
        week.weekNo,
        week.startDate,
        week.endDate,
        voidWeekNos.has(week.weekNo) ? 1 : 0,
      ],
    ),
  );
}
