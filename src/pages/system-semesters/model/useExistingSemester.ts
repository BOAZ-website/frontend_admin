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
  scheduleErrors,
  type ScheduleForm,
} from './scheduleForm';

type SemesterAction = (semester: string) => Promise<SemesterDto>;
/** 지금 보내고 있는 요청. 요청 중에는 입력과 다른 버튼을 막는다(R7-8). */
type Pending = 'schedule' | 'roster' | 'status' | 'week';

/** 반기 하나를 보고 고치는 화면 상태: 일정·명단 초안, 활성화를 막는 이유, 처리 함수. */
export interface ExistingSemesterState {
  /** 보여 줄 일정(초안이 있으면 초안). 읽는 중이면 null. */
  form: ScheduleForm | null;
  scheduleError: Error | null;
  reloadSchedule: () => void;
  scheduleErrors: string[];
  isScheduleReadOnly: boolean;
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
  /** 활성화를 막는 이유. 막지 않으면 null. */
  activateBlock: string | null;
  /** 활성화하면 종료될 진행 반기의 진행 중인 주차. */
  openWeeks: SemesterWeekDto[];
  currentWeeksError: Error | null;
  reloadCurrentWeeks: () => void;
  kindOf: (term: number) => RosterKind;
  handleChangeSchedule: (form: ScheduleForm) => void;
  handleSaveSchedule: () => void;
  handleToggleExcluded: (userId: string) => void;
  handleAddMember: (entry: RosterEntryDto) => void;
  handleRemoveAdded: (userId: string) => void;
  handleSaveRoster: () => void;
  handleActivate: () => void;
  handleCloseWeek: (week: SemesterWeekDto) => void;
  handleRemove: () => void;
}

interface UseExistingSemesterOptions {
  semester: SemesterDto;
  /** 지금 진행 중인 반기 이름. 없으면 null. */
  currentName: string | null;
  activate: SemesterAction;
  remove: SemesterAction;
  onChanged: () => void;
  onRemoved: () => void;
}

/**
 * 준비 반기는 일정·명단을 고치고 활성화하거나 지운다. 진행 반기는 일정만 고친다. 종료 반기는 읽기만 한다.
 * 저장 실패는 알리고 초안은 그대로 둔다(R10-4).
 */
export function useExistingSemester({
  semester,
  currentName,
  activate,
  remove,
  onChanged,
  onRemoved,
}: UseExistingSemesterOptions): ExistingSemesterState {
  const name = semester.semester;
  const isPreparing = semester.status === 'PREPARING';
  const scheduleState = useSemesterSchedule(name);
  const rosterState = useSemesterRoster(name);
  // 활성화하면 종료될 진행 반기의 주차. 진행 중인 주차가 있으면 종료할 수 없다.
  const currentWeeks = useSemesterWeeks(isPreparing ? currentName : null);
  const [draftForm, setDraftForm] = useState<ScheduleForm | null>(null);
  const [draftExcludedIds, setDraftExcludedIds] = useState<ReadonlySet<string>>(new Set());
  const [draftAdded, setDraftAdded] = useState<RosterEntryDto[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);

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

  const isScheduleReadOnly = semester.status === 'ENDED' || pending !== null;
  const form = draftForm ?? (scheduleState.schedule && formFromSchedule(scheduleState.schedule));
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
    scheduleErrors: form && semester.status !== 'ENDED' ? scheduleErrors(form) : [],
    isScheduleReadOnly,
    isScheduleDirty,
    savedMembers,
    rosterError: rosterState.error,
    reloadRoster: rosterState.reload,
    excludedIds: draftExcludedIds,
    added: draftAdded,
    isRosterReadOnly: !isPreparing,
    isDirty,
    pending,
    activateBlock: isDirty
      ? '저장하지 않은 변경이 있습니다. 먼저 저장하세요.'
      : savedMembers?.length === 0
        ? '명단이 비어 있습니다. 명단에 사람을 더한 뒤 활성화하세요.'
        : openWeeks.length > 0
          ? `${currentName}에 진행 중인 주차(${openWeeks.map((week) => week.label).join(', ')})가 있어 ${currentName}을 종료할 수 없습니다. 주차를 마감한 뒤 활성화하세요.`
          : null,
    openWeeks,
    currentWeeksError: currentWeeks.error,
    reloadCurrentWeeks: currentWeeks.reload,
    kindOf: (term) =>
      term === semester.cohort ? 'BASE' : term === semester.advTerm ? 'ADV' : 'EXTRA',
    handleChangeSchedule: setDraftForm,
    handleSaveSchedule: () => {
      if (!draftForm) return;
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
    handleAddMember: (entry) => setDraftAdded([...draftAdded, entry]),
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
    handleActivate: () => {
      const message = currentName
        ? `${name}을 활성화할까요?\n${currentName}이 종료되고 ${name}이 진행 반기가 됩니다. ${currentName}에 연결된 HOST 계정의 팀이 해제되고, 팀·출결 기록은 그대로 남습니다.`
        : `${name}을 활성화할까요?\n${name}이 진행 반기가 됩니다.`;
      if (window.confirm(message)) void run('status', () => activate(name));
    },
    handleCloseWeek: (week) => {
      const message = `${currentName} ${week.label}를 마감할까요?\n마감하면 그 주차 출결은 더 입력하거나 제출할 수 없습니다. 이미 입력한 출결은 그대로 남습니다.`;
      if (window.confirm(message)) void run('week', () => currentWeeks.closeWeek(week.weekNum));
    },
    handleRemove: () => {
      if (
        !window.confirm(`준비 중인 ${name}을 삭제할까요?\n입력한 기간·주차·명단이 모두 지워집니다.`)
      ) {
        return;
      }
      void run('status', () => remove(name)).then((isRemoved) => {
        if (isRemoved) onRemoved();
      });
    },
  };
}
