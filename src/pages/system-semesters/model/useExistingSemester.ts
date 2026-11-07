import { useEffect, useState } from 'react';

import type { RosterEntryDto, RosterKind, SemesterDto } from '@/entities/cohort/model/dto';
import { useSemesterRoster } from '@/entities/cohort/model/useSemesterRoster';
import { useSemesterSchedule } from '@/entities/cohort/model/useSemesterSchedule';
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
type Pending = 'schedule' | 'roster' | 'status';

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
  isDirty: boolean;
  pending: Pending | null;
  kindOf: (term: number) => RosterKind;
  handleChangeSchedule: (form: ScheduleForm) => void;
  handleBlurScheduleField: (field: ScheduleField) => void;
  handleSaveSchedule: () => void;
  handleToggleExcluded: (userId: string) => void;
  handleAddMembers: (entries: RosterEntryDto[]) => void;
  handleRemoveAdded: (userId: string) => void;
  handleSaveRoster: () => void;
}

interface UseExistingSemesterOptions {
  semester: SemesterDto;
  onChanged: () => void;
}

/**
 * 진행 예정 반기만 일정·명단을 고친다. 진행 중·종료 반기는 조회만 한다(서버도 409 SEMESTER_LOCKED).
 * 저장 실패는 알리고 초안은 그대로 둔다(R10-4).
 */
export function useExistingSemester({
  semester,
  onChanged,
}: UseExistingSemesterOptions): ExistingSemesterState {
  const name = semester.semester;
  const isLocked = semester.status !== 'PREPARING';
  const scheduleState = useSemesterSchedule(name);
  const rosterState = useSemesterRoster(name);
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
    isDirty,
    pending,
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
      if (!savedMembers) return;
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
  };
}
