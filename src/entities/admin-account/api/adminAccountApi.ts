/**
 * 운영진 계정 API 호출. 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 * 경로는 백엔드 AdminController 기준이며, 권한 커스텀·카탈로그 응답 형태는 백엔드와 협의가 필요하다.
 */
import { api } from '@/shared/api/client';

import type {
  AdminAccountCreateRequest,
  AdminAccountUpdateRequest,
  AdminCredentialsRequest,
  AdminPasswordRequest,
  OperatorAssignRequest,
  OperatorTeamRequest,
  AdminPermissionsRequest,
} from '../model/dto';
import type { AccountHolder, AdminAccount, PermissionCatalog } from '../model/types';

const accountPath = (accountId: number) => `/api/v1/admin/accounts/${accountId}`;

/** 계정을 가진 사람 전체(운영진 계정 + HOST 계정). 계정별 권한 관리 탭의 목록에 쓴다. */
export function fetchAccountHolders(): Promise<AccountHolder[]> {
  return api.get('/api/v1/admin/account-holders');
}

export function fetchMyAccount(): Promise<AdminAccount> {
  return api.get('/api/v1/admin/accounts/me');
}

export function fetchAdminAccounts(): Promise<AdminAccount[]> {
  return api.get('/api/v1/admin/accounts');
}

export function createAdminAccount(request: AdminAccountCreateRequest): Promise<AdminAccount> {
  return api.post('/api/v1/admin/accounts', request);
}

/** 보낸 값만 바뀐다. 역할·부서가 바뀌면 그 계정의 권한 예외는 모두 지워진다. */
export function updateAdminAccount(
  accountId: number,
  request: AdminAccountUpdateRequest,
): Promise<AdminAccount> {
  return api.patch(accountPath(accountId), request);
}

/**
 * 팀 운영진 일괄 지정. 이 팀 운영진을 보낸 회원들로 맞춘다: 새 회원은 계정 발급 전 상태로 더하고,
 * 다른 팀 운영진은 이 팀으로 옮기고, 목록에서 빠진 이 팀 운영진은 운영진에서 뺀다(계정이 있으면 함께 삭제).
 */
export function setOperatorTeamMembers(
  teamName: string,
  request: OperatorTeamRequest,
): Promise<AdminAccount[]> {
  return api.put(`/api/v1/admin/operator-teams/${encodeURIComponent(teamName)}`, request);
}

/** 한 명의 운영진 팀을 정하거나(teamName), 운영진에서 뺀다(null). */
export function assignOperator(userId: string, request: OperatorAssignRequest): Promise<void> {
  return api.put(`/api/v1/admin/operators/${encodeURIComponent(userId)}`, request);
}

/** 아이디가 없는 운영진에게 계정(아이디·초기 비밀번호)을 발급한다. 이미 있으면 409. */
export function issueAdminCredentials(
  accountId: number,
  request: AdminCredentialsRequest,
): Promise<AdminAccount> {
  return api.put(`${accountPath(accountId)}/credentials`, request);
}

export function changeAdminPassword(
  accountId: number,
  request: AdminPasswordRequest,
): Promise<void> {
  return api.patch(`${accountPath(accountId)}/password`, request);
}

export function deleteAdminAccount(accountId: number): Promise<void> {
  return api.delete(accountPath(accountId));
}

export function fetchPermissionCatalog(): Promise<PermissionCatalog> {
  return api.get('/api/v1/admin/permissions');
}

/** 체크된 최종 권한 집합을 보낸다. 기본 세트와의 차이 계산은 서버가 한다. */
export function saveAccountPermissions(
  accountId: number,
  request: AdminPermissionsRequest,
): Promise<AdminAccount> {
  return api.put(`${accountPath(accountId)}/permissions`, request);
}
