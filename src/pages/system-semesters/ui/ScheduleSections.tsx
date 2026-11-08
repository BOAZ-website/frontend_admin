import { ACTIVITY_WEEK_COUNT } from '@/entities/cohort/model/schedule';
import { monthDayOf } from '@/shared/lib/date';
import { FIELD_TEXT_BTN } from '@/shared/ui/systemStyles';

import {
  ACTIVITIES,
  errorIdOf,
  invalidKey,
  type ScheduleField,
  type ScheduleFieldErrors,
  scheduleFieldId,
  type ScheduleForm,
  weekDatesByActivity,
  withInvalidWeek,
  withoutActivitySchedule,
} from '../model/scheduleForm';
import { DateField } from './DateField';
import { LabeledRow, READONLY_VALUE, SectionBox } from './SectionBox';
import { SemesterCalendar } from './SemesterCalendar';

const WEEK_NUMBERS = Array.from({ length: ACTIVITY_WEEK_COUNT }, (_, index) => index + 1);

interface ScheduleSectionsProps {
  form: ScheduleForm;
  onChange: (form: ScheduleForm) => void;
  /** 고칠 수 없는 반기이거나 저장하는 중이면 값만 보여 준다. */
  isReadOnly: boolean;
  /** 고칠 수 없는 반기(진행 중·종료)다. 구역 제목을 정하는 말('지정') 대신 보는 말로 바꾼다. */
  isLocked?: boolean;
  /** 칸 아래에 보일 입력 오류(보일 것만 넘긴다). */
  errors?: ScheduleFieldErrors;
  /** 칸(기간 한 줄 또는 시작일 칸)에서 포커스가 나가면 부른다. */
  onBlurField?: (field: ScheduleField) => void;
}

const PERIODS = [
  ['vacation', '방학'],
  ['term', '학기'],
] as const;

/** 칸 묶음에서 포커스가 바깥으로 나갈 때만 부른다(달력 버튼 등 안쪽 이동은 무시). */
const blurOutside =
  (handler: (() => void) | undefined) =>
  (event: React.FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) handler?.();
  };

