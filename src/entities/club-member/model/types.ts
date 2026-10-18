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
  /** 대학교. 기록이 없으면 빈 문자열. */
  university: string;
  /** 전공. 기록이 없으면 빈 문자열. */
  major: string;
  /** 기수 (예: 28) */
  term: number;
  track: ClubMemberTrack;
  status: ClubMemberStatus;
  role: ClubMemberRole;
  /**
   * 운영진 팀(운영진 명단의 소속 팀). 운영진이 아니면 null.
   * 동아리원 관리에서 정하면 운영진 계정 관리의 운영진 명단에 그대로 반영된다(계정은 그 화면에서 발급).
   */
  operatorTeam: string | null;
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
