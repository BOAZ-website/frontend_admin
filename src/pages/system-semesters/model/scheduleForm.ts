import type {
  CommonWeekDto,
  DateRange,
  SaveSemesterScheduleRequest,
  SemesterActivity,
  SemesterHalf,
  SemesterScheduleDto,
} from '@/entities/cohort/model/dto';
import {
  activityWeekDates,
  commonWeeksOf,
  isShorterThanWeeks,
  MIN_PERIOD_WEEKS,
  SEMESTER_ACTIVITY_INFO,
  weekCountOf,
} from '@/entities/cohort/model/schedule';
import { isValidIsoDate } from '@/shared/lib/date';

/** 1주차 시작일을 따로 정하는 활동과 화면 이름. */
export const ACTIVITIES = SEMESTER_ACTIVITY_INFO;

/** 입력 중인 일정. 빈 문자열은 아직 정하지 않은 날짜다. */
export interface ScheduleForm {
  vacation: DateRange;
  term: DateRange;
  starts: Record<SemesterActivity, string>;
  /** 휴강으로 정한 공통 주차 번호(작은 번호부터). 모든 활동에 적용된다. */
  voidWeekNos: number[];
}

/** 기간으로 만든 공통 주차와 휴강 여부. 기간을 다 정하지 않았으면 빈 배열. */
export const commonWeeksOfForm = (form: ScheduleForm): CommonWeekDto[] =>
  commonWeeksOf(form.vacation, form.term).map((week) => ({
    ...week,
    isVoid: form.voidWeekNos.includes(week.weekNo),
  }));

/** 휴강 고르기 목록의 한 주. weekNo는 저장에 쓰는 공통 주차 번호, displayNo는 화면에 보이는 번호다. */
export type VoidWeekOption = CommonWeekDto & { displayNo: number };

/**
 * 휴강 주차를 화면에 보일 때 쓰는 번호. 휴강은 BASE·ADV에 걸리므로, 둘 가운데 먼저 시작하는 활동의
 * 1주차 시작일이 든 주를 1주차로 센다(공통 주차 번호는 방학 시작일이 든 주가 1주차라 활동 주차와 어긋난다).
 * BASE·ADV 시작일이 모두 없으면 공통 주차 번호를 그대로 쓴다. 그 주보다 앞이면 null이다.
 */
export function displayWeekNoOf(form: ScheduleForm, weekNo: number): number | null {
  const starts = [form.starts.BASE, form.starts.ADV].filter(Boolean).sort();
  if (starts.length === 0) return weekNo;
  const first = commonWeeksOf(form.vacation, form.term).find(
    (week) => week.startDate <= starts[0] && starts[0] <= week.endDate,
  );
  if (!first) return weekNo;
  const displayNo = weekNo - first.weekNo + 1;
  return displayNo >= 1 ? displayNo : null;
}

/** 고른 주차 번호를 쓴다: 없으면 '없음', 있으면 작은 번호부터 쉼표로 이어 '13, 14주차'. */
export function weekRangeText(weekNos: readonly number[]): string {
  if (weekNos.length === 0) return '없음';
  return `${[...weekNos].sort((a, b) => a - b).join(', ')}주차`;
}

/** 휴강 고르기 목록: BASE·ADV 1주차가 든 주부터, 그 주를 1주차로 센 번호를 붙인다. */
export const voidWeekOptionsOf = (form: ScheduleForm): VoidWeekOption[] =>
  commonWeeksOfForm(form).flatMap((week) => {
    const displayNo = displayWeekNoOf(form, week.weekNo);
    return displayNo === null ? [] : [{ ...week, displayNo }];
  });

/**
 * 활동별로 1주차 시작일에서 7일씩 더한 주차 날짜: 활동 → 주차 → 날짜. 시작일이 없으면 빈 객체.
 * BASE·ADV는 휴강 공통 주차에 하지 않으므로, 주차 시작일이 휴강 주(월~일) 안이면 그 주를 건너뛰고
 * 다음 주로 미뤄 주차 수(16주차)를 채운다. 스터디 휴강은 스터디장이 출결 입력 탭에서 따로 정하므로 건너뛰지 않는다.
 */
