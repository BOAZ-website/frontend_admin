/**
 * 반기 관리 임시 API. 경로·필드·응답 포장·오류 코드는 백엔드 명세 그대로다
 * (ATT-01~05, 08~11, 82, 83 확정 / ATT-12, 18, 19, 21, 22 협의 중, 2026-11-20 기준).
 * 성공 응답은 { status, data }로 감싼다. 반기 id는 임시 DB의 cohorts.cohort다.
 * 출결 화면이 쓰는 옛 반기 API(/api/v1/semesters)는 commonRoutes.ts에 그대로 있다.
 */
import type { Database } from 'sql.js';

import { updateSemesterSchedule } from '@/entities/cohort/api/semesterRepository';
import type { DateRange, SemesterActivity } from '@/entities/cohort/model/dto';
import { commonWeeksOf } from '@/entities/cohort/model/schedule';
import { TRACK_OF_VALUE, VALUE_OF_TRACK } from '@/entities/cohort/model/season';
import type {
  ArchiveReadiness,
  HalfValue,
  PeriodTypeValue,
  SeasonDetail,
  SeasonPreview,
  SeasonRoleValue,
  SeasonStatusValue,
  TrackValue,
} from '@/entities/cohort/model/seasonDto';
import type { UserTrack } from '@/entities/user/model/types';
import { execute, queryAll } from '@/shared/db/createDatabase';
import { isValidIsoDate, localDateTime } from '@/shared/lib/date';

import { cleanupHostAccounts } from '../hostCleanup';
import { insertSemester } from '../queries';
import { ApiError, type MockRequest, type MockRoute, type RouteAudit } from '../router';
import {
  advLeaderEntryWeekOf,
  enrollmentListOf,
  enrollmentsOf,
  findSeasonRow,
  firstWeeksOf,
  listSeasonRows,
  periodWeekNoOf,
  seasonDetailOf,
  seasonListItemOf,
  seasonRowOrThrow,
  seasonWeeksOf,
  statusOf,
  today,
  weekRowsOf,
  yearOf,
  type SeasonRow,
  type WeekRow,
} from '../seasonQueries';
import { semesterRecordCounts, voidImpactOf } from '../semesterOps';
import { type Body, readBody } from '../validate';

const BASE = '/api/v1/admin/attendance';
const NAME_PATTERN = /^\d{2}-[12]$/;
const MAX_VOID_WEEKS = 2;
const MAX_NOTE_LENGTH = 500;
const HALVES: readonly HalfValue[] = ['H1', 'H2'];
const ROLES: readonly SeasonRoleValue[] = ['BASE', 'ADV', 'COMPLETED'];
const TRACKS = Object.keys(TRACK_OF_VALUE) as TrackValue[];
const START_KEYS = [
  'base_start_on',
  'adv_start_on',
  'vacation_study_start_on',
  'semester_study_start_on',
] as const;
type StartKey = (typeof START_KEYS)[number];
const ACTIVITY_OF_START: Record<StartKey, SemesterActivity> = {
  base_start_on: 'BASE',
  adv_start_on: 'ADV',
  vacation_study_start_on: 'STUDY_VACATION',
  semester_study_start_on: 'STUDY_TERM',
};

const ok = <T>(data: T) => ({ status: 200, data });
const created = <T>(data: T) => ({ status: 201, data });
const invalid = (message: string) => new ApiError(400, 'INVALID_INPUT_VALUE', message);
const conflict = (code: string, message: string) => new ApiError(409, code, message);

function idParam(value: string | undefined, name: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new ApiError(400, 'INVALID_PARAMETER_TYPE', `${name} 값은 양의 정수여야 합니다.`);
  }
  return id;
}

/** 명세에 없는 필드가 오면 400. */
function onlyKeys(body: Body, allowed: readonly string[]): void {
  const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) throw invalid(`알 수 없는 필드입니다: ${unknown.join(', ')}`);
}

function dateOf(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isValidIsoDate(value)) {
    throw invalid(`${label}은 YYYY-MM-DD 형식의 날짜여야 합니다.`);
  }
  return value;
}

function positiveInt(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw invalid(`${label}은 1 이상의 정수여야 합니다.`);
  }
  return value;
}

function oneOfValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw invalid(`${label} 값은 ${allowed.join(', ')} 중 하나여야 합니다.`);
  }
  return value as T;
}

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

function rangeOf(value: unknown, label: string): DateRange {
  const range = readBody(value);
  const startDate = dateOf(range.start_date, `${label} 시작일`);
  const endDate = dateOf(range.end_date, `${label} 종료일`);
  if (startDate > endDate) throw invalid(`${label} 시작일은 종료일보다 늦을 수 없습니다.`);
  if (weekdayOf(startDate) !== 1 || weekdayOf(endDate) !== 0) {
    throw invalid(`${label}은 월요일에 시작해 일요일에 끝나야 합니다.`);
  }
  return { startDate, endDate };
}

/** periods 배열을 기간 종류별로 읽는다. 같은 종류가 두 번 오면 400. */
function periodsOf(value: unknown): Partial<Record<PeriodTypeValue, DateRange>> {
  if (!Array.isArray(value)) throw invalid('periods는 배열이어야 합니다.');
  const result: Partial<Record<PeriodTypeValue, DateRange>> = {};
  value.forEach((item) => {
    const period = readBody(item);
    onlyKeys(period, ['period_type', 'start_date', 'end_date']);
    const type = oneOfValue(period.period_type, ['VACATION', 'SEMESTER'], 'period_type');
    if (result[type]) throw invalid('같은 기간 종류를 두 번 보낼 수 없습니다.');
    result[type] = rangeOf(period, type === 'VACATION' ? '방학' : '학기');
  });
  return result;
}

function checkNameHalf(name: string, half: HalfValue): void {
  if (!NAME_PATTERN.test(name)) throw invalid('name은 YY-N 형식이어야 합니다(N은 1 또는 2).');
  if (half !== (name.endsWith('-1') ? 'H1' : 'H2')) {
    throw invalid('name과 half가 맞지 않습니다(1은 H1, 2는 H2).');
  }
}

function checkNoOverlap(vacation: DateRange, term: DateRange): void {
  if (vacation.startDate <= term.endDate && term.startDate <= vacation.endDate) {
    throw new ApiError(400, 'SEASON_PERIOD_OVERLAP', '방학과 학기 기간이 겹칩니다.');
  }
}

