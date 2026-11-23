/**
 * 반기 관리 API 호출(백엔드 /api/v1/admin/attendance). 응답의 { status, data }를 벗기고 snake_case를 화면 모델로 바꾼다.
 * 명세 모양은 model/seasonDto.ts, 화면 모델은 model/season.ts다. 명단(ATT-18·19·21·22)은 아직 협의 중이라 바뀌면 이 파일만 고친다.
 */
import { api, withQuery } from '@/shared/api/client';

import type { RosterEntryDto, SemesterActivity } from '../model/dto';
import {
  type Season,
  type SeasonArchiveReadiness,
  type SeasonInfo,
  type SeasonInput,
  type SeasonPatch,
  type SeasonPreviewResult,
  type SeasonWeek,
  type ScoreRuleSetOption,
  TRACK_OF_VALUE,
  VALUE_OF_TRACK,
} from '../model/season';
import type {
  ApiEnvelope,
  ArchiveReadiness,
  CreateSeasonResult,
  Enrollment,
  EnrollmentList,
  PeriodInput,
  ScoreRuleSetItem,
  SeasonDetail,
  SeasonListItem,
  SeasonPreview,
  SeasonPreviewRequest,
  SeasonRoleValue,
  SeasonWeek as SeasonWeekResponse,
  UpdateSeasonRequest,
} from '../model/seasonDto';
import type { UserTrack } from '@/entities/user/model/types';

const BASE = '/api/v1/admin/attendance';

const dataOf = async <T>(request: Promise<ApiEnvelope<T>>): Promise<T> => (await request).data;

const START_KEY_OF: Record<SemesterActivity, keyof SeasonDetail & `${string}_start_on`> = {
  BASE: 'base_start_on',
  ADV: 'adv_start_on',
  STUDY_VACATION: 'vacation_study_start_on',
  STUDY_TERM: 'semester_study_start_on',
};

const toSeason = (item: SeasonListItem): Season => ({
  id: item.id,
  name: item.name,
  half: item.half,
  status: item.status,
  baseTerm: item.base_term,
  advTerm: item.adv_term,
  startDate: item.start_date,
  endDate: item.end_date,
  isEditable: item.is_editable,
});

const periodsOf = (vacation: SeasonInput['vacation'], term: SeasonInput['term']): PeriodInput[] => [
  { period_type: 'VACATION', start_date: vacation.startDate, end_date: vacation.endDate },
  { period_type: 'SEMESTER', start_date: term.startDate, end_date: term.endDate },
];

const startsOf = (starts: Partial<Record<SemesterActivity, string>>) =>
  Object.fromEntries(
    Object.entries(starts).map(([activity, date]) => [
      START_KEY_OF[activity as SemesterActivity],
      date,
    ]),
  );

const toPreviewRequest = (input: SeasonInput): SeasonPreviewRequest => ({
  name: input.name,
  half: input.half,
  base_term: input.baseTerm,
  adv_term: input.advTerm,
  periods: periodsOf(input.vacation, input.term),
  base_start_on: input.activityStarts.BASE,
  adv_start_on: input.activityStarts.ADV,
  vacation_study_start_on: input.activityStarts.STUDY_VACATION,
  semester_study_start_on: input.activityStarts.STUDY_TERM,
  void_week_nos: input.voidWeekNos,
});

/** 반기 목록(ATT-01). 진행 예정 → 진행 → 종료, 최근 반기부터. */
export async function fetchSeasons(): Promise<Season[]> {
  return (await dataOf(api.get<ApiEnvelope<SeasonListItem[]>>(`${BASE}/seasons`))).map(toSeason);
}

/** 반기 상세(ATT-02). */
export async function fetchSeason(seasonId: number): Promise<SeasonInfo> {
  const detail = await dataOf(api.get<ApiEnvelope<SeasonDetail>>(`${BASE}/seasons/${seasonId}`));
  const rangeOf = (type: 'VACATION' | 'SEMESTER') => {
    const period = detail.periods.find((item) => item.period_type === type);
    return period ? { startDate: period.start_date, endDate: period.end_date } : null;
  };
  const entry = detail.adv_leader_entry_from_week;
  // 상세에는 반기 시작·종료일이 없어 기간에서 정한다(목록 ATT-01과 같은 값).
  const dates = detail.periods.flatMap((period) => [period.start_date, period.end_date]).sort();
  return {
    ...toSeason({
      ...detail,
      start_date: dates[0] ?? '',
      end_date: dates[dates.length - 1] ?? '',
    }),
    activityStarts: {
      BASE: detail.base_start_on,
      ADV: detail.adv_start_on,
      STUDY_VACATION: detail.vacation_study_start_on,
      STUDY_TERM: detail.semester_study_start_on,
    },
    vacation: rangeOf('VACATION'),
    term: rangeOf('SEMESTER'),
    advLeaderEntryWeek: entry && {
      weekId: entry.week_id,
      weekNo: entry.week_no,
      activityWeekNo: entry.activity_week_no,
    },
    scoreRuleSet: detail.score_rule_set.id ? detail.score_rule_set : null,
  };
}

