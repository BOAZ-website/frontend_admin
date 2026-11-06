import type { ClubMember } from '@/entities/club-member/model/types';
import type { RosterEntryDto, RosterKind } from '@/entities/cohort/model/dto';

/** 이름 검색 결과를 이만큼만 보여 준다. */
const SEARCH_LIMIT = 8;

/** 명단 표를 거르는 구분. 뺀 사람은 원래 구분 대신 제외로 거른다. */
export type RosterFilter = 'ALL' | RosterKind | 'EXCLUDED';

/** 이 사람이 걸리는 필터: 뺀 사람이면 제외, 아니면 구분. */
export function rosterFilterOf(
  entry: RosterEntryDto,
  excludedIds: ReadonlySet<string>,
): Exclude<RosterFilter, 'ALL'> {
  return excludedIds.has(entry.userId) ? 'EXCLUDED' : entry.kind;
}

/** 필터별 인원. 전체는 표의 모든 행(뺀 사람 포함)이고, 나머지 필터의 합과 같다. */
export function rosterFilterCounts(
  entries: readonly RosterEntryDto[],
  excludedIds: ReadonlySet<string>,
): Record<RosterFilter, number> {
  const counts: Record<RosterFilter, number> = { ALL: 0, BASE: 0, ADV: 0, EXTRA: 0, EXCLUDED: 0 };
  entries.forEach((entry) => {
    const filter = rosterFilterOf(entry, excludedIds);
    counts[filter] += 1;
    counts.ALL += 1;
  });
  return counts;
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