/** BASE·ADV는 반기 전체, 방학 스터디는 방학, 학기 스터디는 학기 안이어야 한다. */
function checkStarts(starts: Record<StartKey, string>, vacation: DateRange, term: DateRange): void {
  const seasonStart = vacation.startDate < term.startDate ? vacation.startDate : term.startDate;
  const seasonEnd = vacation.endDate > term.endDate ? vacation.endDate : term.endDate;
  const inside = (date: string, from: string, to: string) => from <= date && date <= to;
  if (
    !inside(starts.base_start_on, seasonStart, seasonEnd) ||
    !inside(starts.adv_start_on, seasonStart, seasonEnd) ||
    !inside(starts.vacation_study_start_on, vacation.startDate, vacation.endDate) ||
    !inside(starts.semester_study_start_on, term.startDate, term.endDate)
  ) {
    throw invalid('활동 1주차 시작일이 허용 기간 밖입니다.');
  }
}

const scheduleOf = (vacation: DateRange, term: DateRange, starts: Record<StartKey, string>) => ({
  vacation,
  term,
  starts: Object.fromEntries(
    START_KEYS.map((key) => [ACTIVITY_OF_START[key], starts[key]]),
  ) as Record<SemesterActivity, string>,
});

interface SeasonInput {
  name: string;
  half: HalfValue;
  baseTerm: number;
  advTerm: number;
  vacation: DateRange;
  term: DateRange;
  starts: Record<StartKey, string>;
  voidWeekNos: number[];
}

/** ATT-03·82 요청 본문. 미리보기는 score_rule_set_id를 받지 않는다. */
function readSeasonInput(body: unknown, allowed: readonly string[]): SeasonInput {
  const input = readBody(body);
  onlyKeys(input, allowed);
  if (typeof input.name !== 'string') throw invalid('name 값이 필요합니다.');
  const half = oneOfValue(input.half, HALVES, 'half');
  checkNameHalf(input.name, half);
  const periods = periodsOf(input.periods);
  if (!periods.VACATION || !periods.SEMESTER || (input.periods as unknown[]).length !== 2) {
    throw invalid('periods에는 방학(VACATION)과 학기(SEMESTER)를 하나씩 보내야 합니다.');
  }
  checkNoOverlap(periods.VACATION, periods.SEMESTER);
  const starts = Object.fromEntries(
    START_KEYS.map((key) => [key, dateOf(input[key], key)]),
  ) as Record<StartKey, string>;
  checkStarts(starts, periods.VACATION, periods.SEMESTER);
  const voidWeekNos = input.void_week_nos ?? [];
  if (!Array.isArray(voidWeekNos) || !voidWeekNos.every((no) => Number.isInteger(no))) {
    throw invalid('void_week_nos는 주차 번호 배열이어야 합니다.');
  }
  const weeks = commonWeeksOf(periods.VACATION, periods.SEMESTER);
  const uniqueNos = [...new Set(voidWeekNos as number[])].sort((a, b) => a - b);
  if (uniqueNos.length > MAX_VOID_WEEKS) {
    throw new ApiError(
      400,
      'SEASON_VOID_WEEK_LIMIT_EXCEEDED',
      '휴강은 최대 2주까지 지정할 수 있습니다.',
    );
  }
  if (uniqueNos.some((no) => !weeks.some((week) => week.weekNo === no))) {
    throw invalid('반기에 없는 주차를 휴강으로 보냈습니다.');
  }
  return {
    name: input.name,
    half,
    baseTerm: positiveInt(input.base_term, 'base_term'),
    advTerm: positiveInt(input.adv_term, 'adv_term'),
    vacation: periods.VACATION,
    term: periods.SEMESTER,
    starts,
    voidWeekNos: uniqueNos,
  };
}

const SEASON_INPUT_KEYS = [
  'name',
  'half',
  'base_term',
  'adv_term',
  'periods',
  ...START_KEYS,
  'void_week_nos',
];

const isSameYearHalf = (row: SeasonRow, name: string, half: HalfValue) =>
  yearOf(row.semester_label) === yearOf(name) && row.half === half;

function scoreRuleSetIdOf(db: Database, value: unknown): number {
  const id = positiveInt(value, 'score_rule_set_id');
  if (queryAll(db, 'SELECT 1 FROM score_rules WHERE rowid = ?', [id]).length === 0) {
    throw new ApiError(404, 'SCORE_RULE_SET_NOT_FOUND', '점수 규칙 버전을 찾을 수 없습니다.');
  }
  return id;
}

/** BASE·ADV 기수의 활동 중 회원(자동 명단). */
const autoRosterOf = (db: Database, baseTerm: number, advTerm: number) =>
  queryAll<{ id: string; name: string; term: number; track: UserTrack }>(
    db,
    `SELECT id, name, term, track FROM users
      WHERE club_status = 'ACTIVE' AND deleted_at IS NULL AND term IN (?, ?)
      ORDER BY CASE WHEN term = ? THEN 0 ELSE 1 END, term DESC, name`,
    [baseTerm, advTerm, baseTerm],
  );

const roleOfTerm = (term: number, baseTerm: number): 'BASE' | 'ADV' =>
  term === baseTerm ? 'BASE' : 'ADV';

function previewOf(db: Database, input: SeasonInput): SeasonPreview {
  const weeks = commonWeeksOf(input.vacation, input.term);
  const weekNoOf = (date: string) =>
    weeks.find((week) => week.startDate <= date && date <= week.endDate)?.weekNo ?? 1;
  const first = {
    base: { week_no: weekNoOf(input.starts.base_start_on) },
    adv: { week_no: weekNoOf(input.starts.adv_start_on) },
    vacation_study: { week_no: weekNoOf(input.starts.vacation_study_start_on) },
    semester_study: { week_no: weekNoOf(input.starts.semester_study_start_on) },
  };
  const from = (weekNo: number, firstNo: number) =>
    weekNo >= firstNo ? weekNo - firstNo + 1 : null;
  const members = autoRosterOf(db, input.baseTerm, input.advTerm);
  const entryNo = first.adv.week_no + 3;
  const rows = listSeasonRows(db);
  return {
    year: yearOf(input.name),
    half: input.half,
    conflicts: {
      duplicate_year_half: rows.some((row) => isSameYearHalf(row, input.name, input.half)),
      duplicate_base_term: rows.some((row) => row.cohort === input.baseTerm),
    },
    total_week_count: weeks.length,
    weeks: weeks.map((week) => {
      const inPeriod = weeks.filter((w) => w.periodType === week.periodType);
      return {
        week_no: week.weekNo,
        period_type: week.periodType,
        period_week_no: week.weekNo - inPeriod[0].weekNo + 1,
        start_date: week.startDate,
        end_date: week.endDate,
        is_void: input.voidWeekNos.includes(week.weekNo),
        activity_week_nos: {
          base: from(week.weekNo, first.base.week_no),
          adv: from(week.weekNo, first.adv.week_no),
          vacation_study:
            week.periodType === 'VACATION' ? from(week.weekNo, first.vacation_study.week_no) : null,
          semester_study:
            week.periodType === 'SEMESTER' ? from(week.weekNo, first.semester_study.week_no) : null,
        },
      };
    }),
    first_weeks: first,
    adv_leader_entry_from_week_no: entryNo <= weeks.length ? entryNo : null,
    roster_summary: (['BASE', 'ADV'] as const)
      .map((role) => ({
        term: role === 'BASE' ? input.baseTerm : input.advTerm,
        season_role: role,
        count: members.filter((m) => roleOfTerm(m.term, input.baseTerm) === role).length,
      }))
      .filter((item) => item.count > 0),
    roster_members: members.map((member) => ({
      member_id: member.id,
      name: member.name,
      name_suffix: null,
      term: member.term,
      track: VALUE_OF_TRACK[member.track],
      season_role: roleOfTerm(member.term, input.baseTerm),
    })),
  };
}

