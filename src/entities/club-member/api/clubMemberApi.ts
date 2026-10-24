/**
 * 동아리원 관리 API 호출. 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 */
import { api } from '@/shared/api/client';

import type { ClubMemberCreateRequest, ClubMemberUpdateRequest } from '../model/dto';
import type { ClubMember } from '../model/types';

const clubMemberPath = (memberId: string) => `/api/v1/club-members/${encodeURIComponent(memberId)}`;

export function fetchClubMembers(): Promise<ClubMember[]> {
  return api.get('/api/v1/club-members');
}

/** 동아리원을 추가한다. 역할은 일반 회원으로 시작한다. */
export function createClubMember(request: ClubMemberCreateRequest): Promise<ClubMember> {
  return api.post('/api/v1/club-members', request);
}

/** 동아리원을 지운다. 반기 명단·팀 소속·출결 기록도 함께 지워진다. 운영진이면 409로 거절된다. */
export function deleteClubMember(memberId: string): Promise<void> {
  return api.delete(clubMemberPath(memberId));
}

/** 보낸 값만 바뀐다. */
export function updateClubMember(
  memberId: string,
  request: ClubMemberUpdateRequest,
): Promise<ClubMember> {
  return api.patch(clubMemberPath(memberId), request);
}
