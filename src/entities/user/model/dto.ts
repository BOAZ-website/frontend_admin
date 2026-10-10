import type { UserProfile } from './types';

export interface UserListQuery {
  /** 반기 표기. 생략하면 현재 반기의 출결 회원 명단을 조회한다. */
  semester?: string;
  /** 이름이 정확히 같은 회원. */
  name?: string;
  /** 이름 일부. */
  keyword?: string;
  term?: number;
  track?: string;
}

export interface UserVerifyResponse {
  name: string;
  registered: boolean;
  /** 동명이인이면 여러 명. */
  matches: UserProfile[];
}