/**
 * 기간을 바꾸면 주차를 다시 만든다. 같은 기간 종류의 같은 달력 주(월요일)는 주차 id·휴강을 그대로 두고 번호만 바꾼다(ATT-04).
 * 없어지는 주차와 바뀐 주차 번호를 돌려준다. 저장은 apply()를 불러야 한다.
 */
function planWeeks(db: Database, seasonId: number, vacation: DateRange, term: DateRange) {
  const old = weekRowsOf(db, seasonId);
  const next = commonWeeksOf(vacation, term).map((week) => ({
    ...week,
    id: old.find((w) => w.period_type === week.periodType && w.start_date === week.startDate)?.id,
  }));
  const removed = old.filter((w) => !next.some((week) => week.id === w.id));
  const weekNoAfter = (id: number) => next.find((week) => week.id === id)?.weekNo;
  const apply = () => {
    execute(
      db,
      'UPDATE season_period SET start_date = ?, end_date = ? WHERE activity_season_id = ? AND period_type = ?',
      [vacation.startDate, vacation.endDate, seasonId, 'VACATION'],
    );
    execute(
      db,
      'UPDATE season_period SET start_date = ?, end_date = ? WHERE activity_season_id = ? AND period_type = ?',
      [term.startDate, term.endDate, seasonId, 'SEMESTER'],
    );
    removed.forEach((w) => execute(db, 'DELETE FROM season_week WHERE id = ?', [w.id]));
    // 번호가 겹치지 않게 남는 주차를 먼저 큰 번호로 옮긴 뒤 새 번호를 준다(week_no는 1 이상이어야 한다).
    execute(db, 'UPDATE season_week SET week_no = week_no + 1000 WHERE activity_season_id = ?', [
      seasonId,
    ]);
    next.forEach((week) => {
      if (week.id !== undefined) {
        execute(db, 'UPDATE season_week SET week_no = ? WHERE id = ?', [week.weekNo, week.id]);
        return;
      }
      execute(
        db,
        `INSERT INTO season_week (activity_season_id, period_id, week_no, start_date, end_date)
         SELECT ?, id, ?, ?, ? FROM season_period WHERE activity_season_id = ? AND period_type = ?`,
        [seasonId, week.weekNo, week.startDate, week.endDate, seasonId, week.periodType],
      );
    });
  };
  return { removed, weekNoAfter, apply };
}

/** 출결 입력 화면이 읽는 ADV 팀장 입력 시작 주차(활동 주차 번호)를 반기 관리 값에 맞춘다. */
function syncLegacyEntryWeek(db: Database, seasonId: number): void {
  const row = seasonRowOrThrow(db, seasonId);
  const weeks = weekRowsOf(db, seasonId);
  const entry = advLeaderEntryWeekOf(row, weeks, firstWeeksOf(row, weeks));
  // shortcut: 옛 칸은 비울 수 없어 팀장 입력을 닫으면(null) 값을 그대로 둔다. 출결 입력 화면을 새 API로 옮길 때 없앤다.
  if (!entry) return;
  execute(db, 'UPDATE cohorts SET adv_leader_entry_from_week = ? WHERE cohort = ?', [
    Math.min(16, Math.max(1, entry.activity_week_no)),
    seasonId,
  ]);
}

function seasonOfWeek(db: Database, weekId: number): { week: WeekRow; season: SeasonRow } {
  const seasonId = queryAll<{ activity_season_id: number }>(
    db,
    'SELECT activity_season_id FROM season_week WHERE id = ?',
    [weekId],
  )[0]?.activity_season_id;
  const season = seasonId === undefined ? undefined : findSeasonRow(db, seasonId);
  const week = season && weekRowsOf(db, season.cohort).find((w) => w.id === weekId);
  if (!season || !week) throw new ApiError(404, 'WEEK_NOT_FOUND', '주차를 찾을 수 없습니다.');
  return { week, season };
}

function readinessOf(db: Database, row: SeasonRow, periodId: number | null): ArchiveReadiness {
  const status = statusOf(row);
  const weeks = weekRowsOf(db, row.cohort);
  const now = today();
  const blockReason =
    status === 'DRAFT' ? 'SEASON_NOT_ACTIVE' : status === 'ARCHIVED' ? 'SEASON_ARCHIVED' : null;
  const last = weeks[weeks.length - 1];
  const period =
    periodId === null
      ? null
      : queryAll<{ id: number; period_type: PeriodTypeValue; end_date: string }>(
          db,
          'SELECT id, period_type, end_date FROM season_period WHERE id = ? AND activity_season_id = ?',
          [periodId, row.cohort],
        )[0];
  if (periodId !== null && !period) {
    throw new ApiError(404, 'SEASON_PERIOD_NOT_FOUND', '기간을 찾을 수 없습니다.');
  }
  const lastWeek = last
    ? {
        week_id: last.id,
        week_no: last.week_no,
        end_date: last.end_date,
        is_closed: now > last.end_date,
      }
    : null;
  // shortcut: 임시 DB에는 제출의 승인 대기 상태와 스터디 회차 계획이 없어 막는 항목·경고를 만들지 않는다.
  // 마지막 주차가 끝났는지만 본다. 백엔드 연동 때 서버가 계산한 값으로 바뀐다.
  return {
    season_id: row.cohort,
    season_status: status,
    season_block_reason: blockReason,
    can_archive: period ? null : blockReason === null && lastWeek !== null && lastWeek.is_closed,
    last_week: lastWeek,
    period: period
      ? {
          period_id: period.id,
          period_type: period.period_type,
          end_date: period.end_date,
          is_closed: now > period.end_date,
          is_clear: true,
        }
      : null,
    blocker_counts: { pending_submission_count: 0, missing_submission_count: 0 },
    blocking_items: [],
    warnings: { study_round_shortfalls: [], unverifiable_study_groups: [] },
  };
}

