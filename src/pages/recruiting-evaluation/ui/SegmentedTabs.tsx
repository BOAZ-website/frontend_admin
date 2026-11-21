export interface SegmentedTabItem<T extends string> {
  id: T;
  label: string;
}

interface SegmentedTabsProps<T extends string> {
  items: readonly SegmentedTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** 탭 묶음의 이름. 화면 읽기 프로그램이 읽는다. */
  label: string;
}

/**
 * 지원자 상세의 탭(개인 평가·운영진 평가 현황). 콘텐츠 관리 아카이브의 밑줄 탭(ArchivingSection)과 같은 구조다.
 * 서류 평가 화면 CSS가 인라인 색을 덮어서, 색은 review-design.css의 .evaluation-underline-tabs에 둔다.
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
      className="evaluation-underline-tabs flex items-center gap-8 border-b border-slate-200 px-1"
    >
      {items.map(({ id, label: itemLabel }) => {
        const isActive = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(id)}
            className="relative cursor-pointer pb-3 text-sm font-semibold transition-colors"
          >
            {itemLabel}
            {isActive && (
              <div className="evaluation-underline-tabs-bar absolute bottom-0 left-0 right-0 h-0.5 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
