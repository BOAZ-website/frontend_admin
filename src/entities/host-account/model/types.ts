/** 계정의 역할. 운영진(MASTER·SUPER·TEAM)이 팀장이면 HOST 계정을 따로 두지 않고 운영진 계정을 쓴다. */
export type LeaderAccountRole = 'MASTER' | 'SUPER' | 'TEAM' | 'HOST';

/** 팀장의 로그인 계정. 비밀번호는 담지 않는다. */
export interface LeaderAccount {
  /** admin.id */
  id: number;
  username: string;
  role: LeaderAccountRole;
}

/**
 * 그룹 계정 관리 표의 한 행(GET /api/v1/hosts). 진행 중인 그룹 하나와 그 현재 팀장, 팀장의 계정이다.
 * 계정은 사람(회원)에 묶여 있어 팀장이 바뀌면 새 팀장 본인의 계정이 보인다(설계문서 2026-11-06판 2.1·9.1).
 */
export interface GroupLeaderAccount {
  /** teams.id */
  teamId: string;
  groupType: 'ADV' | 'STUDY';
  /** 현재 팀장(users.id) */
  leaderUserId: string;
  /** 팀장의 계정. 없으면 null이고 표에 "발급 필요"로 보인다. */
  account: LeaderAccount | null;
}
