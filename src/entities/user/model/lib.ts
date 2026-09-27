import type { UserProfile, UserTrack } from './types';

export interface UserFilter {
  terms: readonly number[];
  tracks: readonly UserTrack[];
  keyword: string;
}

/** 빈 배열은 "제한 없음"으로 취급한다. 결과는 기수 → 부문 → 이름 순으로 정렬한다. */
export function filterUsers(users: readonly UserProfile[], filter: UserFilter): UserProfile[] {
  const keyword = filter.keyword.trim();
  return users
    .filter((user) => filter.terms.length === 0 || filter.terms.includes(user.term))
    .filter((user) => filter.tracks.length === 0 || filter.tracks.includes(user.track))
    .filter((user) => keyword === '' || user.name.includes(keyword))
    .sort(
      (a, b) =>
        a.term - b.term || a.track.localeCompare(b.track, 'ko') || a.name.localeCompare(b.name, 'ko'),
    );
}

/** 예: "26기 분석 남민서" */
export function formatUserLabel(user: UserProfile): string {
  return `${user.term}기 ${user.track} ${user.name}`;
}

/** 스터디 생성 시 고른 스터디원 목록과 그중 스터디장 1명. 스터디장은 항상 스터디원에 포함된다. */
export interface MemberSelection {
  members: readonly UserProfile[];
  leaderId: string | null;
}

export const EMPTY_MEMBER_SELECTION: MemberSelection = { members: [], leaderId: null };

/** 스터디원 체크 토글. 스터디장이 빠지면 스터디장 지정도 함께 해제한다. */
export function toggleMember(selection: MemberSelection, user: UserProfile): MemberSelection {
  const isMember = selection.members.some((m) => m.id === user.id);
  if (!isMember) return { ...selection, members: [...selection.members, user] };
  return {
    members: selection.members.filter((m) => m.id !== user.id),
    leaderId: selection.leaderId === user.id ? null : selection.leaderId,
  };
}

/** 스터디장 토글. 아직 스터디원이 아니면 함께 추가한다. 스터디장은 1명만 지정된다. */
export function toggleLeader(selection: MemberSelection, user: UserProfile): MemberSelection {
  if (selection.leaderId === user.id) return { ...selection, leaderId: null };
  const isMember = selection.members.some((m) => m.id === user.id);
  return {
    members: isMember ? selection.members : [...selection.members, user],
    leaderId: user.id,
  };
}

/** 주어진 회원들을 스터디원에 추가한다(이미 있는 회원은 유지). */
export function addMembers(
  selection: MemberSelection,
  users: readonly UserProfile[],
): MemberSelection {
  const existing = new Set(selection.members.map((m) => m.id));
  return {
    ...selection,
    members: [...selection.members, ...users.filter((u) => !existing.has(u.id))],
  };
}

export function findLeader(selection: MemberSelection): UserProfile | null {
  return selection.members.find((m) => m.id === selection.leaderId) ?? null;
}

/** 주어진 기수에 속한 회원 id 목록. */
export function userIdsOfTerm(users: readonly UserProfile[], term: number): string[] {
  return users.filter((user) => user.term === term).map((user) => user.id);
}
