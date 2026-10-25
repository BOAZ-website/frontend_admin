/**
 * 운영진 계정 API 호출. 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 * 경로는 백엔드 AdminController 기준이며, 권한 커스텀·카탈로그 응답 형태는 백엔드와 협의가 필요하다.
 */
import { api } from '@/shared/api/client';

import type {
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

/**
 * 팀 운영진 일괄 지정. 동아리원 명단 화면을 바꾸기 전(#30)까지만 남겨 둔다.
 */
export function setOperatorTeamMembers(
  teamName: string,
  request: OperatorTeamRequest,
): Promise<AdminAccount[]> {
  return api.put(`/api/v1/admin/operator-teams/${encodeURIComponent(teamName)}`, request);
}

/** 한 명의 운영진 팀을 정하거나(teamName), 운영진에서 뺀다(null). 새 운영진이면 아이디·초기 비밀번호를 함께 보낸다. */
export function assignOperator(userId: string, request: OperatorAssignRequest): Promise<void> {
  return api.put(`/api/v1/admin/operators/${encodeURIComponent(userId)}`, request);
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
