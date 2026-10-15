import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronRight, GripVertical, Info, X } from 'lucide-react';

import { isInBaseOf } from '@/entities/admin-account/model/catalog';
import type {
  BaseSetColumn,
  BaseSetKey,
  PermissionDef,
} from '@/entities/admin-account/model/permissions';
import type { PermissionCatalog } from '@/entities/admin-account/model/types';
import { TABLE_BOX } from '@/pages/system-accounts/ui/systemStyles';
import { Tooltip } from '@/shared/ui/Tooltip';

export type AccessKind = 'allowed' | 'denied' | 'ownGroup';

const TAG_STYLE = {
  manage: { text: '관리', className: 'bg-slate-100 text-slate-700' },
  read: { text: '조회', className: 'bg-white text-slate-500 ring-1 ring-inset ring-slate-200' },
  auto: {
    text: '자동',
    className: 'bg-white text-slate-400 ring-1 ring-inset ring-slate-200',
  },
} as const;

/**
 * 권한을 가졌는지 글자 태그로 보여준다. 쓰기 권한은 '관리', 조회 권한은 '조회',
 * 맡은 그룹에서 자동으로 붙는 권한은 '자동'이고, 없으면 아무것도 보이지 않는다.
 */
export function AccessTag({ permission, kind }: { permission: PermissionDef; kind: AccessKind }) {
  if (kind === 'denied') return <span className="sr-only">없음</span>;
  const style =
    kind === 'ownGroup'
      ? TAG_STYLE.auto
      : permission.key.endsWith('_READ')
        ? TAG_STYLE.read
        : TAG_STYLE.manage;
  return (
    <span
      className={`inline-block rounded-sm px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${style.className}`}
    >
      {style.text}
    </span>
  );
}

