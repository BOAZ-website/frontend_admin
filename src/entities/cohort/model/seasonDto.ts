/**
 * 반기 관리 API(백엔드 /api/v1/admin/attendance)의 요청·응답 형태. 백엔드 명세 그대로 snake_case다.
 * 화면은 이 타입을 직접 쓰지 않고 api/seasonApi.ts가 바꾼 모델(model/season.ts)을 쓴다.
 * ATT-01~05, 08~11, 82, 83은 확정, ATT-12, 18, 19, 21, 22는 협의 중인 명세다(2026-11-20).
 */

/** 성공 응답. 실패는 { status, data: null, error_code, message }다. */
export interface ApiEnvelope<T> {
  status: number;
  data: T;
}

export type SeasonStatusValue = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type HalfValue = 'H1' | 'H2';
export type PeriodTypeValue = 'VACATION' | 'SEMESTER';
export type SeasonRoleValue = 'BASE' | 'ADV' | 'COMPLETED';
export type TrackValue = 'ANALYSIS' | 'VISUALIZATION' | 'ENGINEERING';
export type MemberStatusValue = 'ACTIVE' | 'COMPLETED' | 'NOT_COMPLETED' | 'WITHDRAWN' | 'EXPELLED';

/** ATT-01 목록의 한 줄. */
export interface SeasonListItem {
  id: number;
  name: string;
  year: number;
  half: HalfValue;
  status: SeasonStatusValue;
  base_term: number;
  adv_term: number;
  start_date: string;
  end_date: string;
  is_editable: boolean;
}

export interface WeekRef {
  week_id: number;
  week_no: number;
}

export interface FirstWeeks {
  base: WeekRef;
  adv: WeekRef;
  vacation_study: WeekRef;
  semester_study: WeekRef;
}

export interface AdvLeaderEntryWeek extends WeekRef {
  activity_week_no: number;
  start_date: string;
  end_date: string;
}

export interface RosterSummaryItem {
  term: number;
  season_role: SeasonRoleValue;
  count: number;
}

/** ATT-02 상세. */
export interface SeasonDetail {
  id: number;
  name: string;
  year: number;
  half: HalfValue;
  status: SeasonStatusValue;
  is_editable: boolean;
  base_term: number;
  adv_term: number;
  base_start_on: string;
  adv_start_on: string;
  vacation_study_start_on: string;
  semester_study_start_on: string;
  first_weeks: FirstWeeks;
  adv_leader_entry_from_week: AdvLeaderEntryWeek | null;
  score_rule_set: { id: number; name: string };
  periods: {
    id: number;
    period_type: PeriodTypeValue;
    start_date: string;
    end_date: string;
    week_count: number;
  }[];
  total_week_count: number;
  void_weeks: {
    week_id: number;
    week_no: number;
    period_type: PeriodTypeValue;
    period_week_no: number;
    base_week_no: number | null;
    adv_week_no: number | null;
    start_date: string;
    end_date: string;
  }[];
  roster_summary: RosterSummaryItem[];
}

/** ATT-04 응답: ATT-02 모양에서 void_weeks가 없다. */
export type SeasonUpdateResult = Omit<SeasonDetail, 'void_weeks'>;

export interface PeriodInput {
  period_type: PeriodTypeValue;
  start_date: string;
  end_date: string;
}

/** ATT-03 요청. */
export interface CreateSeasonRequest {
  name: string;
  half: HalfValue;
  base_term: number;
  adv_term: number;
  score_rule_set_id: number;
  periods: PeriodInput[];
  base_start_on: string;
  adv_start_on: string;
  vacation_study_start_on: string;
  semester_study_start_on: string;
  void_week_nos?: number[];
}

/** ATT-03 응답. */
export interface CreateSeasonResult {
  id: number;
  name: string;
  year: number;
  half: HalfValue;
  status: 'DRAFT';
  total_week_count: number;
  void_weeks: Omit<SeasonDetail['void_weeks'][number], 'base_week_no' | 'adv_week_no'>[];
  first_weeks: FirstWeeks;
  adv_leader_entry_from_week: AdvLeaderEntryWeek | null;
  roster_summary: RosterSummaryItem[];
}

/** ATT-82 요청: ATT-03에서 score_rule_set_id만 뺀 모양. */
export type SeasonPreviewRequest = Omit<CreateSeasonRequest, 'score_rule_set_id'>;

export interface ActivityWeekNos {
  base: number | null;
  adv: number | null;
  vacation_study: number | null;
  semester_study: number | null;
}

/** ATT-82 응답. 저장하지 않는다. */
export interface SeasonPreview {
  year: number;
  half: HalfValue;
  conflicts: { duplicate_year_half: boolean; duplicate_base_term: boolean };
  total_week_count: number;
  weeks: {
    week_no: number;
    period_type: PeriodTypeValue;
    period_week_no: number;
    start_date: string;
    end_date: string;
    is_void: boolean;
    activity_week_nos: ActivityWeekNos;
  }[];
  first_weeks: Record<keyof FirstWeeks, { week_no: number }>;
  adv_leader_entry_from_week_no: number | null;
  roster_summary: RosterSummaryItem[];
  roster_members: {
    member_id: string;
    name: string;
    name_suffix: string | null;
    term: number;
    track: TrackValue;
    season_role: 'BASE' | 'ADV';
  }[];
}

