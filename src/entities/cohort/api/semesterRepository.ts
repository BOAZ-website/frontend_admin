/**
 * 반기 관리 임시 DB 함수: 자동 명단, 저장된 명단, 일정(기간·활동별 시작일·무효 주차) 읽기·쓰기.
 * 임시 API(shared/api/mock/routes/semesterRoutes.ts)에서만 부른다(R8-6). 요청 검증은 임시 API가 먼저 한다.
 */
import type { Database } from 'sql.js';

import { execute, queryAll } from '@/shared/db/createDatabase';

import type {
  DateRange,
  RosterKind,
  SemesterActivity,
  SemesterRosterDto,
  SemesterScheduleDto,
  SemesterWeekDto,
} from '../model/dto';
import { ACTIVITY_WEEK_COUNT, activityWeekDates } from '../model/schedule';

type Period = '방학' | '학기';

/** 검증을 마친 일정. 임시 API가 요청 본문을 검사해 만든다. */
export interface SemesterScheduleInput {
  vacation: DateRange;
  term: DateRange;
  starts: Partial<Record<SemesterActivity, string>>;
  invalidWeeks: { activity: SemesterActivity; weekNum: number; reason: string }[];
}

/** 활동 안의 주차(1~8)가 반기 주차 표(1~16)에서 놓이는 번호. 학기 스터디만 방학 8주 뒤에 온다. */
const weekNumInSemester = (activity: SemesterActivity, weekNum: number): number =>
  activity === 'STUDY_TERM' ? weekNum + ACTIVITY_WEEK_COUNT : weekNum;

const kindOfTerm =
  (cohort: number, advTerm: number | null) =>
  (term: number): RosterKind =>
    term === cohort ? 'BASE' : term === advTerm ? 'ADV' : 'EXTRA';

type RosterRow = { userId: string; name: string; term: number; track: string };

/**
 * BASE·ADV 기수의 활동 중(ACTIVE) 회원. 준비 반기를 만들 때와 만들기 전 명단 확인(미리보기)에 쓰는 자동 명단이다.
 * 순서와 모양은 저장된 명단(listSemesterRoster)과 같다.
 */
export function listAutoRoster(db: Database, baseTerm: number, advTerm: number): SemesterRosterDto {
  const members = queryAll<RosterRow>(
    db,
    `SELECT u.id AS userId, u.name, u.term, u.track
       FROM users u LEFT JOIN tracks t ON t.name = u.track
      WHERE u.club_status = 'ACTIVE' AND u.term IN (?, ?)
      ORDER BY u.term DESC, t.sort_order, u.name`,
    [baseTerm, advTerm],
  ).map((row) => ({ ...row, kind: kindOfTerm(baseTerm, advTerm)(row.term) }));
  return { members };
}

/** 반기에 저장된 명단. 기수(큰 기수부터) → 부문 → 이름 순. BASE·ADV 기수가 아니면 EXTRA다. */
export function listSemesterRoster(
  db: Database,
  cohort: number,
  advTerm: number | null,
): SemesterRosterDto {
  const members = queryAll<RosterRow>(
    db,
    `SELECT m.user_id AS userId, m.name, m.term, m.track
       FROM semester_members m LEFT JOIN tracks t ON t.name = m.track
      WHERE m.cohort = ?
      ORDER BY m.term DESC, t.sort_order, m.name`,
    [cohort],
  ).map((row) => ({ ...row, kind: kindOfTerm(cohort, advTerm)(row.term) }));
  return { members };
}

/**
 * 반기 주차 표(1~16주차)의 주차마다 활동별 날짜와 휴강 활동. 주차 API가 출결 화면에 함께 돌려준다.
 * 시작일을 정하지 않은 활동은 날짜가 없다.
 */
export function listActivityWeekInfo(
  db: Database,
  cohort: number,
): Map<number, Pick<SemesterWeekDto, 'activityDates' | 'invalidActivities'>> {
  const info = new Map<number, Pick<SemesterWeekDto, 'activityDates' | 'invalidActivities'>>();
  const at = (weekNum: number) => {
    const current = info.get(weekNum) ?? { activityDates: {}, invalidActivities: [] };
    info.set(weekNum, current);
    return current;
  };
  queryAll<{ activity: SemesterActivity; start_date: string }>(
    db,
    'SELECT activity, start_date FROM semester_activity_starts WHERE cohort = ?',
    [cohort],
  ).forEach(({ activity, start_date }) =>
    activityWeekDates(start_date).forEach(({ weekNum, date }) => {
      const week = at(weekNumInSemester(activity, weekNum));
      week.activityDates = { ...week.activityDates, [activity]: date };
    }),
  );
  queryAll<{ activity: SemesterActivity; week_num: number }>(
    db,
    'SELECT activity, week_num FROM semester_invalid_weeks WHERE cohort = ? ORDER BY activity',
    [cohort],
  ).forEach(({ activity, week_num }) => {
    const week = at(weekNumInSemester(activity, week_num));
    week.invalidActivities = [...week.invalidActivities, activity];
  });
  return info;
}

