import { useEffect, useState } from 'react';

import type {
  PrepareSemesterRequest,
  RosterEntryDto,
  RosterKind,
  SemesterDto,
  SemesterRosterDto,
} from '@/entities/cohort/model/dto';
import { alertApiError } from '@/shared/lib/alertApiError';
import { registerLeaveGuard } from '@/shared/lib/leaveGuard';

import {
  emptyScheduleForm,
  requestFromForm,
  scheduleErrors,
  SEMESTER_NAME_PATTERN,
  type ScheduleForm,
} from './scheduleForm';

/** 새 BASE 기수로 고를 수 있는 개수: 등록된 가장 큰 기수 다음부터. */
const BASE_CHOICES = 2;
/** ADV 기수는 BASE 기수 바로 아래부터 이만큼까지 고른다. */
const ADV_CHOICES = 3;

/** 드롭다운 선택지 하나. */
interface TermOption {
  value: string;
  label: string;
}

const termOption = (term: number): TermOption => ({ value: String(term), label: `${term}기` });

/** 명단 확인 결과(자동 명단 또는 실패 이유). requestKey는 확인할 때의 입력이다. 입력이 바뀌면 이 결과는 쓰지 않는다. */
type RosterCheck =
  | { requestKey: string; members: RosterEntryDto[]; error: null }
  | { requestKey: string; members: null; error: string };

/** 새 반기 작성 화면 상태: 입력 초안, 기수 선택지, 입력 오류, 처리 함수. */
export interface NewSemesterFormState {
  draftName: string;
  draftBaseTerm: number;
  draftAdvTerm: number;
  draftForm: ScheduleForm;
  baseOptions: TermOption[];
  advOptions: TermOption[];
  /** 명단 확인을 막는 입력 오류. 첫 번째만 화면에 보여 준다. */
  errors: string[];
  /** 지금 입력으로 확인한 자동 명단. 확인 전이거나 입력이 바뀌었으면 null. */
  checkedMembers: RosterEntryDto[] | null;
  /** 명단 확인에 실패한 이유(서버 메시지). */
  checkError: string | null;
  /** 반기 만들기를 막는 이유. 막지 않으면 null. */
  createBlock: string | null;
  excludedIds: ReadonlySet<string>;
  added: RosterEntryDto[];
  kindOf: (term: number) => RosterKind;
  isChecking: boolean;
  isSaving: boolean;
  handleChangeName: (name: string) => void;
  handleChangeBaseTerm: (term: number) => void;
  handleChangeAdvTerm: (term: number) => void;
  handleChangeSchedule: (form: ScheduleForm) => void;
  handleCheckRoster: () => void;
  handleToggleExcluded: (userId: string) => void;
  handleAddMember: (entry: RosterEntryDto) => void;
  handleRemoveAdded: (userId: string) => void;
  handleSave: () => void;
}

interface UseNewSemesterFormOptions {
  /** 지금까지 등록된 반기 중 가장 큰 기수. 새 BASE 기수는 이보다 커야 한다. */
  latestCohort: number;
  existingNames: readonly string[];
  preview: (request: PrepareSemesterRequest) => Promise<SemesterRosterDto>;
  prepare: (request: PrepareSemesterRequest) => Promise<SemesterDto>;
  onPrepared: (semester: string) => void;
}

/**
 * 새 반기 작성: 입력 → 명단 확인(저장하지 않는 미리보기) → 예외 수정 → 반기 만들기.
 * 입력을 바꾸면 확인한 명단은 무효가 되어 다시 확인해야 한다. 만들기에 실패하면 입력을 그대로 둔다(R10-4).
 */
