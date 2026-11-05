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

/** 저장 전에 화면에서 먼저 거르는 입력 오류. 서버도 같은 규칙으로 다시 검사한다. */
export function scheduleErrors(form: ScheduleForm): string[] {
  const errors: string[] = [];
  const { vacation, term } = form;
  const ranges = [
    ['방학', vacation],
    ['학기', term],
  ] as const;
  for (const [label, range] of ranges) {
    if (!isValidIsoDate(range.startDate) || !isValidIsoDate(range.endDate)) {
      errors.push(`${label} 시작일과 종료일을 입력하세요.`);
    } else if (range.startDate > range.endDate) {
      errors.push(`${label} 시작일이 종료일보다 늦습니다.`);
    }
  }
  if (!errors.length && vacation.endDate >= term.startDate) {
    errors.push('학기 시작일은 방학 종료일보다 늦어야 합니다.');
  }
  if (!errors.length) {
    for (const { value, label } of ACTIVITIES) {
      const start = form.starts[value];
      if (!start) continue;
      if (!isValidIsoDate(start) || start < vacation.startDate || start > term.endDate) {
        errors.push(`${label} 1주차 시작일이 반기 기간 밖입니다.`);
      }
    }
  }
  return errors;
}

/** 새 반기 이름 규칙: 'YY-1' 또는 'YY-2'. */
export const SEMESTER_NAME_PATTERN = /^\d{2}-[12]$/;
