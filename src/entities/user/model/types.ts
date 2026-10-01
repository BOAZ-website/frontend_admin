export type UserRole = 'TEAM' | 'HOST' | 'CONTENT_ADMIN' | 'SUPER';

export type UserTrack = '분석' | '시각화' | '엔지니어링';

/** DB User 테이블에서 스터디장 선택 등에 필요한 최소 프로필. */
export interface UserProfile {
  id: string;
  name: string;
  term: number;
  track: UserTrack;
  affiliation?: string;
  email?: string;
  phone?: string;
}
