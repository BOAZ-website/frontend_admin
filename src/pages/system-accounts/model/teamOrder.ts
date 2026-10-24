import { compareTeamNames, displayTeamOf } from '@/entities/admin-account/model/teams';
import { CLUB_MEMBER_TRACKS } from '@/entities/club-member/model/types';

/**
 * 권한 관리 화면의 팀·사람 순서. 팀 이름 규칙(고정 팀, 차기대표진 묶기)은 entities의 teams.ts를,
 * 부문 순서는 CLUB_MEMBER_TRACKS를 따른다.
 * 팀: 대표진(차기대표진 포함)을 맨 위에 고정하고, 나머지는 가나다순이다.
 * 팀 안의 사람: 팀장이 맨 위, 그다음 기수가 낮은 사람, 같은 기수 안에서는 부문 순이다.
 */

/** 목록에 없으면 맨 뒤로 보내는 부문 순위. */
const trackRankOf = (track: string): number => {
  const index = (CLUB_MEMBER_TRACKS as readonly string[]).indexOf(track);
  return index === -1 ? CLUB_MEMBER_TRACKS.length : index;
};

/** 화면 목록의 팀 이름(displayTeamOf로 묶은 이름)을 화면 순서로 정렬한 새 배열. 같은 이름은 하나만 남긴다. */
export const sortTeamNames = (teamNames: Iterable<string>): string[] =>
  [...new Set([...teamNames].map(displayTeamOf))].sort(compareTeamNames);

interface MemberOrderFields {
  isTeamLead: boolean;
  term: number;
  track: string;
}

/** 팀 안의 사람 순서. Array.prototype.sort에 넘긴다. */
export const byLeadThenTermThenTrack = (a: MemberOrderFields, b: MemberOrderFields): number =>
  Number(b.isTeamLead) - Number(a.isTeamLead) ||
  a.term - b.term ||
  trackRankOf(a.track) - trackRankOf(b.track);