/** ATT-04 요청. 보낸 칸만 바꾼다. */
export interface UpdateSeasonRequest {
  name?: string;
  half?: HalfValue;
  base_start_on?: string;
  adv_start_on?: string;
  vacation_study_start_on?: string;
  semester_study_start_on?: string;
  adv_leader_entry_from_week_id?: number | null;
  score_rule_set_id?: number;
  periods?: PeriodInput[];
}

/** ATT-05 응답. */
export interface ActivateSeasonResult {
  id: number;
  name: string;
  year: number;
  half: HalfValue;
  status: 'ACTIVE';
  is_editable: false;
}

/** ATT-08 주차 한 줄. */
export interface SeasonWeek {
  week_id: number;
  week_no: number;
  period_id: number;
  period_type: PeriodTypeValue;
  period_week_no: number;
  start_date: string;
  end_date: string;
  is_void: boolean;
  is_current: boolean;
  is_closed: boolean;
  activity_week_nos: ActivityWeekNos;
  activity_week_no: number | null;
  is_adv_leader_entry_start: boolean;
  is_adv_leader_entry_open: boolean;
}

/** ATT-09 응답. */
export interface WeekVoidResult {
  week_id: number;
  week_no: number;
  period_type: PeriodTypeValue;
  period_week_no: number;
  start_date: string;
  end_date: string;
  is_void: boolean;
  changed: boolean;
  dry_run: boolean;
  impact: {
    session_count: number;
    record_count: number;
    pending_submission_count: number;
    confirmed_submission_count: number;
    study_round_count: number;
  };
}

/** ATT-10 응답. */
export interface ArchiveReadiness {
  season_id: number;
  season_status: SeasonStatusValue;
  season_block_reason: 'SEASON_NOT_ACTIVE' | 'SEASON_ARCHIVED' | null;
  can_archive: boolean | null;
  last_week: { week_id: number; week_no: number; end_date: string; is_closed: boolean } | null;
  period: {
    period_id: number;
    period_type: PeriodTypeValue;
    end_date: string;
    is_closed: boolean;
    is_clear: boolean;
  } | null;
  blocker_counts: { pending_submission_count: number; missing_submission_count: number };
  blocking_items: {
    reason: 'PENDING' | 'NOT_SUBMITTED';
    group_id: number;
    group_name: string;
    group_type: 'ADV_TEAM' | 'STUDY';
    study_kind: 'MENMEN' | 'GENERAL' | null;
    week_id: number | null;
    week_no: number | null;
    activity_week_no: number | null;
    round_no: number | null;
    submission_id: number | null;
  }[];
  warnings: {
    study_round_shortfalls: {
      group_id: number;
      group_name: string;
      period_type: PeriodTypeValue;
      required_count: number;
      planned_sessions: number;
      void_round_count: number;
      valid_planned_count: number;
      confirmed_round_count: number;
      shortfall_count: number;
    }[];
    unverifiable_study_groups: { group_id: number; group_name: string }[];
  };
}

/** ATT-11 응답. */
export interface ArchiveSeasonResult {
  id: number;
  name: string;
  status: 'ARCHIVED';
  snapshot_count: number;
  scored_enrollment_count: number;
  removed_host_account_count: number;
}

/** ATT-12 점수 규칙 버전 한 줄(협의 중). */
export interface ScoreRuleSetItem {
  id: number;
  name: string;
  created_at: string;
  used_by_seasons: { season_id: number; name: string; status: SeasonStatusValue }[];
  is_used_by_active_season: boolean;
}

/** ATT-18 명단 한 줄(협의 중). */
export interface Enrollment {
  enrollment_id: number;
  member_id: string;
  name: string;
  name_suffix: string | null;
  term: number;
  track: TrackValue;
  member_status: MemberStatusValue;
  season_role: SeasonRoleValue;
  menmen_joined: boolean;
  chinba_joined: boolean;
  parallel_track: TrackValue | null;
  is_parallel_completed: boolean | null;
  note: string | null;
  groups: {
    group_id: string;
    name: string;
    group_type: 'ADV_TEAM' | 'STUDY';
    study_kind: 'MENMEN' | 'GENERAL' | null;
  }[];
  is_cancelled: boolean;
  version: number;
}

/** ATT-18 응답. */
export interface EnrollmentList {
  summary: RosterSummaryItem[];
  total_count: number;
  enrollments: Enrollment[];
}

/** ATT-19 요청. */
export interface CreateEnrollmentRequest {
  member_id: string;
  season_role: SeasonRoleValue;
  menmen_joined?: boolean;
  chinba_joined?: boolean;
  parallel_track?: TrackValue | null;
  note?: string | null;
}

/** ATT-21 요청. version 말고는 보낸 칸만 바꾼다. */
export interface UpdateEnrollmentRequest {
  version: number;
  season_role?: SeasonRoleValue;
  menmen_joined?: boolean;
  chinba_joined?: boolean;
  parallel_track?: TrackValue | null;
  note?: string | null;
}
