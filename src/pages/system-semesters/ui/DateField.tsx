import { DateTextInput } from '@/shared/ui/DateTextInput';
import { FIELD_READONLY } from '@/shared/ui/systemStyles';

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  /** 종료 반기이거나 저장하는 중이면 값만 보여 준다. */
  isReadOnly: boolean;
}

/** 수정할 수 있으면 날짜 입력, 지난 반기면 값만 보여 준다. */
export function DateField({ value, onChange, ariaLabel, isReadOnly }: DateFieldProps) {
  if (isReadOnly) {
    return (
      <span className={`${FIELD_READONLY} w-full tabular-nums`} aria-label={ariaLabel}>
        {value || '-'}
      </span>
    );
  }
  return <DateTextInput value={value} onChange={onChange} ariaLabel={ariaLabel} />;
}
