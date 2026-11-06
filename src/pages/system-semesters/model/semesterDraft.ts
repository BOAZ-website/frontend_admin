import { ACTIVITIES, type ScheduleForm } from './scheduleForm';

/** 시작하기 전의 새 반기 입력. 목록의 "예정" 묶음에 보이고, 이 브라우저에 임시 저장한다. */
export interface SemesterDraft {
  name: string;
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

function isScheduleForm(value: unknown): value is ScheduleForm {
  return (
    isRecord(value) &&
    isDateRange(value.vacation) &&
    isDateRange(value.term) &&
    isStringRecord(value.starts) &&
    ACTIVITIES.every(({ value: activity }) => activity in (value.starts as object)) &&
    isStringRecord(value.invalid)
  );
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
    typeof value.advTerm !== 'number' ||
    !isScheduleForm(value.form)
  ) {
    return null;
  }
  return { name: value.name, baseTerm: value.baseTerm, advTerm: value.advTerm, form: value.form };
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
