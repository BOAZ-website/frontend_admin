/**
 * 로그인 세션(POST /api/v1/auth/login 응답). 운영진 계정과 HOST 계정이 모두 admin 표에 있어 같은 모양으로 온다.
 * 비밀번호는 담지 않는다.
 */
export interface AuthSession {
  /** 운영진 계정이면 ADMIN, 스터디장·ADV 팀장 계정(role = HOST)이면 HOST. */
  kind: 'ADMIN' | 'HOST';
  /** 화면에 보일 이름(계정 주인 회원 이름). */
  name: string;
  username: string;
  /** admin.role. 운영진은 MASTER·SUPER·TEAM, 스터디장·ADV 팀장은 HOST. */
  role: 'MASTER' | 'SUPER' | 'TEAM' | 'HOST';
  /** 운영진의 팀(자리). HOST 계정은 null. */
  teamName: string | null;
  /** 계정 id(admin.id). */
  accountId: number;
  /** 계정 주인이 지금 팀장인 현재 반기 ADV 팀·스터디(teams.id). HOST 진입 화면과 출결 입력 탭이 쓴다. */
  leaderTeamIds: string[];
}

/** POST /api/v1/auth/login 요청. */
export interface LoginRequest {
  username: string;
  password: string;
}
