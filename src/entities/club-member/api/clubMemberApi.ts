/**
 * 동아리원 관리 API 호출. 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 */
import { api } from '@/shared/api/client';

import type { ClubMemberUpdateRequest } from '../model/dto';
import type { ClubMember } from '../model/types';

const clubMemberPath = (memberId: string) => `/api/v1/club-members/${encodeURIComponent(memberId)}`;

export function fetchClubMembers(): Promise<ClubMember[]> {
  return api.get('/api/v1/club-members');
}

/** 보낸 값만 바뀐다. */
export function updateClubMember(
  memberId: string,
  request: ClubMemberUpdateRequest,
): Promise<ClubMember> {
  return api.patch(clubMemberPath(memberId), request);
}
