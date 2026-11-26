import { SERVICE_OPERATIONS_TEAM } from './teams';

/**
 * 내 계정 창의 이름 옆에 등급 코드(MASTER 등) 대신 보일 소속. 팀장 여부는 붙이지 않고 팀 이름만 쓴다.
 *   · MASTER: 서비스운영팀
 *   · SUPER·TEAM: 팀 이름(대표진, 기획팀 등)
 *   · HOST: 운영진 팀이 없으므로 그룹 리더
 * 팀이 필요한데 없으면 null.
 */
export function roleTitleOf(account: {
  role: 'MASTER' | 'SUPER' | 'TEAM' | 'HOST';
  teamName: string | null;
}): string | null {
  if (account.role === 'MASTER') return SERVICE_OPERATIONS_TEAM;
  if (account.role === 'HOST') return '그룹 리더';
  return account.teamName;
}
