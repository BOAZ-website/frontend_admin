import { useEffect, useState } from 'react';

import {
  cancelEnrollment,
  createEnrollment,
  setWeekVoid,
  updateEnrollmentParallel,
} from '@/entities/cohort/api/seasonApi';
import type {
  CommonWeekDto,
  RosterEntryDto,
  RosterKind,
  SemesterHalf,
} from '@/entities/cohort/model/dto';
import type { Season } from '@/entities/cohort/model/season';
import { useSeasonRoster } from '@/entities/cohort/model/useSeasonRoster';
import { useSeasonSchedule } from '@/entities/cohort/model/useSeasonSchedule';
import type { UserTrack } from '@/entities/user/model/types';
import { alertApiError } from '@/shared/lib/alertApiError';
import { monthDayOf } from '@/shared/lib/date';
import { registerLeaveGuard } from '@/shared/lib/leaveGuard';

import {
  commonWeeksOfForm,
  displayWeekNoOf,
  formFromSchedule,
  firstErrorField,
  focusField,
  SCHEDULE_FIELDS,
  scheduleFieldErrors,
  scheduleFieldId,
  type ScheduleField,
  type ScheduleFieldErrors,
  SEMESTER_NAME_PATTERN,
  semesterHalfError,
  shownFieldErrors,
  type ScheduleForm,
} from './scheduleForm';

/** 휴강은 반기 전체에서 2주까지다(백엔드 ATT-09). */
export const MAX_VOID_WEEKS = 2;

/** 진행 예정 반기에서 기간·시작일 말고 더 고치는 값(ATT-04). */
export interface SeasonBasics {
  name: string;
  half: SemesterHalf;
  scoreRuleSetId: number | null;
  /** ADV 팀장 입력 시작 주차. null이면 팀장 입력을 열지 않는다. */
  advLeaderEntryWeekId: number | null;
}

/** 지금 보내고 있는 요청. 요청 중에는 입력과 다른 버튼을 막는다(R7-8). */
type Pending = 'schedule' | 'roster' | 'status' | 'void';

/** 반기 하나를 보고 고치는 화면 상태: 일정·명단 초안, 진행 중인 주차, 처리 함수. */
export interface ExistingSemesterState {
  /** 보여 줄 일정(초안이 있으면 초안). 읽는 중이면 null. */
  form: ScheduleForm | null;
  scheduleError: Error | null;
  reloadSchedule: () => void;
  /** 일정 칸 아래에 보일 오류. 손대지 않은 칸은 저장을 누르기 전까지 숨긴다. */
  scheduleErrors: ScheduleFieldErrors;
  isScheduleReadOnly: boolean;
  /** 기간·1주차 시작일을 고칠 수 없는 반기다(진행 중·종료). 기수·일정을 요약 표로 보인다. */
  isScheduleLocked: boolean;
  /**
   * 휴강을 고칠 수 없다: 종료 반기, 요청 중, 저장하지 않은 기간·시작일 변경이 있을 때
   * (휴강은 서버에 저장된 기간의 주차로 바로 저장하므로 기간을 먼저 저장해야 한다).
   */
  isVoidReadOnly: boolean;
  /** 공통 주차 휴강을 넣거나 뺀다: 확인을 받은 뒤 바로 저장한다(ATT-09). */
  handleChangeVoidWeek: (weekNo: number, isVoid: boolean) => void;
  /** 일정·명단을 고칠 수 있는 반기다(진행 예정·진행). 종료 반기는 저장 버튼을 그리지 않는다. */
  isEditable: boolean;
  isScheduleDirty: boolean;
  /** 저장된 명단. 읽는 중이면 null. */
  savedMembers: RosterEntryDto[] | null;
  rosterError: Error | null;
  reloadRoster: () => void;
  excludedIds: ReadonlySet<string>;
  added: RosterEntryDto[];
  isRosterReadOnly: boolean;
  /** 진행 반기 명단은 「수정」을 눌러야 고친다. 그 버튼을 보일지(진행 반기이고 아직 고치는 중이 아님). */
  canStartRosterEdit: boolean;
  /** 진행 반기 명단을 고치는 중(「취소」를 보인다). */
  isRosterEditing: boolean;
  handleStartRosterEdit: () => void;
  handleCancelRosterEdit: () => void;
  /** 이 반기의 점수 규칙 버전. 읽는 중이거나 없으면 null. */
  appliedRule: { id: number; name: string } | null;
  appliedRuleError: Error | null;
  /** 진행 예정 반기의 이름·상하반기·점수 규칙·ADV 팀장 입력 시작 주차(초안이 있으면 초안). 읽는 중이면 null. */
  basics: SeasonBasics | null;
  basicsErrors: { name?: string; half?: string };
  handleChangeBasics: (patch: Partial<SeasonBasics>) => void;
  /** ADV 팀장 입력 시작 주차로 고를 수 있는 주(저장된 주차 중 ADV 1주차부터). */
  advEntryWeekOptions: { weekId: number; label: string }[];
  /** 고른(아직 저장하지 않은) 병행 부문. 명단 줄의 userId별. */
  parallelDrafts: ReadonlyMap<string, UserTrack | null>;
  handleChangeParallel: (userId: string, track: UserTrack | null) => void;
  isDirty: boolean;
  pending: Pending | null;
  kindOf: (term: number) => RosterKind;
  handleChangeSchedule: (form: ScheduleForm) => void;
  handleBlurScheduleField: (field: ScheduleField) => void;
  handleSaveSchedule: () => void;
  handleToggleExcluded: (userId: string) => void;
  handleAddMembers: (entries: RosterEntryDto[]) => void;
  handleRemoveAdded: (userId: string) => void;
  /** 더한(저장 전) 사람의 멘멘·친바 참여와 비고를 바꾼다. */
  handleChangeAdded: (
    userId: string,
    patch: Partial<Pick<RosterEntryDto, 'menmenJoined' | 'chinbaJoined' | 'note'>>,
  ) => void;
  handleSaveRoster: () => void;
}

