import { useState } from 'react';
import type { ReactNode } from 'react';

import { fetchMembers } from '@/entities/club-member/api/memberApi';
import type { MemberSummary } from '@/entities/club-member/model/types';

import { CLUB_MEMBER_STATUS_LABELS } from '@/entities/club-member/model/types';
import type { RosterEntryDto, RosterKind } from '@/entities/cohort/model/dto';
import { useLoaded } from '@/shared/lib/useLoaded';
import type { UserTrack } from '@/entities/user/model/types';
import {
  FIELD_INPUT,
  FIELD_TEXT_BTN,
  MODAL_CONFIRM_BTN,
  O_MARK,
  TABLE_BOX,
} from '@/shared/ui/systemStyles';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import {
  type DataTableCellContext,
  type DataTableColumn,
  DataTable,
} from '@/shared/ui/table/DataTable';

import { rosterCandidates, rosterEntryOf, withCheckedRange } from '../model/roster';
import { SectionBox } from './SectionBox';

const KIND_LABEL: Record<RosterKind, string> = { BASE: 'BASE', ADV: 'ADV', EXTRA: '수료 기수' };

/** 명단 표의 한 줄: 저장된 사람 또는 저장 전에 더한 사람. */
interface RosterRow {
  entry: RosterEntryDto;
  isAdded: boolean;
}

/** 병행 부문과 병행 수료 여부. 병행하지 않으면 '-'. */
const parallelText = ({ parallelTrack, isParallelCompleted }: RosterEntryDto) => {
  if (!parallelTrack) return '-';
  if (isParallelCompleted === null) return parallelTrack;
  return `${parallelTrack} · ${isParallelCompleted ? '수료' : '미수료'}`;
};

/** 비고 길이 한도(백엔드 ATT-19·21). */
const MAX_NOTE_LENGTH = 500;

/** 병행 부문 선택지. 비우면 병행하지 않는다. 회원 자신의 부문은 고를 수 없다. */
const NO_PARALLEL = 'none';
const TRACK_OPTIONS: readonly UserTrack[] = ['분석', '시각화', '엔지니어링'];

const joinedMark = (isJoined: boolean) =>
  isJoined ? <span className={O_MARK}>O</span> : <span className="text-slate-400">-</span>;

interface RosterSectionProps {
  /** 저장된 명단(새 반기 작성에서는 확인한 자동 명단). */
  saved: readonly RosterEntryDto[];
  /** 저장된 명단에서 뺄 사람(저장 전). */
  excludedIds: ReadonlySet<string>;
  /** 저장된 명단에 더할 사람(저장 전). */
  added: readonly RosterEntryDto[];
  /** 더할 사람의 구분을 정한다(BASE·ADV 기수가 아니면 수료 기수). */
  kindOf: (term: number) => RosterKind;
  /** 고칠 수 없는 반기(서비스운영팀장이 아닌 계정이 보는 종료 반기)면 값만 보인다. */
  isReadOnly: boolean;
  /** 명단을 저장하는 중. 그동안 예외 버튼을 막는다. */
  isSaving: boolean;
  onToggleExcluded?: (userId: string) => void;
  /** 고른 사람들을 명단에 더한다(저장 전). */
  onAdd?: (entries: RosterEntryDto[]) => void;
  onRemoveAdded?: (userId: string) => void;
  /** 고른(저장 전) 병행 부문. 주면 고치는 동안 병행 칸을 드롭다운으로 그린다. */
  parallelDrafts?: ReadonlyMap<string, UserTrack | null>;
  onChangeParallel?: (userId: string, track: UserTrack | null) => void;
  /** 더한(저장 전) 사람의 멘멘·친바 참여와 비고를 바꾼다. 저장할 때 등록 요청(ATT-19)에 함께 보낸다. */
  onChangeAdded?: (
    userId: string,
    patch: Partial<Pick<RosterEntryDto, 'menmenJoined' | 'chinbaJoined' | 'note'>>,
  ) => void;
  /** 명단만 따로 저장한다. 없으면 저장 버튼을 그리지 않는다(새 반기 작성은 반기를 만들 때 함께 보낸다). */
  onSave?: () => void;
  /** 「명단」 제목 오른쪽 버튼(진행 반기의 「수정」·「취소」). */
  action?: ReactNode;
}

