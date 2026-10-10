/**
 * 팀 API 호출(스터디·ADV·BASE). 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 * 요청은 shared/api/client가 서버(VITE_API_BASE_URL) 또는 임시 API로 보낸다.
 */
import { api, withQuery } from '@/shared/api/client';

import {
  type AddTeamMembersResponse,
  type BaseTrackCreateResponse,
  type CreateAdvTeamRequest,
  type CreateBaseTrackRequest,
  type CreateStudyRequest,
  type RemoveTeamMemberResponse,
  TEAM_API_PATHS,
  type TeamDetailResponse,
  type TeamDto,
  type TeamGroup,
  type TeamListQuery,
  type TeamListResponse,
  type UpdateTeamRequest,
} from '../model/dto';

const teamPath = (group: TeamGroup, teamId: string) =>
  `${TEAM_API_PATHS[group]}/${encodeURIComponent(teamId)}`;

/** 팀 목록 + 팀원 + 주차별 제출·출결 현황. */
export function fetchTeams(group: TeamGroup, query: TeamListQuery = {}): Promise<TeamListResponse> {
  return api.get(withQuery(TEAM_API_PATHS[group], { ...query }));
}

/** 팀 상세: 팀원과 주차별 출결 상태·사진·PDF·제출 여부. weekNum을 주면 그 주차만. */
export function fetchTeamDetail(
  group: TeamGroup,
  teamId: string,
  weekNum?: number,
): Promise<TeamDetailResponse> {
  return api.get(withQuery(teamPath(group, teamId), { weekNum }));
}

/** 스터디 생성(유형·부문·팀장·팀원 + 1~8주차 미정 출결 + 주차 날짜). */
export function createStudy(request: CreateStudyRequest): Promise<TeamDetailResponse> {
  return api.post(TEAM_API_PATHS.STUDY, request);
}

/** ADV 팀 생성(기수 생략 시 다음 기수, 부문별 다음 번호 팀). */
export function createAdvTeam(request: CreateAdvTeamRequest): Promise<TeamDetailResponse> {
  return api.post(TEAM_API_PATHS.ADV, request);
}

/** BASE 트랙 출결 생성(트랙이 없으면 만들고 회원을 트랙원으로 추가). */
export function createBaseTrack(request: CreateBaseTrackRequest): Promise<BaseTrackCreateResponse> {
  return api.post(TEAM_API_PATHS.BASE, request);
}

/** 팀명·스터디명·팀장·일정·설명 수정. 보낸 값만 바뀐다. */
export function updateTeam(
  group: TeamGroup,
  teamId: string,
  request: UpdateTeamRequest,
): Promise<TeamDto> {
  return api.patch(teamPath(group, teamId), request);
}

/** 팀원 추가. 이미 만들어진 주차마다 미정 출결이 함께 생긴다. */
export function addTeamMembers(
  group: TeamGroup,
  teamId: string,
  userIds: readonly string[],
): Promise<AddTeamMembersResponse> {
  return api.post(`${teamPath(group, teamId)}/members`, { userIds });
}

/**
 * 팀 삭제. 팀원·출결 기록이 함께 지워진다. 이 팀만 맡던 HOST 계정은 삭제되고(deletedHostIds),
 * 다른 팀도 맡는 계정은 이 팀만 빠진다(detachedHostIds).
 */
export function deleteTeam(
  group: TeamGroup,
  teamId: string,
): Promise<{ deleted: string; deletedHostIds: string[]; detachedHostIds: string[] }> {
  return api.delete(teamPath(group, teamId));
}

/** 팀원 삭제. 그 팀원의 출결 기록도 함께 지워진다. */
export function removeTeamMember(
  group: TeamGroup,
  teamId: string,
  memberId: string,
): Promise<RemoveTeamMemberResponse> {
  return api.delete(`${teamPath(group, teamId)}/members/${encodeURIComponent(memberId)}`);
}