/**
 * 휴강을 바꾸기 전 확인 문구: 주차마다 한 줄. 서버에 묻지 않고 화면의 주차로 만든다(취소하면 요청을 보내지 않는다).
 * 출결 기록은 지우지 않고 점수 계산에서만 빼거나 다시 넣는다(ATT-09).
 */
function voidSaveConfirmMessage(
  changes: readonly { weekNo: number; isVoid: boolean }[],
  weekOf: (weekNo: number) => CommonWeekDto | undefined,
  weekLabelOf: (weekNo: number) => number,
): string {
  const lines = changes.map(({ weekNo, isVoid }) => {
    const week = weekOf(weekNo);
    const dates = week ? `(${monthDayOf(week.startDate)} ~ ${monthDayOf(week.endDate)})` : '';
    return `${weekLabelOf(weekNo)}주차${dates} ${isVoid ? '휴강' : '휴강 해제'}`;
  });
  return `휴강을 저장할까요?\n${lines.join('\n')}`;
}

interface UseExistingSemesterOptions {
  season: Season;
  onChanged: () => void;
}

/**
 * 진행 예정 반기는 모든 설정을 고친다. 진행 반기는 명단(병행 정보, 수료 기수 추가)과 휴강 주차만 고치고,
 * 종료 반기는 조회만 한다(서버도 409로 막는다). 저장 실패는 알리고 초안은 그대로 둔다(R10-4).
 */
