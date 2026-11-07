import type { ClubMember } from '@/entities/club-member/model/types';

/** 목록에 보일 사람: 활동기수 동아리원. 기수 큰 순·이름 순이고, 이미 운영진인 사람도 그 자리에 섞어 둔다. */
export const candidatesOf = (members: readonly ClubMember[]): ClubMember[] =>
  members
    .filter((member) => member.status === 'ACTIVE')
    .sort((a, b) => b.term - a.term || a.name.localeCompare(b.name, 'ko'));

/** 기수 칸의 글자('27', '27기')를 숫자로 읽는다. 비었으면 null, 숫자가 아니면 NaN. */
export const parseTerm = (text: string): number | null => {
  const trimmed = text.trim().replace(/기$/, '');
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
};

/** 이름·기수·부문 칸으로 목록을 거른다. 이름·부문은 글자 일부만 맞아도 되고, 기수는 같아야 한다. 빈 칸은 거르지 않는다. */
export const matchesFilter = (
  member: ClubMember,
  filter: { name: string; term: number | null; track: string },
): boolean =>
  member.name.includes(filter.name) &&
  (filter.term === null || member.term === filter.term) &&
  member.track.includes(filter.track);
