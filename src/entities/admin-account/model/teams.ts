/**
 * 운영진 팀(자리) 규칙. 팀 이름 상수와 화면 순서·묶음 규칙을 이 파일 한 곳에 둔다.
 * 기본 권한 세트 규칙(permissions.ts), 임시 API, 동아리원 명단·권한 관리 화면이 모두 여기서 가져다 쓴다.
 * 고를 수 있는 팀 목록(코드의 ADMIN_TEAM_NAMES + DB에 있는 팀)은 서버가 합쳐서 권한 카탈로그로 준다.
 */

/** 대표진. 팀장을 두지 않는다. */
export const PRESIDENT_TEAM = '대표진';

/** 차기대표진. 팀이 아니라 대표진 안의 자리지만 권한 세트(서류 평가 범위)가 달라 데이터에서는 따로 둔다. */
export const NEXT_PRESIDENT_TEAM = '차기대표진';

/** 서비스운영팀. 서비스운영팀장(MASTER)이 있는 팀이고, 이 팀의 TEAM 계정은 콘텐츠 관리자로 들어간다. */
export const SERVICE_OPERATIONS_TEAM = '서비스운영팀';

/** 운영지원팀. 출결 운영 권한을 받는 팀이다. */
export const OPERATIONS_SUPPORT_TEAM = '운영지원팀';

/** 목록 맨 위에 이 순서로 고정하는 팀. 나머지는 가나다순이다. */
export const PINNED_TEAMS: readonly string[] = [PRESIDENT_TEAM, NEXT_PRESIDENT_TEAM];

/** 팀장을 두지 않는 팀. */
export const TEAMS_WITHOUT_LEAD: readonly string[] = [PRESIDENT_TEAM, NEXT_PRESIDENT_TEAM];

/** 화면 목록에서 묶는 팀. 차기대표진은 화면에서 대표진 팀 안에 함께 보인다. */
export const displayTeamOf = (teamName: string): string =>
  teamName === NEXT_PRESIDENT_TEAM ? PRESIDENT_TEAM : teamName;

const pinnedRankOf = (teamName: string): number => {
  const index = PINNED_TEAMS.indexOf(teamName);
  return index === -1 ? PINNED_TEAMS.length : index;
};

/** 팀 이름 순서(고정 팀 → 가나다순). Array.prototype.sort에 넘긴다. */
export const compareTeamNames = (a: string, b: string): number =>
  pinnedRankOf(a) - pinnedRankOf(b) || a.localeCompare(b, 'ko');
