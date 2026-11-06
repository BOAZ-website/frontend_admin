import { useEffect, useState } from 'react';

import type {
  RosterEntryDto,
  RosterKind,
  SemesterDto,
  SemesterWeekDto,
} from '@/entities/cohort/model/dto';
import { useSemesterRoster } from '@/entities/cohort/model/useSemesterRoster';
import { useSemesterSchedule } from '@/entities/cohort/model/useSemesterSchedule';
import { useSemesterWeeks } from '@/entities/cohort/model/useSemesterWeeks';
import { alertApiError } from '@/shared/lib/alertApiError';
import { registerLeaveGuard } from '@/shared/lib/leaveGuard';

import {
  formFromSchedule,
  requestFromForm,
  firstErrorField,
  focusField,
  SCHEDULE_FIELDS,
  scheduleFieldErrors,
  scheduleFieldId,
  type ScheduleField,
  type ScheduleFieldErrors,
  shownFieldErrors,
  type ScheduleForm,
} from './scheduleForm';

/** 지금 보내고 있는 요청. 요청 중에는 입력과 다른 버튼을 막는다(R7-8). */
type Pending = 'schedule' | 'roster' | 'status' | 'week';

/** 반기 하나를 보고 고치는 화면 상태: 일정·명단 초안, 진행 중인 주차, 처리 함수. */
export interface ExistingSemesterState {
  /** 보여 줄 일정(초안이 있으면 초안). 읽는 중이면 null. */
  form: ScheduleForm | null;
  scheduleError: Error | null;
  reloadSchedule: () => void;
  /** 일정 칸 아래에 보일 오류. 손대지 않은 칸은 저장을 누르기 전까지 숨긴다. */
  scheduleErrors: ScheduleFieldErrors;
  isScheduleReadOnly: boolean;
  /** 일정을 고칠 수 없는 반기다(서비스운영팀장이 아닌 계정이 보는 종료 반기). 저장 버튼을 그리지 않는다. */
  isScheduleLocked: boolean;
  isScheduleDirty: boolean;
  /** 저장된 명단. 읽는 중이면 null. */
  savedMembers: RosterEntryDto[] | null;
  rosterError: Error | null;
  reloadRoster: () => void;
  excludedIds: ReadonlySet<string>;
  added: RosterEntryDto[];
  isRosterReadOnly: boolean;
  /** 종료 반기를 서비스운영팀장이 보고 있다(고치거나 지울 수 있다). */
  isArchivedEditable: boolean;
  isDirty: boolean;
  pending: Pending | null;
  /** 진행 반기의 진행 중인 주차. 새 반기를 시작하려면 먼저 마감해야 한다. 진행 반기가 아니면 빈 배열. */
  openWeeks: SemesterWeekDto[];
  currentWeeksError: Error | null;
  reloadCurrentWeeks: () => void;
  kindOf: (term: number) => RosterKind;
  handleChangeSchedule: (form: ScheduleForm) => void;
  handleBlurScheduleField: (field: ScheduleField) => void;
  handleSaveSchedule: () => void;
  handleToggleExcluded: (userId: string) => void;
  handleAddMembers: (entries: RosterEntryDto[]) => void;
  handleRemoveAdded: (userId: string) => void;
  handleSaveRoster: () => void;
  handleCloseWeek: (week: SemesterWeekDto) => void;
}

interface UseExistingSemesterOptions {
  semester: SemesterDto;
  /** 로그인한 계정이 서비스운영팀장(MASTER)이다. 종료 반기 편집 UI를 연다(서버가 다시 확인한다). */
  canEditArchived: boolean;
  onChanged: () => void;
}

/**
 * 진행 반기는 일정·명단을 고치고 진행 중인 주차를 마감한다.
 * 종료 반기는 읽기만 하고, 서비스운영팀장만 일정·명단을 고친다(저장 전 점수 영향 확인). 삭제는 목록의 휴지통에서 한다.
 * 저장 실패는 알리고 초안은 그대로 둔다(R10-4).
 */
