/**
 * 여러 라우트가 함께 쓰는 조회 함수. 응답 형태(DTO)는 각 entity의 model/dto.ts에 있고,
 * 화면 쪽 API 함수(각 entity의 api 폴더)와 이 임시 API가 같은 타입을 쓴다.
 */
import type { Database } from 'sql.js';

import type {
  AttendanceRecordDto,
  SessionDto,
  SessionSummaryDto,
  StatusCounts,
  SubType,
} from '@/entities/attendance/model/dto';
import type { AttendanceStatus } from '@/entities/attendance/model/types';
import type { WeekInfo, WeekStatus } from '@/entities/attendance/model/week';
import type {
  SemesterAttendanceKind,
  SemesterDto,
  SemesterWeekDto,
} from '@/entities/cohort/model/dto';
import {
  type MemberDto,
  type StudyKind,
  type StudyPeriod,
  TEAM_API_PATHS,
  type TeamDto,
  type TeamGroup,
} from '@/entities/study-team/model/dto';
import { execute, queryAll } from '@/shared/db/createDatabase';
import { resolveFileUrl } from '@/shared/lib/file';
import { resolveImageUrl } from '@/shared/lib/imagePath';

import { ApiError } from './router';

export type { SubType } from '@/entities/attendance/model/dto';
export type {
  MemberDto,
  StudyKind,
  StudyPeriod,
  TeamDto,
  TeamGroup,
} from '@/entities/study-team/model/dto';

export const TEAM_GROUPS: readonly TeamGroup[] = ['STUDY', 'ADV', 'BASE'];
export const TEAM_PATHS = TEAM_API_PATHS;
export const STUDY_PERIODS: readonly StudyPeriod[] = ['방학', '학기'];
export const STUDY_KINDS: readonly StudyKind[] = ['GENERAL', 'MENTORING'];
export const MENTORING_SUB_TYPES: readonly SubType[] = ['멘멘', '친바'];
export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  'present',
  'late',
  'earlyLeave',
  'absent',
  'excusedAbsent',
  'remote',
  'unexcusedLate',
  'unexcusedAbsent',
  'unmarked',
];

export const notFound = (message: string) => new ApiError(404, 'NOT_FOUND', message);

// ───────────────────────────── 반기·주차 ─────────────────────────────

interface SemesterRow extends Record<string, unknown> {
  cohort: number;
  semester_label: string;
  start_date: string;
  end_date: string;
  is_current: number;
  adv_term: number | null;
}

function toSemesterDto(db: Database, row: SemesterRow): SemesterDto {
  const weeks = semesterWeeks(db, row.cohort);
  const currentWeekNum = currentWeekNumOf(weeks);
  return {
    cohort: row.cohort,
    semester: row.semester_label,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current === 1,
    advTerm: row.adv_term,
    memberTerms: queryAll<{ term: number }>(
      db,
      'SELECT term FROM semester_member_terms WHERE cohort = ? ORDER BY term',
      [row.cohort],
    ).map((item) => item.term),
    currentWeekNum,
    currentPeriod: weeks.find((week) => week.weekNum === currentWeekNum)?.period ?? null,
    attendanceKinds: attendanceKindsOf(db, row.cohort),
  };
}

/** 반기에 출결이 등록된 구분: 그 반기의 팀(BASE·ADV·스터디)과 행사가 있는지. */
function attendanceKindsOf(db: Database, cohort: number): SemesterAttendanceKind[] {
  const teamGroups = queryAll<{ group_type: 'BASE' | 'ADV' | 'STUDY' }>(
    db,
    'SELECT DISTINCT group_type FROM teams WHERE semester_cohort = ?',
    [cohort],
  ).map((row) => row.group_type);
  const hasEvents =
    queryAll<{ id: string }>(db, 'SELECT id FROM events WHERE semester_cohort = ? LIMIT 1', [
      cohort,
    ]).length > 0;
  return [...teamGroups, ...(hasEvents ? (['EVENT'] as const) : [])];
}

const SEMESTER_SELECT =
  'SELECT cohort, semester_label, start_date, end_date, is_current, adv_term FROM cohorts';

/** 현재 반기와 지난 반기(큰 기수부터). 미리 만들어 둔 다음 반기는 넣지 않는다. */
export function listSemesters(db: Database): SemesterDto[] {
  return queryAll<SemesterRow>(
    db,
    `${SEMESTER_SELECT}
      WHERE cohort <= (SELECT cohort FROM cohorts WHERE is_current = 1)
      ORDER BY cohort DESC`,
  ).map((row) => toSemesterDto(db, row));
}

