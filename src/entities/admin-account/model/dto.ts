import type { AdminRole } from './types';

/**
 * 운영진 계정 발급(POST /api/v1/admin/accounts). 계정 주인은 회원(userId)으로 고르며,
 * 이름·기수·부문은 회원 정보를 쓰므로 보내지 않는다.
 */
export interface AdminAccountCreateRequest {
  userId: string;
  username: string;
  password: string;
  role: AdminRole;
  teamName: string;
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
