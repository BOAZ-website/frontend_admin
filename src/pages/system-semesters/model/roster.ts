import type { MemberSummary } from '@/entities/club-member/model/types';
import type { RosterEntryDto, RosterKind } from '@/entities/cohort/model/dto';

/** 명단에 더할 후보를 거르는 조건. */
export interface RosterCandidateFilter {
  term: number | 'ALL';
  query: string;
}

/** 명단에 더할 수 있는 동아리원: 탈동하지 않았고 명단에 없으며 기수·이름 조건에 맞는 사람. 큰 기수부터 이름순. */
export function rosterCandidates(
  members: readonly MemberSummary[],
  inRosterIds: ReadonlySet<string>,
  { term, query }: RosterCandidateFilter,
): MemberSummary[] {
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

/**
 * 동아리원을 명단 줄로 바꾼다(저장 전에 더한 사람).
 * 아직 반기에 저장되지 않아 그룹·멘멘·친바 참여·병행 수료·비고는 없다.
 */
export function rosterEntryOf(
  member: MemberSummary,
  kindOf: (term: number) => RosterKind,
): RosterEntryDto {
  return {
    userId: member.id,
    name: member.name,
    term: member.term,
    track: member.track,
    parallelTrack: member.parallelTrack,
    kind: kindOf(member.term),
    memberStatus: member.status,
    // 백엔드는 생략하면 참여(true)로 등록한다(ATT-19). 화면도 같은 기본값에서 시작한다.
    menmenJoined: true,
    chinbaJoined: true,
    isParallelCompleted: null,
    note: null,
    groups: [],
  };
}
