/**
 * 로그인 세션(POST /api/v1/auth/login 응답). 운영진 계정(admin)과 HOST 계정(host_accounts)이 같은 모양으로 온다.
 * 비밀번호는 담지 않는다.
 */
export interface AuthSession {
  /** 운영진 계정이면 ADMIN, 스터디장·ADV 팀장 계정이면 HOST. */
  kind: 'ADMIN' | 'HOST';
  /** 화면에 보일 이름(계정 주인 회원 이름). */
  name: string;
  username: string;
  /** 운영진은 admin.role(MASTER·SUPER·TEAM), HOST 계정은 'HOST'. */
  role: 'MASTER' | 'SUPER' | 'TEAM' | 'HOST';
  /** 운영진의 팀(자리). HOST 계정은 null. */
  teamName: string | null;
  /** 운영진 계정 id. HOST 계정은 null. */
  accountId: number | null;
  /** HOST 계정 id. 운영진 계정은 null. */
  hostId: string | null;
  /** HOST가 맡은 첫 그룹의 팀 id(HOST 진입 화면용). 운영진이거나 맡은 팀이 없으면 null. */
  hostTeamId: string | null;
}

/** POST /api/v1/auth/login 요청. */
export interface LoginRequest {
  username: string;
  password: string;
}
