export type UserRole = 'TEAM' | 'HOST' | 'CONTENT_ADMIN' | 'SUPER';

export type UserTrack = '분석' | '시각화' | '엔지니어링';
export type OAuthProvider = 'KAKAO' | 'GOOGLE' | 'NAVER';
export type MemberType = 'OUTSIDER' | 'MEMBER';
export type MilitaryStatus = 'COMPLETED_OR_EXEMPT' | 'NOT_COMPLETED';

/** DB User 테이블에서 스터디장 선택 등에 필요한 최소 프로필. */
export interface UserProfile {
  id: string;
  provider?: OAuthProvider;
  provider_id?: string;
  nickname?: string;
  member_type?: MemberType;
  name: string;
  term: number;
  track: UserTrack;
  affiliation?: string;
  email?: string;
  phone?: string;
  university?: string;
  major?: string;
  minor_double_major?: unknown;
  last_semester?: number;
  military_status?: MilitaryStatus;
  birth_date?: string;
  graduation_date?: string;
  grad_school_plan?: boolean;
  created_at?: string;
  updated_at?: string;
}
