import type { LucideIcon } from 'lucide-react';

export interface SegmentedTabItem<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedTabsProps<T extends string> {
  items: readonly SegmentedTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** 탭 묶음의 이름. 화면 읽기 프로그램이 읽는다. */
  label: string;
}

/**
 * 서류 평가 화면의 탭 버튼 묶음. 상단 페이지 전환(전체 지원 현황·서류 평가·합격자 승격)과
 * 지원자 상세 탭(개인 평가·평가 현황·면접 질문)이 같은 모양을 쓴다. 고른 탭은 aria-pressed로 표시한다.
 */
export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="evaluation-header-tabs flex p-1 rounded-sm bg-slate-100 border border-slate-200"
    >
      {items.map(({ id, label: itemLabel, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className="px-3.5 py-1.5 rounded-sm text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
        >
          {Icon && <Icon size={13} />}
          <span>{itemLabel}</span>
        </button>
      ))}
    </div>
  );
}
