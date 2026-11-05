import type { ClubMember } from '@/entities/club-member/model/types';
import type { RosterEntryDto, RosterKind } from '@/entities/cohort/model/dto';

/** 이름 검색 결과를 이만큼만 보여 준다. */
const SEARCH_LIMIT = 8;

/** 기수·구분별 인원 한 줄. */
export interface RosterCount {
  term: number;
  kind: RosterKind;
  count: number;
}

/** 저장된 명단에서 뺄 사람을 빼고 더할 사람을 더한, 저장하면 남을 명단. */
export function effectiveRoster(
  saved: readonly RosterEntryDto[],
  excludedIds: ReadonlySet<string>,
  added: readonly RosterEntryDto[],
): RosterEntryDto[] {
  return [...saved.filter((m) => !excludedIds.has(m.userId)), ...added];
}

/** 기수(큰 기수부터)·구분별 인원. */
export function rosterCounts(members: readonly RosterEntryDto[]): RosterCount[] {
  const groups = new Map<string, RosterCount>();
  members.forEach(({ term, kind }) => {
    const key = `${term}|${kind}`;
    const group = groups.get(key) ?? { term, kind, count: 0 };
    groups.set(key, { ...group, count: group.count + 1 });
  });
  return [...groups.values()].sort((a, b) => b.term - a.term);
}

/** 명단에 더할 수 있는 동아리원: 탈퇴하지 않았고 명단에 없으며 이름에 검색어가 들어간 사람. */
export function searchRosterCandidates(
  members: readonly ClubMember[],
  inRosterIds: ReadonlySet<string>,
  query: string,
): ClubMember[] {
  const keyword = query.trim();
  if (!keyword) return [];
  return members
    .filter((c) => c.status !== 'WITHDRAWN' && !inRosterIds.has(c.id) && c.name.includes(keyword))
    .slice(0, SEARCH_LIMIT);
}
