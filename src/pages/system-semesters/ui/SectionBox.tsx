import type { ReactNode } from 'react';

interface SectionBoxProps {
  title: string;
  children: ReactNode;
}

/** 반기 관리 패널의 구역 카드. */
export function SectionBox({ title, children }: SectionBoxProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h4 className="mb-4 text-xs font-bold text-slate-900">{title}</h4>
      {children}
    </section>
  );
}

interface LabeledRowProps {
  label: string;
  children: ReactNode;
}

/** 라벨 열(96px) + 값 한 줄. */
export function LabeledRow({ label, children }: LabeledRowProps) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-24 shrink-0 text-xs font-semibold text-slate-500">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2">{children}</div>
    </div>
  );
}

/** 표 머리 줄. 출결 표처럼 칸마다 세로 줄을 긋는다. */
export const GRID_HEAD_ROW = 'h-10 divide-x divide-slate-200 border-b border-slate-200 text-xs';
/** 표 본문 줄. 출결 표와 같은 높이·세로 줄이다. */
export const GRID_ROW = 'h-10 divide-x divide-slate-200 transition-colors hover:bg-slate-50/70';
