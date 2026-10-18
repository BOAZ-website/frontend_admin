import type { AdminRole } from './types';

/**
 * 운영진 계정 발급(POST /api/v1/admin/accounts). 계정 주인은 회원(userId)으로 고르며,
 * 이름·기수·부문은 회원 정보를 쓰므로 보내지 않는다.
 */
export interface AdminAccountCreateRequest {
  userId: string;
  /** 아이디·초기 비밀번호는 함께 보내거나 함께 뺀다. 빼면 운영진으로만 정하고 계정은 나중에 발급한다. */
  username?: string;
  password?: string;
  role: AdminRole;
  teamName: string;
}

/** 계정 발급(PUT .../credentials). 운영진으로 정해졌지만 아이디가 없는 사람에게 아이디·초기 비밀번호를 준다. */
export interface AdminCredentialsRequest {
  username: string;
  password: string;
}

/**
 * 운영진 계정 수정(PATCH). 보낸 값만 바뀐다. 이름·기수·부문은 동아리원 관리에서 고친다.
 * 본인 계정은 역할·부서를 바꿀 수 없다.
 */
export type AdminAccountUpdateRequest = Partial<
  Pick<AdminAccountCreateRequest, 'role' | 'teamName'>
>;

/** 비밀번호 변경(PATCH .../password). 본인 계정이면 현재 비밀번호가 필요하다. */
export interface AdminPasswordRequest {
  newPassword: string;
  currentPassword?: string;
}

/** 계정별 권한 저장(PUT .../permissions). 체크된 최종 집합을 보내고 기본 세트와의 차이는 서버가 계산한다. */
export interface AdminPermissionsRequest {
  permissions: string[];
}
