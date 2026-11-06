import { useState } from 'react';

import type { ClubMember } from '@/entities/club-member/model/types';

import { useClubMembers } from '@/entities/club-member/model/useClubMembers';
import type { RosterEntryDto, RosterKind } from '@/entities/cohort/model/dto';
import {
  FIELD_INPUT,
  FIELD_TEXT_BTN,
  MODAL_CONFIRM_BTN,
  TABLE_BOX,
  TD_CLASS,
  TH_CLASS,
} from '@/shared/ui/systemStyles';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';

import {
  type RosterFilter,
  rosterFilterCounts,
  rosterFilterOf,
  rosterCandidates,
  withCheckedRange,
} from '../model/roster';
import { GRID_HEAD_ROW, GRID_ROW, SectionBox } from './SectionBox';

const KIND_LABEL: Record<RosterKind, string> = { BASE: 'BASE', ADV: 'ADV', EXTRA: '수료 기수' };
const FILTER_LABEL: Record<RosterFilter, string> = { ALL: '전체', ...KIND_LABEL, EXCLUDED: '제외' };
/** 인원이 0이어도 보이는 필터. 수료 기수·제외는 있을 때만 보인다. */
const ALWAYS_SHOWN: readonly RosterFilter[] = ['ALL', 'BASE', 'ADV'];
const FILTER_ORDER: readonly RosterFilter[] = ['ALL', 'BASE', 'ADV', 'EXTRA', 'EXCLUDED'];

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
  onToggleExcluded: (userId: string) => void;
  /** 고른 사람들을 명단에 더한다(저장 전). */
  onAdd: (entries: RosterEntryDto[]) => void;
  onRemoveAdded: (userId: string) => void;
  /** 명단만 따로 저장한다. 없으면 저장 버튼을 그리지 않는다(새 반기 작성은 반기를 만들 때 함께 보낸다). */
  onSave?: () => void;
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
  onSave,
}: RosterSectionProps) {
  const [chosenFilter, setChosenFilter] = useState<RosterFilter>('ALL');
  const isDirty = excludedIds.size > 0 || added.length > 0;

  const rows: { entry: RosterEntryDto; isAdded: boolean }[] = [
    ...saved.map((entry) => ({ entry, isAdded: false })),
    ...added.map((entry) => ({ entry, isAdded: true })),
  ];
  const counts = rosterFilterCounts(
    rows.map((row) => row.entry),
    excludedIds,
  );
  const filters = FILTER_ORDER.filter((f) => ALWAYS_SHOWN.includes(f) || counts[f] > 0);
  // 고른 필터의 사람이 모두 사라지면(예: 제외를 모두 되돌림) 전체로 돌아간다.
  const filter = filters.includes(chosenFilter) ? chosenFilter : 'ALL';
  const shownRows =
    filter === 'ALL'
      ? rows
      : rows.filter((row) => rosterFilterOf(row.entry, excludedIds) === filter);

  return (
    <SectionBox title="명단">
      <div className="space-y-4">
        <div
          role="group"
          aria-label="명단 구분"
          className="inline-flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-100 p-1"
        >
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setChosenFilter(f)}
              className={`rounded-sm px-3 py-1 text-xs font-semibold ${
                filter === f ? 'bg-white text-slate-900' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {FILTER_LABEL[f]} <span className="font-normal tabular-nums">{counts[f]}</span>
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <p className="text-xs text-slate-500">명단이 비어 있습니다.</p>
        ) : shownRows.length === 0 ? (
          <p className="text-xs text-slate-500">{FILTER_LABEL[filter]} 인원이 없습니다.</p>
        ) : (
          <div className={`${TABLE_BOX} max-h-96 overflow-y-auto`}>
            <table className="w-full border-collapse text-xs">
              <caption className="sr-only">명단</caption>
              <thead className="sticky top-0 z-10">
                <tr className={GRID_HEAD_ROW}>
                  <th scope="col" className={`${TH_CLASS} w-10 text-slate-500`}>
                    #
                  </th>
                  <th scope="col" className={`${TH_CLASS} w-16`}>
                    기수
                  </th>
                  <th scope="col" className={`${TH_CLASS} w-24`}>
                    부문
                  </th>
                  <th scope="col" className={`${TH_CLASS} text-slate-900`}>
                    이름
                  </th>
                  <th scope="col" className={`${TH_CLASS} w-20`}>
                    구분
                  </th>
                  {!isReadOnly && (
                    <th scope="col" className={`${TH_CLASS} w-20`}>
                      예외
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shownRows.map(({ entry, isAdded }, index) => {
                  const isExcluded = excludedIds.has(entry.userId);
                  const action = isAdded ? '빼기' : isExcluded ? '되돌리기' : '제외';
                  return (
                    <tr
                      key={entry.userId}
                      className={`${GRID_ROW} ${isExcluded ? 'bg-slate-50' : ''}`}
                    >
                      <td className={`${TD_CLASS} tabular-nums text-slate-500`}>{index + 1}</td>
                      <td className={`${TD_CLASS} tabular-nums text-slate-700`}>{entry.term}</td>
                      <td className={`${TD_CLASS} text-slate-700`}>{entry.track}</td>
                      <td
                        className={`${TD_CLASS} font-semibold ${isExcluded ? 'text-slate-500 line-through' : 'text-slate-900'}`}
                      >
                        {entry.name}
                      </td>
                      <td className={`${TD_CLASS} text-slate-700`}>
                        {isExcluded ? (
                          <span className="font-semibold text-red-600">제외</span>
                        ) : isAdded ? (
                          <span className="font-semibold text-emerald-700">추가</span>
                        ) : (
                          KIND_LABEL[entry.kind]
                        )}
                      </td>
                      {!isReadOnly && (
                        <td className={TD_CLASS}>
                          <button
                            type="button"
                            className={FIELD_TEXT_BTN}
                            disabled={isSaving}
                            aria-label={`${entry.name} ${action}`}
                            onClick={() =>
                              isAdded ? onRemoveAdded(entry.userId) : onToggleExcluded(entry.userId)
                            }
                          >
                            {action}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isReadOnly && (
          <div className="space-y-2">
            <RosterPicker
              inRosterIds={new Set([...saved, ...added].map((m) => m.userId))}
              kindOf={kindOf}
              disabled={isSaving}
              onAdd={(picked) =>
                onAdd(
                  picked.map((c) => ({
                    userId: c.id,
                    name: c.name,
                    term: c.term,
                    track: c.track,
                    kind: kindOf(c.term),
                  })),
                )
              }
            />
            {onSave && (
              <div className="flex items-center justify-end gap-3">
                {isDirty && (
                  <p className="mr-auto text-xs text-slate-500">
                    저장 전 · 제외 {excludedIds.size} · 추가 {added.length}
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
  /** 사람의 기수로 정한 구분. BASE·ADV를 한꺼번에 고르는 데 쓴다. */
  kindOf: (term: number) => RosterKind;
  disabled: boolean;
  /** 체크한 사람들을 명단에 더한다. */
  onAdd: (members: ClubMember[]) => void;
}

/**
 * 명단에 더할 사람 고르기: 기수·이름으로 거른 동아리원(탈동 제외)을 체크해 한 번에 더한다.
 * 명단을 고칠 수 있을 때만 그려서 그때만 회원 목록을 읽는다.
 */
function RosterPicker({ inRosterIds, kindOf, disabled, onAdd }: RosterPickerProps) {
  const { members, error, reload } = useClubMembers();
  const [term, setTerm] = useState<number | 'ALL'>('ALL');
  const [query, setQuery] = useState('');
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set());
  /** 마지막으로 누른 줄. Shift를 누른 채 다른 줄을 누르면 그 사이를 한꺼번에 고른다. */
  const [lastIndex, setLastIndex] = useState<number | null>(null);
  const candidates = members ? rosterCandidates(members, inRosterIds, { term, query }) : [];
  // 거르는 조건을 바꿔도 앞서 체크한 사람은 그대로 더한다(보이지 않아도 빠지지 않게).
  const picked = members
    ? rosterCandidates(members, inRosterIds, { term: 'ALL', query: '' }).filter((c) =>
        checkedIds.has(c.id),
      )
    : [];
  const allCandidates = members
    ? rosterCandidates(members, inRosterIds, { term: 'ALL', query: '' })
    : [];
  const activeIdsOf = (kind: RosterKind) =>
    allCandidates.filter((c) => c.status === 'ACTIVE' && kindOf(c.term) === kind).map((c) => c.id);
  const checkKind = (kind: RosterKind) => {
    setCheckedIds(new Set([...checkedIds, ...activeIdsOf(kind)]));
    setLastIndex(null);
  };
  const shownChecked = candidates.filter((c) => checkedIds.has(c.id)).length;
  const isAllChecked = candidates.length > 0 && shownChecked === candidates.length;
  const isSomeChecked = shownChecked > 0 && !isAllChecked;
  const termOptions = [
    { value: 'ALL', label: '전체 기수' },
    ...[...new Set((members ?? []).filter((m) => m.status !== 'WITHDRAWN').map((m) => m.term))]
      .sort((a, b) => b - a)
      .map((t) => ({ value: String(t), label: `${t}기` })),
  ];
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
        <SelectDropdown
          ariaLabel="더할 사람 기수"
          value={String(term)}
          options={termOptions}
          onChange={(value) => {
            setTerm(value === 'ALL' ? 'ALL' : Number(value));
            setLastIndex(null);
          }}
          buttonClassName="h-10 w-32 text-left"
        />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLastIndex(null);
          }}
          aria-label="더할 사람 이름"
          placeholder="이름"
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
      {(['BASE', 'ADV'] as const).some((kind) => activeIdsOf(kind).length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {(['BASE', 'ADV'] as const).map((kind) => {
            const count = activeIdsOf(kind).length;
            return (
              count > 0 && (
                <button
                  key={kind}
                  type="button"
                  className="h-8 cursor-pointer rounded-sm border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900"
                  onClick={() => checkKind(kind)}
                >
                  {kind} 모두 고르기{' '}
                  <span className="font-normal tabular-nums text-slate-500">{count}</span>
                </button>
              )
            );
          })}
        </div>
      )}
      {candidates.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>
            <span className="font-semibold tabular-nums text-slate-900">{picked.length}</span>명
            고름
          </span>
          <button
            type="button"
            className={FIELD_TEXT_BTN}
            onClick={() => setAllShown(!isAllChecked)}
          >
            {isAllChecked ? '보이는 사람 모두 풀기' : `보이는 ${candidates.length}명 모두 고르기`}
          </button>
          {picked.length > 0 && (
            <button
              type="button"
              className={FIELD_TEXT_BTN}
              onClick={() => {
                setCheckedIds(new Set());
                setLastIndex(null);
              }}
            >
              고른 사람 비우기
            </button>
          )}
        </div>
      )}
      {members && candidates.length === 0 && (
        <p className="text-xs text-slate-500">더할 수 있는 사람이 없습니다.</p>
      )}
      {candidates.length > 0 && (
        <div className={`${TABLE_BOX} max-h-64 overflow-y-auto`}>
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">명단에 더할 사람</caption>
            <thead className="sticky top-0 z-10">
              <tr className={GRID_HEAD_ROW}>
                <th scope="col" className={`${TH_CLASS} w-10`}>
                  <input
                    type="checkbox"
                    checked={isAllChecked}
                    ref={(element) => {
                      if (element) element.indeterminate = isSomeChecked;
                    }}
                    onChange={() => setAllShown(!isAllChecked)}
                    aria-label="보이는 사람 모두 고르기"
                    className="size-4 cursor-pointer accent-slate-700"
                  />
                </th>
                <th scope="col" className={`${TH_CLASS} w-16`}>
                  기수
                </th>
                <th scope="col" className={`${TH_CLASS} w-24`}>
                  부문
                </th>
                <th scope="col" className={`${TH_CLASS} text-slate-900`}>
                  이름
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((c, index) => (
                // 줄 어디를 눌러도 고른다. Shift를 누른 채 누르면 앞서 누른 줄까지 한꺼번에 고른다.
                <tr
                  key={c.id}
                  onClick={(event) => toggleRow(index, event.shiftKey)}
                  className={`${GRID_ROW} cursor-pointer select-none ${checkedIds.has(c.id) ? 'bg-slate-50' : ''}`}
                >
                  <td className={TD_CLASS}>
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
                      className="size-4 cursor-pointer accent-slate-700"
                    />
                  </td>
                  <td className={`${TD_CLASS} tabular-nums text-slate-700`}>{c.term}</td>
                  <td className={`${TD_CLASS} text-slate-700`}>{c.track}</td>
                  <td className={`${TD_CLASS} font-semibold text-slate-900`}>{c.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
