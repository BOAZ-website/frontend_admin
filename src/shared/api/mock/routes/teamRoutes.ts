/**
 * 스터디·ADV·BASE 팀 API. 세 구분은 같은 팀 구조를 쓰므로 조회·수정·팀원 관리는 한 번에 정의하고,
 * 생성만 구분별 규칙(스터디 유형·멘멘, ADV 팀 번호, BASE 트랙)에 맞춰 따로 둔다.
 *
 *   /api/v1/study-teams  스터디(일반·멘멘)
 *   /api/v1/adv-teams    ADV 팀
 *   /api/v1/base-tracks  BASE 트랙(반기마다 분석·시각화·엔지니어링)
 *
 * 조회는 반기(?semester=26-2, 생략하면 현재 반기)로 거른다. ADV 팀의 기수는 회원 기수라서
 * 반기로 조회하면 그 반기의 ADV 기수 팀이 나오고, ?term=26처럼 기수로도 조회할 수 있다.
 */
import type { Database } from 'sql.js';

import {
  baseTeamId,
  createAdvTeamRecords,
  createBaseAttendanceRecords,
  createStudyRecords,
} from '@/entities/study-team/model/db';
import { loadTeamState } from '@/entities/study-team/api/teamRepository';
import { execute, queryAll } from '@/shared/db/createDatabase';

import {
  findTeam,
  listMembers,
  listTeams,
  loadSessions,
  currentSemester,
  resolveSemester,
  STUDY_KINDS,
  STUDY_PERIODS,
  summarizeSession,
  TEAM_PATHS,
  type TeamGroup,
} from '../queries';
import { detachTeamsFromHosts } from '../hostCleanup';
import { ApiError, type MockRequest, type MockRoute } from '../router';
import {
  addMembersToTeam,
  assertTrack,
  assertUniqueTeamName,
  newTeamId,
  resolveUsers,
  saveTeamWithAttendance,
  teamInfosOf,
} from '../teamWrites';
import {
  oneOf,
  optionalNumber,
  optionalString,
  parsePositiveInt,
  readBody,
  requiredString,
  stringArray,
  weekDatesOf,
} from '../validate';

const GROUP_LABELS: Record<TeamGroup, string> = {
  STUDY: '스터디',
  ADV: 'ADV 팀',
  BASE: 'BASE 트랙',
};

/** 팀 상세 응답: 팀 정보 + 팀원 + 주차별 출결. */
function teamDetail(db: Database, teamId: string, group: TeamGroup, weekNum?: number) {
  return {
    team: findTeam(db, teamId, group),
    members: listMembers(db, teamId),
    sessions: loadSessions(db, teamId, weekNum),
  };
}

function weekNumsOf(body: Readonly<Record<string, unknown>>): number[] | undefined {
  const value = body.weekNums;
  if (value === undefined || value === null) return undefined;
  if (
    !Array.isArray(value) ||
    value.some((item) => !Number.isInteger(item) || item < 1 || item > 16)
  ) {
    throw new ApiError(400, 'BAD_REQUEST', 'weekNums 값은 1~16 주차 번호 배열이어야 합니다.');
  }
  return [...new Set(value as number[])].sort((a, b) => a - b);
}

function assertLeaderInMembers(leaderId: string | undefined, memberIds: readonly string[]): void {
  if (leaderId && !memberIds.includes(leaderId)) {
    throw new ApiError(400, 'LEADER_NOT_MEMBER', '팀장은 팀원 중에서 골라야 합니다.');
  }
}

// ───────────────────────────── 구분별 생성 ─────────────────────────────

function createStudy({ db, body }: MockRequest) {
  const input = readBody(body);
  const name = requiredString(input, 'name');
  const track = requiredString(input, 'track');
  const studyKind = oneOf(requiredString(input, 'studyKind'), STUDY_KINDS, 'studyKind') as
    'GENERAL' | 'MENTORING';
  const period = oneOf(requiredString(input, 'period'), STUDY_PERIODS, 'period');
  const { cohort } = resolveSemester(db, optionalString(input, 'semester'));
  assertNotFutureSemester(db, cohort);
  const memberIds = stringArray(input, 'memberIds');
  const leaderId = optionalString(input, 'leaderId');
  assertTrack(db, track);
  assertLeaderInMembers(leaderId, memberIds);
  assertUniqueTeamName(db, cohort, track, name);

  const members = resolveUsers(db, memberIds, cohort);
  const id = newTeamId('study', cohort);
  const records = createStudyRecords({
    id,
    name,
    studyKind,
    track,
    isVacation: period === '방학',
    cohort,
    leaderName: members.find((user) => user.id === leaderId)?.name ?? null,
    members,
  });
  saveTeamWithAttendance(db, {
    group: 'STUDY',
    team: { ...records.team, ...(leaderId ? { leaderId } : {}) },
    members: records.members,
    attendance: records.attendance,
    semesterCohort: cohort,
    weekDates: weekDatesOf(input),
  });
  return teamDetail(db, id, 'STUDY');
}