/** 설명이 필요한 곳에만 두는 ⓘ 말풍선. 화면에는 아이콘만 보인다. */
export function InfoTip({ label, align = 'center' }: { label: string; align?: 'center' | 'end' }) {
  return (
    <Tooltip label={label} align={align}>
      <span
        tabIndex={0}
        aria-label={label}
        className="inline-flex cursor-help text-slate-300 outline-none hover:text-slate-600 focus-visible:text-slate-600"
      >
        <Info size={12} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

/** 권한 이름. 이름만으로 알 수 없는 조건은 ⓘ 말풍선으로 둔다. */
export function PermissionLabel({ permission }: { permission: PermissionDef }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
      {permission.label}
      {permission.note && <InfoTip label={permission.note} />}
    </span>
  );
}

const accessKindOf = (
  catalog: PermissionCatalog,
  permission: PermissionDef,
  key: BaseSetKey,
): AccessKind => {
  if (permission.ownGroup) return key === 'groupLeader' ? 'ownGroup' : 'denied';
  return isInBaseOf(catalog, permission, key) ? 'allowed' : 'denied';
};

/** 출결 화면(그룹 계정 관리)의 왼쪽 목록과 같은 버튼 모양. */
const roleTabClass = (isActive: boolean) =>
  `w-full flex items-center justify-between px-3.5 py-3 rounded-sm border text-left transition-all cursor-pointer ${
    isActive
      ? 'border-slate-300 bg-slate-100/80 shadow-2xs text-slate-950 font-bold'
      : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 text-slate-700 font-semibold'
  }`;

const DEFAULT_SPLIT_RATIO = 23;
const MIN_SPLIT_RATIO = 15;
const MAX_SPLIT_RATIO = 65;

const OWN_GROUP_NOTE = '맡은 팀·스터디가 계정에 연결되면 그곳에 한해 자동으로 생기는 권한';

/** 담당 그룹 권한은 따로 배지를 달지 않고, 생기는 조건을 ⓘ 말풍선 설명에 합친다. */
const withOwnGroupNote = (permission: PermissionDef): PermissionDef =>
  permission.ownGroup
    ? {
        ...permission,
        note: permission.note ? `${OWN_GROUP_NOTE} · ${permission.note}` : OWN_GROUP_NOTE,
      }
    : permission;

/**
 * 고른 운영진의 권한을 영역별 표로 보여 주는 오른쪽 상자.
 * 어느 자리든 같은 권한 목록을 보여 주고, 가진 권한은 ✓, 없는 권한은 흐리게 표시한다.
 * 출결 화면의 오른쪽 상자처럼 따로 스크롤되고, ✕로 닫는다.
 */
function RolePermissionPanel({
  catalog,
  column,
  onClose,
}: {
  catalog: PermissionCatalog;
  column: BaseSetColumn;
  onClose: () => void;
}) {
  const areas = catalog.groups.map((group) => {
    const rows = group.permissions.map((permission) => ({
      permission,
      kind: accessKindOf(catalog, permission, column.key),
    }));
    return { title: group.title, rows, hasAny: rows.some(({ kind }) => kind !== 'denied') };
  });

  return (
    <section
      className="w-full min-w-0 flex-1 space-y-5 lg:min-w-[340px] rounded-md border border-slate-200/90 bg-white p-6 shadow-2xs animate-in slide-in-from-right duration-150 lg:h-full lg:overflow-y-auto lg:[scrollbar-gutter:stable]"
      aria-labelledby="role-title"
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <h2 id="role-title" className="min-w-0 text-base font-bold text-slate-900">
          {column.label} 기본 권한
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="권한 상자 닫기"
          className="shrink-0 cursor-pointer rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={TABLE_BOX}>
        <table className="w-full border-collapse text-xs">
          <thead className="bg-slate-50/80 select-none">
            <tr className="h-11 divide-x divide-slate-200 border-b border-slate-200 text-[11px] whitespace-nowrap">
              <th className="w-[120px] bg-slate-100/90 px-4 py-2 text-center font-bold text-slate-900">
                영역
              </th>
              <th className="bg-slate-100/90 px-4 py-2 text-center font-bold text-slate-700">
                권한
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {areas.flatMap(({ title, rows, hasAny }) =>
              rows.map(({ permission, kind }, index) => {
                const isHeld = kind !== 'denied';
                return (
                  <tr
                    key={permission.key}
                    className={`h-[46px] divide-x divide-slate-200 transition-colors ${
                      isHeld ? 'hover:bg-slate-50/70' : 'bg-slate-50/60'
                    }`}
                  >
                    {index === 0 && (
                      <th
                        scope="rowgroup"
                        rowSpan={rows.length}
                        className={`bg-white px-4 py-2 text-center align-middle text-xs font-bold whitespace-nowrap ${
                          hasAny ? 'text-slate-900' : 'text-slate-300'
                        }`}
                      >
                        {title}
                      </th>
                    )}
                    <td className="px-4 py-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-2 ${isHeld ? '' : 'opacity-35'}`}
                      >
                        <Check
                          size={13}
                          strokeWidth={2.5}
                          className={isHeld ? 'text-slate-700' : 'invisible'}
                          aria-hidden="true"
                        />
                        <PermissionLabel permission={withOwnGroupNote(permission)} />
                        {!isHeld && <span className="sr-only">(권한 없음)</span>}
                      </span>
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * 기본 권한(읽기 전용). 출결 화면처럼 왼쪽 운영진 목록에서 운영진(대표진, 운영지원팀 등)을 누르면
 * 오른쪽에 그 운영진의 권한 상자가 열린다. 처음 들어오면 서운팀장(MASTER) 상자가 열려 있다. 넓은 화면에서는 왼쪽 목록과 오른쪽 상자가 따로 스크롤되고, 비율은 출결 화면과 같다.
 */
export function PermissionMatrixTable({ catalog }: { catalog: PermissionCatalog }) {
  const [selectedKey, setSelectedKey] = useState<BaseSetKey | null>('master');
  const selected = catalog.baseSets.find((column) => column.key === selectedKey);
  // 출결 화면과 같은 분할 비율: 왼쪽 23%, 오른쪽 77%. 가운데 막대를 끌어 15~65% 사이로 바꾼다.
  const [splitRatio, setSplitRatio] = useState(DEFAULT_SPLIT_RATIO);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    function handlePointerMove(e: MouseEvent | TouchEvent) {
      if (!containerRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const rect = containerRef.current.getBoundingClientRect();
      const rawRatio = ((clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(Math.max(rawRatio, MIN_SPLIT_RATIO), MAX_SPLIT_RATIO));
    }

    function handlePointerUp() {
      setIsDragging(false);
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      style={{ '--split': `${splitRatio}%` } as CSSProperties}
      className="flex flex-col items-start gap-5 lg:h-[calc(100vh-15rem)] lg:min-h-[420px] lg:flex-row lg:gap-0"
    >
      <nav
        className="w-full shrink-0 space-y-2 lg:h-full lg:w-(--split) lg:min-w-[200px] lg:overflow-y-auto lg:pr-1.5 lg:[scrollbar-gutter:stable]"
        aria-label="운영진 목록"
      >
        <div className="px-1 pb-1">
          <span className="text-[11px] font-bold tracking-wider text-slate-400">운영진 목록</span>
        </div>
        {catalog.baseSets.map((column) => (
          <button
            key={column.key}
            type="button"
            aria-current={column.key === selectedKey}
            onClick={() => setSelectedKey(column.key)}
            className={roleTabClass(column.key === selectedKey)}
          >
            <span className="text-xs font-bold">{column.label}</span>
            <ChevronRight
              size={15}
              className={column.key === selectedKey ? 'text-slate-500' : 'text-slate-400'}
              aria-hidden="true"
            />
          </button>
        ))}
      </nav>

      {selected && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="목록과 권한 상자 너비 조절"
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          className={`group z-20 -mx-0.5 hidden w-4 shrink-0 cursor-col-resize items-center justify-center self-stretch py-12 transition-colors select-none lg:flex ${
            isDragging ? 'bg-slate-200/50' : 'hover:bg-slate-100/80'
          }`}
          title="마우스로 드래그하여 패널 너비 조절"
        >
          <div
            className={`flex w-1 flex-col items-center justify-center rounded-full transition-all ${
              isDragging
                ? 'h-20 bg-slate-700'
                : 'h-14 bg-slate-300 group-hover:h-16 group-hover:bg-slate-500'
            }`}
          >
            <GripVertical
              size={10}
              className="text-white opacity-0 transition-opacity group-hover:opacity-100"
            />
          </div>
        </div>
      )}
      {selected && (
        <RolePermissionPanel
          key={selected.key}
          catalog={catalog}
          column={selected}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </div>
  );
}
