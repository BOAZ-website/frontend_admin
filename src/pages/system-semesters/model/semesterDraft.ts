import type { SemesterHalf } from '@/entities/cohort/model/dto';

import { ACTIVITIES, type ScheduleForm } from './scheduleForm';

/** 시작하기 전의 새 반기 입력. 목록의 "예정" 묶음에 보이고, 이 브라우저에 임시 저장한다. */
export interface SemesterDraft {
  name: string;
  /** 상반기·하반기 드롭다운. 고르기 전에는 빈 문자열이다. */
  half: SemesterHalf | '';
  /** 점수 규칙 버전(ATT-12 id). 고르기 전에는 null이다. */
  scoreRuleSetId: number | null;
  baseTerm: number;
  advTerm: number;
  form: ScheduleForm;
}

/** 임시 저장 키. 서버가 아니라 이 브라우저(localStorage)에만 둔다. */
export const SEMESTER_DRAFT_KEY = 'boaz_semester_draft';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === 'string');

const isDateRange = (value: unknown): boolean =>
  isRecord(value) && typeof value.startDate === 'string' && typeof value.endDate === 'string';

/**
 * 저장해 둔 일정 입력을 읽는다. 휴강 주차 목록이 없거나 모양이 틀리면(예전 버전의 활동별 휴강 등) 휴강만 비운다.
 * 기간·시작일 모양이 틀리면 null.
 */
function scheduleFormOf(value: unknown): ScheduleForm | null {
  if (
    !isRecord(value) ||
    !isDateRange(value.vacation) ||
    !isDateRange(value.term) ||
    !isStringRecord(value.starts) ||
    !ACTIVITIES.every(({ value: activity }) => activity in (value.starts as object))
  ) {
    return null;
  }
  const voidWeekNos =
    Array.isArray(value.voidWeekNos) && value.voidWeekNos.every((no) => Number.isInteger(no))
      ? (value.voidWeekNos as number[])
      : [];
  return {
    vacation: value.vacation as ScheduleForm['vacation'],
    term: value.term as ScheduleForm['term'],
    starts: value.starts as ScheduleForm['starts'],
    voidWeekNos,
  };
}

/** 저장해 둔 문자열을 읽는다. 없거나 모양이 틀리면(다른 버전이 저장한 값 등) null이다. */
export function parseSemesterDraft(raw: string | null): SemesterDraft | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    typeof value.baseTerm !== 'number' ||
    typeof value.advTerm !== 'number'
  ) {
    return null;
  }
  const form = scheduleFormOf(value.form);
  // 드롭다운을 넣기 전에 저장한 입력에는 half가 없다. 그때는 고르지 않은 상태로 읽는다.
  const half = value.half === 'H1' || value.half === 'H2' ? value.half : '';
  const scoreRuleSetId = typeof value.scoreRuleSetId === 'number' ? value.scoreRuleSetId : null;
  return form
    ? {
        name: value.name,
        half,
        scoreRuleSetId,
        baseTerm: value.baseTerm,
        advTerm: value.advTerm,
        form,
      }
    : null;
}

export function loadSemesterDraft(): SemesterDraft | null {
  try {
    return parseSemesterDraft(localStorage.getItem(SEMESTER_DRAFT_KEY));
  } catch {
    // 저장소를 쓸 수 없는 브라우저(사생활 보호 모드 등)는 임시 저장 없이 쓴다.
    return null;
  }
}

/** 임시 저장한다. 저장소가 꽉 찼거나 쓸 수 없으면 false(화면이 알린다). */
export function saveSemesterDraft(draft: SemesterDraft): boolean {
  try {
    localStorage.setItem(SEMESTER_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearSemesterDraft(): void {
  try {
    localStorage.removeItem(SEMESTER_DRAFT_KEY);
  } catch {
    // 지우지 못해도 다음에 읽을 때 같은 값이 보일 뿐이다.
  }
}
