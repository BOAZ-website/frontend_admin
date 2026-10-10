/** HOST 계정 생성(POST)·수정(PATCH) 요청. 수정은 보낸 값만 바뀐다. */
export interface HostUpsertRequest {
  /** 생성 시 필수. */
  username?: string;
  initialPassword?: string;
  /** 계정 주인인 users.id. */
  userId?: string;
  hostName?: string;
  generation?: string;
  track?: string;
  role?: string;
  accountType?: 'STUDY' | 'ADV';
  /** 담당 팀(teams.id). 빈 문자열이나 null이면 해제. */
  teamId?: string | null;
  permissions?: ('ADV' | 'STUDY')[];
  /** 맡은 그룹(teams.id 목록). */
  assignedTeamIds?: string[];
  concurrentRoles?: string[];
  active?: boolean;
  /** true면 계정 주인을 담당 팀의 팀장으로 연결한다. */
  linkLeader?: boolean;
}

export interface HostListQuery {
  active?: boolean;
  permission?: 'ADV' | 'STUDY';
  teamId?: string;
}
