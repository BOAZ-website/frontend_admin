/**
 * 한 명의 운영진 지정(PUT /api/v1/admin/operators/:userId). teamName이 null이면 운영진에서 뺀다.
 * 운영진이 아닌 회원을 팀으로 정할 때는 username·password가 필수다(그 값으로 계정을 만든다).
 * 이미 운영진이면 teamName이 다를 때 팀을 옮기고, username이 지금 아이디와 다르면 아이디를 바꾸며
 * (빈 값은 400, 다른 계정과 겹치면 409), password를 보내면 비밀번호를 바꾼다.
 */
export interface OperatorAssignRequest {
  teamName: string | null;
  username?: string;
  password?: string;
}

/** 비밀번호 변경(PATCH .../password). 본인 계정이면 현재 비밀번호가 필요하다. */
export interface AdminPasswordRequest {
  newPassword: string;
  currentPassword?: string;
}

/** 계정별 권한 저장(PUT .../permissions). 체크된 최종 집합을 보내고 기본 세트와의 차이는 서버가 계산한다. */
export interface AdminPermissionsRequest {
  permissions: string[];
}

/** 팀 운영진 일괄 지정(PUT /operator-teams/:teamName). 동아리원 명단 화면을 바꾸기 전(#30)까지만 남겨 둔다. */
export interface OperatorTeamRequest {
  userIds: string[];
}
