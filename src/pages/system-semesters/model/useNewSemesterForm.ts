import { useEffect, useState } from 'react';

import type {
  PrepareSemesterRequest,
  RosterEntryDto,
  RosterKind,
  SemesterDto,
} from '@/entities/cohort/model/dto';
import { alertApiError } from '@/shared/lib/alertApiError';
import { registerLeaveGuard } from '@/shared/lib/leaveGuard';

import {
  emptyScheduleForm,
  firstErrorField,
  requestFromForm,
  SCHEDULE_FIELDS,
  scheduleFieldErrors,
  focusField,
  scheduleFieldId,
  type ScheduleField,
  type ScheduleForm,
  semesterNameError,
  shownFieldErrors,
} from './scheduleForm';

/** 새 반기 작성에서 오류를 붙여 보이는 칸: 반기 이름 + 일정 칸. */
export type NewSemesterField = 'name' | ScheduleField;
const FIELD_ORDER: readonly NewSemesterField[] = ['name', ...SCHEDULE_FIELDS];

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

/** 새 반기 작성 화면 상태: 입력 초안, 기수 선택지, 입력 오류, 처리 함수. */
export interface NewSemesterFormState {
  draftName: string;
  draftBaseTerm: number;
  draftAdvTerm: number;
  draftForm: ScheduleForm;
  baseOptions: TermOption[];
  advOptions: TermOption[];
  /** 칸 아래에 보일 오류. 손대지 않은 칸은 만들기 버튼을 누르기 전까지 숨긴다. */
  shownErrors: Partial<Record<NewSemesterField, string>>;
  /** 명단에 넣기로 고른 사람. 빈 명단에서 시작한다. */
  members: RosterEntryDto[];
  kindOf: (term: number) => RosterKind;
  isSaving: boolean;
  handleChangeName: (name: string) => void;
  handleChangeBaseTerm: (term: number) => void;
  handleChangeAdvTerm: (term: number) => void;
  handleChangeSchedule: (form: ScheduleForm) => void;
  /** 칸을 벗어나면 그 칸의 오류를 보이기 시작한다. */
  handleBlurField: (field: NewSemesterField) => void;
  handleAddMembers: (entries: RosterEntryDto[]) => void;
  handleRemoveMember: (userId: string) => void;
  handleSave: () => void;
}

interface UseNewSemesterFormOptions {
  /** 지금까지 등록된 반기 중 가장 큰 기수. 새 BASE 기수는 이보다 커야 한다. */
  latestCohort: number;
  existingNames: readonly string[];
  prepare: (request: PrepareSemesterRequest) => Promise<SemesterDto>;
  onPrepared: (semester: string) => void;
}

/**
 * 새 반기 작성: 입력 → 명단에 사람 추가(빈 명단에서 시작) → 반기 만들기.
 * 만들기에 실패하면 입력을 그대로 둔다(R10-4).
 */
export function useNewSemesterForm({
  latestCohort,
  existingNames,
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
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [isAttempted, setIsAttempted] = useState(false);
  const [members, setMembers] = useState<RosterEntryDto[]>([]);

  const isDirty =
    draftName !== '' ||
    draftBaseTerm !== firstBase ||
    draftAdvTerm !== firstAdv ||
    members.length > 0 ||
    JSON.stringify(draftForm) !== JSON.stringify(emptyScheduleForm());
  useEffect(
    () =>
      isDirty
        ? registerLeaveGuard(() => window.confirm('작성 중인 새 반기를 저장하지 않고 나갈까요?'))
        : undefined,
    [isDirty],
  );

  const nameError = semesterNameError(draftName, existingNames);
  const fieldErrors: Partial<Record<NewSemesterField, string>> = {
    ...(nameError ? { name: nameError } : {}),
    ...scheduleFieldErrors(draftForm),
  };
  /** 오류가 있으면 모든 칸 오류를 보이고 첫 오류 칸으로 포커스를 옮긴다. 오류가 없으면 true. */
  const passOrShowErrors = (): boolean => {
    const first = firstErrorField(fieldErrors, FIELD_ORDER);
    if (!first) return true;
    setIsAttempted(true);
    focusField(scheduleFieldId(first));
    return false;
  };

  const save = async () => {
    if (!passOrShowErrors()) return;
    setIsSaving(true);
    try {
      await prepare({
        semester: draftName,
        baseTerm: draftBaseTerm,
        advTerm: draftAdvTerm,
        schedule: requestFromForm(draftForm),
        userIds: members.map((m) => m.userId),
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
    shownErrors: shownFieldErrors(fieldErrors, touched, isAttempted),
    // 기수를 바꿔도 이미 고른 사람의 구분이 새 기수 기준으로 보이게 다시 정한다.
    members: members.map((m) => ({
      ...m,
      kind: m.term === draftBaseTerm ? 'BASE' : m.term === draftAdvTerm ? 'ADV' : 'EXTRA',
    })),
    kindOf: (term) => (term === draftBaseTerm ? 'BASE' : term === draftAdvTerm ? 'ADV' : 'EXTRA'),
    isSaving,
    handleChangeName: (name) => setDraftName(name.trim()),
    handleChangeBaseTerm: (term) => {
      setDraftBaseTerm(term);
      setDraftAdvTerm(term - 1);
    },
    handleChangeAdvTerm: setDraftAdvTerm,
    handleChangeSchedule: setDraftForm,
    handleBlurField: (field) => {
      if (!touched.has(field)) setTouched(new Set([...touched, field]));
    },
    handleAddMembers: (entries) => setMembers([...members, ...entries]),
    handleRemoveMember: (userId) => setMembers(members.filter((m) => m.userId !== userId)),
    handleSave: () => void save(),
  };
}
