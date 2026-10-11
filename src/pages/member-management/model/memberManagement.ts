import type {
  ClubMember,
  ClubMemberStatus,
  ClubMemberTrack,
} from '@/entities/club-member/model/types';

export interface ClubMemberFilter {
  query: string;
  term: number | 'ALL';
  track: ClubMemberTrack | 'ALL';
  status: ClubMemberStatus | 'ALL';
}

export function filterClubMembers(
  members: readonly ClubMember[],
  filter: ClubMemberFilter,
): ClubMember[] {
  const query = filter.query.trim().toLocaleLowerCase('ko');

  return members
    .filter((member) => {
      const matchesQuery =
        !query ||
        member.name.toLocaleLowerCase('ko').includes(query) ||
        member.email.toLocaleLowerCase('ko').includes(query) ||
        member.phone.includes(query);
      const matchesTerm = filter.term === 'ALL' || member.term === filter.term;
      const matchesTrack = filter.track === 'ALL' || member.track === filter.track;
      const matchesStatus = filter.status === 'ALL' || member.status === filter.status;

      return matchesQuery && matchesTerm && matchesTrack && matchesStatus;
    })
    .sort((a, b) => b.term - a.term || a.name.localeCompare(b.name, 'ko'));
}

export function summarizeClubMembers(members: readonly ClubMember[]) {
  return {
    total: members.length,
    active: members.filter((member) => member.status === 'ACTIVE').length,
    alumni: members.filter((member) => member.status === 'ALUMNI').length,
    operators: members.filter((member) => member.role !== 'MEMBER').length,
  };
}