export function weekDatesByActivity(
  form: ScheduleForm,
): Record<SemesterActivity, Record<number, string>> {
  const voidWeeks = commonWeeksOfForm(form).filter((week) => week.isVoid);
  const isInVoidWeek = (date: string) =>
    voidWeeks.some((week) => week.startDate <= date && date <= week.endDate);
  const datesOf = (activity: SemesterActivity) => {
    const count = weekCountOf(activity);
    const isTrack = activity === 'BASE' || activity === 'ADV';
    // 건너뛸 주만큼 더 만들어 두고, 휴강 주를 뺀 앞에서부터 주차 수만큼 쓴다.
    const candidates = activityWeekDates(
      form.starts[activity],
      isTrack ? count + voidWeeks.length : count,
    );
    const dates = (isTrack ? candidates.filter((w) => !isInVoidWeek(w.date)) : candidates)
      .slice(0, count)
      .map((w) => w.date);
    return Object.fromEntries(dates.map((date, index) => [index + 1, date]));
  };
  return Object.fromEntries(ACTIVITIES.map(({ value }) => [value, datesOf(value)])) as Record<
    SemesterActivity,
    Record<number, string>
  >;
}

/** 공통 주차 하나를 휴강으로 넣거나 뺀 새 일정. */
export function withVoidWeek(form: ScheduleForm, weekNo: number, isVoid: boolean): ScheduleForm {
  const others = form.voidWeekNos.filter((no) => no !== weekNo);
  return { ...form, voidWeekNos: isVoid ? [...others, weekNo].sort((a, b) => a - b) : others };
}

/** 아무것도 정하지 않은 새 일정. */
export const emptyScheduleForm = (): ScheduleForm => ({
  vacation: { startDate: '', endDate: '' },
  term: { startDate: '', endDate: '' },
  starts: Object.fromEntries(ACTIVITIES.map(({ value }) => [value, ''])) as Record<
    SemesterActivity,
    string
  >,
  voidWeekNos: [],
});

/** 서버 일정을 입력 상태로 바꾼다. 정하지 않은 날짜는 빈 문자열. */
export function formFromSchedule(schedule: SemesterScheduleDto): ScheduleForm {
  const form = emptyScheduleForm();
  if (schedule.vacation) form.vacation = { ...schedule.vacation };
  if (schedule.term) form.term = { ...schedule.term };
  for (const { value } of ACTIVITIES) form.starts[value] = schedule.activityStarts[value] ?? '';
  form.voidWeekNos = schedule.weeks.filter((week) => week.isVoid).map((week) => week.weekNo);
  return form;
}

/** 입력 상태를 기간·시작일 저장 요청으로 바꾼다. 빈 시작일은 null. 휴강은 따로 보낸다. */
export function requestFromForm(form: ScheduleForm): SaveSemesterScheduleRequest {
  return {
    vacation: form.vacation,
    term: form.term,
    activityStarts: Object.fromEntries(
      ACTIVITIES.map(({ value }) => [value, form.starts[value] || null]),
    ),
  };
}

/** 오류를 붙여 보이는 칸: 기간 두 줄과 활동별 1주차 시작일. */
export type ScheduleField = 'vacation' | 'term' | SemesterActivity;

/** 칸별 입력 오류(그 칸 아래에 보일 짧은 문장). 오류가 없는 칸은 키가 없다. */
export type ScheduleFieldErrors = Partial<Record<ScheduleField, string>>;

/** 칸을 화면에서 찾는 id. 첫 오류 칸으로 포커스를 옮길 때 쓴다. */
export const scheduleFieldId = (field: ScheduleField | 'name' | 'half' | 'scoreRule'): string =>
  `semester-field-${field}`;

