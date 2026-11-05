import { useState } from 'react';

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

import { effectiveRoster, rosterCounts, searchRosterCandidates } from '../model/roster';
import { GRID_HEAD_ROW, GRID_ROW, SectionBox } from './SectionBox';

const KIND_LABEL: Record<RosterKind, string> = { BASE: 'BASE', ADV: 'ADV', EXTRA: '예외 추가' };

interface RosterSectionProps {
  /** 저장된 명단. */
  saved: readonly RosterEntryDto[];
  /** 저장된 명단에서 뺄 사람(저장 전). */
  excludedIds: ReadonlySet<string>;
  /** 저장된 명단에 더할 사람(저장 전). */
  added: readonly RosterEntryDto[];
  /** 더할 사람의 구분을 정한다(BASE·ADV 기수가 아니면 예외 추가). */
  kindOf: (term: number) => RosterKind;
  /** 준비 반기가 아니면 예외를 고칠 수 없다. */
  isReadOnly: boolean;
  /** 명단을 저장하는 중. 그동안 예외 버튼을 막는다. */
  isSaving: boolean;
  onToggleExcluded: (userId: string) => void;
  onAdd: (entry: RosterEntryDto) => void;
  onRemoveAdded: (userId: string) => void;
  onSave: () => void;
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
  const effective = effectiveRoster(saved, excludedIds, added);
  const isDirty = excludedIds.size > 0 || added.length > 0;
  const counts = rosterCounts(effective);

  const rows: { entry: RosterEntryDto; isAdded: boolean }[] = [
    ...saved.map((entry) => ({ entry, isAdded: false })),
    ...added.map((entry) => ({ entry, isAdded: true })),
  ];

  return (
    <SectionBox title="명단">
      <div className="space-y-4">
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-slate-600">
          {counts.map(({ term, kind, count }) => (
            <span key={`${term}-${kind}`}>
              {term}기 {KIND_LABEL[kind]}{' '}
              <span className="font-semibold tabular-nums text-slate-900">{count}</span>명
            </span>
          ))}
          <span className="ml-auto">
            합계 <span className="font-bold tabular-nums text-slate-900">{effective.length}</span>명
          </span>
        </p>

        {rows.length === 0 ? (
          <p className="text-xs text-slate-500">
            명단이 비어 있습니다. BASE·ADV 기수에 활동 중인 회원이 없으면 아래에서 직접 더하세요.
          </p>
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
                {rows.map(({ entry, isAdded }, index) => {
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
            <RosterAddSearch
              inRosterIds={new Set([...saved, ...added].map((m) => m.userId))}
              onAdd={(c) =>
                onAdd({
                  userId: c.id,
                  name: c.name,
                  term: c.term,
                  track: c.track,
                  kind: kindOf(c.term),
                })
              }
            />
            <div className="flex items-center justify-end gap-3">
              {isDirty && (
                <p className="mr-auto text-xs text-slate-500">
                  제외 {excludedIds.size}명 · 추가 {added.length}명, 저장하지 않음
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
          </div>
        )}
      </div>
    </SectionBox>
  );
}

interface RosterAddSearchProps {
  /** 이미 명단에 있거나 더하기로 한 사람. 검색 결과에서 뺀다. */
  inRosterIds: ReadonlySet<string>;
  /** 검색 결과의 사람을 명단에 더한다. */
  onAdd: (member: { id: string; name: string; term: number; track: string }) => void;
}

/** 명단에 없는 동아리원(탈퇴 제외)을 이름으로 찾아 더한다. 명단을 고칠 수 있을 때만 그려서 그때만 회원 목록을 읽는다. */
function RosterAddSearch({ inRosterIds, onAdd }: RosterAddSearchProps) {
  const { members, error, reload } = useClubMembers();
  const [query, setQuery] = useState('');
  const keyword = query.trim();
  const matches = members ? searchRosterCandidates(members, inRosterIds, query) : [];

  return (
    <>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="명단에 더할 사람 이름"
        placeholder="더할 사람 이름"
        className={FIELD_INPUT}
      />
      {error && (
        <p role="status" className="text-xs text-red-600">
          동아리원 목록을 불러오지 못했습니다.{' '}
          <button type="button" className={FIELD_TEXT_BTN} onClick={reload}>
            다시 불러오기
          </button>
        </p>
      )}
      {matches.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {matches.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 px-2 py-2">
              <span className="text-xs text-slate-900">
                {c.name}
                <span className="ml-2 text-slate-500">
                  {c.term}기 · {c.track}
                </span>
              </span>
              <button
                type="button"
                className={FIELD_TEXT_BTN}
                aria-label={`${c.name} 명단에 더하기`}
                onClick={() => onAdd(c)}
              >
                더하기
              </button>
            </li>
          ))}
        </ul>
      )}
      {members && keyword && matches.length === 0 && (
        <p className="text-xs text-slate-500">더할 수 있는 사람이 없습니다.</p>
      )}
    </>
  );
}
