/**
 * 동아리원 관리 API 호출. 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 */
import { api, withQuery } from '@/shared/api/client';

import type { ClubMemberCreateRequest, ClubMemberUpdateRequest } from '../model/dto';
import type { ClubMember, ClubMemberTermPage, ClubMemberTermScope } from '../model/types';

const clubMemberPath = (memberId: string) => `/api/v1/club-members/${encodeURIComponent(memberId)}`;

export function fetchClubMembers(): Promise<ClubMember[]> {
  return api.get('/api/v1/club-members');
}

/**
 * 활동기수·수료기수 목록이나 부문 명단의 한 기수를 읽는다.
 * scope에 status·track 중 하나는 있어야 한다. term을 빼면 조건에 맞는 가장 최근 기수다.
 */
export function fetchClubMembersByTerm(
  scope: ClubMemberTermScope,
  term?: number,
): Promise<ClubMemberTermPage> {
  return api.get(
    withQuery('/api/v1/club-members/by-term', {
      status: scope.status,
      track: scope.track,
      term,
    }),
  );
}

/** 동아리원을 추가한다. 역할은 일반 회원으로 시작한다. */
export function createClubMember(request: ClubMemberCreateRequest): Promise<ClubMember> {
  return api.post('/api/v1/club-members', request);
}

/**
 * 동아리원을 탈퇴 처리한다(DELETE). 행은 지우지 않고 활동 상태만 탈퇴로 바뀌며, 바뀐 동아리원을 돌려준다.
 * 반기 명단·팀 소속·출결 기록은 그대로 남는다. 운영진이거나 이미 탈퇴했으면 409로 거절된다.
 */
export function withdrawClubMember(memberId: string): Promise<ClubMember> {
  return api.delete(clubMemberPath(memberId));
}

/** 보낸 값만 바뀐다. */
export function updateClubMember(
  memberId: string,
  request: ClubMemberUpdateRequest,
): Promise<ClubMember> {
  return api.patch(clubMemberPath(memberId), request);
}