/** 칸 아래 오류 문장의 id: 칸 id 뒤에 '-error'. 입력칸의 aria-describedby가 가리킨다. */
export const errorIdOf = (fieldId: string): string => `${fieldId}-error`;

/** id의 칸(입력칸이거나 입력칸을 감싼 묶음)의 첫 입력칸으로 포커스를 옮긴다. */
export function focusField(id: string): void {
  const element = document.getElementById(id);
  // 드롭다운 칸은 입력칸이 없어 펼침 버튼에 포커스를 준다.
  const input =
    element instanceof HTMLInputElement
      ? element
      : element?.querySelector<HTMLElement>('input, button');
  input?.focus();
}

const MONDAY = 1;
const SUNDAY = 0;
const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

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
    } else if (weekdayOf(range.startDate) !== MONDAY) {
      errors[field] = '시작일은 월요일로 정하세요';
    } else if (weekdayOf(range.endDate) !== SUNDAY) {
      errors[field] = '종료일은 일요일로 정하세요';
    }
  }
  if (errors.vacation || errors.term) return errors;
  if (vacation.endDate >= term.startDate) {
    errors.term = '학기 시작일을 방학 종료일 뒤로 정하세요';
    return errors;
  }
  if (isShorterThanWeeks(vacation, MIN_PERIOD_WEEKS.vacation)) {
    errors.vacation = `방학은 ${MIN_PERIOD_WEEKS.vacation}주 이상으로 정하세요`;
  }
  if (isShorterThanWeeks(term, MIN_PERIOD_WEEKS.term)) {
    errors.term = `학기는 ${MIN_PERIOD_WEEKS.term}주 이상으로 정하세요`;
  }
  if (errors.vacation || errors.term) return errors;
  // 4개 활동의 1주차 시작일은 모두 정해야 한다. BASE·ADV는 반기 안, 스터디는 그 기간 안이다(백엔드 ATT-03).
  const rangeOfStart: Record<SemesterActivity, DateRange> = {
    BASE: { startDate: vacation.startDate, endDate: term.endDate },
    ADV: { startDate: vacation.startDate, endDate: term.endDate },
    STUDY_VACATION: vacation,
    STUDY_TERM: term,
  };
  for (const { value } of ACTIVITIES) {
    const start = form.starts[value];
    const range = rangeOfStart[value];
    if (!start) {
      errors[value] = '1주차 시작일을 고르세요';
    } else if (!isValidIsoDate(start) || start < range.startDate || start > range.endDate) {
      errors[value] =
        value === 'STUDY_VACATION'
          ? '방학 기간 안의 날짜를 고르세요'
          : value === 'STUDY_TERM'
            ? '학기 기간 안의 날짜를 고르세요'
            : '방학 시작일 ~ 학기 종료일 안의 날짜를 고르세요';
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

/** 반기 등록 화면의 상반기·하반기 드롭다운 선택지. */
export const SEMESTER_HALF_OPTIONS: readonly { value: SemesterHalf; label: string }[] = [
  { value: 'H1', label: '상반기(H1)' },
  { value: 'H2', label: '하반기(H2)' },
];

/** 반기 이름 'YY-N'의 N이 가리키는 상반기·하반기(1=H1, 2=H2). 형식이 틀리면 null. */
const halfOfSemesterName = (name: string): SemesterHalf | null =>
  SEMESTER_NAME_PATTERN.test(name) ? (name.endsWith('-1') ? 'H1' : 'H2') : null;

/** 상반기·하반기 입력 오류. 고르지 않았거나 반기 이름의 N과 다르면 오류다(백엔드 ATT-03). 없으면 undefined. */
export function semesterHalfError(half: SemesterHalf | '', name: string): string | undefined {
  if (!half) return '상반기·하반기를 고르세요';
  const expected = halfOfSemesterName(name);
  if (expected && expected !== half) {
    return `반기 이름 ${name}은 ${expected === 'H1' ? '상반기' : '하반기'}입니다`;
  }
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
