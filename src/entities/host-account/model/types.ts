export type GroupType = 'ADV' | '스터디' | string;

export interface AssignedGroup {
  type: GroupType;
  teamName: string;
  /** DB의 팀 id(teams.id). 있으면 이름보다 이 값으로 팀을 가리킨다. */
  teamId?: string;
}

export interface HostAccount {
  id: string;
  /** 계정 주인인 users.id. 이름·기수·부문은 이 사용자의 프로필을 따른다. */
  userId?: string;
  username: string;
  initialPassword?: string;
  hostName?: string;
  generation?: string;
  track?: string;
  role?: '그룹리더' | string;
  team: string; // 담당 팀 이름(teams.team_name). 팀이 없으면 빈 문자열
  /** 담당 팀의 DB id(teams.id). 스터디·ADV 출결 화면이 쓰는 팀과 같은 팀을 가리킨다. */
  teamId?: string;
  groupType?: GroupType;
  assignedGroups?: AssignedGroup[];
  concurrentRoles?: string[];
  permissions?: ('ADV' | 'STUDY')[];
  createdAt: string;
  active: boolean;
  lastLogin?: string;
  accountType?: 'STUDY' | 'ADV';
}
