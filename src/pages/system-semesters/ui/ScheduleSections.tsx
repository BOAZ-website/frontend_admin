import {
  ACTIVITIES,
  voidWeekOptionsOf,
  errorIdOf,
  type ScheduleField,
  type ScheduleFieldErrors,
  scheduleFieldId,
  type ScheduleForm,
  withVoidWeek,
} from '../model/scheduleForm';
import { DateField } from './DateField';
import { LabeledRow, READONLY_VALUE, SectionBox } from './SectionBox';
import { SemesterCalendar } from './SemesterCalendar';
import { VoidWeekPicker } from './VoidWeekPicker';

interface ScheduleSectionsProps {
  form: ScheduleForm;
  onChange: (form: ScheduleForm) => void;
  /** 고칠 수 없는 반기이거나 저장하는 중이면 값만 보여 준다. */
  isReadOnly: boolean;
  /** 기간·시작일을 고칠 수 없는 반기(진행 중·종료)다. 기간·시작일은 위쪽 요약 표에 보이므로 그리지 않는다. */
  isLocked?: boolean;
  /**
   * 휴강 주차를 넣거나 뺄 때 부른다. 이미 있는 반기는 공통 주차 휴강 API로 바로 저장한다(ATT-09).
   * 없으면(새 반기 입력) 입력 상태의 휴강 목록만 바꾼다.
   */
  onChangeVoidWeek?: (weekNo: number, isVoid: boolean) => void;
  /** 휴강을 고칠 수 없다(종료 반기·요청 중). */
  isVoidReadOnly?: boolean;
  /** 고를 수 있는 휴강 수(새 반기 2개). */
  voidWeekLimit?: number;
  /** 칸 아래에 보일 입력 오류(보일 것만 넘긴다). */
  errors?: ScheduleFieldErrors;
  /** 칸(기간 한 줄 또는 시작일 칸)에서 포커스가 나가면 부른다. */
  onBlurField?: (field: ScheduleField) => void;
  /** false면 휴강 주차를 그리지 않는다(진행·종료 반기는 달력 옆에 따로 둔다). */
  showVoidWeeks?: boolean;
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

/** 기간, 활동별 1주차 시작일, 달력, 휴강 주차(공통 주차 드롭다운). */
export function ScheduleSections({
  form,
  onChange,
  isReadOnly,
  isLocked = false,
  onChangeVoidWeek,
  isVoidReadOnly = isReadOnly,
  voidWeekLimit,
  errors = {},
  onBlurField,
  showVoidWeeks = true,
}: ScheduleSectionsProps) {
  const scheduledActivities = ACTIVITIES.filter(({ value }) => form.starts[value]);
  // 고칠 수 없는 반기는 활동 기간·시작일을 위쪽 요약 표에 보이므로 여기서는 그리지 않는다.
  const periods = isLocked ? [] : PERIODS;
  const activities = isLocked ? [] : ACTIVITIES;
  const errorIdFor = (field: ScheduleField) =>
    errors[field] ? errorIdOf(scheduleFieldId(field)) : undefined;

  // 시작일을 정한 활동의 주차 날짜를 달력으로 보인다(날짜는 화면에서 계산). 고칠 수 없는 반기는 요약 표 옆에 있다.
  const hasCalendar = !isLocked && scheduledActivities.length > 0;

  return (
    <>
      {/* 넓은 화면에서는 활동 기간·시작일 오른쪽에 달력을 둔다(진행 중·종료 반기의 요약 표 + 달력과 같은 배치). */}
      {/* 화면 폭이 아니라 이 영역 폭으로 나눈다: 사이드바·반기 목록 때문에 화면이 넓어도 영역은 좁을 수 있다. */}
      <div className="@container">
        <div className="grid items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 space-y-6">
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
                          // 1주차 시작일은 반기 기간(방학 시작 ~ 학기 종료) 안이어야 한다. 스터디는 그 기간 안(서버도 400).
                          min={form.vacation.startDate || undefined}
                          max={form.term.endDate || undefined}
                          errorId={errorIdFor(value)}
                        />
                      </div>
                    </LabeledRow>
                  ))}
                </div>
              </SectionBox>
            )}
          </div>
          {hasCalendar && (
            <SectionBox title="달력">
              <SemesterCalendar form={form} />
            </SectionBox>
          )}
        </div>
      </div>

      {/* 휴강은 공통 주차(방학·학기 기간의 월~일 주) 단위이고 모든 활동에 적용된다(백엔드 ATT-09). */}
      {showVoidWeeks && voidWeekOptionsOf(form).length > 0 && (
        <SectionBox title="휴강 주차">
          <VoidWeekPicker
            weeks={voidWeekOptionsOf(form)}
            limit={voidWeekLimit}
            isReadOnly={isVoidReadOnly}
            onChange={
              onChangeVoidWeek ?? ((weekNo, isVoid) => onChange(withVoidWeek(form, weekNo, isVoid)))
            }
          />
        </SectionBox>
      )}
    </>
  );
}
