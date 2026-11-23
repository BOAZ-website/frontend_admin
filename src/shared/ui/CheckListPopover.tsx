import { type ReactNode, useId } from 'react';
import * as Popover from '@radix-ui/react-popover';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

export interface CheckListOption {
  value: string;
  /** 줄에 보일 내용. 화면 낭독기에만 읽힐 설명은 sr-only로 함께 넣는다. */
  label: ReactNode;
  isDisabled?: boolean;
}

interface CheckListPopoverProps {
  /** 목록의 접근성 이름. 예: '방학 휴강 주차'. */
  label: string;
  options: readonly CheckListOption[];
  /** 고른 값들. */
  value: readonly string[];
  /** 고른 값 전체를 새로 넘긴다. */
  onValueChange: (values: string[]) => void;
  /** 목록을 여는 버튼 하나(button 요소). 열려 있으면 data-state="open"이 붙는다. */
  trigger: ReactNode;
  /** 버튼 기준 목록 가로 위치. */
  align?: 'start' | 'center' | 'end';
  /** 목록 너비를 최소한 버튼 너비만큼 둔다(입력칸 모양 버튼). 아니면 내용 너비다. */
  isTriggerWidth?: boolean;
}

/**
 * 여러 개를 고르는 펼침 목록(체크박스 그룹). 줄마다 체크박스와 이름표가 있고, 줄 어디를 눌러도 체크된다.
 * 열고 닫기·바깥 클릭·Escape·포커스는 Radix Popover가, 체크 상태와 키보드(Space)는 Radix Checkbox가 맡는다.
 * 목록은 화면 맨 위층(Portal)에 띄워 표처럼 내용을 자르는 상자 안에서도 잘리지 않는다.
 */
export function CheckListPopover({
  label,
  options,
  value,
  onValueChange,
  trigger,
  align = 'start',
  isTriggerWidth = false,
}: CheckListPopoverProps) {
  const idPrefix = useId();
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={6}
          className={`z-50 max-h-64 w-max overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.28)] ${
            isTriggerWidth ? 'min-w-[var(--radix-popover-trigger-width)]' : ''
          }`}
        >
          <div role="group" aria-label={label} className="flex flex-col">
            {options.map((option) => {
              const isChecked = value.includes(option.value);
              const id = `${idPrefix}-${option.value}`;
              return (
                <label
                  key={option.value}
                  htmlFor={id}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-xs whitespace-nowrap tabular-nums transition-colors ${
                    option.isDisabled
                      ? 'cursor-not-allowed text-slate-300'
                      : 'cursor-pointer text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {/* 모서리 4px: 이 프로젝트의 rounded-sm(8px)은 16px 상자를 원처럼 보이게 해서 값을 직접 준다. */}
                  <Checkbox.Root
                    id={id}
                    checked={isChecked}
                    disabled={option.isDisabled}
                    onCheckedChange={(checked) =>
                      onValueChange(
                        checked === true
                          ? [...value, option.value]
                          : value.filter((v) => v !== option.value),
                      )
                    }
                    className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-slate-300 bg-white outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:border-slate-200 data-[state=checked]:border-slate-900 data-[state=checked]:bg-slate-900 data-[state=checked]:text-white"
                  >
                    <Checkbox.Indicator>
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <span className={isChecked ? 'font-semibold text-slate-900' : ''}>
                    {option.label}
                  </span>
                </label>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
