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
 * 지원자 상세의 탭 토글(개인 평가·운영진 평가 현황). BASE 출결 관리의 방학/학기 토글과 같은 모양이고,
 * 서류 평가 화면의 색 일괄 규칙을 덮어야 해서 색·여백은 review-design.css의 .evaluation-header-tabs에 둔다.
 * 고른 탭은 aria-pressed로 표시한다.
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
      className="evaluation-header-tabs flex items-center select-none"
    >
      {items.map(({ id, label: itemLabel, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={value === id}
          onClick={() => onChange(id)}
          className="flex cursor-pointer items-center gap-1.5 transition-all"
        >
          {Icon && <Icon size={13} />}
          <span>{itemLabel}</span>
        </button>
      ))}
    </div>
  );
}
