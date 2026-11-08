/**
 * HOST 계정 API 호출. 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 * 비밀번호 초기화는 운영진 계정과 같은 API(changeAdminPassword)를 쓴다.
 */
import { api } from '@/shared/api/client';

import type { HostIssueRequest, HostIssueResponse } from '../model/dto';
import type { GroupLeaderAccount } from '../model/types';

/** 진행 중인 그룹마다 현재 팀장과 그 계정(그룹 계정 관리 표). */
export function fetchGroupLeaderAccounts(): Promise<GroupLeaderAccount[]> {
  return api.get('/api/v1/hosts');
}

/** 계정이 없는 팀장에게 HOST 계정을 발급한다. */
export function issueHostAccount(request: HostIssueRequest): Promise<HostIssueResponse> {
  return api.post('/api/v1/hosts', request);
}