/**
 * 미래 반기에는 팀·출결을 미리 만들지 않는다. 다음 반기는 '새 반기 시작'으로 현재 반기가 된 뒤에
 * 명단을 불러와 만든다.
 */
function assertNotFutureSemester(db: Database, cohort: number): void {
  if (cohort > currentSemester(db).cohort) {
    throw new ApiError(
      409,
      'FUTURE_SEMESTER',
      '아직 시작하지 않은 반기에는 만들 수 없습니다. 새 반기를 시작한 뒤 만들어 주세요.',
    );
  }
}

function createAdvTeam({ db, body }: MockRequest) {
  const input = readBody(body);
  const track = requiredString(input, 'track');
  // ADV 팀의 기수는 회원 기수다. 생략하면 현재 반기의 ADV 기수로 만든다.
  // 미래 반기는 여기서 만들지 않는다(새 반기 시작 때만 생긴다).
  const term = optionalNumber(input, 'term');
  const cohort = term ?? currentSemester(db).advTerm;
  const semesterCohort = queryAll<{ cohort: number }>(
    db,
    'SELECT cohort FROM cohorts WHERE adv_term = ?',
    [cohort ?? 0],
  )[0]?.cohort;
  if (!cohort || !semesterCohort) {
    throw new ApiError(
      409,
      'ADV_SEMESTER_NOT_FOUND',
      '이 기수가 ADV를 진행할 반기가 등록되어 있지 않습니다.',
    );
  }
  assertNotFutureSemester(db, semesterCohort);
  const memberIds = stringArray(input, 'memberIds', { required: true });
  const leaderId = optionalString(input, 'leaderId');
  const teamName = optionalString(input, 'teamName')?.trim() || undefined;
  assertTrack(db, track);
  assertLeaderInMembers(leaderId, memberIds);
  if (memberIds.length === 0)
    throw new ApiError(400, 'BAD_REQUEST', '팀원을 한 명 이상 선택해 주세요.');
  if (teamName) assertUniqueTeamName(db, semesterCohort, track, teamName);

  const members = resolveUsers(db, memberIds, semesterCohort);
  const records = createAdvTeamRecords(
    {
      cohort,
      track,
      members,
      weekNums: weekNumsOf(input),
      leaderName: members.find((user) => user.id === leaderId)?.name ?? null,
      teamName,
    },
    teamInfosOf(db, 'ADV'),
  );
  saveTeamWithAttendance(db, {
    group: 'ADV',
    team: { ...records.team, ...(leaderId ? { leaderId } : {}) },
    members: records.members,
    attendance: records.attendance,
    semesterCohort,
    weekDates: weekDatesOf(input),
  });
  return teamDetail(db, records.team.id, 'ADV');
}

function createBaseTrack({ db, body }: MockRequest) {
  const input = readBody(body);
  const track = requiredString(input, 'track');
  const label = optionalString(input, 'semester');
  // 반기를 생략하면 현재 반기에 만든다. 미래 반기는 여기서 만들지 않는다(새 반기 시작 때만 생긴다).
  const { cohort } = resolveSemester(db, label);
  assertNotFutureSemester(db, cohort);
  const memberIds = stringArray(input, 'memberIds', { required: true });
  assertTrack(db, track);

  const state = loadTeamState(db);
  const result = createBaseAttendanceRecords(
    {
      cohort,
      track,
      members: resolveUsers(db, memberIds, cohort),
      weekNums: weekNumsOf(input),
    },
    state.baseTeams,
    state.members,
    state.attendance,
  );
  if (result.addedMembers.length === 0) {
    throw new ApiError(409, 'ALREADY_REGISTERED', '선택한 회원은 이미 모두 등록되어 있습니다.');
  }
  saveTeamWithAttendance(db, {
    group: 'BASE',
    team: result.team,
    members: result.addedMembers,
    attendance: result.attendance,
    semesterCohort: cohort,
    weekDates: weekDatesOf(input),
  });
  return { ...teamDetail(db, baseTeamId(cohort, track), 'BASE'), isNewTeam: result.isNewTeam };
}