/** 그 반기 그룹에 이 회원의 출결 기록이 있는지(입력하지 않은 칸 제외). */
const hasAttendance = (db: Database, seasonId: number, memberId: string) =>
  queryAll(
    db,
    `SELECT 1 FROM attendance_records r
       JOIN team_members tm ON tm.id = r.member_id
       JOIN teams t ON t.id = r.team_id
      WHERE t.semester_cohort = ? AND tm.user_id = ? AND r.status <> 'unmarked' LIMIT 1`,
    [seasonId, memberId],
  ).length > 0;

const groupKindsOf = (db: Database, seasonId: number, memberId: string) =>
  queryAll<{ group_type: string; kind: string }>(
    db,
    `SELECT t.group_type, t.kind FROM team_members tm JOIN teams t ON t.id = tm.team_id
      WHERE t.semester_cohort = ? AND tm.user_id = ?`,
    [seasonId, memberId],
  );

interface EnrollmentRecord {
  id: number;
  member_id: string;
  activity_season_id: number;
  season_role: SeasonRoleValue;
  version: number;
  deleted_at: string | null;
}

function liveEnrollment(db: Database, id: number): EnrollmentRecord {
  const row = queryAll<EnrollmentRecord & Record<string, unknown>>(
    db,
    'SELECT id, member_id, activity_season_id, season_role, version, deleted_at FROM member_enrollment WHERE id = ?',
    [id],
  )[0];
  if (!row || row.deleted_at !== null) {
    throw new ApiError(404, 'ENROLLMENT_NOT_FOUND', '명단 등록을 찾을 수 없습니다.');
  }
  return row;
}

function assertSeasonNotArchived(db: Database, seasonId: number): SeasonRow {
  const row = seasonRowOrThrow(db, seasonId);
  if (statusOf(row) === 'ARCHIVED') throw conflict('SEASON_ARCHIVED', '종료된 반기입니다.');
  return row;
}

function trackOf(value: unknown, label: string): UserTrack | null {
  if (value === null) return null;
  return TRACK_OF_VALUE[oneOfValue(value, TRACKS, label)];
}

function noteOf(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value === '')
    throw invalid('note는 빈 값이 아닌 문자열이어야 합니다.');
  if (value.length > MAX_NOTE_LENGTH) throw invalid(`note는 ${MAX_NOTE_LENGTH}자 이하여야 합니다.`);
  return value;
}

function booleanOf(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw invalid(`${label} 값은 true 또는 false여야 합니다.`);
  return value;
}

const multiQuery = (query: URLSearchParams, key: string): string[] =>
  query
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

