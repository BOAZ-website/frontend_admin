import type {
  DateRange,
  SaveSemesterScheduleRequest,
  SemesterActivity,
  SemesterScheduleDto,
} from '@/entities/cohort/model/dto';
import { activityWeekDates } from '@/entities/cohort/model/schedule';
import { isValidIsoDate } from '@/shared/lib/date';

/** 1주차 시작일을 따로 정하는 활동과 화면 이름. */
export const ACTIVITIES: readonly { value: SemesterActivity; label: string }[] = [
  { value: 'BASE', label: 'BASE' },
  { value: 'ADV', label: 'ADV' },
  { value: 'STUDY_VACATION', label: '방학 스터디' },
  { value: 'STUDY_TERM', label: '학기 스터디' },
];

/** 입력 중인 일정. 빈 문자열은 아직 정하지 않은 날짜다. */
export interface ScheduleForm {
  vacation: DateRange;
  term: DateRange;
  starts: Record<SemesterActivity, string>;
  /** 휴강으로 체크한 주차: invalidKey(활동, 주차) → 사유(없으면 빈 문자열). */
  invalid: Record<string, string>;
}

/** 휴강 체크를 담는 키: '활동:주차'. */
export const invalidKey = (activity: SemesterActivity, weekNum: number): string =>
  `${activity}:${weekNum}`;

/** 활동별로 1주차 시작일에서 7일씩 더한 주차 날짜: 활동 → 주차 → 날짜. 시작일이 없으면 빈 객체. */
export function weekDatesByActivity(
  form: ScheduleForm,
): Record<SemesterActivity, Record<number, string>> {
  const datesOf = (activity: SemesterActivity) =>
    Object.fromEntries(activityWeekDates(form.starts[activity]).map((w) => [w.weekNum, w.date]));
  return {
    BASE: datesOf('BASE'),
    ADV: datesOf('ADV'),
    STUDY_VACATION: datesOf('STUDY_VACATION'),
    STUDY_TERM: datesOf('STUDY_TERM'),
  };
}

/** 휴강 체크를 켜거나 끈 새 일정. 다시 켜면 사유는 빈 문자열이다. */
export function withInvalidWeek(form: ScheduleForm, key: string, isInvalid: boolean): ScheduleForm {
  const invalid = { ...form.invalid };
  if (isInvalid) invalid[key] = '';
  else delete invalid[key];
  return { ...form, invalid };
}

/** 한 활동의 일정 선택을 취소한 새 일정: 1주차 시작일과 그 활동의 휴동 주차를 지운다. */
export function withoutActivitySchedule(
  form: ScheduleForm,
  activity: SemesterActivity,
): ScheduleForm {
  // invalidKey와 같은 'ACTIVITY:주차' 모양이다.
  const prefix = `${activity}:`;
  return {
    ...form,
    starts: { ...form.starts, [activity]: '' },
    invalid: Object.fromEntries(
      Object.entries(form.invalid).filter(([key]) => !key.startsWith(prefix)),
    ),
  };
}

/** 아무것도 정하지 않은 새 일정. */
export const emptyScheduleForm = (): ScheduleForm => ({
  vacation: { startDate: '', endDate: '' },
  term: { startDate: '', endDate: '' },
  starts: { BASE: '', ADV: '', STUDY_VACATION: '', STUDY_TERM: '' },
  invalid: {},
});

/** 서버 일정을 입력 상태로 바꾼다. 정하지 않은 날짜는 빈 문자열. */
export function formFromSchedule(schedule: SemesterScheduleDto): ScheduleForm {
  const form = emptyScheduleForm();
  if (schedule.vacation) form.vacation = { ...schedule.vacation };
  if (schedule.term) form.term = { ...schedule.term };
  for (const { value } of ACTIVITIES) form.starts[value] = schedule.activityStarts[value] ?? '';
  for (const week of schedule.invalidWeeks) {
    form.invalid[invalidKey(week.activity, week.weekNum)] = week.reason;
  }
  return form;
}

/** 입력 상태를 저장 요청으로 바꾼다. 빈 시작일은 null, 사유 없는 휴강은 reason을 뺀다. */
export function requestFromForm(form: ScheduleForm): SaveSemesterScheduleRequest {
  return {
    vacation: form.vacation,
    term: form.term,
    activityStarts: Object.fromEntries(
      ACTIVITIES.map(({ value }) => [value, form.starts[value] || null]),
    ),
    invalidWeeks: Object.entries(form.invalid).flatMap(([key, reason]) => {
      const [activityKey, weekNum] = key.split(':');
      const activity = ACTIVITIES.find(({ value }) => value === activityKey)?.value;
      return activity
        ? [{ activity, weekNum: Number(weekNum), ...(reason ? { reason } : {}) }]
        : [];
    }),
  };
}