const CREATE_HANDLERS: Record<TeamGroup, MockRoute> = {
  STUDY: {
    method: 'POST',
    pattern: TEAM_PATHS.STUDY,
    summary:
      '스터디 생성(반기 생략 시 현재 반기. 유형·부문·팀장·팀원 + 1~8주차 미정 출결 + 주차 날짜)',
    handler: createStudy,
  },
  ADV: {
    method: 'POST',
    pattern: TEAM_PATHS.ADV,
    summary:
      'ADV 팀 생성(term 생략 시 다음 반기의 ADV 기수, 부문별 다음 번호 팀, 팀장·팀원 + 주차별 출결)',
    handler: createAdvTeam,
  },
  BASE: {
    method: 'POST',
    pattern: TEAM_PATHS.BASE,
    summary:
      'BASE 트랙 출결 생성(반기 생략 시 다음 반기, 트랙이 없으면 만들고 회원을 트랙원으로 추가)',
    handler: createBaseTrack,
  },
};

// ───────────────────────────── 공통 조회·수정 ─────────────────────────────

function teamRoutesFor(group: TeamGroup): MockRoute[] {
  const base = TEAM_PATHS[group];
  const label = GROUP_LABELS[group];

  return [
    {
      method: 'GET',
      pattern: base,
      summary: `${label} 목록 + 팀원 + 주차별 제출·출결 현황(semester[all이면 전체 반기]·term·period·kind·track으로 거른다. include=sessions면 주차별 출결 기록까지)`,
      handler: ({ db, query }) => {
        const isAllSemesters = query.get('semester') === 'all';
        const semester = resolveSemester(db, isAllSemesters ? null : query.get('semester'));
        const term = parsePositiveInt(query.get('term'), 'term');
        const includeSessions = query.get('include') === 'sessions';
        const periodParam = query.get('period');
        const period =
          periodParam === 'all'
            ? undefined
            : (oneOf(periodParam ?? undefined, STUDY_PERIODS, 'period') ??
              (group === 'STUDY' && !isAllSemesters && term === undefined
                ? (semester.currentPeriod ?? undefined)
                : undefined));
        const teams = listTeams(db, {
          group,
          ...(term !== undefined
            ? { cohort: term }
            : isAllSemesters
              ? {}
              : { semesterCohort: semester.cohort }),
          period,
          kind: oneOf(query.get('kind') ?? undefined, STUDY_KINDS, 'kind'),
          track: query.get('track') ?? undefined,
        });
        return {
          semester,
          teams: teams.map((team) => {
            const sessions = loadSessions(db, team.id);
            return {
              ...team,
              members: listMembers(db, team.id),
              weeks: sessions.map(summarizeSession),
              ...(includeSessions ? { sessions } : {}),
            };
          }),
        };
      },
    },
    CREATE_HANDLERS[group],
    {
      method: 'GET',
      pattern: `${base}/:teamId`,
      summary: `${label} 상세: 팀원과 주차별 출결 상태·사진·PDF·제출 여부(weekNum으로 한 주차만)`,
      handler: ({ db, params, query }) =>
        teamDetail(db, params.teamId, group, parsePositiveInt(query.get('weekNum'), 'weekNum')),
    },
    {
      method: 'PATCH',
      pattern: `${base}/:teamId`,
      summary: `${label} 정보 수정(팀명·스터디명·팀장·일정·설명). leaderId를 null로 보내면 팀장 해제`,
      handler: ({ db, params, body }) => {
        const team = findTeam(db, params.teamId, group);
        const input = readBody(body);
        const teamName = optionalString(input, 'teamName');
        const studyName = optionalString(input, 'studyName');
        if (teamName !== undefined) {
          if (!teamName) throw new ApiError(400, 'BAD_REQUEST', '팀 이름을 입력해 주세요.');
          assertUniqueTeamName(
            db,
            resolveSemester(db, team.semester).cohort,
            team.track,
            teamName,
            team.id,
          );
        }
        if ('leaderId' in input) {
          const leaderId = optionalString(input, 'leaderId') || null;
          const isMember = listMembers(db, team.id).some((member) => member.userId === leaderId);
          if (leaderId && !isMember) {
            throw new ApiError(400, 'LEADER_NOT_MEMBER', '팀장은 팀원 중에서 골라야 합니다.');
          }
          const previousLeaderId = team.leaderId ?? null;
          const isLeaderChange =
            group !== 'BASE' && previousLeaderId !== null && leaderId !== previousLeaderId;
          execute(db, 'UPDATE teams SET leader_id = ? WHERE id = ?', [leaderId, team.id]);
          // 예전 팀장은 팀원으로 남고, 예전 팀장 계정에서 이 팀의 출결 권한을 회수한다.
          // 그러면 이 팀에 연결된 계정이 없어지고, 새 팀장의 계정은 그룹 계정 관리에서 발급한다.
          if (isLeaderChange) {
            detachTeamsFromHosts(
              db,
              (teamId) => teamId === team.id,
              (host) => host.userId === previousLeaderId,
            );
          }
        }
        // ADV는 팀 이름(분석 1팀)과 프로젝트 이름이 따로 있고, 스터디·BASE는 두 이름이 같다.
        const nextStudyName = studyName ?? (group === 'ADV' ? undefined : teamName);
        execute(
          db,
          `UPDATE teams SET team_name = COALESCE(?, team_name), study_name = COALESCE(?, study_name),
                            schedule = COALESCE(?, schedule), description = COALESCE(?, description)
            WHERE id = ?`,
          [
            teamName ?? null,
            nextStudyName ?? null,
            optionalString(input, 'schedule') ?? null,
            optionalString(input, 'description') ?? null,
            team.id,
          ],
        );
        return findTeam(db, team.id, group);
      },
    },
    {
      method: 'POST',
      pattern: `${base}/:teamId/members`,
      summary: `${label} 팀원 추가(userId 또는 userIds). 만들어진 주차마다 미정 출결이 함께 생긴다`,
      handler: ({ db, params, body }) => {
        findTeam(db, params.teamId, group);
        const input = readBody(body);
        const single = optionalString(input, 'userId');
        const userIds = single ? [single] : stringArray(input, 'userIds', { required: true });
        const semesterCohort = queryAll<{ semester_cohort: number }>(
          db,
          'SELECT semester_cohort FROM team_semesters WHERE team_id = ?',
          [params.teamId],
        )[0]?.semester_cohort;
        if (!semesterCohort)
          throw new ApiError(409, 'SEMESTER_NOT_FOUND', '팀의 반기를 찾을 수 없습니다.');
        const addedMemberIds = addMembersToTeam(
          db,
          params.teamId,
          resolveUsers(db, userIds, semesterCohort),
        );
        if (addedMemberIds.length === 0) {
          throw new ApiError(409, 'ALREADY_MEMBER', '이미 팀에 소속된 회원입니다.');
        }
        return { addedMemberIds, members: listMembers(db, params.teamId) };
      },
    },
    {
      method: 'DELETE',
      pattern: `${base}/:teamId`,
      summary: `${label} 삭제. 팀원·주차별 출결·사진·수정 요청이 함께 지워진다. 이 팀만 맡던 HOST 계정은 삭제하고, 다른 팀도 맡는 계정은 이 팀만 뺀다`,
      handler: ({ db, params }) => {
        const team = findTeam(db, params.teamId, group);
        const hosts = detachTeamsFromHosts(db, (teamId) => teamId === team.id);
        // 외래 키(ON DELETE CASCADE)가 팀원·출결·맡은 그룹 행을 함께 지운다.
        execute(db, 'DELETE FROM teams WHERE id = ?', [team.id]);
        return { deleted: team.id, ...hosts };
      },
    },
    {
      method: 'DELETE',
      pattern: `${base}/:teamId/members/:memberId`,
      summary: `${label} 팀원 삭제. 그 팀원의 출결 기록도 함께 지워지고, 팀장이었다면 팀장이 해제된다`,
      handler: ({ db, params }) => {
        const team = findTeam(db, params.teamId, group);
        const member = listMembers(db, team.id).find((item) => item.id === params.memberId);
        if (!member) throw new ApiError(404, 'NOT_FOUND', '팀원을 찾을 수 없습니다.');
        if (team.leaderId === member.userId) {
          execute(db, 'UPDATE teams SET leader_id = NULL WHERE id = ?', [team.id]);
        }
        execute(db, 'DELETE FROM team_members WHERE team_id = ? AND id = ?', [team.id, member.id]);
        return { members: listMembers(db, team.id) };
      },
    },
  ];
}

export const teamRoutes: MockRoute[] = (['STUDY', 'ADV', 'BASE'] as const).flatMap(teamRoutesFor);
