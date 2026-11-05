import { useEffect, useState } from 'react';

import type { PrepareSemesterRequest, SemesterDto } from '@/entities/cohort/model/dto';
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

/** 새 반기 작성 화면 상태: 입력 초안, 기수 선택지, 입력 오류, 처리 함수. */
export interface NewSemesterFormState {
  draftName: string;
  draftBaseTerm: number;
  draftAdvTerm: number;
  draftForm: ScheduleForm;
  baseOptions: TermOption[];
  advOptions: TermOption[];
  /** 저장을 막는 입력 오류. 첫 번째만 화면에 보여 준다. */
  errors: string[];
  isSaving: boolean;
  handleChangeName: (name: string) => void;
  handleChangeBaseTerm: (term: number) => void;
  handleChangeAdvTerm: (term: number) => void;
  handleChangeSchedule: (form: ScheduleForm) => void;
  handleSave: () => void;
}

interface UseNewSemesterFormOptions {
  /** 지금까지 등록된 반기 중 가장 큰 기수. 새 BASE 기수는 이보다 커야 한다. */
  latestCohort: number;
  existingNames: readonly string[];
  prepare: (request: PrepareSemesterRequest) => Promise<SemesterDto>;
  onPrepared: (semester: string) => void;
}

/** 새 반기 작성. 저장하기 전에는 아무것도 보내지 않고, 저장에 실패하면 입력을 그대로 둔다(R10-4). */
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

  const save = async () => {
    setIsSaving(true);
    try {
      await prepare({
        semester: draftName,
        baseTerm: draftBaseTerm,
        advTerm: draftAdvTerm,
        schedule: requestFromForm(draftForm),
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
    isSaving,
    handleChangeName: (name) => setDraftName(name.trim()),
    handleChangeBaseTerm: (term) => {
      setDraftBaseTerm(term);
      setDraftAdvTerm(term - 1);
    },
    handleChangeAdvTerm: setDraftAdvTerm,
    handleChangeSchedule: setDraftForm,
    handleSave: () => void save(),
  };
}