/** 일정을 통째로 저장한다. cohort_week_dates는 BASE(없으면 방학 스터디)·학기 스터디 시작일로 다시 채운다. */
export function updateSemesterSchedule(
  db: Database,
  cohort: number,
  schedule: SemesterScheduleInput,
): void {
  const { vacation, term, starts, invalidWeeks } = schedule;
  execute(db, 'UPDATE cohorts SET start_date = ?, end_date = ? WHERE cohort = ?', [
    vacation.startDate,
    term.endDate,
    cohort,
  ]);
  execute(db, 'DELETE FROM semester_periods WHERE cohort = ?', [cohort]);
  const periods: [Period, DateRange][] = [
    ['방학', vacation],
    ['학기', term],
  ];
  periods.forEach(([period, range]) =>
    execute(
      db,
      'INSERT INTO semester_periods (cohort, period, start_date, end_date) VALUES (?, ?, ?, ?)',
      [cohort, period, range.startDate, range.endDate],
    ),
  );
  execute(db, 'DELETE FROM semester_activity_starts WHERE cohort = ?', [cohort]);
  Object.entries(starts).forEach(([activity, date]) =>
    execute(
      db,
      'INSERT INTO semester_activity_starts (cohort, activity, start_date) VALUES (?, ?, ?)',
      [cohort, activity, date],
    ),
  );
  execute(db, 'DELETE FROM semester_invalid_weeks WHERE cohort = ?', [cohort]);
  invalidWeeks.forEach((week) =>
    execute(
      db,
      'INSERT INTO semester_invalid_weeks (cohort, activity, week_num, reason) VALUES (?, ?, ?, ?)',
      [cohort, week.activity, week.weekNum, week.reason],
    ),
  );
  // 출결 생성 창·CSV는 cohort_week_dates를 읽는다. 1~8주차는 BASE(없으면 방학 스터디), 9~16주차는 학기 스터디.
  execute(db, 'DELETE FROM cohort_week_dates WHERE cohort = ?', [cohort]);
  const vacationStart = starts.BASE ?? starts.STUDY_VACATION;
  [
    ...(vacationStart ? activityWeekDates(vacationStart) : []),
    ...(starts.STUDY_TERM
      ? activityWeekDates(starts.STUDY_TERM).map((week) => ({
          ...week,
          weekNum: weekNumInSemester('STUDY_TERM', week.weekNum),
        }))
      : []),
  ].forEach((week) =>
    execute(db, 'INSERT INTO cohort_week_dates (cohort, week_num, date) VALUES (?, ?, ?)', [
      cohort,
      week.weekNum,
      week.date,
    ]),
  );
}

/** 반기 일정: 방학·학기 기간, 활동별 1주차 시작일과 주차 날짜, 무효 주차. 정하지 않은 기간은 null. */
export function findSemesterSchedule(db: Database, cohort: number): SemesterScheduleDto {
  const periods = queryAll<{ period: Period; start_date: string; end_date: string }>(
    db,
    'SELECT period, start_date, end_date FROM semester_periods WHERE cohort = ?',
    [cohort],
  );
  const rangeOf = (period: Period): DateRange | null => {
    const row = periods.find((item) => item.period === period);
    return row ? { startDate: row.start_date, endDate: row.end_date } : null;
  };
  const startRows = queryAll<{ activity: SemesterActivity; start_date: string }>(
    db,
    'SELECT activity, start_date FROM semester_activity_starts WHERE cohort = ?',
    [cohort],
  );
  const invalidWeeks = queryAll<{ activity: SemesterActivity; week_num: number; reason: string }>(
    db,
    'SELECT activity, week_num, reason FROM semester_invalid_weeks WHERE cohort = ? ORDER BY activity, week_num',
    [cohort],
  ).map((row) => ({ activity: row.activity, weekNum: row.week_num, reason: row.reason }));
  const startOf = (activity: SemesterActivity) =>
    startRows.find((row) => row.activity === activity)?.start_date ?? null;
  const weeksOf = (activity: SemesterActivity) => {
    const start = startOf(activity);
    return (start ? activityWeekDates(start) : []).map((week) => ({
      ...week,
      isInvalid: invalidWeeks.some(
        (invalid) => invalid.activity === activity && invalid.weekNum === week.weekNum,
      ),
    }));
  };
  const activityStarts: SemesterScheduleDto['activityStarts'] = {
    BASE: startOf('BASE'),
    ADV: startOf('ADV'),
    STUDY_VACATION: startOf('STUDY_VACATION'),
    STUDY_TERM: startOf('STUDY_TERM'),
  };
  const weeks: SemesterScheduleDto['weeks'] = {
    BASE: weeksOf('BASE'),
    ADV: weeksOf('ADV'),
    STUDY_VACATION: weeksOf('STUDY_VACATION'),
    STUDY_TERM: weeksOf('STUDY_TERM'),
  };
  return { vacation: rangeOf('방학'), term: rangeOf('학기'), activityStarts, invalidWeeks, weeks };
}