function enumQuery<T extends string>(
  query: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T[] {
  const values = multiQuery(query, key);
  if (values.some((value) => !(allowed as readonly string[]).includes(value))) {
    throw new ApiError(
      400,
      'INVALID_PARAMETER_TYPE',
      `${key} 값은 ${allowed.join(', ')} 중 하나여야 합니다.`,
    );
  }
  return values as T[];
}

function booleanQuery(query: URLSearchParams, key: string): boolean {
  const value = query.get(key);
  if (value === null) return false;
  if (value !== 'true' && value !== 'false') {
    throw new ApiError(400, 'INVALID_PARAMETER_TYPE', `${key} 값은 true 또는 false여야 합니다.`);
  }
  return value === 'true';
}

// ───────────────────────────── 감사 기록 ─────────────────────────────
// 반기 쓰기의 감사 대상은 반기 이름이다(감사 로그 화면에 「26-2 반기」로 보인다).

const labelsOf = (label: string | undefined): string[] => (label ? [label] : []);

const seasonTarget = ({ db, params }: MockRequest) =>
  labelsOf(findSeasonRow(db, Number(params.seasonId))?.semester_label);

const weekTarget = ({ db, params }: MockRequest) => {
  const seasonId = queryAll<{ id: number }>(
    db,
    'SELECT activity_season_id AS id FROM season_week WHERE id = ?',
    [Number(params.weekId)],
  )[0]?.id;
  return labelsOf(seasonId === undefined ? undefined : findSeasonRow(db, seasonId)?.semester_label);
};

const enrollmentTarget = ({ db, params }: MockRequest) => {
  const seasonId = queryAll<{ id: number }>(
    db,
    'SELECT activity_season_id AS id FROM member_enrollment WHERE id = ?',
    [Number(params.enrollmentId)],
  )[0]?.id;
  return labelsOf(seasonId === undefined ? undefined : findSeasonRow(db, seasonId)?.semester_label);
};

/** 명단 쓰기는 누구를 바꿨는지 이름을 함께 남긴다. */
const enrollmentMember = ({ db, params, body }: MockRequest) => {
  const memberId =
    params.enrollmentId !== undefined
      ? queryAll<{ member_id: string }>(
          db,
          'SELECT member_id FROM member_enrollment WHERE id = ?',
          [Number(params.enrollmentId)],
        )[0]?.member_id
      : readBody(body).member_id;
  const name = queryAll<{ name: string }>(db, 'SELECT name FROM users WHERE id = ?', [
    String(memberId ?? ''),
  ])[0]?.name;
  return name ? { member: name } : {};
};

const seasonAudit = (
  action: RouteAudit['action'],
  extra: Partial<RouteAudit> = {},
): RouteAudit => ({
  action,
  targetType: 'SEMESTER',
  targets: seasonTarget,
  ...extra,
});

const enrollmentAudit = (targets: RouteAudit['targets']): RouteAudit => ({
  action: 'SEMESTER_MEMBERS_SET',
  targetType: 'SEMESTER',
  targets,
  before: (request) => enrollmentMember(request),
  detail: (_request, { before }) => before,
});

const STATUS_ORDER: Record<SeasonStatusValue, number> = { DRAFT: 0, ACTIVE: 1, ARCHIVED: 2 };

const UPDATE_KEYS = [
  'name',
  'half',
  ...START_KEYS,
  'adv_leader_entry_from_week_id',
  'score_rule_set_id',
  'periods',
];

export const seasonRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${BASE}/seasons`,
    summary: 'ATT-01 반기 목록. DRAFT → ACTIVE → ARCHIVED, 연도·반기 내림차순',
    handler: ({ db }) =>
      ok(
        listSeasonRows(db)
          .map((row) => seasonListItemOf(db, row))
          .sort(
            (a, b) =>
              STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
              b.year - a.year ||
              b.half.localeCompare(a.half),
          ),
      ),
  },
  {
    method: 'POST',
    pattern: `${BASE}/seasons/preview`,
    summary: 'ATT-82 반기 설정 미리보기. 주차·자동 명단을 계산만 하고 저장하지 않는다',
    audit: null,
    handler: ({ db, body }) => ok(previewOf(db, readSeasonInput(body, SEASON_INPUT_KEYS))),
  },
  {
    method: 'POST',
    pattern: `${BASE}/seasons`,
    summary:
      'ATT-03 반기 확정. DRAFT 반기·기간·주차·휴강을 만들고 BASE·ADV 기수 활동 회원으로 명단을 자동으로 만든다',
    audit: {
      action: 'SEMESTER_CREATE',
      targetType: 'SEMESTER',
      targets: (_request, result) =>
        labelsOf((result as { data?: { name?: string } } | undefined)?.data?.name),
    },
    handler: ({ db, body }) => {
      const input = readSeasonInput(body, [...SEASON_INPUT_KEYS, 'score_rule_set_id']);
      const scoreRuleSetId = scoreRuleSetIdOf(db, readBody(body).score_rule_set_id);
      const rows = listSeasonRows(db);
      if (rows.some((row) => isSameYearHalf(row, input.name, input.half))) {
        throw conflict('DUPLICATE_ACTIVITY_SEASON', '같은 연도·반기의 반기가 이미 있습니다.');
      }
      if (rows.some((row) => row.cohort === input.baseTerm)) {
        throw conflict('DUPLICATE_BASE_TERM', '같은 BASE 기수의 반기가 이미 있습니다.');
      }
      const id = input.baseTerm;
      insertSemester(db, {
        cohort: id,
        semester: input.name,
        startDate: input.vacation.startDate,
        endDate: input.term.endDate,
        isCurrent: false,
        status: 'PREPARING',
        advTerm: input.advTerm,
        memberTerms: [input.advTerm, input.baseTerm],
        currentWeekNum: null,
        currentPeriod: null,
        attendanceKinds: [],
      });
      execute(db, 'UPDATE cohorts SET half = ?, score_rule_set_id = ? WHERE cohort = ?', [
        input.half,
        scoreRuleSetId,
        id,
      ]);
      updateSemesterSchedule(db, id, scheduleOf(input.vacation, input.term, input.starts));
      input.voidWeekNos.forEach((weekNo) =>
        execute(
          db,
          'UPDATE season_week SET is_void = 1 WHERE activity_season_id = ? AND week_no = ?',
          [id, weekNo],
        ),
      );
      // ADV 팀장 입력 시작 주차 기본값: ADV 1주차가 든 공통 주차부터 센 4주차. 없으면 비워 둔다.
      const row = seasonRowOrThrow(db, id);
      const weeks = weekRowsOf(db, id);
      const entry = weeks.find((w) => w.week_no === firstWeeksOf(row, weeks).adv.week_no + 3);
      execute(db, 'UPDATE cohorts SET adv_leader_entry_from_week_id = ? WHERE cohort = ?', [
        entry?.id ?? null,
        id,
      ]);
      autoRosterOf(db, input.baseTerm, input.advTerm).forEach((member) =>
        execute(
          db,
          `INSERT INTO member_enrollment (member_id, activity_season_id, season_role, parallel_track)
           SELECT id, ?, ?, parallel_track FROM users WHERE id = ?`,
          [id, roleOfTerm(member.term, input.baseTerm), member.id],
        ),
      );
      const detail = seasonDetailOf(db, seasonRowOrThrow(db, id));
      return created({
        id: detail.id,
        name: detail.name,
        year: detail.year,
        half: detail.half,
        status: 'DRAFT',
        total_week_count: detail.total_week_count,
        void_weeks: detail.void_weeks.map((week) => ({
          week_id: week.week_id,
          week_no: week.week_no,
          period_type: week.period_type,
          period_week_no: week.period_week_no,
          start_date: week.start_date,
          end_date: week.end_date,
        })),
        first_weeks: detail.first_weeks,
        adv_leader_entry_from_week: detail.adv_leader_entry_from_week,
        roster_summary: detail.roster_summary,
      });
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/seasons/:seasonId`,
    summary: 'ATT-02 반기 상세',
    handler: ({ db, params }) =>
      ok(seasonDetailOf(db, seasonRowOrThrow(db, idParam(params.seasonId, 'seasonId')))),
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/seasons/:seasonId`,
    summary:
      'ATT-04 진행 예정(DRAFT) 반기 수정. 보낸 칸만 바꾼다. 기간을 바꾸면 같은 달력 주의 주차 id·휴강을 그대로 두고 주차를 다시 만든다',
    audit: seasonAudit('SEMESTER_UPDATE', {
      detail: ({ body }) => ({ fields: Object.keys(readBody(body)) }),
    }),
    handler: ({ db, params, body }) => {
      const id = idParam(params.seasonId, 'seasonId');
      const row = seasonRowOrThrow(db, id);
      if (statusOf(row) !== 'DRAFT') {
        throw conflict('SEASON_NOT_DRAFT', '진행 예정 반기만 고칠 수 있습니다.');
      }
      const input = readBody(body);
      onlyKeys(input, UPDATE_KEYS);
      const name = 'name' in input ? input.name : row.semester_label;
      if (typeof name !== 'string' || name === '') throw invalid('name은 빈 값일 수 없습니다.');
      const half = 'half' in input ? oneOfValue(input.half, HALVES, 'half') : (row.half ?? 'H1');
      checkNameHalf(name, half);
      if (
        listSeasonRows(db).some((other) => other.cohort !== id && isSameYearHalf(other, name, half))
      ) {
        throw conflict('DUPLICATE_ACTIVITY_SEASON', '같은 연도·반기의 반기가 이미 있습니다.');
      }
      const current = queryAll<{
        period_type: PeriodTypeValue;
        start_date: string;
        end_date: string;
      }>(
        db,
        'SELECT period_type, start_date, end_date FROM season_period WHERE activity_season_id = ?',
        [id],
      );
      const currentRange = (type: PeriodTypeValue): DateRange => {
        const period = current.find((p) => p.period_type === type);
        return { startDate: period?.start_date ?? '', endDate: period?.end_date ?? '' };
      };
      const sent = 'periods' in input ? periodsOf(input.periods) : {};
      const vacation = sent.VACATION ?? currentRange('VACATION');
      const term = sent.SEMESTER ?? currentRange('SEMESTER');
      checkNoOverlap(vacation, term);
      const starts = Object.fromEntries(
        START_KEYS.map((key) => [key, key in input ? dateOf(input[key], key) : (row[key] ?? '')]),
      ) as Record<StartKey, string>;
      checkStarts(starts, vacation, term);
      const scoreRuleSetId =
        'score_rule_set_id' in input
          ? scoreRuleSetIdOf(db, input.score_rule_set_id)
          : row.score_rule_set_id;

      const plan = 'periods' in input ? planWeeks(db, id, vacation, term) : null;
      const isEntrySent = 'adv_leader_entry_from_week_id' in input;
      const entryId = isEntrySent
        ? input.adv_leader_entry_from_week_id
        : row.adv_leader_entry_from_week_id;
      if (entryId !== null && (typeof entryId !== 'number' || !Number.isInteger(entryId))) {
        throw invalid('adv_leader_entry_from_week_id는 주차 id여야 합니다.');
      }
      if (entryId !== null && !weekRowsOf(db, id).some((w) => w.id === entryId)) {
        throw invalid('다른 반기의 주차는 ADV 팀장 입력 시작 주차로 정할 수 없습니다.');
      }
      if (plan && !isEntrySent && entryId !== null) {
        if (plan.removed.some((w) => w.id === entryId)) {
          throw conflict('SEASON_WEEK_IN_USE', 'ADV 팀장 입력 시작 주차가 없어지는 기간입니다.');
        }
        const before = weekRowsOf(db, id).find((w) => w.id === entryId)?.week_no;
        if (plan.weekNoAfter(entryId) !== before) {
          throw conflict(
            'SEASON_ADV_ENTRY_WEEK_CHANGED',
            'ADV 팀장 입력 시작 주차의 번호가 바뀝니다. 다시 정해 주세요.',
          );
        }
      }

      plan?.apply();
      execute(
        db,
        `UPDATE cohorts SET semester_label = ?, half = ?, start_date = ?, end_date = ?,
                            base_start_on = ?, adv_start_on = ?, vacation_study_start_on = ?,
                            semester_study_start_on = ?, score_rule_set_id = ?,
                            adv_leader_entry_from_week_id = ?
          WHERE cohort = ?`,
        [
          name,
          half,
          vacation.startDate,
          term.endDate,
          starts.base_start_on,
          starts.adv_start_on,
          starts.vacation_study_start_on,
          starts.semester_study_start_on,
          scoreRuleSetId,
          entryId as number | null,
          id,
        ],
      );
      syncLegacyEntryWeek(db, id);
      // ATT-04 응답은 상세(ATT-02)에서 void_weeks를 뺀 모양이다.
      const detail: Partial<SeasonDetail> = seasonDetailOf(db, seasonRowOrThrow(db, id));
      delete detail.void_weeks;
      return ok(detail);
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/seasons/:seasonId`,
    summary:
      'ATT-83 진행 예정(DRAFT) 반기 삭제. 기간·주차·명단·그룹을 함께 지운다. 출결 기록이 있으면 409 SEASON_NOT_DELETABLE',
    // 지우기 전 그 반기의 팀·출결·행사 기록 건수를 함께 남긴다.
    audit: seasonAudit('SEMESTER_DELETE', {
      before: ({ db, params }) => ({ ...semesterRecordCounts(db, Number(params.seasonId)) }),
      detail: (_request, { before }) => before,
    }),
    handler: ({ db, params }) => {
      const id = idParam(params.seasonId, 'seasonId');
      const row = seasonRowOrThrow(db, id);
      const hasRecords =
        queryAll(
          db,
          `SELECT 1 FROM attendance_records r JOIN teams t ON t.id = r.team_id
            WHERE t.semester_cohort = ? AND r.status <> 'unmarked' LIMIT 1`,
          [id],
        ).length > 0;
      if (statusOf(row) !== 'DRAFT' || hasRecords) {
        throw conflict(
          'SEASON_NOT_DELETABLE',
          '진행 예정 반기이고 출결 기록이 없을 때만 지울 수 있습니다.',
        );
      }
      execute(db, 'DELETE FROM teams WHERE semester_cohort = ?', [id]);
      execute(db, 'DELETE FROM cohorts WHERE cohort = ?', [id]);
      return ok(null);
    },
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/seasons/:seasonId/activate`,
    summary:
      'ATT-05 진행 예정 반기 활성화. 진행 반기가 있으면 409 ACTIVE_SEASON_EXISTS(먼저 종료한다)',
    audit: seasonAudit('SEMESTER_ACTIVATE'),
    handler: ({ db, params, body }) => {
      if (Object.keys(readBody(body)).length > 0) throw invalid('본문 없이 보내야 합니다.');
      const id = idParam(params.seasonId, 'seasonId');
      const row = seasonRowOrThrow(db, id);
      const active = listSeasonRows(db).find((other) => statusOf(other) === 'ACTIVE');
      if (active && active.cohort !== id) {
        throw conflict(
          'ACTIVE_SEASON_EXISTS',
          `진행 중인 반기(${active.semester_label})가 있습니다.`,
        );
      }
      if (statusOf(row) !== 'DRAFT') {
        throw conflict('SEASON_NOT_DRAFT', '진행 예정 반기만 활성화할 수 있습니다.');
      }
      execute(db, 'UPDATE cohorts SET is_current = 1, is_preparing = 0 WHERE cohort = ?', [id]);
      return ok({
        id,
        name: row.semester_label,
        year: yearOf(row.semester_label),
        half: row.half ?? 'H1',
        status: 'ACTIVE',
        is_editable: false,
      });
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/seasons/:seasonId/weeks`,
    // shortcut: group_id를 받아도 activity_week_no를 계산하지 않는다(반기 관리 화면은 그룹 없이 부른다).
    summary: 'ATT-08 반기 주차 목록',
    handler: ({ db, params }) =>
      ok(seasonWeeksOf(db, seasonRowOrThrow(db, idParam(params.seasonId, 'seasonId')))),
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/weeks/:weekId/void`,
    summary:
      'ATT-09 공통 주차 휴강 지정·해제. dry_run=true면 저장하지 않는다. 반기 전체 2주까지. 종료 반기는 409 SEASON_ARCHIVED',
    audit: {
      action: 'SEMESTER_WEEK_VOID',
      targetType: 'SEMESTER',
      targets: weekTarget,
      detail: ({ body }) => ({ isVoid: readBody(body).is_void }),
      isSkipped: ({ query }) => query.get('dry_run') === 'true',
    },
    handler: ({ db, params, body, query }) => {
      const { week, season } = seasonOfWeek(db, idParam(params.weekId, 'weekId'));
      if (statusOf(season) === 'ARCHIVED') throw conflict('SEASON_ARCHIVED', '종료된 반기입니다.');
      const input = readBody(body);
      onlyKeys(input, ['is_void']);
      const isVoid = booleanOf(input.is_void, 'is_void');
      const isDryRun = booleanQuery(query, 'dry_run');
      const weeks = weekRowsOf(db, season.cohort);
      const changed = (week.is_void === 1) !== isVoid;
      if (isVoid && changed && weeks.filter((w) => w.is_void === 1).length >= MAX_VOID_WEEKS) {
        throw new ApiError(
          400,
          'SEASON_VOID_WEEK_LIMIT_EXCEEDED',
          '휴강은 최대 2주까지 지정할 수 있습니다.',
        );
      }
      const impact = voidImpactOf(db, season.cohort, {
        weekNo: week.week_no,
        periodType: week.period_type,
        startDate: week.start_date,
        endDate: week.end_date,
      });
      if (changed && !isDryRun) {
        execute(db, 'UPDATE season_week SET is_void = ? WHERE id = ?', [isVoid ? 1 : 0, week.id]);
      }
      return ok({
        week_id: week.id,
        week_no: week.week_no,
        period_type: week.period_type,
        period_week_no: periodWeekNoOf(weeks, week),
        start_date: week.start_date,
        end_date: week.end_date,
        is_void: isVoid,
        changed,
        dry_run: isDryRun,
        // shortcut: 임시 DB에는 제출·스터디 회차가 없어 그 건수는 0이다.
        impact: {
          session_count: impact.sessionCount,
          record_count: impact.recordCount,
          pending_submission_count: 0,
          confirmed_submission_count: 0,
          study_round_count: 0,
        },
      });
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/seasons/:seasonId/archive-readiness`,
    summary: 'ATT-10 반기 종료 사전 점검. 조회만 한다. 임시 API는 마지막 주차가 끝났는지만 본다',
    handler: ({ db, params, query }) => {
      const row = seasonRowOrThrow(db, idParam(params.seasonId, 'seasonId'));
      const periodId = query.get('period_id');
      return ok(readinessOf(db, row, periodId === null ? null : idParam(periodId, 'period_id')));
    },
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/seasons/:seasonId/archive`,
    summary:
      'ATT-11 진행 반기 종료. 본문 { confirm: true }. 점검을 통과하지 못하면 409 SEASON_NOT_FINISHED. 맡은 그룹이 없어진 HOST 계정을 지운다',
    audit: seasonAudit('SEMESTER_ARCHIVE'),
    handler: ({ db, params, body }) => {
      const id = idParam(params.seasonId, 'seasonId');
      const row = seasonRowOrThrow(db, id);
      const input = readBody(body);
      if (input.confirm !== true || Object.keys(input).length !== 1) {
        throw invalid('종료하려면 { confirm: true }만 보내야 합니다.');
      }
      const status = statusOf(row);
      if (status === 'ARCHIVED') throw conflict('SEASON_ARCHIVED', '이미 종료된 반기입니다.');
      if (status === 'DRAFT')
        throw conflict('SEASON_NOT_ACTIVE', '진행 중인 반기만 종료할 수 있습니다.');
      if (!readinessOf(db, row, null).can_archive) {
        throw conflict('SEASON_NOT_FINISHED', '아직 끝나지 않은 주차나 제출이 있습니다.');
      }
      execute(db, 'UPDATE cohorts SET is_current = 0 WHERE cohort = ?', [id]);
      execute(db, 'DELETE FROM admin_group_leader');
      const removed = cleanupHostAccounts(db);
      return ok({
        id,
        name: row.semester_label,
        status: 'ARCHIVED',
        // shortcut: 임시 DB는 점수 고정본을 만들지 않는다.
        snapshot_count: 0,
        scored_enrollment_count: enrollmentsOf(db, id).length,
        removed_host_account_count: removed.length,
      });
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/score-rule-sets`,
    // shortcut: 반기 관리 화면이 쓰는 칸만 채운다. 점수 규칙 탭을 이 API로 옮길 때 나머지 칸(calc_version 등)을 넣는다.
    summary: 'ATT-12 점수 규칙 버전 목록(협의 중). 만든 순서 내림차순',
    handler: ({ db }) => {
      const seasons = listSeasonRows(db);
      const ruleSets = queryAll<{ id: number; name: string; created_at: string }>(
        db,
        'SELECT rowid AS id, name, COALESCE(activated_at, start_date) AS created_at FROM score_rules ORDER BY rowid DESC',
      ).map((rule) => {
        const users = seasons.filter((season) => season.score_rule_set_id === rule.id);
        return {
          ...rule,
          used_by_seasons: users.map((season) => ({
            season_id: season.cohort,
            name: season.semester_label,
            status: statusOf(season),
          })),
          is_used_by_active_season: users.some((season) => statusOf(season) === 'ACTIVE'),
        };
      });
      return ok({ rule_sets: ruleSets, required_rule_keys: [] });
    },
  },
  {
    method: 'GET',
    pattern: `${BASE}/seasons/:seasonId/enrollments`,
    summary: 'ATT-18 반기 명단(협의 중). 구분 → 기수 내림차순 → 이름 순',
    handler: ({ db, params, query }) => {
      const row = seasonRowOrThrow(db, idParam(params.seasonId, 'seasonId'));
      const terms = multiQuery(query, 'term').map((value) => idParam(value, 'term'));
      return ok(
        enrollmentListOf(db, row.cohort, {
          terms,
          roles: enumQuery(query, 'season_role', ROLES),
          tracks: enumQuery(query, 'track', TRACKS).map((track) => TRACK_OF_VALUE[track]),
          keyword: query.get('keyword')?.trim() || undefined,
          includeCancelled: booleanQuery(query, 'include_cancelled'),
        }),
      );
    },
  },
  {
    method: 'POST',
    pattern: `${BASE}/seasons/:seasonId/enrollments`,
    summary:
      'ATT-19 반기 개별 등록(협의 중). 등록 취소한 회원이면 다시 살린다(is_rejoined). 탈동 회원은 409 MEMBER_WITHDRAWN',
    audit: enrollmentAudit(seasonTarget),
    handler: ({ db, params, body }) => {
      const season = assertSeasonNotArchived(db, idParam(params.seasonId, 'seasonId'));
      const input = readBody(body);
      onlyKeys(input, [
        'member_id',
        'season_role',
        'menmen_joined',
        'chinba_joined',
        'parallel_track',
        'note',
      ]);
      if (typeof input.member_id !== 'string' || input.member_id === '') {
        throw invalid('member_id 값이 필요합니다.');
      }
      const member = queryAll<{ id: string; track: UserTrack; club_status: string }>(
        db,
        'SELECT id, track, club_status FROM users WHERE id = ? AND deleted_at IS NULL',
        [input.member_id],
      )[0];
      if (!member) throw new ApiError(404, 'MEMBER_NOT_FOUND', '회원을 찾을 수 없습니다.');
      const role = oneOfValue(input.season_role, ROLES, 'season_role');
      const parallel =
        'parallel_track' in input ? trackOf(input.parallel_track, 'parallel_track') : null;
      if (parallel && role === 'COMPLETED')
        throw invalid('수료 기수는 병행 부문을 정할 수 없습니다.');
      if (parallel && parallel === member.track)
        throw invalid('병행 부문은 회원의 부문과 달라야 합니다.');
      const menmen =
        'menmen_joined' in input ? booleanOf(input.menmen_joined, 'menmen_joined') : true;
      const chinba =
        'chinba_joined' in input ? booleanOf(input.chinba_joined, 'chinba_joined') : true;
      const note = 'note' in input ? noteOf(input.note) : null;
      const existing = queryAll<{ id: number; deleted_at: string | null }>(
        db,
        'SELECT id, deleted_at FROM member_enrollment WHERE activity_season_id = ? AND member_id = ?',
        [season.cohort, member.id],
      )[0];
      if (existing && existing.deleted_at === null) {
        throw conflict('DUPLICATE_ENROLLMENT', '이미 이 반기 명단에 있는 회원입니다.');
      }
      if (member.club_status === 'WITHDRAWN') {
        throw conflict('MEMBER_WITHDRAWN', '탈동한 회원은 명단에 넣을 수 없습니다.');
      }
      const values = [role, menmen ? 1 : 0, chinba ? 1 : 0, parallel, note];
      if (existing) {
        execute(
          db,
          `UPDATE member_enrollment SET season_role = ?, menmen_joined = ?, chinba_joined = ?,
                  parallel_track = ?, note = ?, deleted_at = NULL, version = version + 1
            WHERE id = ?`,
          [...values, existing.id],
        );
      } else {
        execute(
          db,
          `INSERT INTO member_enrollment (season_role, menmen_joined, chinba_joined, parallel_track, note,
                                          member_id, activity_season_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [...values, member.id, season.cohort],
        );
      }
      const enrollmentId =
        existing?.id ?? queryAll<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')[0].id;
      const [enrollment] = enrollmentsOf(db, season.cohort, { enrollmentId });
      return created({ ...enrollment, is_rejoined: existing !== undefined });
    },
  },
  {
    method: 'PATCH',
    pattern: `${BASE}/enrollments/:enrollmentId`,
    summary:
      'ATT-21 반기 등록 수정(협의 중). version이 다르면 409 OPTIMISTIC_LOCK_CONFLICT. 출결·그룹이 있으면 구분을 바꿀 수 없다(409 ENROLLMENT_IN_USE)',
    audit: enrollmentAudit(enrollmentTarget),
    handler: ({ db, params, body }) => {
      const enrollment = liveEnrollment(db, idParam(params.enrollmentId, 'enrollmentId'));
      assertSeasonNotArchived(db, enrollment.activity_season_id);
      const input = readBody(body);
      onlyKeys(input, [
        'version',
        'season_role',
        'menmen_joined',
        'chinba_joined',
        'parallel_track',
        'note',
      ]);
      if (typeof input.version !== 'number') throw invalid('version 값이 필요합니다.');
      if (input.version !== enrollment.version) {
        throw conflict(
          'OPTIMISTIC_LOCK_CONFLICT',
          '다른 사람이 먼저 고쳤습니다. 다시 불러온 뒤 고쳐 주세요.',
        );
      }
      const role =
        'season_role' in input
          ? oneOfValue(input.season_role, ROLES, 'season_role')
          : enrollment.season_role;
      const memberTrack = queryAll<{ track: UserTrack }>(
        db,
        'SELECT track FROM users WHERE id = ?',
        [enrollment.member_id],
      )[0]?.track;
      const current = enrollmentsOf(db, enrollment.activity_season_id, {
        enrollmentId: enrollment.id,
      })[0];
      const parallel =
        'parallel_track' in input
          ? trackOf(input.parallel_track, 'parallel_track')
          : current.parallel_track && TRACK_OF_VALUE[current.parallel_track];
      if (parallel && role === 'COMPLETED')
        throw invalid('수료 기수는 병행 부문을 정할 수 없습니다.');
      if (parallel && parallel === memberTrack)
        throw invalid('병행 부문은 회원의 부문과 달라야 합니다.');
      const groups = groupKindsOf(db, enrollment.activity_season_id, enrollment.member_id);
      if (
        role !== enrollment.season_role &&
        (groups.length > 0 ||
          hasAttendance(db, enrollment.activity_season_id, enrollment.member_id))
      ) {
        throw conflict('ENROLLMENT_IN_USE', '그룹이나 출결 기록이 있어 구분을 바꿀 수 없습니다.');
      }
      const menmen =
        'menmen_joined' in input
          ? booleanOf(input.menmen_joined, 'menmen_joined')
          : current.menmen_joined;
      if (!menmen && groups.some((group) => group.kind === 'MENTORING')) {
        throw conflict('ENROLLMENT_IN_USE', '멘멘 스터디에 속해 있어 멘멘 참여를 끌 수 없습니다.');
      }
      const chinba =
        'chinba_joined' in input
          ? booleanOf(input.chinba_joined, 'chinba_joined')
          : current.chinba_joined;
      const note = 'note' in input ? noteOf(input.note) : current.note;
      execute(
        db,
        `UPDATE member_enrollment SET season_role = ?, menmen_joined = ?, chinba_joined = ?,
                parallel_track = ?, note = ?, version = version + 1
          WHERE id = ?`,
        [role, menmen ? 1 : 0, chinba ? 1 : 0, parallel ?? null, note, enrollment.id],
      );
      return ok(
        enrollmentsOf(db, enrollment.activity_season_id, { enrollmentId: enrollment.id })[0],
      );
    },
  },
  {
    method: 'DELETE',
    pattern: `${BASE}/enrollments/:enrollmentId`,
    summary:
      'ATT-22 반기 등록 취소(협의 중). 쿼리 version 필수. 출결 기록이 있으면 409 ENROLLMENT_IN_USE. 그 반기 그룹에서도 뺀다',
    audit: enrollmentAudit(enrollmentTarget),
    handler: ({ db, params, query }) => {
      const versionValue = query.get('version');
      if (versionValue === null)
        throw new ApiError(400, 'MISSING_PARAMETER', 'version 값이 필요합니다.');
      const version = Number(versionValue);
      if (!Number.isInteger(version)) {
        throw new ApiError(400, 'INVALID_PARAMETER_TYPE', 'version 값은 정수여야 합니다.');
      }
      const enrollment = liveEnrollment(db, idParam(params.enrollmentId, 'enrollmentId'));
      assertSeasonNotArchived(db, enrollment.activity_season_id);
      if (version !== enrollment.version) {
        throw conflict(
          'OPTIMISTIC_LOCK_CONFLICT',
          '다른 사람이 먼저 고쳤습니다. 다시 불러온 뒤 고쳐 주세요.',
        );
      }
      if (hasAttendance(db, enrollment.activity_season_id, enrollment.member_id)) {
        throw conflict('ENROLLMENT_IN_USE', '출결 기록이 있어 명단에서 뺄 수 없습니다.');
      }
      execute(
        db,
        `DELETE FROM team_members WHERE user_id = ?
           AND team_id IN (SELECT id FROM teams WHERE semester_cohort = ?)`,
        [enrollment.member_id, enrollment.activity_season_id],
      );
      execute(
        db,
        'UPDATE member_enrollment SET deleted_at = ?, version = version + 1 WHERE id = ?',
        [localDateTime(), enrollment.id],
      );
      return ok(null);
    },
  },
];
