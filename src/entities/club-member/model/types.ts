import type { UserTrack } from '@/entities/user/model/types';

export type ClubMemberTrack = UserTrack;
/**
 * 동아리원 활동 상태 코드와 화면 이름. 값은 백엔드 member.status와 같다(2026-11-05 협의).
 * 상태를 더하거나 이름을 바꿀 때는 이 표 한 곳만 고친다.
 */
export const CLUB_MEMBER_STATUS_LABELS = {
  ACTIVE: '활동기수',
  COMPLETED: '수료',
  NOT_COMPLETED: '미수료',
  WITHDRAWN: '탈동',
} as const;
/** 활동 상태 코드. */
export type ClubMemberStatus = keyof typeof CLUB_MEMBER_STATUS_LABELS;
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
   * 동아리원 관리에서 정하면 운영진 계정 관리의 운영진 명단에 그대로 반영된다(새 운영진은 이때 계정도 함께 만든다).
   */
  operatorTeam: string | null;
  /**
   * 현재 반기에 팀장을 맡은 팀 이름(여러 개면 ', '로 이음). 없으면 null.
   * 현재 반기 팀장은 탈동 처리할 수 없다(출결 화면에서 팀장을 바꾼 뒤 탈동한다). 지난 반기 팀장은 막지 않는다.
   */
  leaderTeams: string | null;
  /**
   * 연결된 HOST 계정 아이디(여러 개면 ', '로 이음). 없으면 null.
   * HOST 계정이 있으면 탈동 처리할 수 없다(그룹 계정 관리에서 계정을 먼저 삭제한다).
   */
  hostUsernames: string | null;
}

export const CLUB_MEMBER_TRACKS: readonly ClubMemberTrack[] = ['분석', '시각화', '엔지니어링'];
/** 활동 상태 코드 전체(화면 선택지 순서). */
export const CLUB_MEMBER_STATUSES: readonly ClubMemberStatus[] = [
  'ACTIVE',
  'COMPLETED',
  'NOT_COMPLETED',
  'WITHDRAWN',
];

/** 활동을 마치지 못하고 나간 상태(미수료·탈동). 탈동 명단에 함께 보이고, 기수 페이지·부문 명단에서는 빠진다. */
export const LEFT_CLUB_STATUSES: readonly ClubMemberStatus[] = ['NOT_COMPLETED', 'WITHDRAWN'];

/** 미수료·탈동처럼 활동을 마치지 못하고 나간 상태인지. */
export const isLeftClubStatus = (status: ClubMemberStatus): boolean =>
  LEFT_CLUB_STATUSES.includes(status);

/**
 * 이름·기수·부문을 고칠 수 없는 상태인지(활동기수). 부문은 서류 평가 범위와 이어져 있어,
 * 활동 중에는 화면에서 고치지 않고 필요하면 DB에서 직접 고친다(2026-11-05 협의).
 */
export const isIdentityLockedStatus = (status: ClubMemberStatus): boolean => status === 'ACTIVE';
export const CLUB_MEMBER_ROLES: readonly ClubMemberRole[] = ['MEMBER', 'OPERATOR', 'PRESIDENT'];

/** 기수 하나씩 페이지로 나눠 읽는 활동 상태: 활동기수 목록(ACTIVE)·수료기수 목록(COMPLETED). */
export type ClubMemberPagedStatus = Exclude<ClubMemberStatus, 'WITHDRAWN' | 'NOT_COMPLETED'>;
export const CLUB_MEMBER_PAGED_STATUSES: readonly ClubMemberPagedStatus[] = ['ACTIVE', 'COMPLETED'];

/**
 * GET /api/v1/club-members/by-term 의 조건. status·track 둘 다 선택이지만 둘 중 하나는 있어야 한다.
 * - status만: 활동기수 목록(ACTIVE)·수료기수 목록(COMPLETED).
 * - track만: 그 부문 명단(활동·수료인 사람, 탈동은 빠진다).
 * - 둘 다: 두 조건을 모두 만족하는 사람.
 */
export interface ClubMemberTermScope {
  status?: ClubMemberPagedStatus;
  track?: ClubMemberTrack;
}

/**
 * GET /api/v1/club-members/by-term 응답. 한 페이지 = 한 기수.
 * 활동기수·수료기수 목록과 부문 명단이 함께 쓴다.
 */
export interface ClubMemberTermPage {
  /** 보낸 활동 상태. 안 보냈으면 null(활동·수료 둘 다). */
  status: ClubMemberPagedStatus | null;
  /** 보낸 부문. 안 보냈으면 null(모든 부문). */
  track: ClubMemberTrack | null;
  /** 이 페이지의 기수. 조건에 맞는 사람이 아무도 없고 term도 안 보냈으면 null. */
  term: number | null;
  /** 조건에 맞는 사람이 있는 기수 전체, 큰 기수부터(페이지 목록). */
  terms: number[];
  /**
   * 그 기수에서 조건에 맞는 사람. 활동 상태(활동 → 수료) → 부문(분석 → 시각화 → 엔지니어링) → 이름 → id 순.
   * 보낸 기수에 조건에 맞는 사람이 없으면 빈 배열이다(탈동 처리 직후 빈 페이지가 될 수 있다).
   */
  members: ClubMember[];
}

export const ROLE_LABELS: Record<ClubMemberRole, string> = {
  MEMBER: '일반 회원',
  OPERATOR: '운영진',
  PRESIDENT: '대표진',
};
