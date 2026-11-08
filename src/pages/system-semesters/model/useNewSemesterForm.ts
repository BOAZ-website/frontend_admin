import { useEffect, useState } from 'react';

import type { PrepareSemesterRequest, RosterKind, SemesterDto } from '@/entities/cohort/model/dto';
import { alertApiError } from '@/shared/lib/alertApiError';

import { rosterTermsOf } from './roster';
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
import type { SemesterDraft } from './semesterDraft';

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

/** "새 반기 시작"을 처음 누를 때의 빈 입력. 기수는 등록된 가장 큰 기수 다음이다. */
export const emptySemesterDraft = (latestCohort: number): SemesterDraft => ({
  name: '',
  baseTerm: latestCohort + 1,
  advTerm: Math.max(1, latestCohort),
  form: emptyScheduleForm(),
});

/** 새 반기 작성 화면 상태: 입력 초안, 기수 선택지, 입력 오류, 명단 확인 창, 처리 함수. */
export interface NewSemesterFormState {
  draftName: string;
  draftBaseTerm: number;
  draftAdvTerm: number;
  draftForm: ScheduleForm;
  baseOptions: TermOption[];
  advOptions: TermOption[];
  /** 칸 아래에 보일 오류. 손대지 않은 칸은 저장 버튼을 누르기 전까지 숨긴다. */
  shownErrors: Partial<Record<NewSemesterField, string>>;
  /** 명단 확인 창을 열었다. */
  isRosterOpen: boolean;
  /** 명단 확인 창에 미리 넣을 기수(1주차 시작일을 정한 BASE·ADV 기수). */
  rosterTerms: number[];
  kindOf: (term: number) => RosterKind;
  isSaving: boolean;
  handleChangeName: (name: string) => void;
  handleChangeBaseTerm: (term: number) => void;
  handleChangeAdvTerm: (term: number) => void;
  handleChangeSchedule: (form: ScheduleForm) => void;
  /** 칸을 벗어나면 그 칸의 오류를 보이기 시작한다. */
  handleBlurField: (field: NewSemesterField) => void;
  /** 입력을 검사하고, 오류가 없으면 명단 확인 창을 연다. */
  handleSave: () => void;
  handleCloseRoster: () => void;
  /** 명단 확인 창에서 확인한 명단으로 진행 예정 반기를 만든다(적용). */
  handleApply: (userIds: string[]) => void;
}

interface UseNewSemesterFormOptions {
  /** 임시 저장해 둔 입력. 화면은 이 값에서 시작한다. */
  initialDraft: SemesterDraft;
  /** 입력이 바뀔 때마다 부른다. 목록의 "예정" 칸 이름과 임시 저장에 쓴다. */
  onDraftChange: (draft: SemesterDraft) => void;
  existingNames: readonly string[];
  prepare: (request: PrepareSemesterRequest) => Promise<SemesterDto>;
  onApplied: (semester: string) => void;
}

/**
 * 새 반기 작성: 입력(바뀔 때마다 임시 저장) → 적용 → 명단 확인 창 → 확인하면 진행 예정 반기가 된다.
 * 진행 반기는 바뀌지 않고, 목록에서 그 반기를 열어 활성화해야 진행 반기가 된다.
 * 적용에 실패하면 입력과 명단 확인 창을 그대로 둔다(R10-4).
 */
export function useNewSemesterForm({
  initialDraft,
  onDraftChange,
  existingNames,
  prepare,
  onApplied,
}: UseNewSemesterFormOptions): NewSemesterFormState {
  const [draftName, setDraftName] = useState(initialDraft.name);
  const [draftBaseTerm, setDraftBaseTerm] = useState(initialDraft.baseTerm);
  const [draftAdvTerm, setDraftAdvTerm] = useState(initialDraft.advTerm);
  const [draftForm, setDraftForm] = useState(initialDraft.form);
  const [isSaving, setIsSaving] = useState(false);
  const [isRosterOpen, setIsRosterOpen] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const [isAttempted, setIsAttempted] = useState(false);
  const firstBase = initialDraft.baseTerm;

  // 임시 저장은 바깥 저장소와 맞추는 일이라 effect에서 한다.
  useEffect(() => {
    onDraftChange({
      name: draftName,
      baseTerm: draftBaseTerm,
      advTerm: draftAdvTerm,
      form: draftForm,
    });
  }, [draftName, draftBaseTerm, draftAdvTerm, draftForm, onDraftChange]);

  const nameError = semesterNameError(draftName, existingNames);
  const fieldErrors: Partial<Record<NewSemesterField, string>> = {
    ...(nameError ? { name: nameError } : {}),
    ...scheduleFieldErrors(draftForm),
  };

  const applyWith = async (userIds: string[]) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await prepare({
        semester: draftName,
        baseTerm: draftBaseTerm,
        advTerm: draftAdvTerm,
        schedule: requestFromForm(draftForm),
        userIds,
      });
    } catch (error) {
      alertApiError(error);
      return;
    } finally {
      setIsSaving(false);
    }
    onApplied(draftName);
  };

  const kindOf = (term: number): RosterKind =>
    term === draftBaseTerm ? 'BASE' : term === draftAdvTerm ? 'ADV' : 'EXTRA';

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
    isRosterOpen,
    rosterTerms: rosterTermsOf(draftForm, draftBaseTerm, draftAdvTerm),
    kindOf,
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
    handleSave: () => {
      // 오류가 있으면 모든 칸 오류를 보이고 첫 오류 칸으로 포커스를 옮긴다.
      const first = firstErrorField(fieldErrors, FIELD_ORDER);
      if (first) {
        setIsAttempted(true);
        focusField(scheduleFieldId(first));
        return;
      }
      setIsRosterOpen(true);
    },
    handleCloseRoster: () => setIsRosterOpen(false),
    handleApply: (userIds) => void applyWith(userIds),
  };
}