export function useNewSemesterForm({
  latestCohort,
  existingNames,
  preview,
  prepare,
  onPrepared,
}: UseNewSemesterFormOptions): NewSemesterFormState {
  const firstBase = latestCohort + 1;
  const firstAdv = Math.max(1, firstBase - 1);
  const [draftName, setDraftName] = useState('');
  const [draftBaseTerm, setDraftBaseTerm] = useState(firstBase);
  const [draftAdvTerm, setDraftAdvTerm] = useState(firstAdv);
  const [draftForm, setDraftForm] = useState(emptyScheduleForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [check, setCheck] = useState<RosterCheck | null>(null);
  const [excludedIds, setExcludedIds] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState<RosterEntryDto[]>([]);

  const isDirty =
    draftName !== '' ||
    draftBaseTerm !== firstBase ||
    draftAdvTerm !== firstAdv ||
    JSON.stringify(draftForm) !== JSON.stringify(emptyScheduleForm());
  useEffect(
    () =>
      isDirty
        ? registerLeaveGuard(() => window.confirm('작성 중인 새 반기를 저장하지 않고 나갈까요?'))
        : undefined,
    [isDirty],
  );

  const errors: string[] = [];
  if (!SEMESTER_NAME_PATTERN.test(draftName)) errors.push('반기 이름은 26-2처럼 입력하세요.');
  else if (existingNames.includes(draftName)) errors.push('이미 있는 반기 이름입니다.');
  errors.push(...scheduleErrors(draftForm));

  const request: PrepareSemesterRequest = {
    semester: draftName,
    baseTerm: draftBaseTerm,
    advTerm: draftAdvTerm,
    schedule: requestFromForm(draftForm),
  };
  const requestKey = JSON.stringify(request);
  const freshCheck = check?.requestKey === requestKey ? check : null;
  const checkedMembers = freshCheck?.members ?? null;
  const checkError = freshCheck?.error ?? null;
  const createBlock =
    errors[0] ??
    checkError ??
    (checkedMembers
      ? null
      : check
        ? '입력이 바뀌었습니다. 명단을 다시 확인하세요.'
        : '명단 확인을 누르고 명단을 본 뒤 반기를 만드세요.');

  const checkRoster = async () => {
    setIsChecking(true);
    try {
      const roster = await preview(request);
      setCheck({ requestKey, members: roster.members, error: null });
    } catch (error) {
      // 검증에 걸린 이유(서버 메시지)를 만들기 버튼 옆에 보여 준다.
      const message = error instanceof Error ? error.message : '명단을 확인하지 못했습니다.';
      setCheck({ requestKey, members: null, error: message });
    } finally {
      // 다시 확인하면 예외는 새 명단 기준으로 처음부터 정한다.
      setExcludedIds(new Set());
      setAdded([]);
      setIsChecking(false);
    }
  };

  const save = async () => {
    if (!checkedMembers) return;
    setIsSaving(true);
    try {
      await prepare({
        ...request,
        excludedUserIds: [...excludedIds],
        includedUserIds: added.map((m) => m.userId),
      });
    } catch (error) {
      alertApiError(error);
      return;
    } finally {
      setIsSaving(false);
    }
    onPrepared(draftName);
  };

  return {
    draftName,
    draftBaseTerm,
    draftAdvTerm,
    draftForm,
    baseOptions: Array.from({ length: BASE_CHOICES }, (_, i) => termOption(firstBase + i)),
    advOptions: Array.from({ length: ADV_CHOICES }, (_, i) => draftBaseTerm - 1 - i)
      .filter((term) => term >= 1)
      .map(termOption),
    errors,
    checkedMembers,
    checkError,
    createBlock,
    excludedIds,
    added,
    kindOf: (term) => (term === draftBaseTerm ? 'BASE' : term === draftAdvTerm ? 'ADV' : 'EXTRA'),
    isChecking,
    isSaving,
    handleChangeName: (name) => setDraftName(name.trim()),
    handleChangeBaseTerm: (term) => {
      setDraftBaseTerm(term);
      setDraftAdvTerm(term - 1);
    },
    handleChangeAdvTerm: setDraftAdvTerm,
    handleChangeSchedule: setDraftForm,
    handleCheckRoster: () => void checkRoster(),
    handleToggleExcluded: (userId) => {
      const next = new Set(excludedIds);
      if (!next.delete(userId)) next.add(userId);
      setExcludedIds(next);
    },
    handleAddMember: (entry) => setAdded([...added, entry]),
    handleRemoveAdded: (userId) => setAdded(added.filter((m) => m.userId !== userId)),
    handleSave: () => void save(),
  };
}
