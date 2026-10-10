/**
 * 출결 API 호출: 기준 데이터(반기·주차), 팀 주차 출결 저장·제출, 점수.
 * 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 */
import type { TeamGroup } from '@/entities/study-team/model/dto';
import { TEAM_API_PATHS } from '@/entities/study-team/model/dto';
import { api, withQuery } from '@/shared/api/client';

import type {
  AttendanceMetaResponse,
  AttendanceScoresQuery,
  AttendanceScoresResponse,
  SaveWeekAttendanceRequest,
  ScoreSheetGroup,
  ScoreSheetResponse,
  SessionDto,
  SubmitWeekRequest,
  SubmitWeekResponse,
} from '../model/dto';

const weekPath = (group: TeamGroup, teamId: string, weekNum: number) =>
  `${TEAM_API_PATHS[group]}/${encodeURIComponent(teamId)}/weeks/${weekNum}`;

// ───────────────────────────── 기준 데이터 ─────────────────────────────

/**
 * 출결 화면 기준 데이터: 반기 목록·현재/다음 반기·부문, 요청한 반기(생략하면 현재 반기)의 주차 상태·날짜·기본 주차.
 * 반기별 조회·수정은 entities/cohort/api/semesterApi를 쓴다.
 */
export function fetchAttendanceMeta(
  query: { semester?: string; period?: '방학' | '학기' } = {},
): Promise<AttendanceMetaResponse> {
  return api.get(withQuery('/api/v1/attendance/meta', query));
}

// ───────────────────────────── 팀 주차 출결 ─────────────────────────────

/** 출결·비고 저장(제출 전 임시 저장, 운영진 수정). 보낸 팀원 줄만 바뀐다. */
export function saveWeekAttendance(
  group: TeamGroup,
  teamId: string,
  weekNum: number,
  request: SaveWeekAttendanceRequest,
): Promise<SessionDto> {
  return api.put(`${weekPath(group, teamId, weekNum)}/attendance`, request);
}

/** 출결·활동 사진·PDF를 한 요청으로 제출한다. 이미 제출한 주차면 다시 제출한다. */
export function submitTeamWeek(
  group: TeamGroup,
  teamId: string,
  weekNum: number,
  request: SubmitWeekRequest,
): Promise<SubmitWeekResponse> {
  return api.post(`${weekPath(group, teamId, weekNum)}/submit`, request);
}

// ───────────────────────────── 점수 ─────────────────────────────

/** 팀·회원별 출결 점수와 주차별 점수. */
export function fetchAttendanceScores(
  query: AttendanceScoresQuery = {},
): Promise<AttendanceScoresResponse> {
  return api.get(withQuery('/api/v1/attendance/scores', { ...query }));
}

/** 엑셀 양식 점수표(BASE·ADV 중간·최종 집계용). 계산은 API가 하고 화면은 표시와 CSV 추출만 한다. */
export function fetchScoreSheet(query: {
  semester?: string;
  group: ScoreSheetGroup;
}): Promise<ScoreSheetResponse> {
  return api.get(withQuery('/api/v1/attendance/score-sheet', query));
}
