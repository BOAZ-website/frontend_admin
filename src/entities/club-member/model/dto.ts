import type { ClubMember } from './types';

/** 동아리원 정보 수정 팝업의 입력값. 동아리원 행에서 id만 뺀 값이다. */
export type ClubMemberForm = Omit<ClubMember, 'id'>;

/** 동아리원 수정(PATCH) 요청. 보낸 값만 바뀐다. 동아리원 등록은 합격자 승격으로 하므로 등록 요청은 없다. */
export type ClubMemberUpdateRequest = Partial<ClubMemberForm>;