export function semesterByCohort(db: Database, cohort: number): SemesterDto | null {
  const row = queryAll<SemesterRow>(db, `${SEMESTER_SELECT} WHERE cohort = ?`, [cohort])[0];
  return row ? toSemesterDto(db, row) : null;
}

export function currentSemester(db: Database): SemesterDto {
  const row = queryAll<SemesterRow>(db, `${SEMESTER_SELECT} WHERE is_current = 1`)[0];
  if (!row) throw new ApiError(409, 'NO_CURRENT_SEMESTER', '현재 반기가 지정되어 있지 않습니다.');
  return toSemesterDto(db, row);
}

/** 현재 반기 다음으로 등록된 반기. 없으면 null. */
function registeredNextSemester(db: Database): SemesterDto | null {
  const row = queryAll<SemesterRow>(
    db,
    `${SEMESTER_SELECT}
      WHERE cohort > (SELECT cohort FROM cohorts WHERE is_current = 1)
      ORDER BY cohort LIMIT 1`,
  )[0];
  return row ? toSemesterDto(db, row) : null;
}

export const canCreateNextSemester = (db: Database): boolean => registeredNextSemester(db) === null;

/**
 * 현재 반기 바로 다음 반기의 값. 기수 번호·ADV 기수·점수 집계 대상 기수는 하나씩 올리고,
 * 반기 표기와 기간은 상반기(1~6월)·하반기(7~12월)를 번갈아 정한다. 예: 26-2(27) → 27-1(28)
 */
function plannedNextSemester(current: SemesterDto): SemesterDto {
  const [year, half] = current.semester.split('-').map(Number);
  const nextYear = half === 2 ? year + 1 : year;
  const nextHalf = half === 2 ? 1 : 2;
  const fullYear = 2000 + nextYear;
  return {
    cohort: current.cohort + 1,
    semester: `${String(nextYear).padStart(2, '0')}-${nextHalf}`,
    startDate: nextHalf === 1 ? `${fullYear}-01-01` : `${fullYear}-07-01`,
    endDate: nextHalf === 1 ? `${fullYear}-06-30` : `${fullYear}-12-31`,
    isCurrent: false,
    advTerm: current.advTerm === null ? null : current.advTerm + 1,
    memberTerms: current.memberTerms.map((term) => term + 1),
    currentWeekNum: null,
    currentPeriod: null,
    attendanceKinds: [],
  };
}

/** 다음 반기. 등록되어 있으면 그 반기, 없으면 '새 반기 시작' 때 등록될 반기의 값(아직 저장하지 않음). */
export function nextSemester(db: Database): SemesterDto {
  return registeredNextSemester(db) ?? plannedNextSemester(currentSemester(db));
}