export function useExistingSemester({
  season,
  onChanged,
}: UseExistingSemesterOptions): ExistingSemesterState {
  const { name } = season;
  const isLocked = season.status !== 'DRAFT';
  const isEditable = season.status !== 'ARCHIVED';
  const scheduleState = useSeasonSchedule(season.id);
  const rosterState = useSeasonRoster(season.id);
  const saved = scheduleState.data;
  const [draftForm, setDraftForm] = useState<ScheduleForm | null>(null);
  const [draftBasics, setDraftBasics] = useState<SeasonBasics | null>(null);
  const [parallelDrafts, setParallelDrafts] = useState<ReadonlyMap<string, UserTrack | null>>(
    new Map(),
  );
  const [draftExcludedIds, setDraftExcludedIds] = useState<ReadonlySet<string>>(new Set());
  const [draftAdded, setDraftAdded] = useState<RosterEntryDto[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  // 진행 반기 명단은 평소에는 보기만 하고, 「수정」을 누른 동안만 고친다(진행 예정 반기는 늘 고친다).
  const [isRosterEditing, setIsRosterEditing] = useState(false);
  const isActive = season.status === 'ACTIVE';
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [isAttempted, setIsAttempted] = useState(false);

  const isScheduleDirty = draftForm !== null || draftBasics !== null;
  const isDirty =
    isScheduleDirty ||
    parallelDrafts.size > 0 ||
    draftExcludedIds.size > 0 ||
    draftAdded.length > 0;
  useEffect(
    () =>
      isDirty
        ? registerLeaveGuard(() =>
            window.confirm(`${name}의 저장하지 않은 변경을 버리고 나갈까요?`),
          )
        : undefined,
    [isDirty, name],
  );

  const isScheduleReadOnly = !isEditable || pending !== null;
  const form = draftForm ?? (saved && formFromSchedule(saved.schedule));
  const fieldErrors = form && !isLocked ? scheduleFieldErrors(form) : {};
  const basics: SeasonBasics | null =
    draftBasics ??
    (saved && {
      name: saved.info.name,
      half: saved.info.half,
      scoreRuleSetId: saved.info.scoreRuleSet?.id ?? null,
      advLeaderEntryWeekId: saved.info.advLeaderEntryWeek?.weekId ?? null,
    });
  const basicsErrors = {
    ...(basics && !SEMESTER_NAME_PATTERN.test(basics.name) && { name: '26-2처럼 입력하세요' }),
    ...(basics && { half: semesterHalfError(basics.half, basics.name) }),
  };
  const hasBasicsError = basicsErrors.name !== undefined || basicsErrors.half !== undefined;
  // ADV 팀장 입력 시작 주차는 저장된 주차 중 ADV 1주차부터 고른다. 번호는 ADV 1주차부터 센다.
  const advFirstWeekNo = saved?.weeks.find(
    (week) =>
      week.startDate <= saved.info.activityStarts.ADV &&
      saved.info.activityStarts.ADV <= week.endDate,
  )?.weekNo;
  const advEntryWeekOptions =
    saved && advFirstWeekNo !== undefined
      ? saved.weeks
          .filter((week) => week.weekNo >= advFirstWeekNo)
          .map((week) => ({
            weekId: week.weekId,
            label: `${week.weekNo - advFirstWeekNo + 1}주차 (${monthDayOf(week.startDate)} ~ ${monthDayOf(week.endDate)})`,
          }))
      : [];
  const weekIdOf = (weekNo: number) => saved?.weeks.find((week) => week.weekNo === weekNo)?.weekId;
  const saveVoid = async (weekNo: number, isVoid: boolean) => {
    const weekId = weekIdOf(weekNo);
    if (weekId === undefined)
      throw new Error(`${weekNo}주차를 찾지 못했습니다. 다시 불러와 주세요.`);
    await setWeekVoid(weekId, isVoid);
  };
  const savedMembers = rosterState.members;
  const savedVoidWeekNos = form?.voidWeekNos ?? [];
  // 확인 창의 주차 번호는 휴강 목록과 같이 BASE·ADV 1주차부터 센 번호로 보인다.
  const weekLabelOf = (weekNo: number) =>
    form ? (displayWeekNoOf(form, weekNo) ?? weekNo) : weekNo;
  const commonWeeks = form ? commonWeeksOfForm(form) : [];
  const weekOf = (weekNo: number) => commonWeeks.find((week) => week.weekNo === weekNo);

  const run = async (kind: Pending, work: () => Promise<unknown>): Promise<boolean> => {
    setPending(kind);
    try {
      await work();
    } catch (error) {
      alertApiError(error);
      return false;
    } finally {
      setPending(null);
    }
    onChanged();
    return true;
  };

  return {
    form,
    scheduleError: scheduleState.error,
    reloadSchedule: scheduleState.reload,
    scheduleErrors: shownFieldErrors(fieldErrors, touched, isAttempted),
    isScheduleReadOnly,
    isScheduleLocked: isLocked,
    // 휴강은 서버에 저장된 기간의 주차로 바로 저장하므로, 저장하지 않은 기간 변경이 있으면 막는다.
    isVoidReadOnly: !isEditable || pending !== null || draftForm !== null,
    handleChangeVoidWeek: (weekNo, isVoid) => {
      if (savedVoidWeekNos.includes(weekNo) === isVoid) return;
      if (isVoid && savedVoidWeekNos.length >= MAX_VOID_WEEKS) return;
      // 확인을 먼저 받는다. 취소하면 서버에 아무 요청도 보내지 않는다.
      if (!window.confirm(voidSaveConfirmMessage([{ weekNo, isVoid }], weekOf, weekLabelOf)))
        return;
      void run('void', async () => {
        await saveVoid(weekNo, isVoid);
        scheduleState.reload();
      });
    },
    isEditable,
    isScheduleDirty,
    savedMembers,
    rosterError: rosterState.error,
    reloadRoster: rosterState.reload,
    excludedIds: draftExcludedIds,
    added: draftAdded,
    isRosterReadOnly: !isEditable || (isActive && !isRosterEditing),
    canStartRosterEdit: isActive && !isRosterEditing,
    isRosterEditing: isActive && isRosterEditing,
    handleStartRosterEdit: () => setIsRosterEditing(true),
    handleCancelRosterEdit: () => {
      const hasChanges =
        draftExcludedIds.size > 0 || draftAdded.length > 0 || parallelDrafts.size > 0;
      if (hasChanges && !window.confirm('바꾼 명단을 버리고 수정을 끝낼까요?')) return;
      setDraftExcludedIds(new Set());
      setDraftAdded([]);
      setParallelDrafts(new Map());
      setIsRosterEditing(false);
    },
    appliedRule: saved?.info.scoreRuleSet ?? null,
    appliedRuleError: scheduleState.error,
    basics,
    basicsErrors: shownFieldErrors(basicsErrors, touched, isAttempted),
    handleChangeBasics: (patch) => basics && setDraftBasics({ ...basics, ...patch }),
    advEntryWeekOptions,
    parallelDrafts,
    handleChangeParallel: (userId, track) => {
      const next = new Map(parallelDrafts);
      const savedTrack = savedMembers?.find((m) => m.userId === userId)?.parallelTrack ?? null;
      if (track === savedTrack) next.delete(userId);
      else next.set(userId, track);
      setParallelDrafts(next);
    },
    isDirty,
    pending,
    kindOf: (term) =>
      term === season.baseTerm ? 'BASE' : term === season.advTerm ? 'ADV' : 'EXTRA',
    handleChangeSchedule: setDraftForm,
    handleBlurScheduleField: (field) => {
      if (!touched.has(field)) setTouched(new Set([...touched, field]));
    },
    handleSaveSchedule: () => {
      if (!draftForm && !draftBasics) return;
      const first = firstErrorField(fieldErrors, SCHEDULE_FIELDS);
      if (first || hasBasicsError) {
        setIsAttempted(true);
        if (first) focusField(scheduleFieldId(first));
        return;
      }
      void run('schedule', () =>
        scheduleState.save({
          ...(draftForm && {
            vacation: draftForm.vacation,
            term: draftForm.term,
            activityStarts: draftForm.starts,
          }),
          ...(draftBasics && {
            name: draftBasics.name,
            half: draftBasics.half,
            advLeaderEntryWeekId: draftBasics.advLeaderEntryWeekId,
            ...(draftBasics.scoreRuleSetId !== null && {
              scoreRuleSetId: draftBasics.scoreRuleSetId,
            }),
          }),
        }),
      ).then((isSaved) => {
        if (!isSaved) return;
        setDraftForm(null);
        setDraftBasics(null);
      });
    },
    handleToggleExcluded: (userId) => {
      const next = new Set(draftExcludedIds);
      if (!next.delete(userId)) next.add(userId);
      setDraftExcludedIds(next);
    },
    handleAddMembers: (entries) => setDraftAdded([...draftAdded, ...entries]),
    handleRemoveAdded: (userId) => setDraftAdded(draftAdded.filter((m) => m.userId !== userId)),
    handleChangeAdded: (userId, patch) =>
      setDraftAdded(draftAdded.map((m) => (m.userId === userId ? { ...m, ...patch } : m))),
    handleSaveRoster: () => {
      if (!savedMembers) return;
      // 명단 API는 한 줄씩 받는다(ATT-19·21·22). 저장한 줄은 바로 초안에서 지워, 중간에 실패해도
      // 저장하지 못한 줄만 남기고 다시 누르면 그 줄만 다시 보낸다.
      void run('roster', async () => {
        try {
          for (const member of savedMembers.filter((m) => draftExcludedIds.has(m.userId))) {
            await cancelEnrollment(member.enrollmentId ?? 0, member.version ?? 0);
            setDraftExcludedIds((ids) => new Set([...ids].filter((id) => id !== member.userId)));
            // 뺀 사람의 고른 병행 부문은 더 보낼 곳이 없다.
            setParallelDrafts((drafts) => {
              const next = new Map(drafts);
              next.delete(member.userId);
              return next;
            });
          }
          for (const member of draftAdded) {
            const kind = member.kind === 'EXTRA' ? 'COMPLETED' : member.kind;
            // 명단 줄의 부문 값은 동아리원 명단의 부문 이름(분석·시각화·엔지니어링)이다.
            await createEnrollment(
              season.id,
              member.userId,
              kind,
              member.parallelTrack as UserTrack | null,
              {
                menmenJoined: member.menmenJoined,
                chinbaJoined: member.chinbaJoined,
                note: member.note?.trim() || null,
              },
            );
            setDraftAdded((added) => added.filter((m) => m.userId !== member.userId));
          }
          for (const [userId, track] of parallelDrafts) {
            const member = savedMembers.find((m) => m.userId === userId);
            if (!member || draftExcludedIds.has(userId)) continue;
            await updateEnrollmentParallel(member.enrollmentId ?? 0, member.version ?? 0, track);
            setParallelDrafts((drafts) => {
              const next = new Map(drafts);
              next.delete(userId);
              return next;
            });
          }
        } finally {
          rosterState.reload();
        }
      }).then((isSaved) => {
        if (isSaved) setIsRosterEditing(false);
      });
    },
  };
}
