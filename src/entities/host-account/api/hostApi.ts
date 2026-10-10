/**
 * HOST 계정 API 호출. 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 */
import type { TeamDto } from '@/entities/study-team/model/dto';
import { api, withQuery } from '@/shared/api/client';

import type { HostListQuery, HostUpsertRequest } from '../model/dto';
import type { HostAccount } from '../model/types';

const hostPath = (hostId: string) => `/api/v1/hosts/${encodeURIComponent(hostId)}`;

export function fetchHosts(query: HostListQuery = {}): Promise<HostAccount[]> {
  return api.get(withQuery('/api/v1/hosts', { ...query }));
}

export function fetchHost(hostId: string): Promise<HostAccount> {
  return api.get(hostPath(hostId));
}

/** HOST가 출결을 입력할 수 있는 팀(담당 팀 + 맡은 그룹 중 권한이 있는 팀). */
export function fetchHostTeams(hostId: string): Promise<TeamDto[]> {
  return api.get(`${hostPath(hostId)}/teams`);
}

export function createHost(
  request: HostUpsertRequest & { username: string },
): Promise<HostAccount> {
  return api.post('/api/v1/hosts', request);
}

export function deleteHost(hostId: string): Promise<{ deleted: string }> {
  return api.delete(hostPath(hostId));
}

/** 보낸 값만 바뀐다. active로 활성화·비활성화, linkLeader로 팀장 연결. */
export function updateHost(hostId: string, request: HostUpsertRequest): Promise<HostAccount> {
  return api.patch(hostPath(hostId), request);
}