/** 반기 출결·점수 명단: 기수·구분별 인원, 자동으로 만든 명단과 예외(빼기·더하기). */
export function RosterSection({
  saved,
  excludedIds,
  added,
  kindOf,
  isReadOnly,
  isSaving,
  onToggleExcluded,
  onAdd,
  onRemoveAdded,
  parallelDrafts,
  onChangeParallel,
  onChangeAdded,
  onSave,
  action,
}: RosterSectionProps) {
  const parallelCount = parallelDrafts?.size ?? 0;
  const isDirty = excludedIds.size > 0 || added.length > 0 || parallelCount > 0;
  // 병행은 저장된 BASE·ADV 줄에서만 고친다(수료 기수는 병행을 정할 수 없다, 백엔드 ATT-21).
  // 더한 사람은 저장 전까지 멘멘·친바 참여와 비고를 바로 고친다.
  const canEditAdded = (row: RosterRow) =>
    !isReadOnly && !isSaving && row.isAdded && onChangeAdded !== undefined;
  const joinedCell = (row: RosterRow, field: 'menmenJoined' | 'chinbaJoined', label: string) =>
    canEditAdded(row) ? (
      <input
        type="checkbox"
        checked={row.entry[field]}
        onChange={(event) => onChangeAdded?.(row.entry.userId, { [field]: event.target.checked })}
        aria-label={`${row.entry.name} ${label} 참여`}
        className="size-4 cursor-pointer accent-slate-700"
      />
    ) : (
      joinedMark(row.entry[field])
    );
  const canEditParallel = (row: RosterRow) =>
    !isReadOnly &&
    !isSaving &&
    onChangeParallel !== undefined &&
    !row.isAdded &&
    row.entry.kind !== 'EXTRA' &&
    !excludedIds.has(row.entry.userId);

  const rows: RosterRow[] = [
    ...saved.map((entry) => ({ entry, isAdded: false })),
    ...added.map((entry) => ({ entry, isAdded: true })),
  ];
  const isExcludedRow = ({ entry }: RosterRow) => excludedIds.has(entry.userId);
  // 열 정의(TanStack ColumnDef 관례). 예외 열은 고칠 수 있을 때만 붙인다.
  const columns: DataTableColumn<RosterRow>[] = [
    {
      id: 'index',
      header: '#',
      size: 40,
      cell: ({ index }) => index + 1,
      meta: { cellClassName: 'tabular-nums text-slate-500' },
    },
    {
      id: 'term',
      header: '기수',
      size: 48,
      accessorFn: ({ entry }) => entry.term,
      meta: { cellClassName: 'tabular-nums text-slate-700' },
    },
    {
      id: 'track',
      header: '부문',
      size: 80,
      accessorFn: ({ entry }) => entry.track,
      meta: { cellClassName: 'text-slate-700' },
    },
    {
      id: 'name',
      header: '이름',
      size: 96,
      accessorFn: ({ entry }) => entry.name,
      meta: {
        cellClassName: (row) =>
          `font-semibold ${isExcludedRow(row) ? 'text-slate-500 line-through' : 'text-slate-900'}`,
      },
    },
    {
      id: 'kind',
      header: '구분',
      size: 80,
      cell: ({ row }) =>
        isExcludedRow(row) ? (
          <span className="font-semibold text-red-600">제외</span>
        ) : row.isAdded ? (
          <span className="font-semibold text-emerald-700">추가</span>
        ) : (
          KIND_LABEL[row.entry.kind]
        ),
      meta: { cellClassName: 'text-slate-700' },
    },
    {
      id: 'status',
      header: '활동 상태',
      size: 80,
      accessorFn: ({ entry }) => CLUB_MEMBER_STATUS_LABELS[entry.memberStatus],
      meta: { cellClassName: 'text-slate-700' },
    },
    {
      id: 'parallel',
      header: '병행',
      size: 96,
      cell: ({ row }) => {
        if (!canEditParallel(row)) return parallelText(row.entry);
        const { userId, track, parallelTrack } = row.entry;
        const value = parallelDrafts?.has(userId) ? parallelDrafts.get(userId) : parallelTrack;
        return (
          <SelectDropdown
            ariaLabel={`${row.entry.name} 병행 부문`}
            value={value ?? NO_PARALLEL}
            options={[
              { value: NO_PARALLEL, label: '-' },
              ...TRACK_OPTIONS.filter((option) => option !== track).map((option) => ({
                value: option,
                label: option,
              })),
            ]}
            buttonClassName="h-[30px] w-full text-center"
            onChange={(next) =>
              onChangeParallel?.(userId, next === NO_PARALLEL ? null : (next as UserTrack))
            }
          />
        );
      },
      meta: { cellClassName: 'text-slate-700' },
    },
    {
      id: 'menmen',
      header: '멘멘',
      size: 48,
      cell: ({ row }) => joinedCell(row, 'menmenJoined', '멘멘'),
    },
    {
      id: 'chinba',
      header: '친바',
      size: 48,
      cell: ({ row }) => joinedCell(row, 'chinbaJoined', '친바'),
    },
    {
      id: 'groups',
      header: '참여 그룹',
      accessorFn: ({ entry }) => entry.groups.map((group) => group.name).join(', '),
      meta: { align: 'left', isWrapped: true, cellClassName: 'text-slate-700' },
    },
    {
      id: 'note',
      header: '비고',
      size: 112,
      cell: ({ row }) =>
        canEditAdded(row) ? (
          <input
            value={row.entry.note ?? ''}
            onChange={(event) =>
              onChangeAdded?.(row.entry.userId, { note: event.target.value || null })
            }
            aria-label={`${row.entry.name} 비고`}
            maxLength={MAX_NOTE_LENGTH}
            className={`${FIELD_INPUT} h-[30px] w-full text-xs`}
          />
        ) : (
          (row.entry.note ?? <span className="block text-center">-</span>)
        ),
      meta: { align: 'left', isWrapped: true, cellClassName: 'text-slate-500' },
    },
    ...(isReadOnly
      ? []
      : [
          {
            id: 'action',
            header: '예외',
            size: 80,
            cell: ({ row }: DataTableCellContext<RosterRow>) => {
              const action = row.isAdded ? '빼기' : isExcludedRow(row) ? '되돌리기' : '제외';
              return (
                <button
                  type="button"
                  className={FIELD_TEXT_BTN}
                  disabled={isSaving}
                  aria-label={`${row.entry.name} ${action}`}
                  onClick={() =>
                    row.isAdded
                      ? onRemoveAdded?.(row.entry.userId)
                      : onToggleExcluded?.(row.entry.userId)
                  }
                >
                  {action}
                </button>
              );
            },
          },
        ]),
  ];

  return (
    <SectionBox title="명단" action={action}>
      <div className="space-y-4">
        {rows.length === 0 ? (
          <p className="text-xs text-slate-500">명단이 비어 있습니다.</p>
        ) : (
          <>
            {/* 멘멘·친바 참여와 소속 그룹까지 출결·점수 계산이 이 명단을 기준으로 하므로 한 표에 모두 보인다. */}
            <DataTable
              caption="명단"
              columns={columns}
              data={rows}
              getRowId={({ entry }) => entry.userId}
              rowClassName={(row) => (isExcludedRow(row) ? 'bg-slate-50' : '')}
              className="max-h-96 overflow-x-auto overflow-y-auto"
              tableClassName="min-w-[920px]"
              isHeadSticky
            />
          </>
        )}

        {!isReadOnly && (
          <div className="space-y-2">
            <RosterPicker
              inRosterIds={new Set([...saved, ...added].map((m) => m.userId))}
              disabled={isSaving}
              onAdd={(picked) => onAdd?.(picked.map((c) => rosterEntryOf(c, kindOf)))}
            />
            {onSave && (
              <div className="flex items-center justify-end gap-3">
                {isDirty && (
                  <p className="mr-auto text-xs text-slate-500">
                    저장 전 · 제외 {excludedIds.size} · 추가 {added.length}
                    {parallelCount > 0 && ` · 병행 ${parallelCount}`}
                  </p>
                )}
                <button
                  type="button"
                  className={MODAL_CONFIRM_BTN}
                  disabled={!isDirty || isSaving}
                  onClick={onSave}
                >
                  {isSaving ? '저장 중' : '명단 저장'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </SectionBox>
  );
}

interface RosterPickerProps {
  /** 이미 명단에 있거나 더하기로 한 사람. 후보에서 뺀다. */
  inRosterIds: ReadonlySet<string>;
  disabled: boolean;
  /** 체크한 사람들을 명단에 더한다. */
  onAdd: (members: MemberSummary[]) => void;
}

// 명단에 더하는 사람은 스터디에 참여하는 수료 회원이다. 활동 기수(BASE·ADV)는 반기를 만들 때 서버가 넣는다(MEM-01 status=COMPLETED).
const loadMembers = () => fetchMembers(['COMPLETED']);

/**
 * 명단에 더할 사람 고르기: 스터디에 참여하는 수료 기수 회원(이번 반기의 BASE·ADV 기수가 아니고 탈동하지 않은 사람)을
 * 목록에서 체크해 한 번에 더한다(이름으로 찾을 수 있다). 더한 사람은 수료 기수(COMPLETED)로 등록된다.
 * 명단을 고칠 수 있을 때만 그려서 그때만 회원 목록을 읽는다.
 */
function RosterPicker({ inRosterIds, disabled, onAdd }: RosterPickerProps) {
  const { data: members, error, reload } = useLoaded('members', loadMembers);
  const [query, setQuery] = useState('');
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());
  /** 마지막으로 누른 줄. Shift를 누른 채 다른 줄을 누르면 그 사이를 한꺼번에 고른다. */
  const [lastIndex, setLastIndex] = useState<number | null>(null);
  const candidates = members ? rosterCandidates(members, inRosterIds, { term: 'ALL', query }) : [];
  // 이름으로 찾는 조건을 바꿔도 앞서 체크한 사람은 그대로 더한다(보이지 않아도 빠지지 않게).
  const picked = members
    ? rosterCandidates(members, inRosterIds, { term: 'ALL', query: '' }).filter((c) =>
        checkedIds.has(c.id),
      )
    : [];
  const shownChecked = candidates.filter((c) => checkedIds.has(c.id)).length;
  const isAllChecked = candidates.length > 0 && shownChecked === candidates.length;
  const isSomeChecked = shownChecked > 0 && !isAllChecked;
  const candidateIds = candidates.map((c) => c.id);
  const toggleRow = (index: number, isRange: boolean) => {
    setCheckedIds(withCheckedRange(checkedIds, candidateIds, isRange ? lastIndex : null, index));
    setLastIndex(index);
  };
  const setAllShown = (isOn: boolean) => {
    const next = new Set(checkedIds);
    candidateIds.forEach((id) => (isOn ? next.add(id) : next.delete(id)));
    setCheckedIds(next);
    setLastIndex(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLastIndex(null);
          }}
          aria-label="더할 사람 이름"
          placeholder="이름으로 찾기"
          className={`${FIELD_INPUT} w-auto min-w-0 flex-1`}
        />
        <button
          type="button"
          className={MODAL_CONFIRM_BTN}
          disabled={disabled || picked.length === 0}
          onClick={() => {
            onAdd(picked);
            setCheckedIds(new Set());
            setLastIndex(null);
          }}
        >
          {picked.length > 0 ? `${picked.length}명 추가` : '추가'}
        </button>
      </div>
      {error && (
        <p role="status" className="text-xs text-red-600">
          동아리원 목록을 불러오지 못했습니다.{' '}
          <button type="button" className={FIELD_TEXT_BTN} onClick={reload}>
            다시 불러오기
          </button>
        </p>
      )}
      {/* 더할 사람이 없어도 표 머리는 그대로 두고 빈 줄 문구를 보인다. 고르는 목록이라 세로 줄 없이 가볍게 그린다. */}
      {members && (
        <div
          // relative: 숨긴 표 제목(sr-only)이 이 넘기는 상자 밖으로 나가 화면을 길게 만들지 않게 한다.
          className={`${TABLE_BOX} relative max-h-56 overflow-y-auto`}
        >
          <table className="w-full table-fixed border-collapse text-xs">
            <caption className="sr-only">명단에 더할 사람</caption>
            <colgroup>
              <col className="w-10" />
              <col />
              <col className="w-20" />
              <col className="w-28" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
              <tr className="h-8 border-b border-slate-200">
                <th scope="col" className="px-3">
                  <input
                    type="checkbox"
                    checked={isAllChecked}
                    ref={(element) => {
                      if (element) element.indeterminate = isSomeChecked;
                    }}
                    onChange={() => setAllShown(!isAllChecked)}
                    disabled={candidates.length === 0}
                    aria-label="보이는 사람 모두 고르기"
                    className="size-4 cursor-pointer align-middle accent-slate-700 disabled:cursor-not-allowed"
                  />
                </th>
                <th scope="col" className="px-2 text-left font-semibold">
                  이름
                </th>
                <th scope="col" className="px-2 text-left font-semibold">
                  기수
                </th>
                <th scope="col" className="px-2 text-left font-semibold">
                  부문
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.length === 0 && (
                <tr className="h-10">
                  <td colSpan={4} className="px-3 text-center text-slate-500">
                    더할 수 있는 사람이 없습니다.
                  </td>
                </tr>
              )}
              {candidates.map((c, index) => (
                // 줄 어디를 눌러도 고른다. Shift를 누른 채 누르면 앞서 누른 줄까지 한꺼번에 고른다.
                <tr
                  key={c.id}
                  onClick={(event) => toggleRow(index, event.shiftKey)}
                  className={`h-9 cursor-pointer select-none transition-colors ${checkedIds.has(c.id) ? 'bg-slate-100/70' : 'hover:bg-slate-50'}`}
                >
                  <td className="px-3">
                    <input
                      type="checkbox"
                      checked={checkedIds.has(c.id)}
                      // 줄의 onClick이 고르므로 체크박스 자체 클릭은 줄로만 넘긴다(두 번 뒤집히지 않게).
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleRow(index, event.shiftKey);
                      }}
                      onChange={() => undefined}
                      aria-label={`${c.name} 고르기`}
                      className="size-4 cursor-pointer align-middle accent-slate-700"
                    />
                  </td>
                  <td className="truncate px-2 font-semibold text-slate-900">{c.name}</td>
                  <td className="px-2 tabular-nums text-slate-600">{c.term}기</td>
                  <td className="px-2 text-slate-600">{c.track}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
