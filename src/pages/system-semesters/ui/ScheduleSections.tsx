import { ACTIVITY_WEEK_COUNT } from '@/entities/cohort/model/schedule';
import { TABLE_BOX, TD_CLASS, TH_CLASS } from '@/shared/ui/systemStyles';

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
} from '../model/scheduleForm';
import { DateField } from './DateField';
import { GRID_HEAD_ROW, GRID_ROW, LabeledRow, SectionBox } from './SectionBox';

const WEEK_NUMBERS = Array.from({ length: ACTIVITY_WEEK_COUNT }, (_, index) => index + 1);

interface ScheduleSectionsProps {
  form: ScheduleForm;
  onChange: (form: ScheduleForm) => void;
  /** 종료 반기이거나 저장하는 중이면 값만 보여 준다. */
  isReadOnly: boolean;
  /** 칸 아래에 보일 입력 오류(보일 것만 넘긴다). */
  errors?: ScheduleFieldErrors;
  /** 칸(기간 한 줄 또는 시작일 칸)에서 포커스가 나가면 부른다. */
  onBlurField?: (field: ScheduleField) => void;
}

/** 칸 묶음에서 포커스가 바깥으로 나갈 때만 부른다(달력 버튼 등 안쪽 이동은 무시). */
const blurOutside =
  (handler: (() => void) | undefined) =>
  (event: React.FocusEvent<HTMLDivElement>): void => {
    if (!event.currentTarget.contains(event.relatedTarget)) handler?.();
  };

/** 기간, 활동별 1주차 시작일, 계산된 주차 날짜와 휴강 체크. */
export function ScheduleSections({
  form,
  onChange,
  isReadOnly,
  errors = {},
  onBlurField,
}: ScheduleSectionsProps) {
  const datesOf = weekDatesByActivity(form);
  const errorIdFor = (field: ScheduleField) =>
    errors[field] ? errorIdOf(scheduleFieldId(field)) : undefined;

  return (
    <>
      <SectionBox title="기간">
        <div className="space-y-4">
          {(
            [
              ['vacation', '방학'],
              ['term', '학기'],
            ] as const
          ).map(([field, label]) => (
            <LabeledRow key={field} label={label} error={errors[field]} errorId={errorIdFor(field)}>
              <div
                id={scheduleFieldId(field)}
                className="flex min-w-0 flex-1 items-center gap-2"
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
                <span aria-hidden="true" className="text-xs text-slate-500">
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
            </LabeledRow>
          ))}
        </div>
      </SectionBox>

      <SectionBox title="1주차 시작일">
        <div className="space-y-4">
          {ACTIVITIES.map(({ value, label }) => (
            <LabeledRow key={value} label={label} error={errors[value]} errorId={errorIdFor(value)}>
              <div
                id={scheduleFieldId(value)}
                className="min-w-0 flex-1"
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
            </LabeledRow>
          ))}
        </div>
        <p className="mt-4 mb-2 text-xs text-slate-500">
          시작일에서 7일씩 더한 주차 날짜입니다. 휴강으로 체크한 주차는 출결에서 제외됩니다.
        </p>
        <div className={`${TABLE_BOX} overflow-x-auto`}>
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">활동별 주차 날짜와 휴강</caption>
            <thead>
              <tr className={GRID_HEAD_ROW}>
                <th scope="col" className={`${TH_CLASS} w-16`}>
                  주차
                </th>
                {ACTIVITIES.map(({ value, label }) => (
                  <th key={value} scope="col" className={TH_CLASS}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {WEEK_NUMBERS.map((week) => (
                <tr key={week} className={GRID_ROW}>
                  <th scope="row" className={`${TD_CLASS} font-semibold text-slate-700`}>
                    {week}주차
                  </th>
                  {ACTIVITIES.map(({ value, label }) => {
                    const key = invalidKey(value, week);
                    const isInvalid = key in form.invalid;
                    const date = datesOf[value][week];
                    return (
                      <td key={value} className={`${TD_CLASS} ${isInvalid ? 'bg-slate-50' : ''}`}>
                        {date ? (
                          <label className="inline-flex items-center justify-center gap-2 text-xs font-normal">
                            <span
                              className={`tabular-nums ${
                                isInvalid ? 'text-slate-500 line-through' : 'text-slate-800'
                              }`}
                            >
                              {date}
                            </span>
                            {isInvalid && <span className="font-semibold text-red-600">휴강</span>}
                            <input
                              type="checkbox"
                              checked={isInvalid}
                              disabled={isReadOnly}
                              onChange={(event) =>
                                onChange(withInvalidWeek(form, key, event.target.checked))
                              }
                              aria-label={`${label} ${week}주차 휴강`}
                              className="size-4 cursor-pointer accent-slate-700 disabled:cursor-default"
                            />
                          </label>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionBox>
    </>
  );
}
