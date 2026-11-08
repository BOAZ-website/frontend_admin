import { useEffect, useState } from 'react';

import {
  DEFAULT_ADV_LEADER_ENTRY_FROM_WEEK,
  LAST_WEEK_NUM,
} from '@/entities/attendance/model/week';
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

/** 새 반기 작성에서 오류를 붙여 보이는 칸: 반기 이름 + ADV 팀장 입력 시작 주차 + 일정 칸. */
export type NewSemesterField = 'name' | 'advLeaderEntryFromWeek' | ScheduleField;
const FIELD_ORDER: readonly NewSemesterField[] = [
  'name',
  'advLeaderEntryFromWeek',
  ...SCHEDULE_FIELDS,
];

/** ADV 팀장 입력 시작 주차 입력의 오류. 비어 있으면 반기를 만들 수 없다(서버도 같은 규칙으로 거부한다). */
export function advLeaderEntryWeekError(text: string): string | null {
  if (!text.trim()) return 'ADV 팀장 입력 시작 주차를 입력하세요';
  const week = Number(text);
  if (!Number.isInteger(week) || week < 1 || week > LAST_WEEK_NUM) {
    return `1~${LAST_WEEK_NUM} 사이의 주차를 입력하세요`;
  }
  return null;
}

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
  advLeaderEntryFromWeek: String(DEFAULT_ADV_LEADER_ENTRY_FROM_WEEK),
  form: emptyScheduleForm(),
});

/** 새 반기 작성 화면 상태: 입력 초안, 기수 선택지, 입력 오류, 명단 확인 창, 처리 함수. */
export interface NewSemesterFormState {
  draftName: string;
  draftBaseTerm: number;
  draftAdvTerm: number;
  /** ADV 팀장 입력 시작 주차 입력칸의 글자. */
  draftAdvLeaderEntryFromWeek: string;
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
  handleChangeAdvLeaderEntryFromWeek: (text: string) => void;
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
  const [draftAdvLeaderEntryFromWeek, setDraftAdvLeaderEntryFromWeek] = useState(
    initialDraft.advLeaderEntryFromWeek,
  );
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
      advLeaderEntryFromWeek: draftAdvLeaderEntryFromWeek,
      form: draftForm,
    });
  }, [
    draftName,
    draftBaseTerm,
    draftAdvTerm,
    draftAdvLeaderEntryFromWeek,
    draftForm,
    onDraftChange,
  ]);

  const nameError = semesterNameError(draftName, existingNames);
  const entryWeekError = advLeaderEntryWeekError(draftAdvLeaderEntryFromWeek);
  const fieldErrors: Partial<Record<NewSemesterField, string>> = {
    ...(nameError ? { name: nameError } : {}),
    ...(entryWeekError ? { advLeaderEntryFromWeek: entryWeekError } : {}),
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
        advLeaderEntryFromWeek: Number(draftAdvLeaderEntryFromWeek),
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
    draftAdvLeaderEntryFromWeek,
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
    handleChangeAdvLeaderEntryFromWeek: (text) => setDraftAdvLeaderEntryFromWeek(text.trim()),
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
