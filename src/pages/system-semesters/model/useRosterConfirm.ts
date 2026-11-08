import { useState } from 'react';

import { useClubMembers } from '@/entities/club-member/model/useClubMembers';
import type { RosterEntryDto, RosterKind } from '@/entities/cohort/model/dto';

import { autoRosterOf } from './roster';

/** 새 반기 명단 확인 창의 상태: 미리 넣은 명단, 뺀 사람, 직접 더한 사람. */
export interface RosterConfirmState {
  /** 미리 넣은 명단(1주차 시작일을 정한 BASE·ADV 기수의 활동 중 회원). 읽는 중이면 null. */
  autoMembers: RosterEntryDto[] | null;
  membersError: Error | null;
  reloadMembers: () => void;
  excludedIds: ReadonlySet<string>;
  added: RosterEntryDto[];
  /** 시작하면 명단이 될 회원 id. */
  userIds: string[];
  handleToggleExcluded: (userId: string) => void;
  handleAddMembers: (entries: RosterEntryDto[]) => void;
  handleRemoveAdded: (userId: string) => void;
}

/** 새 반기를 시작하기 전에 명단을 확인한다. 미리 넣은 사람을 빼거나 다른 사람을 더할 수 있다. */
export function useRosterConfirm(
  terms: readonly number[],
  kindOf: (term: number) => RosterKind,
): RosterConfirmState {
  const { members, error, reload } = useClubMembers();
  const [excludedIds, setExcludedIds] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState<RosterEntryDto[]>([]);
  const autoMembers = members ? autoRosterOf(members, terms, kindOf) : null;

  return {
    autoMembers,
    membersError: error,
    reloadMembers: reload,
    excludedIds,
    added,
    userIds: [
      ...(autoMembers ?? []).filter((m) => !excludedIds.has(m.userId)).map((m) => m.userId),
      ...added.map((m) => m.userId),
    ],
    handleToggleExcluded: (userId) => {
      const next = new Set(excludedIds);
      if (!next.delete(userId)) next.add(userId);
      setExcludedIds(next);
    },
    handleAddMembers: (entries) => setAdded([...added, ...entries]),
    handleRemoveAdded: (userId) => setAdded(added.filter((m) => m.userId !== userId)),
  };
}
