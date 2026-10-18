/**
 * 운영진 계정 관리·계정별 권한 관리가 같이 쓰는 팀·사람 순서.
 * 팀: 대표진(차기대표진 포함)을 맨 위에 고정하고, 나머지는 가나다순이다.
 * 팀 안의 사람: 팀장이 맨 위, 그다음 기수가 낮은 사람, 같은 기수 안에서는 부문 순(분석 → 시각화 → 엔지니어링)이다.
 */

/** 목록 맨 위에 고정하는 팀. 나머지는 가나다순이다. */
const PINNED_TEAMS: readonly string[] = ['대표진'];

/** 팀장을 두지 않는 팀. 차기대표진은 화면에서 대표진에 묶이므로 목록에 따로 나오지 않는다. */
export const TEAMS_WITHOUT_LEAD: readonly string[] = ['대표진', '차기대표진'];

const TRACK_ORDER: readonly string[] = ['분석', '시각화', '엔지니어링'];

/** 목록에 없으면 맨 뒤로 보내는 순위. */
const rankIn = (order: readonly string[], value: string): number => {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
};

/**
 * 화면 목록에서 묶는 팀. 차기대표진은 권한 세트(서류 평가 범위)가 달라 데이터에서는 따로 두지만,
 * 화면에서는 대표진 팀 안에 함께 보인다.
 */
export const displayTeamOf = (teamName: string): string =>
  teamName === '차기대표진' ? '대표진' : teamName;

/** 화면 목록의 팀 이름(displayTeamOf로 묶은 이름)을 화면 순서로 정렬한 새 배열. 같은 이름은 하나만 남긴다. */
export const sortTeamNames = (teamNames: Iterable<string>): string[] =>
  [...new Set([...teamNames].map(displayTeamOf))].sort(
    (a, b) => rankIn(PINNED_TEAMS, a) - rankIn(PINNED_TEAMS, b) || a.localeCompare(b, 'ko'),
  );

interface MemberOrderFields {
  isTeamLead: boolean;
  term: number;
  track: string;
}

/** 팀 안의 사람 순서. Array.prototype.sort에 넘긴다. */
export const byLeadThenTermThenTrack = (a: MemberOrderFields, b: MemberOrderFields): number =>
  Number(b.isTeamLead) - Number(a.isTeamLead) ||
  a.term - b.term ||
  rankIn(TRACK_ORDER, a.track) - rankIn(TRACK_ORDER, b.track);
