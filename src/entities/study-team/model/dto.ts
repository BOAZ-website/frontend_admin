/**
 * 팀 API(/api/v1/study-teams · adv-teams · base-tracks)의 요청·응답 형태.
 * 백엔드와 맞출 계약의 초안이며, 화면 상태 타입(StudyTeamInfo 등)과는 별개다.
 */
import type { SessionDto, SessionSummaryDto } from '@/entities/attendance/model/dto';
import type { SemesterDto } from '@/entities/cohort/model/dto';

export type TeamGroup = 'STUDY' | 'ADV' | 'BASE';
export type StudyPeriod = '방학' | '학기';
export type StudyKind = 'GENERAL' | 'MENTORING';

/** 구분별 팀 API 경로. 세 구분은 같은 팀·출결 구조를 쓰므로 경로만 다르고 동작은 같다. */
export const TEAM_API_PATHS: Readonly<Record<TeamGroup, string>> = {
  STUDY: '/api/v1/study-teams',
  ADV: '/api/v1/adv-teams',
  BASE: '/api/v1/base-tracks',
};

export interface TeamDto {
  id: string;
  group: TeamGroup;
  /** 스터디·BASE는 활동 기수(반기의 기수 번호), ADV는 팀원의 회원 기수. */
  cohort: number;
  /** 팀이 출결을 진행하는 반기(예: '26-2'). 반기가 등록되지 않았으면 null. */
  semester: string | null;
  track: string;
  teamName: string;
  studyName: string;
  kind: StudyKind;
  period: StudyPeriod;
  leaderId: string | null;
  leaderName: string | null;
  schedule: string;
  description: string;
  createdAt: string;
}

export interface MemberDto {
  /** 팀 소속 id(team_members.id). 출결 기록은 이 값으로 사람을 가리킨다. */
  id: string;
  userId: string;
  name: string;
  term: number;
  track: string;
}

export interface TeamListQuery {
  /** 활동 반기(예: '26-2'). 생략하면 현재 반기, 'all'이면 모든 반기. ADV는 그 반기의 ADV 기수 팀이 나온다. */
  semester?: string;
  /** 'sessions'면 팀마다 주차별 출결 기록(sessions)을 함께 받는다. */
  include?: 'sessions';
  /** ADV 팀의 회원 기수로 거를 때. 주면 semester 대신 쓴다. */
  term?: number;
  /** 생략하면 현재 기간, 'all'이면 현재 반기의 방학·학기 팀을 모두 조회한다. */
  period?: StudyPeriod | 'all';
  kind?: StudyKind;
  track?: string;
}

export interface TeamListItemDto extends TeamDto {
  members: MemberDto[];
  /** 주차별 제출 여부와 상태별 인원 수(팀별 출결 현황). */
  weeks: SessionSummaryDto[];
  /** include=sessions로 요청했을 때만 있는 주차별 출결 기록. */
  sessions?: SessionDto[];
}

export interface TeamListResponse {
  semester: SemesterDto;
  teams: TeamListItemDto[];
}

export interface TeamDetailResponse {
  team: TeamDto;
  members: MemberDto[];
  sessions: SessionDto[];
}

export interface BaseTrackCreateResponse extends TeamDetailResponse {
  /** 이번 요청으로 그 기수·트랙의 팀을 새로 만들었는지(이미 있었다면 트랙원만 추가). */
  isNewTeam: boolean;
}

/** 주차 번호(1~16) → YYYY-MM-DD. 팀이 진행하는 반기의 주차 날짜로 저장된다. */
export type WeekDates = Record<number, string>;

export interface CreateStudyRequest {
  name: string;
  studyKind: StudyKind;
  track: string;
  period: StudyPeriod;
  /** 활동 반기(예: '26-2'). 생략하면 현재 반기. */
  semester?: string;
  leaderId?: string;
  memberIds?: string[];
  weekDates?: WeekDates;
}

export interface CreateAdvTeamRequest {
  track: string;
  /** 팀 이름. 생략하면 그 기수·부문의 다음 번호(예: '분석 3팀'). */
  teamName?: string;
  /** ADV 팀원의 회원 기수. 생략하면 현재 반기의 ADV 기수. 아직 시작하지 않은 반기의 기수면 409. */
  term?: number;
  memberIds: string[];
  leaderId?: string;
  /** 출결을 만들 주차 번호. 생략하면 1~8주차. */
  weekNums?: number[];
  weekDates?: WeekDates;
}

export interface CreateBaseTrackRequest {
  track: string;
  /** 활동 반기(예: '27-1'). 생략하면 현재 반기. 아직 시작하지 않은 반기면 409. */
  semester?: string;
  memberIds: string[];
  weekNums?: number[];
  weekDates?: WeekDates;
}

export interface UpdateTeamRequest {
  teamName?: string;
  /** ADV 프로젝트 이름. 스터디·BASE는 teamName을 바꾸면 함께 바뀐다. */
  studyName?: string;
  /** null이면 팀장 해제. 팀원 중의 users.id여야 한다. */
  leaderId?: string | null;
  schedule?: string;
  description?: string;
}

export interface AddTeamMembersResponse {
  addedMemberIds: string[];
  members: MemberDto[];
}

export interface RemoveTeamMemberResponse {
  members: MemberDto[];
}
