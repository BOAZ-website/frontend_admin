import type { ClubMember } from './types';

/**
 * 동아리원 정보 수정 팝업의 입력값. 동아리원 행에서 id, 운영진 팀(운영진 지정에서 바꿈),
 * 팀장인 팀(출결 화면에서 바꿈)을 뺀 값이다.
 */
export type ClubMemberForm = Omit<ClubMember, 'id' | 'operatorTeam' | 'leaderTeams'>;

/** 동아리원 수정(PATCH) 요청. 보낸 값만 바뀐다. */
export type ClubMemberUpdateRequest = Partial<ClubMemberForm>;

/**
 * 동아리원 추가(POST) 요청. 합격자 승격을 거치지 않은 사람(예: 예전 수료 기수)을 직접 넣을 때 쓴다.
 * 역할은 일반 회원으로 시작하고, 운영진은 동아리원 수정 팝업에서 운영진 팀을 골라 저장할 때(assignOperator) 정한다.
 */
export type ClubMemberCreateRequest = Omit<ClubMemberForm, 'role'>;
