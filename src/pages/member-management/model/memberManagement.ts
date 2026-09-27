export type ClubMemberTrack = 'ANALYSIS' | 'VISUALIZATION' | 'ENGINEERING';
export type ClubMemberStatus = 'ACTIVE' | 'ALUMNI' | 'INACTIVE';
export type ClubMemberRole = 'MEMBER' | 'OPERATOR' | 'PRESIDENT';

export interface ClubMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  cohort: number;
  track: ClubMemberTrack;
  status: ClubMemberStatus;
  role: ClubMemberRole;
  joinedAt: string;
}

export interface ClubMemberFilter {
  query: string;
  cohort: number | 'ALL';
  track: ClubMemberTrack | 'ALL';
  status: ClubMemberStatus | 'ALL';
}

export const TRACK_LABELS: Record<ClubMemberTrack, string> = {
  ANALYSIS: '분석',
  VISUALIZATION: '시각화',
  ENGINEERING: '엔지니어링',
};

export const STATUS_LABELS: Record<ClubMemberStatus, string> = {
  ACTIVE: '활동 중',
  ALUMNI: '수료',
  INACTIVE: '비활동',
};

export const ROLE_LABELS: Record<ClubMemberRole, string> = {
  MEMBER: '일반 회원',
  OPERATOR: '운영진',
  PRESIDENT: '대표진',
};

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
      const matchesCohort = filter.cohort === 'ALL' || member.cohort === filter.cohort;
      const matchesTrack = filter.track === 'ALL' || member.track === filter.track;
      const matchesStatus = filter.status === 'ALL' || member.status === filter.status;

      return matchesQuery && matchesCohort && matchesTrack && matchesStatus;
    })
    .sort((a, b) => b.cohort - a.cohort || a.name.localeCompare(b.name, 'ko'));
}

export function summarizeClubMembers(members: readonly ClubMember[]) {
  return {
    total: members.length,
    active: members.filter((member) => member.status === 'ACTIVE').length,
    alumni: members.filter((member) => member.status === 'ALUMNI').length,
    operators: members.filter((member) => member.role !== 'MEMBER').length,
  };
}
