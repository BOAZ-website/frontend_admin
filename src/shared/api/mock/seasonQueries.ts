/**
 * 반기 관리 임시 API(routes/seasonRoutes.ts)가 응답을 만드는 읽기 함수. 응답 모양은 백엔드 명세 그대로다(model/seasonDto.ts).
 * 반기 id는 임시 DB의 cohorts.cohort(BASE 기수)다.
 */
import type { Database } from 'sql.js';

import { PARALLEL_DONE_SQL } from '@/entities/cohort/api/semesterRepository';
import { VALUE_OF_TRACK } from '@/entities/cohort/model/season';
import type {
  ActivityWeekNos,
  AdvLeaderEntryWeek,
  Enrollment,
  EnrollmentList,
  FirstWeeks,
  HalfValue,
  MemberStatusValue,
  PeriodTypeValue,
  RosterSummaryItem,
  SeasonDetail,
  SeasonListItem,
  SeasonRoleValue,
  SeasonStatusValue,
  SeasonWeek,
} from '@/entities/cohort/model/seasonDto';
import type { UserTrack } from '@/entities/user/model/types';
import { queryAll } from '@/shared/db/createDatabase';
import { localDateTime } from '@/shared/lib/date';

import { ApiError } from './router';

export interface SeasonRow extends Record<string, unknown> {
  cohort: number;
  semester_label: string;
  half: HalfValue | null;
  is_current: number;
  is_preparing: number;
  adv_term: number | null;
  base_start_on: string | null;
  adv_start_on: string | null;
  vacation_study_start_on: string | null;
  semester_study_start_on: string | null;
  score_rule_set_id: number | null;
  adv_leader_entry_from_week_id: number | null;
}

export interface WeekRow extends Record<string, unknown> {
  id: number;
  week_no: number;
  period_id: number;
  period_type: PeriodTypeValue;
  start_date: string;
  end_date: string;
  is_void: number;
}

const SEASON_SELECT = `SELECT cohort, semester_label, half, is_current, is_preparing, adv_term, base_start_on,
        adv_start_on, vacation_study_start_on, semester_study_start_on, score_rule_set_id,
        adv_leader_entry_from_week_id
   FROM cohorts WHERE deleted_at IS NULL`;

export const statusOf = (row: SeasonRow): SeasonStatusValue =>
  row.is_current === 1 ? 'ACTIVE' : row.is_preparing === 1 ? 'DRAFT' : 'ARCHIVED';

/** 'YY-N'의 YY를 연도로. */
export const yearOf = (name: string): number => 2000 + Number(name.slice(0, 2));

/** 오늘(이 컴퓨터 시각, 'YYYY-MM-DD'). 주차 마감·현재 판단에 쓴다. */
export const today = (): string => localDateTime().slice(0, 10);

export const listSeasonRows = (db: Database): SeasonRow[] => queryAll<SeasonRow>(db, SEASON_SELECT);

export const findSeasonRow = (db: Database, id: number): SeasonRow | undefined =>
  queryAll<SeasonRow>(db, `${SEASON_SELECT} AND cohort = ?`, [id])[0];

export function seasonRowOrThrow(db: Database, id: number): SeasonRow {
  const row = findSeasonRow(db, id);
  if (!row) throw new ApiError(404, 'SEASON_NOT_FOUND', '반기를 찾을 수 없습니다.');
  return row;
}

export const weekRowsOf = (db: Database, seasonId: number): WeekRow[] =>
  queryAll<WeekRow>(
    db,
    `SELECT w.id, w.week_no, w.period_id, p.period_type, w.start_date, w.end_date, w.is_void
       FROM season_week w JOIN season_period p ON p.id = w.period_id
      WHERE w.activity_season_id = ? ORDER BY w.week_no`,
    [seasonId],
  );

const weekOfDate = (weeks: readonly WeekRow[], date: string | null) =>
  weeks.find((week) => date !== null && week.start_date <= date && date <= week.end_date);

/** 활동별 1주차가 든 공통 주차. 시작일이 반기 밖인 옛 데이터는 첫 주차로 둔다. */
export function firstWeeksOf(row: SeasonRow, weeks: readonly WeekRow[]): FirstWeeks {
  const refOf = (date: string | null) => {
    const week = weekOfDate(weeks, date) ?? weeks[0];
    return { week_id: week?.id ?? 0, week_no: week?.week_no ?? 1 };
  };
  return {
    base: refOf(row.base_start_on),
    adv: refOf(row.adv_start_on),
    vacation_study: refOf(row.vacation_study_start_on),
    semester_study: refOf(row.semester_study_start_on),
  };
}

/** 그 기간 안에서 센 주차 번호. */
export const periodWeekNoOf = (weeks: readonly WeekRow[], week: WeekRow): number =>
  week.week_no -
  Math.min(...weeks.filter((w) => w.period_id === week.period_id).map((w) => w.week_no)) +
  1;

