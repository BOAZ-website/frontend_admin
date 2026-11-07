import { DatePickerField } from '@/shared/ui/DatePickerField';

import { READONLY_VALUE } from './SectionBox';

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  /** 진행 중·종료 반기이거나 저장하는 중이면 값만 보여 준다. */
  isReadOnly: boolean;
  /** 달력에서 고를 수 있는 범위('YYYY-MM-DD'). */
  min?: string;
  max?: string;
  /** 입력 오류 문장의 id. 있으면 칸을 오류로 표시하고 오류 문장과 잇는다. */
  errorId?: string;
}

/** 수정할 수 있으면 날짜 입력, 고칠 수 없는 반기면 값만 보여 준다. */
export function DateField({
  value,
  onChange,
  ariaLabel,
  isReadOnly,
  min,
  max,
  errorId,
}: DateFieldProps) {
  if (isReadOnly) {
    return (
      <span className={`${READONLY_VALUE} w-full`} aria-label={ariaLabel}>
        {value || '-'}
      </span>
    );
  }
  return (
    <DatePickerField
      value={value}
      onChange={onChange}
      ariaLabel={ariaLabel}
      min={min}
      max={max}
      errorId={errorId}
    />
  );
}
