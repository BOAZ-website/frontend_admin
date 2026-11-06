import type { ReactNode } from 'react';

interface SectionBoxProps {
  title: string;
  children: ReactNode;
}

/** 반기 관리 패널의 구역 카드. */
export function SectionBox({ title, children }: SectionBoxProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h4 className="mb-4 text-sm font-bold text-slate-900">{title}</h4>
      {children}
    </section>
  );
}

interface LabeledRowProps {
  label: string;
  children: ReactNode;
  /** 값 칸 바로 아래에 보일 입력 오류. */
  error?: string;
  /** 오류 문장의 id. 입력칸의 aria-describedby가 가리킨다. */
  errorId?: string;
}

/** 라벨 열(96px) + 값 한 줄. 오류가 있으면 값 칸 아래(라벨 열 + 간격만큼 들여서)에 붙인다. */
export function LabeledRow({ label, children, error, errorId }: LabeledRowProps) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="w-24 shrink-0 text-xs font-semibold text-slate-500">{label}</span>
        <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
      </div>
      {error && (
        <p id={errorId} className="mt-1 pl-28 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** 표 머리 줄. 출결 표처럼 칸마다 세로 줄을 긋는다. */
export const GRID_HEAD_ROW = 'h-10 divide-x divide-slate-200 border-b border-slate-200 text-xs';
/** 표 본문 줄. 출결 표와 같은 높이·세로 줄이다. */
export const GRID_ROW = 'h-10 divide-x divide-slate-200 transition-colors hover:bg-slate-50/70';
