import type { ClubMember } from './types';

/** 동아리원 등록(POST) 요청. joinedAt은 YYYY-MM-DD. */
export type ClubMemberCreateRequest = Omit<ClubMember, 'id'>;

/** 동아리원 수정(PATCH) 요청. 보낸 값만 바뀐다. */
export type ClubMemberUpdateRequest = Partial<ClubMemberCreateRequest>;