/** 오류를 붙여 보이는 칸: 기간 두 줄과 활동별 1주차 시작일. */
export type ScheduleField = 'vacation' | 'term' | SemesterActivity;

/** 칸별 입력 오류(그 칸 아래에 보일 짧은 문장). 오류가 없는 칸은 키가 없다. */
export type ScheduleFieldErrors = Partial<Record<ScheduleField, string>>;

/** 칸을 화면에서 찾는 id. 첫 오류 칸으로 포커스를 옮길 때 쓴다. */
export const scheduleFieldId = (field: ScheduleField | 'name'): string => `semester-field-${field}`;

/** 칸 아래 오류 문장의 id: 칸 id 뒤에 '-error'. 입력칸의 aria-describedby가 가리킨다. */
export const errorIdOf = (fieldId: string): string => `${fieldId}-error`;

/** id의 칸(입력칸이거나 입력칸을 감싼 묶음)의 첫 입력칸으로 포커스를 옮긴다. */
export function focusField(id: string): void {
  const element = document.getElementById(id);
  const input = element instanceof HTMLInputElement ? element : element?.querySelector('input');
  input?.focus();
}

/** 저장 전에 화면에서 먼저 거르는 입력 오류(칸별). 서버도 같은 규칙으로 다시 검사한다. */
export function scheduleFieldErrors(form: ScheduleForm): ScheduleFieldErrors {
  const errors: ScheduleFieldErrors = {};
  const { vacation, term } = form;
  for (const field of ['vacation', 'term'] as const) {
    const range = form[field];
    if (!isValidIsoDate(range.startDate) || !isValidIsoDate(range.endDate)) {
      errors[field] = '시작일과 종료일을 입력하세요';
    } else if (range.startDate > range.endDate) {
      errors[field] = '종료일을 시작일 뒤로 정하세요';
    }
  }
  if (errors.vacation || errors.term) return errors;
  if (vacation.endDate >= term.startDate) {
    errors.term = '학기 시작일을 방학 종료일 뒤로 정하세요';
    return errors;
  }
  for (const { value } of ACTIVITIES) {
    const start = form.starts[value];
    if (!start) continue;
    if (!isValidIsoDate(start) || start < vacation.startDate || start > term.endDate) {
      errors[value] = '방학 시작일 ~ 학기 종료일 안의 날짜를 고르세요';
    }
  }
  return errors;
}

/** 화면 위에서 아래 순서로 본 칸 이름. 첫 오류 칸을 찾을 때 쓴다. */
export const SCHEDULE_FIELDS: readonly ScheduleField[] = [
  'vacation',
  'term',
  ...ACTIVITIES.map(({ value }) => value),
];

/** 새 반기 이름 규칙: 'YY-1' 또는 'YY-2'. */
export const SEMESTER_NAME_PATTERN = /^\d{2}-[12]$/;

/** 새 반기 이름의 입력 오류. 없으면 undefined. */
export function semesterNameError(
  name: string,
  existingNames: readonly string[],
): string | undefined {
  if (!SEMESTER_NAME_PATTERN.test(name)) return '26-2처럼 입력하세요';
  if (existingNames.includes(name)) return '이미 있는 반기 이름입니다';
  return undefined;
}

/**
 * 칸 아래에 실제로 보일 오류. 아직 손대지 않은 칸은 숨기고, 한 번 벗어났거나(touched)
 * 확인·저장 버튼을 누른 뒤(isAttempted)에만 보인다.
 */
export function shownFieldErrors<F extends string>(
  errors: Partial<Record<F, string>>,
  touched: ReadonlySet<string>,
  isAttempted: boolean,
): Partial<Record<F, string>> {
  if (isAttempted) return errors;
  return Object.fromEntries(
    Object.entries(errors).filter(([field]) => touched.has(field)),
  ) as Partial<Record<F, string>>;
}

/** 화면 순서(order)에서 처음 나오는 오류 칸. 오류가 없으면 null. */
export function firstErrorField<F extends string>(
  errors: Partial<Record<F, string>>,
  order: readonly F[],
): F | null {
  return order.find((field) => errors[field] !== undefined) ?? null;
}