/** 활동 1주차부터 센 번호. 1주차 앞이거나 스터디가 그 기간이 아니면 null. */
export function activityWeekNosOf(first: FirstWeeks, week: WeekRow): ActivityWeekNos {
  const from = (firstNo: number, periodType?: PeriodTypeValue) =>
    week.week_no >= firstNo && (!periodType || week.period_type === periodType)
      ? week.week_no - firstNo + 1
      : null;
  return {
    base: from(first.base.week_no),
    adv: from(first.adv.week_no),
    vacation_study: from(first.vacation_study.week_no, 'VACATION'),
    semester_study: from(first.semester_study.week_no, 'SEMESTER'),
  };
}

export function advLeaderEntryWeekOf(
  row: SeasonRow,
  weeks: readonly WeekRow[],
  first: FirstWeeks,
): AdvLeaderEntryWeek | null {
  const week = weeks.find((w) => w.id === row.adv_leader_entry_from_week_id);
  if (!week) return null;
  return {
    week_id: week.id,
    week_no: week.week_no,
    activity_week_no: week.week_no - first.adv.week_no + 1,
    start_date: week.start_date,
    end_date: week.end_date,
  };
}

const ROLE_ORDER_SQL = "CASE e.season_role WHEN 'BASE' THEN 0 WHEN 'ADV' THEN 1 ELSE 2 END";

/** 기수·구분별 인원(등록 취소 제외). 기수 내림차순 → BASE·ADV·COMPLETED 순. */
export const rosterSummaryOf = (db: Database, seasonId: number): RosterSummaryItem[] =>
  queryAll<{ term: number; season_role: SeasonRoleValue; count: number }>(
    db,
    `SELECT u.term, e.season_role, COUNT(*) AS count
       FROM member_enrollment e JOIN users u ON u.id = e.member_id
      WHERE e.activity_season_id = ? AND e.deleted_at IS NULL
      GROUP BY u.term, e.season_role
      ORDER BY u.term DESC, ${ROLE_ORDER_SQL}`,
    [seasonId],
  ).map((item) => ({ ...item }));

function periodsOf(db: Database, seasonId: number) {
  return queryAll<{
    id: number;
    period_type: PeriodTypeValue;
    start_date: string;
    end_date: string;
  }>(
    db,
    `SELECT id, period_type, start_date, end_date FROM season_period
      WHERE activity_season_id = ? ORDER BY start_date`,
    [seasonId],
  );
}

export function seasonListItemOf(db: Database, row: SeasonRow): SeasonListItem {
  const periods = periodsOf(db, row.cohort);
  return {
    id: row.cohort,
    name: row.semester_label,
    year: yearOf(row.semester_label),
    half: row.half ?? 'H1',
    status: statusOf(row),
    base_term: row.cohort,
    adv_term: row.adv_term ?? 0,
    start_date: periods[0]?.start_date ?? '',
    end_date: periods.reduce((last, p) => (p.end_date > last ? p.end_date : last), ''),
    is_editable: statusOf(row) === 'DRAFT',
  };
}

export function seasonDetailOf(db: Database, row: SeasonRow): SeasonDetail {
  const weeks = weekRowsOf(db, row.cohort);
  const first = firstWeeksOf(row, weeks);
  const rule = queryAll<{ id: number; name: string }>(
    db,
    'SELECT rowid AS id, name FROM score_rules WHERE rowid = ?',
    [row.score_rule_set_id ?? -1],
  )[0];
  const weekNoFrom = (week: WeekRow, firstNo: number) =>
    week.week_no >= firstNo ? week.week_no - firstNo + 1 : null;
  return {
    ...seasonListItemOf(db, row),
    base_start_on: row.base_start_on ?? '',
    adv_start_on: row.adv_start_on ?? '',
    vacation_study_start_on: row.vacation_study_start_on ?? '',
    semester_study_start_on: row.semester_study_start_on ?? '',
    first_weeks: first,
    adv_leader_entry_from_week: advLeaderEntryWeekOf(row, weeks, first),
    // shortcut: 점수 규칙 버전이 없는 옛 반기는 id 0으로 둔다. 백엔드는 반기마다 반드시 있다.
    score_rule_set: rule ?? { id: 0, name: '' },
    periods: periodsOf(db, row.cohort).map((period) => ({
      ...period,
      week_count: weeks.filter((week) => week.period_id === period.id).length,
    })),
    total_week_count: weeks.length,
    void_weeks: weeks
      .filter((week) => week.is_void === 1)
      .map((week) => ({
        week_id: week.id,
        week_no: week.week_no,
        period_type: week.period_type,
        period_week_no: periodWeekNoOf(weeks, week),
        base_week_no: weekNoFrom(week, first.base.week_no),
        adv_week_no: weekNoFrom(week, first.adv.week_no),
        start_date: week.start_date,
        end_date: week.end_date,
      })),
    roster_summary: rosterSummaryOf(db, row.cohort),
  };
}

