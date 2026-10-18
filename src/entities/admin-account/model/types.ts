import type {
  BaseSetColumn,
  BaseSetKey,
  BaseSetRule,
  LeadershipGroup,
  PermissionGroup,
  PermissionOverrides,
} from './permissions';

export const ADMIN_ROLES = ['MASTER', 'SUPER', 'TEAM'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

/**
 * 운영진 팀(자리) 목록. 새 팀이 생기면 여기에 더한다. 이름으로 정한 기본 권한 세트가 없는 팀은
 * 기타 운영진(TEAM 폴백) 권한을 받으므로 권한 표는 고치지 않는다.
 * 가나다순으로 둔다(계정 발급 팝업의 팀 선택 순서). 운영진 계정 관리의 팀 목록은 화면에서 따로 가나다순으로 정렬한다.
 * 차기대표진은 팀이 아니라 대표진 안의 자리지만, 권한 세트가 달라 따로 둔다.
 */
export const ADMIN_TEAM_NAMES = [
  '기획팀',
  '대외협력팀',
  '대표진',
  '디자인팀',
  '서비스운영팀',
  '운영지원팀',
  '자료연구팀',
  '차기대표진',
] as const;

/**
 * 운영진 계정의 응답(AdminAccountResponse 확장안). 권한 화면에 필요한 기본 권한 세트·맡은 그룹·예외·유효 권한을 함께 싣는다.
 * 백엔드는 이 중 유효 권한만 /me에 싣기로 했으므로(설계 §7.3) 나머지 필드는 협의가 필요하다.
 */
export interface AdminAccount {
  id: number;
  /** 계정 주인(회원) id. 운영진은 모두 회원이며 이름·기수·부문은 회원 정보에서 온다. */
  userId: string;
  /** 로그인 아이디. 운영진으로 정해졌지만 계정을 아직 발급하지 않았으면 null이다(백엔드 협의 필요). */
  username: string | null;
  /** 회원 이름(users.name). */
  name: string;
  role: AdminRole;
  /** 회원 부문(users.track). 예: '분석' */
  track: string;
  /** 회원 기수(users.term). */
  term: number;
  /** 운영진의 자리(대표진·서비스운영팀 등). 새 팀이 생길 수 있어 문자열이다. */
  teamName: string;
  /** 그 팀의 팀장인지. 대표진은 팀장을 두지 않는다. 권한과는 관계없고 표시에만 쓴다(백엔드 협의 필요). */
  isTeamLead: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  /** (role, teamName)의 기본 권한 세트. 정해지지 않은 조합이면 null(권한 0). */
  baseSetKey: BaseSetKey | null;
  /** 맡은 그룹의 종류. 출결 입력 권한(_OWN_GROUP_)이 여기서 계산된다. */
  leadership: LeadershipGroup[];
  /** 계정별 예외. true는 추가(GRANT), false는 제외(REVOKE). */
  overrides: PermissionOverrides;
  /** 기본 세트 − 제외 + 추가 + 맡은 그룹 파생. 화면은 이 목록으로 버튼·메뉴를 보이거나 숨긴다. */
  effectivePermissions: string[];
}

/**
 * 권한 카탈로그(GET /api/v1/admin/permissions). 권한 목록, 기본 권한 세트 열과 규칙, 운영진 팀 목록이다.
 * 화면은 권한 체크박스·매트릭스를 하드코딩하지 않고 이 응답으로 그린다(설계 §7.3).
 */
export interface PermissionCatalog {
  groups: PermissionGroup[];
  baseSets: BaseSetColumn[];
  rules: BaseSetRule[];
  /** 계정 발급·수정에서 고를 수 있는 운영진 팀. 새 팀은 여기에 더해진다. */
  teamNames: string[];
}

/** 이번 반기에 맡은 그룹(ADV 팀·스터디). 팀장(teams.leader_id)이 이 회원이면 들어간다. */
export interface LeaderGroup {
  teamId: string;
  name: string;
  groupType: 'ADV' | 'STUDY';
  /** 스터디만. MENTORING(멘멘)·GENERAL */
  studyKind: 'MENTORING' | 'GENERAL' | null;
}

/** 스터디장·ADV 팀장 로그인 계정(HOST). */
export interface HostLogin {
  id: string;
  username: string;
  active: boolean;
  lastLogin: string | null;
}

/**
 * 계정 통합 목록(GET /api/v1/admin/account-holders, 임시 API 전용 제안). 계정을 가진 사람 한 명이 한 행이다.
 * 운영진 계정(운영 권한)과 HOST 계정(맡은 그룹 출결 입력)을 회원 단위로 합친다.
 * 백엔드 설계(2026-10-16)는 두 계정을 admin 하나로 합치므로, 실서버에서는 응답 형태가 바뀔 수 있다.
 */
export interface AccountHolder {
  /** 회원 id(users.id). HOST 계정에 회원이 연결되지 않았으면 'host:{계정 id}' */
  key: string;
  userId: string | null;
  name: string;
  term: number | null;
  track: string | null;
  /** 운영진 계정. 없으면 운영 권한이 없다. */
  adminAccount: AdminAccount | null;
  hostLogins: HostLogin[];
  leaderGroups: LeaderGroup[];
}