/** 반기 공통 주차(ATT-08). */
export async function fetchSeasonWeeks(seasonId: number): Promise<SeasonWeek[]> {
  const weeks = await dataOf(
    api.get<ApiEnvelope<SeasonWeekResponse[]>>(`${BASE}/seasons/${seasonId}/weeks`),
  );
  return weeks.map((week) => ({
    weekId: week.week_id,
    weekNo: week.week_no,
    periodType: week.period_type,
    startDate: week.start_date,
    endDate: week.end_date,
    isVoid: week.is_void,
  }));
}

/** 새 반기 미리보기(ATT-82). 주차와 자동 명단을 계산만 한다. */
export async function previewSeason(input: SeasonInput): Promise<SeasonPreviewResult> {
  const preview = await dataOf(
    api.post<ApiEnvelope<SeasonPreview>>(`${BASE}/seasons/preview`, toPreviewRequest(input)),
  );
  return {
    isDuplicateName: preview.conflicts.duplicate_year_half,
    isDuplicateBaseTerm: preview.conflicts.duplicate_base_term,
    totalWeekCount: preview.total_week_count,
    rosterSummary: preview.roster_summary.map((item) => ({
      term: item.term,
      kind: item.season_role === 'BASE' ? 'BASE' : 'ADV',
      count: item.count,
    })),
    rosterMembers: preview.roster_members.map((member) => ({
      memberId: member.member_id,
      name: member.name,
      term: member.term,
      track: TRACK_OF_VALUE[member.track],
      kind: member.season_role,
    })),
  };
}

/** 반기 확정(ATT-03). 진행 예정 반기가 되고 BASE·ADV 기수 활동 회원으로 명단이 자동으로 생긴다. */
export async function createSeason(
  input: SeasonInput & { scoreRuleSetId: number },
): Promise<{ id: number; name: string }> {
  const result = await dataOf(
    api.post<ApiEnvelope<CreateSeasonResult>>(`${BASE}/seasons`, {
      ...toPreviewRequest(input),
      score_rule_set_id: input.scoreRuleSetId,
    }),
  );
  return { id: result.id, name: result.name };
}

/** 진행 예정 반기 수정(ATT-04). 보낸 칸만 바꾼다. 진행·종료 반기는 409 SEASON_NOT_DRAFT. */
export async function updateSeason(seasonId: number, patch: SeasonPatch): Promise<void> {
  const request: UpdateSeasonRequest = {
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.half !== undefined && { half: patch.half }),
    ...(patch.activityStarts && startsOf(patch.activityStarts)),
    ...(patch.advLeaderEntryWeekId !== undefined && {
      adv_leader_entry_from_week_id: patch.advLeaderEntryWeekId,
    }),
    ...(patch.scoreRuleSetId !== undefined && { score_rule_set_id: patch.scoreRuleSetId }),
    ...(patch.vacation && patch.term && { periods: periodsOf(patch.vacation, patch.term) }),
  };
  await api.patch(`${BASE}/seasons/${seasonId}`, request);
}

/** 진행 예정 반기 삭제(ATT-83). 출결 기록이 있으면 409 SEASON_NOT_DELETABLE. */
export async function deleteSeason(seasonId: number): Promise<void> {
  await api.delete(`${BASE}/seasons/${seasonId}`);
}

/** 진행 예정 반기 활성화(ATT-05). 진행 반기가 남아 있으면 409 ACTIVE_SEASON_EXISTS. */
export async function activateSeason(seasonId: number): Promise<void> {
  await api.patch(`${BASE}/seasons/${seasonId}/activate`);
}

