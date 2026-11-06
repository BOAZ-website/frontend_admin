import type { ClubMember } from '@/entities/club-member/model/types';
import type { RosterEntryDto, RosterKind } from '@/entities/cohort/model/dto';
import type { ScheduleForm } from './scheduleForm';

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

/** 명단에 더할 후보를 거르는 조건. */
export interface RosterCandidateFilter {
  term: number | 'ALL';
  query: string;
}

/** 명단에 더할 수 있는 동아리원: 탈동하지 않았고 명단에 없으며 기수·이름 조건에 맞는 사람. 큰 기수부터 이름순. */
export function rosterCandidates(
  members: readonly ClubMember[],
  inRosterIds: ReadonlySet<string>,
  { term, query }: RosterCandidateFilter,
): ClubMember[] {
  const keyword = query.trim();
  return members
    .filter(
      (m) =>
        m.status !== 'WITHDRAWN' &&
        !inRosterIds.has(m.id) &&
        (term === 'ALL' || m.term === term) &&
        m.name.includes(keyword),
    )
    .sort((a, b) => b.term - a.term || a.name.localeCompare(b.name, 'ko'));
}

/**
 * 목록에서 한 줄을 눌렀을 때의 체크 상태. 누른 줄은 상태가 뒤집히고, from이 있으면(Shift)
 * from 줄부터 누른 줄까지 모두 누른 줄의 새 상태로 맞춘다.
 */
export function withCheckedRange(
  checked: ReadonlySet<string>,
  ids: readonly string[],
  from: number | null,
  to: number,
): Set<string> {
  const isOn = !checked.has(ids[to]);
  const start = from === null ? to : Math.min(from, to);
  const end = from === null ? to : Math.max(from, to);
  const next = new Set(checked);
  ids.slice(start, end + 1).forEach((id) => (isOn ? next.add(id) : next.delete(id)));
  return next;
}

/** 명단 확인에 미리 넣을 기수: 1주차 시작일을 정한 활동의 기수(BASE·ADV). 스터디만 하는 사람은 직접 더한다. */
export function rosterTermsOf(form: ScheduleForm, baseTerm: number, advTerm: number): number[] {
  return [...(form.starts.BASE ? [baseTerm] : []), ...(form.starts.ADV ? [advTerm] : [])];
}

/** 미리 넣는 명단: 그 기수의 활동 중 회원. 구분은 기수로 정한다. */
export function autoRosterOf(
  members: readonly ClubMember[],
  terms: readonly number[],
  kindOf: (term: number) => RosterKind,
): RosterEntryDto[] {
  return members
    .filter((m) => m.status === 'ACTIVE' && terms.includes(m.term))
    .map((m) => ({
      userId: m.id,
      name: m.name,
      term: m.term,
      track: m.track,
      kind: kindOf(m.term),
    }));
}
