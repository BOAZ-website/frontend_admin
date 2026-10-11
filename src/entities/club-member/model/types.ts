import type { UserTrack } from '@/entities/user/model/types';

export type ClubMemberTrack = UserTrack;
export type ClubMemberStatus = 'ACTIVE' | 'ALUMNI' | 'INACTIVE';
export type ClubMemberRole = 'MEMBER' | 'OPERATOR' | 'PRESIDENT';

/** 동아리원 관리 화면의 한 행. 임시 DB의 users 테이블 한 행에서 읽는다(id = users.id). */
export interface ClubMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** 기수 (예: 28) */
  term: number;
  track: ClubMemberTrack;
  status: ClubMemberStatus;
  role: ClubMemberRole;
  /** 동아리 가입일(YYYY-MM-DD). 기록이 없으면 빈 문자열. */
  joinedAt: string;
}

export const CLUB_MEMBER_TRACKS: readonly ClubMemberTrack[] = ['분석', '시각화', '엔지니어링'];
export const CLUB_MEMBER_STATUSES: readonly ClubMemberStatus[] = ['ACTIVE', 'ALUMNI', 'INACTIVE'];
export const CLUB_MEMBER_ROLES: readonly ClubMemberRole[] = ['MEMBER', 'OPERATOR', 'PRESIDENT'];

export const STATUS_LABELS: Record<ClubMemberStatus, string> = {
  ACTIVE: '활동 중',
  ALUMNI: '수료',
  INACTIVE: '비활동',
};

export const ROLE_LABELS: Record<ClubMemberRole, string> = {
  MEMBER: '일반 회원',
  OPERATOR: '운영진',
  PRESIDENT: '대표진',
};