export function useExistingSemester({
  semester,
  canEditArchived,
  onChanged,
}: UseExistingSemesterOptions): ExistingSemesterState {
  const name = semester.semester;
  const isActive = semester.status === 'ACTIVE';
  const isEnded = semester.status === 'ENDED';
  const isArchivedEditable = isEnded && canEditArchived;
  const isLocked = isEnded && !canEditArchived;
  /** 종료 반기를 고치기 전에 묻는다. 그 밖의 반기는 바로 저장한다. */
  const confirmArchivedSave = (what: string) =>
    !isEnded ||
    window.confirm(
      `종료된 ${name}의 ${what}을 저장할까요?
지난 반기 점수 계산에 영향을 줄 수 있습니다. 이 변경은 감사 로그에 남습니다.`,
    );
  const scheduleState = useSemesterSchedule(name);
  const rosterState = useSemesterRoster(name);
  // 진행 반기의 주차. 진행 중인 주차가 있으면 새 반기를 시작할 수 없어 여기서 마감한다.
  const currentWeeks = useSemesterWeeks(isActive ? name : null);
  const [draftForm, setDraftForm] = useState<ScheduleForm | null>(null);
  const [draftExcludedIds, setDraftExcludedIds] = useState<ReadonlySet<string>>(new Set());
  const [draftAdded, setDraftAdded] = useState<RosterEntryDto[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [isAttempted, setIsAttempted] = useState(false);

  const isScheduleDirty = draftForm !== null;
  const isDirty = isScheduleDirty || draftExcludedIds.size > 0 || draftAdded.length > 0;
  useEffect(
    () =>
      isDirty
        ? registerLeaveGuard(() =>
            window.confirm(`${name}의 저장하지 않은 변경을 버리고 나갈까요?`),
          )
        : undefined,
    [isDirty, name],
  );

  const isScheduleReadOnly = isLocked || pending !== null;
  const form = draftForm ?? (scheduleState.schedule && formFromSchedule(scheduleState.schedule));
  const fieldErrors = form && !isLocked ? scheduleFieldErrors(form) : {};
  const savedMembers = rosterState.members;
  const openWeeks = currentWeeks.weeks?.filter((week) => week.status === 'OPEN') ?? [];

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
    isScheduleDirty,
    savedMembers,
    rosterError: rosterState.error,
    reloadRoster: rosterState.reload,
    excludedIds: draftExcludedIds,
    added: draftAdded,
    isRosterReadOnly: isLocked,
    isArchivedEditable,
    isDirty,
    pending,
    openWeeks,
    currentWeeksError: currentWeeks.error,
    reloadCurrentWeeks: currentWeeks.reload,
    kindOf: (term) =>
      term === semester.cohort ? 'BASE' : term === semester.advTerm ? 'ADV' : 'EXTRA',
    handleChangeSchedule: setDraftForm,
    handleBlurScheduleField: (field) => {
      if (!touched.has(field)) setTouched(new Set([...touched, field]));
    },
    handleSaveSchedule: () => {
      if (!draftForm) return;
      const first = firstErrorField(fieldErrors, SCHEDULE_FIELDS);
      if (first) {
        setIsAttempted(true);
        focusField(scheduleFieldId(first));
        return;
      }
      if (!confirmArchivedSave('일정')) return;
      const saving = draftForm;
      void run('schedule', () => scheduleState.save(requestFromForm(saving))).then((isSaved) => {
        if (isSaved) setDraftForm(null);
      });
    },
    handleToggleExcluded: (userId) => {
      const next = new Set(draftExcludedIds);
      if (!next.delete(userId)) next.add(userId);
      setDraftExcludedIds(next);
    },
    handleAddMembers: (entries) => setDraftAdded([...draftAdded, ...entries]),
    handleRemoveAdded: (userId) => setDraftAdded(draftAdded.filter((m) => m.userId !== userId)),
    handleSaveRoster: () => {
      if (!savedMembers || !confirmArchivedSave('명단')) return;
      const userIds = [
        ...savedMembers.filter((m) => !draftExcludedIds.has(m.userId)).map((m) => m.userId),
        ...draftAdded.map((m) => m.userId),
      ];
      void run('roster', () => rosterState.save(userIds)).then((isSaved) => {
        if (!isSaved) return;
        setDraftExcludedIds(new Set());
        setDraftAdded([]);
      });
    },
    handleCloseWeek: (week) => {
      const message = `${name} ${week.label}를 마감할까요?\n마감하면 그 주차 출결은 더 입력하거나 제출할 수 없습니다. 이미 입력한 출결은 그대로 남습니다.`;
      if (window.confirm(message)) void run('week', () => currentWeeks.closeWeek(week.weekNum));
    },
  };
}