/** ATT-08 주차 목록. 그룹을 주지 않으면 activity_week_no는 null이다. */
export function seasonWeeksOf(db: Database, row: SeasonRow): SeasonWeek[] {
  const weeks = weekRowsOf(db, row.cohort);
  const first = firstWeeksOf(row, weeks);
  const entry = advLeaderEntryWeekOf(row, weeks, first);
  const now = today();
  return weeks.map((week) => ({
    week_id: week.id,
    week_no: week.week_no,
    period_id: week.period_id,
    period_type: week.period_type,
    period_week_no: periodWeekNoOf(weeks, week),
    start_date: week.start_date,
    end_date: week.end_date,
    is_void: week.is_void === 1,
    is_current: week.start_date <= now && now <= week.end_date,
    is_closed: now > week.end_date,
    activity_week_nos: activityWeekNosOf(first, week),
    activity_week_no: null,
    is_adv_leader_entry_start: entry?.week_id === week.id,
    is_adv_leader_entry_open: entry !== null && week.week_no >= entry.week_no,
  }));
}

interface EnrollmentRow extends Record<string, unknown> {
  enrollment_id: number;
  member_id: string;
  name: string;
  term: number;
  track: UserTrack;
  member_status: MemberStatusValue;
  season_role: SeasonRoleValue;
  menmen_joined: number;
  chinba_joined: number;
  parallel_track: UserTrack | null;
  is_parallel_completed: number | null;
  note: string | null;
  deleted_at: string | null;
  version: number;
}

export interface EnrollmentFilter {
  terms?: number[];
  roles?: SeasonRoleValue[];
  tracks?: UserTrack[];
  keyword?: string;
  includeCancelled?: boolean;
  enrollmentId?: number;
}

/** 명단 행(ATT-18 enrollments). 구분(BASE → ADV → COMPLETED) → 기수 내림차순 → 이름 순. */
export function enrollmentsOf(
  db: Database,
  seasonId: number,
  filter: EnrollmentFilter = {},
): Enrollment[] {
  const where = ['e.activity_season_id = ?'];
  const args: (string | number)[] = [seasonId];
  if (!filter.includeCancelled) where.push('e.deleted_at IS NULL');
  if (filter.enrollmentId !== undefined) {
    where.push('e.id = ?');
    args.push(filter.enrollmentId);
  }
  const inList = (column: string, values: readonly (string | number)[] | undefined) => {
    if (!values?.length) return;
    where.push(`${column} IN (${values.map(() => '?').join(', ')})`);
    args.push(...values);
  };
  inList('u.term', filter.terms);
  inList('e.season_role', filter.roles);
  inList('u.track', filter.tracks);
  if (filter.keyword) {
    where.push("u.name LIKE '%' || ? || '%'");
    args.push(filter.keyword);
  }
  const rows = queryAll<EnrollmentRow>(
    db,
    `SELECT e.id AS enrollment_id, e.member_id, u.name, u.term, u.track, u.club_status AS member_status,
            e.season_role, e.menmen_joined, e.chinba_joined, e.parallel_track, e.note, e.deleted_at,
            e.version,
            CASE WHEN e.parallel_track IS NULL THEN NULL
                 WHEN u.club_status = 'COMPLETED'
                  AND EXISTS (${PARALLEL_DONE_SQL('BASE')})
                  AND EXISTS (${PARALLEL_DONE_SQL('ADV')}) THEN 1
                 ELSE 0 END AS is_parallel_completed
       FROM member_enrollment e JOIN users u ON u.id = e.member_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${ROLE_ORDER_SQL}, u.term DESC, u.name`,
    args,
  );
  const groups = queryAll<{
    user_id: string;
    group_id: string;
    name: string;
    group_type: 'ADV' | 'STUDY';
    kind: string;
  }>(
    db,
    `SELECT tm.user_id, t.id AS group_id, t.study_name AS name, t.group_type, t.kind
       FROM team_members tm JOIN teams t ON t.id = tm.team_id
      WHERE t.semester_cohort = ? AND t.group_type IN ('ADV', 'STUDY')
      ORDER BY t.group_type, t.study_name`,
    [seasonId],
  );
  return rows.map((row) => ({
    enrollment_id: row.enrollment_id,
    member_id: row.member_id,
    name: row.name,
    name_suffix: null,
    term: row.term,
    track: VALUE_OF_TRACK[row.track],
    member_status: row.member_status,
    season_role: row.season_role,
    menmen_joined: row.menmen_joined === 1,
    chinba_joined: row.chinba_joined === 1,
    parallel_track: row.parallel_track ? VALUE_OF_TRACK[row.parallel_track] : null,
    is_parallel_completed:
      row.is_parallel_completed === null ? null : row.is_parallel_completed === 1,
    note: row.note,
    groups: groups
      .filter((group) => group.user_id === row.member_id)
      .map((group) => ({
        group_id: group.group_id,
        name: group.name,
        group_type: group.group_type === 'ADV' ? 'ADV_TEAM' : 'STUDY',
        study_kind:
          group.group_type === 'ADV' ? null : group.kind === 'MENTORING' ? 'MENMEN' : 'GENERAL',
      })),
    is_cancelled: row.deleted_at !== null,
    version: row.version,
  }));
}

export function enrollmentListOf(
  db: Database,
  seasonId: number,
  filter: EnrollmentFilter,
): EnrollmentList {
  const enrollments = enrollmentsOf(db, seasonId, filter);
  return {
    summary: rosterSummaryOf(db, seasonId),
    total_count: enrollments.length,
    enrollments,
  };
}
