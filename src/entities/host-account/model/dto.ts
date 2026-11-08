/** HOST 계정 발급(POST /api/v1/hosts). 계정 주인은 그 팀의 현재 팀장으로 서버가 정한다. */
export interface HostIssueRequest {
  teamId: string;
  username: string;
  /** 운영지원팀이 정한 초기 비밀번호. 응답에는 담기지 않는다. */
  password: string;
}

/** HOST 계정 발급 응답. */
export interface HostIssueResponse {
  /** admin.id */
  id: number;
  userId: string;
  username: string;
}
