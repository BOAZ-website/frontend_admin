import type { ClubMember } from './types';

/** 탈퇴 처리를 막는 사유 하나. code는 임시 API의 409 오류 코드다. */
export interface WithdrawBlock {
  code: 'MEMBER_IS_OPERATOR' | 'MEMBER_HAS_HOST_ACCOUNT' | 'MEMBER_IS_TEAM_LEADER';
  /** 왜 안 되는지와 먼저 할 일. */
  message: string;
}

/**
 * 탈퇴 처리를 막는 사유 목록(없으면 빈 배열). 화면(버튼을 눌렀을 때 안내)과 임시 API(409)가 같은 규칙을 쓴다.
 * 로그인 계정이 있는 사람은 계정을 먼저 해지해야 탈퇴할 수 있다. 지난 반기 팀장은 막지 않는다.
 */
export function withdrawBlocksOf(
  member: Pick<ClubMember, 'operatorTeam' | 'hostUsernames' | 'leaderTeams'>,
): WithdrawBlock[] {
  const blocks: WithdrawBlock[] = [];
  if (member.operatorTeam) {
    blocks.push({
      code: 'MEMBER_IS_OPERATOR',
      message: `운영진(${member.operatorTeam})입니다. 정보 수정에서 운영진을 '없음'으로 바꿔 운영진 계정을 먼저 해지해 주세요.`,
    });
  }
  if (member.hostUsernames) {
    blocks.push({
      code: 'MEMBER_HAS_HOST_ACCOUNT',
      message: `HOST 계정(${member.hostUsernames})이 있습니다. 출결의 그룹 계정 관리에서 계정을 먼저 삭제해 주세요.`,
    });
  }
  if (member.leaderTeams) {
    blocks.push({
      code: 'MEMBER_IS_TEAM_LEADER',
      message: `현재 반기 ${member.leaderTeams}의 팀장입니다. 출결 화면에서 팀장을 먼저 바꿔 주세요.`,
    });
  }
  return blocks;
}

/** 막는 사유를 한 번에 보여 줄 안내문. 사유가 없으면 null. */
export function withdrawBlockMessageOf(
  name: string,
  blocks: readonly WithdrawBlock[],
): string | null {
  if (blocks.length === 0) return null;
  const lines = blocks.map((block) => `- ${block.message}`);
  return [`${name}님은 아래 이유로 탈퇴 처리할 수 없습니다.`, ...lines].join('\n');
}
