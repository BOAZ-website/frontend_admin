import { useState, type ReactNode } from 'react';
import { ChevronRight, ChevronsRight, GripVertical, Maximize2, Minimize2 } from 'lucide-react';

import { useSplitRatio } from '@/pages/system-accounts/model/useSplitRatio';

interface SplitViewProps {
  /** 왼쪽 목록의 화면 읽기 프로그램용 이름. */
  listLabel: string;
  /** 스크롤되는 목록. */
  list: ReactNode;
  /** 오른쪽 상세 패널을 열었는지. */
  isOpen: boolean;
  panelTitle: string;
  /** 패널 닫기. 저장하지 않은 변경 확인 같은 판단은 부르는 쪽이 한다. */
  onClose: () => void;
  /** 오른쪽 상세 패널 내용. */
  children: ReactNode;
}

/**
 * 시스템·계정 화면의 분할 화면. 출결(BASE·ADV·스터디)의 분할 화면과 같다:
 * 왼쪽 목록에서 고르면 오른쪽에 상세 패널이 열리고, 가운데 막대로 너비를 바꾸고,
 * 패널을 전체 화면으로 키우거나 닫을 수 있다. 목록과 패널은 따로 스크롤된다.
 */
export function SplitView({
  listLabel,
  list,
  isOpen,
  panelTitle,
  onClose,
  children,
}: SplitViewProps) {
  const { containerRef, splitRatio, isDragging, startDragging } = useSplitRatio();
  const [isFullScreen, setIsFullScreen] = useState(false);
  // 패널이 닫히면 전체 화면도 푼다. 다시 열 때는 분할 화면으로 시작한다.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setIsFullScreen(false);
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-[calc(100vh-11rem)] min-h-[420px] w-full ${
        isOpen && !isFullScreen ? 'flex min-w-0 flex-row gap-0' : 'block'
      }`}
    >
      {/* 왼쪽: 목록 */}
      {(!isOpen || !isFullScreen) && (
        <aside
          style={{
            width: isOpen ? `${splitRatio}%` : '100%',
            minWidth: isOpen ? '200px' : undefined,
          }}
          className={`flex h-full shrink-0 flex-col gap-2.5 ${isOpen ? 'pr-1.5' : ''}`}
          aria-label={listLabel}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        </aside>
      )}

      {/* 가운데: 너비 조절 막대 */}
      {isOpen && !isFullScreen && (
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(event) => {
            event.preventDefault();
            startDragging();
          }}
          onTouchStart={(event) => {
            event.preventDefault();
            startDragging();
          }}
          className={`group z-20 -mx-0.5 flex w-4 shrink-0 cursor-col-resize select-none items-center justify-center self-stretch py-12 transition-colors ${
            isDragging ? 'bg-slate-200/50' : 'hover:bg-slate-100/80'
          }`}
          title="마우스로 드래그하여 패널 너비 조절"
        >
          <div
            className={`flex h-14 w-1 flex-col items-center justify-center rounded-full transition-all ${
              isDragging
                ? 'h-20 bg-slate-700'
                : 'bg-slate-300 group-hover:h-16 group-hover:bg-slate-500'
            }`}
          >
            <GripVertical
              size={10}
              className="text-white opacity-0 transition-opacity group-hover:opacity-100"
            />
          </div>
        </div>
      )}

      {/* 오른쪽: 상세 패널 */}
      {isOpen && (
        <section
          style={{
            width: isFullScreen ? '100%' : `${100 - splitRatio}%`,
            minWidth: isFullScreen ? undefined : '340px',
          }}
          className="h-full min-w-0 flex-1 space-y-4 overflow-y-auto rounded-md border border-slate-200/90 bg-white p-6 shadow-sm animate-in slide-in-from-right duration-150 [scrollbar-gutter:stable] lg:p-7"
          aria-label={panelTitle}
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
            <h3 className="min-w-0 truncate text-xl font-black leading-snug tracking-tight text-slate-950 sm:text-2xl">
              {panelTitle}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="hidden cursor-pointer items-center rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 sm:flex"
                title={isFullScreen ? '분할 뷰로 축소' : '전체 화면으로 확장'}
                aria-label={isFullScreen ? '분할 뷰로 축소' : '전체 화면으로 확장'}
              >
                {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex cursor-pointer items-center rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                title="사이드 패널 닫기"
                aria-label="사이드 패널 닫기"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>

          {children}
        </section>
      )}
    </div>
  );
}

interface SplitListItemProps {
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}

/** 분할 화면 목록의 한 칸: 이름만 보여 준다. 출결 분할 화면의 팀 카드와 같은 모양이다. */
export function SplitListItem({ label, isSelected, onSelect }: SplitListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? 'true' : undefined}
      className={`group relative flex w-full shrink-0 cursor-pointer select-none items-center justify-between gap-3 rounded-md border p-4 text-left transition-all ${
        isSelected
          ? 'border-slate-300 bg-slate-100/80 shadow-2xs'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
      }`}
    >
      <span
        className={`min-w-0 flex-1 truncate text-sm font-bold ${
          isSelected ? 'text-slate-950' : 'text-slate-900 group-hover:text-slate-950'
        }`}
      >
        {label}
      </span>
      <ChevronRight
        size={16}
        aria-hidden="true"
        className={`shrink-0 transition-transform ${
          isSelected
            ? 'translate-x-0.5 text-slate-500'
            : 'text-slate-300 group-hover:text-slate-500'
        }`}
      />
    </button>
  );
}