/** 기간, 활동별 1주차 시작일과 그 옆의 주차 칸(누르면 휴강·수업을 바꾼다). */
export function ScheduleSections({
  form,
  onChange,
  isReadOnly,
  isLocked = false,
  errors = {},
  onBlurField,
}: ScheduleSectionsProps) {
  const datesOf = weekDatesByActivity(form);
  const scheduledActivities = ACTIVITIES.filter(({ value }) => form.starts[value]);
  // 고칠 수 없는 반기는 활동 기간·시작일을 위쪽 요약 표에 보이므로 여기서는 그리지 않는다.
  const periods = isLocked ? [] : PERIODS;
  const activities = isLocked ? [] : ACTIVITIES;
  const errorIdFor = (field: ScheduleField) =>
    errors[field] ? errorIdOf(scheduleFieldId(field)) : undefined;

  return (
    <>
      {periods.length > 0 && (
        <SectionBox title="활동 기간">
          <div className={isReadOnly ? '' : 'space-y-2'}>
            {periods.map(([field, label]) => (
              <LabeledRow
                key={field}
                label={label}
                error={errors[field]}
                errorId={errorIdFor(field)}
              >
                {isReadOnly ? (
                  // 고칠 수 없는 반기는 '시작일 ~ 종료일'을 한 덩어리 글자로 보인다.
                  <span className={READONLY_VALUE}>
                    {form[field].startDate || '-'} ~ {form[field].endDate || '-'}
                  </span>
                ) : (
                  // 시작일·종료일을 한 묶음으로 붙여 둔다. 넓은 패널에서 두 칸이 양끝으로 벌어지지 않게 칸 너비를 고정한다.
                  <div
                    id={scheduleFieldId(field)}
                    className="grid grid-cols-[10rem_auto_10rem] items-center gap-2"
                    onBlur={blurOutside(onBlurField && (() => onBlurField(field)))}
                  >
                    <DateField
                      value={form[field].startDate}
                      onChange={(startDate) =>
                        onChange({ ...form, [field]: { ...form[field], startDate } })
                      }
                      ariaLabel={`${label} 시작일`}
                      isReadOnly={isReadOnly}
                      max={form[field].endDate || undefined}
                      errorId={errorIdFor(field)}
                    />
                    <span aria-hidden="true" className="text-sm text-slate-500">
                      ~
                    </span>
                    <DateField
                      value={form[field].endDate}
                      onChange={(endDate) =>
                        onChange({ ...form, [field]: { ...form[field], endDate } })
                      }
                      ariaLabel={`${label} 종료일`}
                      isReadOnly={isReadOnly}
                      min={form[field].startDate || undefined}
                      errorId={errorIdFor(field)}
                    />
                  </div>
                )}
              </LabeledRow>
            ))}
          </div>
        </SectionBox>
      )}

      {activities.length > 0 && (
        <SectionBox title="시작일">
          <div className={isReadOnly ? '' : 'space-y-2'}>
            {activities.map(({ value, label }) => (
              <LabeledRow
                key={value}
                label={label}
                error={errors[value]}
                errorId={errorIdFor(value)}
              >
                <div
                  id={scheduleFieldId(value)}
                  className="w-40 shrink-0"
                  onBlur={blurOutside(onBlurField && (() => onBlurField(value)))}
                >
                  <DateField
                    value={form.starts[value]}
                    onChange={(start) =>
                      onChange({ ...form, starts: { ...form.starts, [value]: start } })
                    }
                    ariaLabel={`${label} 1주차 시작일`}
                    isReadOnly={isReadOnly}
                    // 1주차 시작일은 반기 기간(방학 시작 ~ 학기 종료) 안이어야 한다(서버도 400).
                    min={form.vacation.startDate || undefined}
                    max={form.term.endDate || undefined}
                    errorId={errorIdFor(value)}
                  />
                </div>
                {form.starts[value] && !isReadOnly && (
                  <button
                    type="button"
                    className={`${FIELD_TEXT_BTN} shrink-0`}
                    aria-label={`${label} 시작일 선택 취소`}
                    onClick={() => onChange(withoutActivitySchedule(form, value))}
                  >
                    선택 취소
                  </button>
                )}
              </LabeledRow>
            ))}
          </div>
        </SectionBox>
      )}

      {/* 시작일을 정한 활동만 주차·날짜 칸이 나온다. 칸을 누르면 휴동·수업이 바뀐다. */}
      {!isLocked && scheduledActivities.length > 0 && (
        <SectionBox title="휴동 기간 지정">
          <div className="space-y-4">
            {scheduledActivities.map(({ value, label }) => (
              <LabeledRow key={value} label={label}>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {WEEK_NUMBERS.map((week) => {
                    const date = datesOf[value][week];
                    if (!date) return null;
                    const key = invalidKey(value, week);
                    const isInvalid = key in form.invalid;
                    const name = `${label} ${week}주차 ${monthDayOf(date)}`;
                    return (
                      <button
                        key={week}
                        type="button"
                        aria-pressed={isInvalid}
                        aria-label={`${name} ${isInvalid ? '휴동' : '활동'}`}
                        title={`${date} ${isInvalid ? '휴동' : '활동'}`}
                        disabled={isReadOnly}
                        onClick={() => onChange(withInvalidWeek(form, key, !isInvalid))}
                        className={`flex w-14 shrink-0 flex-col items-center rounded-sm border border-slate-200 py-1 text-xs disabled:cursor-default ${
                          isInvalid ? 'bg-slate-100' : 'bg-white hover:border-slate-400'
                        }`}
                      >
                        <span className={isInvalid ? 'text-slate-400' : 'text-slate-500'}>
                          {week}주차
                        </span>
                        <span
                          className={`tabular-nums ${isInvalid ? 'text-slate-400 line-through' : 'text-slate-900'}`}
                        >
                          {monthDayOf(date)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </LabeledRow>
            ))}
          </div>
        </SectionBox>
      )}
      {/* 시작일을 정한 활동의 주차 날짜를 달력으로 보인다(날짜는 화면에서 계산). 고칠 수 없는 반기는 요약 표 옆에 있다. */}
      {!isLocked && scheduledActivities.length > 0 && (
        <SectionBox title="달력">
          <SemesterCalendar form={form} />
        </SectionBox>
      )}
    </>
  );
}
