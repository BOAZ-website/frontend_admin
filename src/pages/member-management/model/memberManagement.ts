import {
  CLUB_MEMBER_TRACKS,
  type ClubMember,
  type ClubMemberStatus,
  type ClubMemberTermScope,
  type ClubMemberTrack,
} from '@/entities/club-member/model/types';

/** 운영진 필터에서 운영진이 아닌 사람을 고르는 값. 그 밖의 값은 운영진 팀 이름이다. */
export const NOT_OPERATOR = 'NONE';

/** 부문 명단의 id(주소에 남기는 값). */
const TRACK_SHEET_IDS = {
  분석: 'analysis',
  시각화: 'visualization',
  엔지니어링: 'engineering',
} as const satisfies Record<ClubMemberTrack, string>;

export type MemberSheet =
  'active' | 'alumni' | 'withdrawn' | (typeof TRACK_SHEET_IDS)[ClubMemberTrack];

/** 왼쪽 목록의 명단 한 개. 활동 상태로 나눈 명단(status)과 부문 명단(track)이 있다. */
export type MemberSheetItem = { id: MemberSheet; label: string } & (
  | { kind: 'status'; status: ClubMemberStatus; track: null }
  | { kind: 'track'; status: null; track: ClubMemberTrack }
);

/**
 * 동아리원 명단. 왼쪽 목록에서 고르는 단위다.
 * - 활동기수·수료기수 목록: 부문과 관계없이 그 활동 상태인 사람(status)
 * - 부문 명단: 그 부문에서 탈퇴하지 않은 사람(track). 순서는 CLUB_MEMBER_TRACKS를 따른다.
 * - 탈퇴 명단: 부문과 관계없이 탈퇴한 사람(status)
 * id는 주소('#system-members/<id>')에 남기는 값이다.
 */
export const MEMBER_SHEETS: readonly MemberSheetItem[] = [
  { id: 'active', label: '활동기수 목록', kind: 'status', status: 'ACTIVE', track: null },
  { id: 'alumni', label: '수료기수 목록', kind: 'status', status: 'ALUMNI', track: null },
  ...CLUB_MEMBER_TRACKS.map((track): MemberSheetItem => ({
    id: TRACK_SHEET_IDS[track],
    label: track,
    kind: 'track',
    status: null,
    track,
  })),
  { id: 'withdrawn', label: '탈퇴', kind: 'status', status: 'WITHDRAWN', track: null },
];

export const isMemberSheet = (value: string): value is MemberSheet =>
  MEMBER_SHEETS.some((sheet) => sheet.id === value);

/**
 * 한 페이지에 한 기수씩 서버(GET /api/v1/club-members/by-term)에서 나눠 읽는 명단의 읽기 조건.
 * 활동기수·수료기수 목록은 { status }, 부문 명단은 { track }(그 부문의 활동·수료 사람)이다.
 * 탈퇴 명단이나 명단을 닫았을 때(null)는 기수 페이지가 없어 null이다.
 */
export function termScopeOfSheet(sheet: MemberSheet | null): ClubMemberTermScope | null {
  const item = MEMBER_SHEETS.find((candidate) => candidate.id === sheet);
  if (!item) return null;
  if (item.kind === 'track') return { track: item.track };
  return item.status === 'WITHDRAWN' ? null : { status: item.status };
}

/** 명단에 들어가는 사람인지. */
export function isInSheet(member: ClubMember, sheet: MemberSheet): boolean {
  const item = MEMBER_SHEETS.find((candidate) => candidate.id === sheet);
  if (!item) return true;
  if (item.kind === 'status') return member.status === item.status;
  return member.track === item.track && member.status !== 'WITHDRAWN';
}

export interface ClubMemberFilter {
  query: string;
  term: number | 'ALL';
  track: ClubMemberTrack | 'ALL';
  status: ClubMemberStatus | 'ALL';
  /** 운영진 필터: 'ALL'(전체), NOT_OPERATOR(운영진 아님), 또는 팀 이름. 없으면 전체다. */
  operator?: string;
  /** 보고 있는 시트. 없으면 시트로 거르지 않는다. */
  sheet?: MemberSheet;
}

export function filterClubMembers(
  members: readonly ClubMember[],
  filter: ClubMemberFilter,
): ClubMember[] {
  const query = filter.query.trim().toLocaleLowerCase('ko');

  return members.filter((member) => {
    const matchesQuery =
      !query ||
      member.name.toLocaleLowerCase('ko').includes(query) ||
      member.email.toLocaleLowerCase('ko').includes(query) ||
      member.phone.includes(query);
    const matchesTerm = filter.term === 'ALL' || member.term === filter.term;
    const matchesTrack = filter.track === 'ALL' || member.track === filter.track;
    const matchesStatus = filter.status === 'ALL' || member.status === filter.status;
    const operator = filter.operator ?? 'ALL';
    const matchesOperator =
      operator === 'ALL' ||
      (operator === NOT_OPERATOR ? !member.operatorTeam : member.operatorTeam === operator);

    const matchesSheet = !filter.sheet || isInSheet(member, filter.sheet);

    return (
      matchesQuery &&
      matchesTerm &&
      matchesTrack &&
      matchesStatus &&
      matchesOperator &&
      matchesSheet
    );
  });
}
