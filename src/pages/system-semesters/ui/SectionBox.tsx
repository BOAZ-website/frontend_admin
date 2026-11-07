import type { ReactNode } from 'react';

interface SectionBoxProps {
  title: string;
  children: ReactNode;
}

/**
 * 반기 관리 패널의 구역. 패널 안에 카드를 겹치지 않고 위쪽 구분선으로 나눈다.
 * 패널의 첫 구역은 패널 제목 아래 선과 겹치지 않게 선을 뺀다.
 */
export function SectionBox({ title, children }: SectionBoxProps) {
  return (
    <section className="border-t border-slate-200 pt-6 first:border-t-0 first:pt-0">
      <h4 className="mb-4 text-base font-semibold text-slate-900">{title}</h4>
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

/** 고칠 수 없는 값(진행 중·종료 반기). 입력칸과 같은 높이의 글자로만 보여 준다. */
export const READONLY_VALUE = 'flex h-10 items-center text-sm tabular-nums text-slate-900';

/** 라벨 열(96px) + 값 한 줄. 오류가 있으면 값 칸 아래(라벨 열 + 간격만큼 들여서)에 붙인다. */
export function LabeledRow({ label, children, error, errorId }: LabeledRowProps) {
  return (
    <div>
      <div className="flex min-h-10 items-center gap-4">
        <span className="w-24 shrink-0 text-sm font-medium text-slate-600">{label}</span>
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