/** 반기를 등록한다. 주차는 모두 진행 예정으로 만든다. */
export function insertSemester(db: Database, semester: SemesterDto): void {
  execute(
    db,
    `INSERT INTO cohorts (cohort, semester_label, start_date, end_date, is_current, adv_term)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [semester.cohort, semester.semester, semester.startDate, semester.endDate, semester.advTerm],
  );
  semester.memberTerms.forEach((term) =>
    execute(db, 'INSERT INTO semester_member_terms (cohort, term) VALUES (?, ?)', [
      semester.cohort,
      term,
    ]),
  );
  execute(
    db,
    "INSERT INTO semester_weeks (cohort, week_id, status) SELECT ?, id, 'UPCOMING' FROM weeks",
    [semester.cohort],
  );
}

/** 반기 표기(예: '26-2')로 반기를 찾는다. 값이 없으면 현재 반기. 등록되지 않은 반기면 404. */
export function resolveSemester(db: Database, label: string | null | undefined): SemesterDto {
  if (!label) return currentSemester(db);
  const row = queryAll<SemesterRow>(db, `${SEMESTER_SELECT} WHERE semester_label = ?`, [label])[0];
  if (!row) throw notFound(`등록되지 않은 반기입니다: ${label}`);
  return toSemesterDto(db, row);
}

/** 반기의 주차별 진행 상태와 날짜. 상태 행이 없는 주차는 진행 예정이다. */
export function semesterWeeks(db: Database, cohort: number): SemesterWeekDto[] {
  return queryAll<{
    week_num: number;
    label: string;
    period: StudyPeriod;
    status: WeekStatus;
    date: string | null;
  }>(
    db,
    `SELECT w.week_num, w.label, w.period, COALESCE(sw.status, 'UPCOMING') AS status, d.date
       FROM weeks w
       LEFT JOIN semester_weeks sw ON sw.cohort = ? AND sw.week_id = w.id
       LEFT JOIN cohort_week_dates d ON d.cohort = ? AND d.week_num = w.week_num
      ORDER BY w.week_num`,
    [cohort, cohort],
  ).map((row) => ({
    weekNum: row.week_num,
    label: row.label,
    period: row.period,
    status: row.status,
    date: row.date,
  }));
}

export function findSemesterWeek(db: Database, cohort: number, weekNum: number): SemesterWeekDto {
  const week = semesterWeeks(db, cohort).find((item) => item.weekNum === weekNum);
  if (!week) throw notFound(`${weekNum}주차가 없습니다.`);
  return week;
}

/** 반기의 지금 주차: 진행 중인 마지막 주차 → 종료된 마지막 주차. 모두 진행 예정이면 null. */
function currentWeekNumOf(weeks: readonly SemesterWeekDto[]): number | null {
  const open = weeks.filter((week) => week.status === 'OPEN').at(-1);
  if (open) return open.weekNum;
  return weeks.filter((week) => week.status === 'CLOSED').at(-1)?.weekNum ?? null;
}

/** 화면이 처음 보여줄 주차: 지금 주차, 반기 시작 전이면 첫 주차. */
export function defaultWeekNumOf(weeks: readonly SemesterWeekDto[]): number {
  return currentWeekNumOf(weeks) ?? weeks[0]?.weekNum ?? 1;
}

export function weekIdOf(db: Database, weekNum: number): string {
  const row = queryAll<{ id: string }>(db, 'SELECT id FROM weeks WHERE week_num = ?', [weekNum])[0];
  if (!row) throw notFound(`${weekNum}주차가 없습니다.`);
  return row.id;
}

// ───────────────────────────── 팀 ─────────────────────────────

interface TeamRow extends Record<string, unknown> {
  id: string;
  group_type: TeamGroup;
  cohort: number;
  track: string;
  team_name: string;
  study_name: string;
  kind: StudyKind;
  period: StudyPeriod;
  leader_id: string | null;
  leader_name: string | null;
  schedule: string;
  description: string;
  created_at: string;
  semester_cohort: number | null;
  semester_label: string | null;
}

const TEAM_SELECT = `SELECT t.id, t.group_type, t.cohort, t.track, t.team_name, t.study_name, t.kind, t.period,
                            t.leader_id, u.name AS leader_name, t.schedule, t.description, t.created_at,
                            ts.semester_cohort, c.semester_label
                       FROM teams t
                       JOIN team_semesters ts ON ts.team_id = t.id
                       LEFT JOIN cohorts c ON c.cohort = ts.semester_cohort
                       LEFT JOIN users u ON u.id = t.leader_id
                       LEFT JOIN tracks tr ON tr.name = t.track`;

const toTeamDto = (row: TeamRow): TeamDto => ({
  id: row.id,
  group: row.group_type,
  cohort: row.cohort,
  semester: row.semester_label,
  track: row.track,
  teamName: row.team_name,
  studyName: row.study_name,
  kind: row.kind,
  period: row.period,
  leaderId: row.leader_id,
  leaderName: row.leader_name,
  schedule: row.schedule,
  description: row.description,
  createdAt: row.created_at,
});

export interface TeamFilter {
  group?: TeamGroup;
  /** 팀이 출결을 진행하는 반기의 기수 번호. */
  semesterCohort?: number;
  /** teams.cohort(ADV는 회원 기수). */
  cohort?: number;
  period?: StudyPeriod;
  kind?: StudyKind;
  track?: string;
}

/** 조건에 맞는 팀을 멘멘 스터디 → 일반(그 외) → 부문 순서 → 생성 순서로 돌려준다. */
export function listTeams(db: Database, filter: TeamFilter): TeamDto[] {
  return queryAll<TeamRow>(
    db,
    `${TEAM_SELECT}
      WHERE (?1 IS NULL OR t.group_type = ?1)
        AND (?2 IS NULL OR ts.semester_cohort = ?2)
        AND (?3 IS NULL OR t.period = ?3)
        AND (?4 IS NULL OR t.kind = ?4)
        AND (?5 IS NULL OR t.track = ?5)
        AND (?6 IS NULL OR t.cohort = ?6)
      ORDER BY CASE t.kind WHEN 'MENTORING' THEN 0 ELSE 1 END, tr.sort_order, t.rowid`,
    [
      filter.group ?? null,
      filter.semesterCohort ?? null,
      filter.period ?? null,
      filter.kind ?? null,
      filter.track ?? null,
      filter.cohort ?? null,
    ],
  ).map(toTeamDto);
}

/** 팀을 찾는다. group을 주면 그 구분의 팀이 아닐 때도 404로 본다(다른 경로로 접근한 경우). */
export function findTeam(db: Database, teamId: string, group?: TeamGroup): TeamDto {
  const row = queryAll<TeamRow>(db, `${TEAM_SELECT} WHERE t.id = ?`, [teamId])[0];
  if (!row || (group && row.group_type !== group)) throw notFound('팀을 찾을 수 없습니다.');
  return toTeamDto(row);
}

// ───────────────────────────── 팀원 ─────────────────────────────

export function listMembers(db: Database, teamId: string): MemberDto[] {
  return queryAll<MemberDto & Record<string, unknown>>(
    db,
    `SELECT tm.id, tm.user_id AS userId, COALESCE(m.name, u.name) AS name,
            COALESCE(m.term, u.term) AS term, COALESCE(m.track, u.track) AS track
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       LEFT JOIN members m ON m.id = tm.member_id
      WHERE tm.team_id = ?
      ORDER BY tm.sort_order, tm.id`,
    [teamId],
  );
}

// ───────────────────────────── 출결 ─────────────────────────────

export function countStatuses(records: readonly AttendanceRecordDto[]): StatusCounts {
  const counts = Object.fromEntries(
    ATTENDANCE_STATUSES.map((status) => [status, 0]),
  ) as StatusCounts;
  records.forEach((record) => {
    counts[record.status] += 1;
  });
  return counts;
}

/** 팀의 주차별 출결(제출 상태·사진·PDF·팀원별 기록). weekNum을 주면 그 주차만 돌려준다. */
export function loadSessions(db: Database, teamId: string, weekNum?: number): SessionDto[] {
  const records = queryAll<{
    week_id: string;
    member_id: string;
    sub_type: SubType;
    status: AttendanceStatus;
    memo: string | null;
  }>(
    db,
    `SELECT r.week_id, r.member_id, r.sub_type, r.status, r.memo
       FROM attendance_records r
       JOIN team_members tm ON tm.id = r.member_id
      WHERE r.team_id = ?
      ORDER BY tm.sort_order, r.member_id, r.sub_type`,
    [teamId],
  );

  return queryAll<{
    week_id: string;
    week_num: number;
    label: string;
    period: StudyPeriod;
    week_status: WeekInfo['status'];
    submitted: number;
    submitted_at: string | null;
    image_path: string | null;
    image_url: string | null;
    image_name: string | null;
    image_size: string | null;
    pdf_url: string | null;
    pdf_name: string | null;
    pdf_size: string | null;
  }>(
    db,
    `SELECT s.week_id, w.week_num, w.label, w.period, COALESCE(sw.status, 'UPCOMING') AS week_status,
            s.submitted, s.submitted_at,
            i.path AS image_path, i.url AS image_url, i.original_name AS image_name, i.size_label AS image_size,
            s.pdf_url, s.pdf_name, s.pdf_size
       FROM attendance_sessions s
       JOIN weeks w ON w.id = s.week_id
       JOIN team_semesters ts ON ts.team_id = s.team_id
       LEFT JOIN semester_weeks sw ON sw.cohort = ts.semester_cohort AND sw.week_id = s.week_id
       LEFT JOIN images i ON i.id = s.image_id
      WHERE s.team_id = ? AND (? IS NULL OR w.week_num = ?)
      ORDER BY w.week_num`,
    [teamId, weekNum ?? null, weekNum ?? null],
  ).map((row) => ({
    weekNum: row.week_num,
    weekLabel: row.label,
    period: row.period,
    weekStatus: row.week_status,
    submitted: row.submitted === 1,
    submittedAt: row.submitted_at,
    photo: row.image_path
      ? {
          url: resolveImageUrl({ path: row.image_path, url: row.image_url }),
          name: row.image_name,
          size: row.image_size,
        }
      : null,
    pdf: row.pdf_url
      ? { url: resolveFileUrl(row.pdf_url), name: row.pdf_name, size: row.pdf_size }
      : null,
    records: records
      .filter((record) => record.week_id === row.week_id)
      .map((record) => ({
        memberId: record.member_id,
        subType: record.sub_type,
        status: record.status,
        memo: record.memo,
      })),
  }));
}

export function summarizeSession(session: SessionDto): SessionSummaryDto {
  return {
    weekNum: session.weekNum,
    weekStatus: session.weekStatus,
    submitted: session.submitted,
    submittedAt: session.submittedAt,
    hasPhoto: session.photo !== null,
    hasPdf: session.pdf !== null,
    counts: countStatuses(session.records),
  };
}