/** 반기 종료 사전 점검(ATT-10). 조회만 한다. */
export async function fetchArchiveReadiness(seasonId: number): Promise<SeasonArchiveReadiness> {
  const readiness = await dataOf(
    api.get<ApiEnvelope<ArchiveReadiness>>(`${BASE}/seasons/${seasonId}/archive-readiness`),
  );
  return {
    blockReason: readiness.season_block_reason,
    canArchive: readiness.can_archive === true,
    lastWeek: readiness.last_week && {
      weekNo: readiness.last_week.week_no,
      isClosed: readiness.last_week.is_closed,
    },
    blockingItems: readiness.blocking_items.map((item) => ({
      reason: item.reason,
      groupName: item.group_name,
      weekNo: item.week_no,
      roundNo: item.round_no,
    })),
  };
}

/** 진행 반기 종료(ATT-11). 점검을 통과하지 못하면 409 SEASON_NOT_FINISHED. */
export async function archiveSeason(seasonId: number): Promise<void> {
  await api.patch(`${BASE}/seasons/${seasonId}/archive`, { confirm: true });
}

/** 공통 주차 하나를 휴강으로 지정하거나 푼다(ATT-09). 반기 전체 2주까지. */
export async function setWeekVoid(weekId: number, isVoid: boolean): Promise<void> {
  await api.patch(`${BASE}/weeks/${weekId}/void`, { is_void: isVoid });
}

/** 점수 규칙 버전 목록(ATT-12). */
export async function fetchScoreRuleSets(): Promise<ScoreRuleSetOption[]> {
  const { rule_sets: ruleSets } = await dataOf(
    api.get<ApiEnvelope<{ rule_sets: ScoreRuleSetItem[] }>>(`${BASE}/score-rule-sets`),
  );
  return ruleSets.map(({ id, name }) => ({ id, name }));
}

const toRosterEntry = (item: Enrollment): RosterEntryDto => ({
  enrollmentId: item.enrollment_id,
  version: item.version,
  userId: item.member_id,
  name: item.name,
  term: item.term,
  track: TRACK_OF_VALUE[item.track],
  parallelTrack: item.parallel_track && TRACK_OF_VALUE[item.parallel_track],
  kind: item.season_role === 'COMPLETED' ? 'EXTRA' : item.season_role,
  memberStatus: item.member_status === 'EXPELLED' ? 'WITHDRAWN' : item.member_status,
  menmenJoined: item.menmen_joined,
  chinbaJoined: item.chinba_joined,
  isParallelCompleted: item.is_parallel_completed,
  note: item.note,
  groups: item.groups.map((group) => ({
    groupId: group.group_id,
    name: group.name,
    groupType: group.group_type === 'ADV_TEAM' ? 'ADV' : 'STUDY',
    studyKind: group.study_kind,
  })),
});

/** 반기 명단(ATT-18, 협의 중). */
export async function fetchEnrollments(seasonId: number): Promise<RosterEntryDto[]> {
  const list = await dataOf(
    api.get<ApiEnvelope<EnrollmentList>>(`${BASE}/seasons/${seasonId}/enrollments`),
  );
  return list.enrollments.map(toRosterEntry);
}

/** 회원 한 명을 반기 명단에 넣는다(ATT-19, 협의 중). */
export async function createEnrollment(
  seasonId: number,
  memberId: string,
  seasonRole: SeasonRoleValue,
  parallelTrack: UserTrack | null,
  options: { menmenJoined: boolean; chinbaJoined: boolean; note: string | null },
): Promise<void> {
  await api.post(`${BASE}/seasons/${seasonId}/enrollments`, {
    member_id: memberId,
    season_role: seasonRole,
    menmen_joined: options.menmenJoined,
    chinba_joined: options.chinbaJoined,
    note: options.note,
    // 수료 기수는 병행 부문을 정할 수 없다(ATT-19).
    ...(seasonRole !== 'COMPLETED' && {
      parallel_track: parallelTrack && VALUE_OF_TRACK[parallelTrack],
    }),
  });
}

/** 명단 한 줄의 병행 부문을 바꾼다(ATT-21, 협의 중). null이면 병행하지 않는다. */
export async function updateEnrollmentParallel(
  enrollmentId: number,
  version: number,
  parallelTrack: UserTrack | null,
): Promise<void> {
  await api.patch(`${BASE}/enrollments/${enrollmentId}`, {
    version,
    parallel_track: parallelTrack && VALUE_OF_TRACK[parallelTrack],
  });
}

/** 명단에서 뺀다(ATT-22, 협의 중). */
export async function cancelEnrollment(enrollmentId: number, version: number): Promise<void> {
  await api.delete(withQuery(`${BASE}/enrollments/${enrollmentId}`, { version }));
}
