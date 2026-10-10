/**
 * 팀 생성·팀원 추가처럼 여러 테이블을 함께 바꾸는 쓰기 작업.
 * 화면의 기존 생성 규칙(createStudyRecords 등)을 그대로 써서, API로 만든 팀과 화면에서 만든 팀이 같은 모양이 되게 한다.
 */
import type { Database } from 'sql.js';

import type { AttendanceState } from '@/entities/attendance/model/types';
import { loadWeekDates, persistWeekDates } from '@/entities/cohort/api/cohortRepository';
import {
  ensureMemberProfile,
  loadTeamState,
  persistAttendance,
  persistMembers,
  persistTeams,
} from '@/entities/study-team/api/teamRepository';
import { memberKeysOf } from '@/entities/study-team/model/db';
import type { Member, StudyTeamInfo } from '@/entities/study-team/model/types';
import { listSemesterUsers } from '@/entities/user/api/usersRepository';
import type { UserProfile } from '@/entities/user/model/types';
import { execute, queryAll } from '@/shared/db/createDatabase';

import { findTeam, type TeamGroup } from './queries';
import { ApiError } from './router';

const TEAM_STATE_KEYS = { STUDY: 'studyTeams', ADV: 'advTeams', BASE: 'baseTeams' } as const;

export function teamInfosOf(db: Database, group: TeamGroup): StudyTeamInfo[] {
  return loadTeamState(db)[TEAM_STATE_KEYS[group]];
}

/** id 목록을 회원 프로필로 바꾼다. 없는 회원이 하나라도 있으면 400. */
export function resolveUsers(
  db: Database,
  userIds: readonly string[],
  semesterCohort: number,
): UserProfile[] {
  const byId = new Map(listSemesterUsers(db, semesterCohort).map((user) => [user.id, user]));
  const missing = userIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new ApiError(
      400,
      'USER_NOT_FOUND',
      `해당 반기 명단에 등록되지 않은 회원입니다: ${missing.join(', ')}`,
    );
  }
  return userIds.map((id) => byId.get(id) as UserProfile);
}

export function assertTrack(db: Database, track: string): void {
  if (queryAll(db, 'SELECT 1 FROM tracks WHERE name = ?', [track]).length === 0) {
    throw new ApiError(400, 'INVALID_TRACK', `없는 부문입니다: ${track}`);
  }
}

export function assertUniqueTeamName(
  db: Database,
  cohort: number,
  track: string,
  teamName: string,
  exceptTeamId?: string,
): void {
  const duplicated = queryAll(
    db,
    'SELECT 1 FROM teams WHERE semester_cohort = ? AND track = ? AND team_name = ? AND id <> ?',
    [cohort, track, teamName, exceptTeamId ?? ''],
  );
  if (duplicated.length > 0) {
    throw new ApiError(
      409,
      'DUPLICATE_TEAM_NAME',
      '같은 기수·부문에 이미 사용 중인 이름입니다. 다른 이름을 쓰거나 다른 부문으로 만들어 주세요.',
    );
  }
}

interface NewTeamWrite {
  group: TeamGroup;
  team: StudyTeamInfo;
  /** 이번에 새로 넣는 팀원(기존 팀원은 그대로 둔다). */
  members: readonly Member[];
  /** 새로 만들거나 바꾼 주차별 출결 세션. */
  attendance: AttendanceState;
  /** 팀이 출결을 진행하는 반기의 기수 번호. 주차 날짜는 이 반기에 저장된다. */
  semesterCohort: number;
  weekDates?: Readonly<Record<number, string>>;
}

/**
 * 팀(없으면 생성)·팀원·주차별 출결·주차 날짜를 저장한다. 라우터가 트랜잭션으로 감싼다.
 * 반기는 미리 등록되어 있어야 한다(POST /api/v1/semesters). 여기서 반기를 새로 만들지 않는다.
 */
export function saveTeamWithAttendance(db: Database, write: NewTeamWrite): void {
  const state = loadTeamState(db);
  const key = TEAM_STATE_KEYS[write.group];
  const teams = state[key];
  const nextTeams = teams.some((team) => team.id === write.team.id)
    ? teams
    : [...teams, write.team];
  const cohort = write.semesterCohort;

  persistTeams(db, teams, nextTeams, write.group);
  execute(db, 'UPDATE teams SET semester_cohort = ? WHERE id = ?', [cohort, write.team.id]);
  persistMembers(db, state.members, {
    ...state.members,
    [write.team.id]: [...(state.members[write.team.id] ?? []), ...write.members],
  });
  persistAttendance(db, state.attendance, { ...state.attendance, ...write.attendance });

  if (write.weekDates && Object.keys(write.weekDates).length > 0) {
    const all = loadWeekDates(db);
    persistWeekDates(db, all, { ...all, [cohort]: { ...(all[cohort] ?? {}), ...write.weekDates } });
  }
}

/**
 * 기존 팀에 회원을 넣고, 이미 만들어진 모든 주차 세션에 미정(unmarked) 출결을 채운다.
 * 이미 팀원인 회원은 건너뛰며, 실제로 들어간 팀원 id를 돌려준다.
 */
export function addMembersToTeam(
  db: Database,
  teamId: string,
  users: readonly UserProfile[],
): string[] {
  const team = findTeam(db, teamId);
  const existingUserIds = new Set(
    queryAll<{ user_id: string }>(db, 'SELECT user_id FROM team_members WHERE team_id = ?', [
      teamId,
    ]).map((row) => row.user_id),
  );
  const added = users.filter((user) => !existingUserIds.has(user.id));
  const weekIds = queryAll<{ week_id: string }>(
    db,
    'SELECT week_id FROM attendance_sessions WHERE team_id = ?',
    [teamId],
  ).map((row) => row.week_id);

  return added.map((user) => {
    const memberId = `${teamId}_${user.id}`;
    const profileId = ensureMemberProfile(db, user.id, user.term, user.track, user.name);
    execute(
      db,
      `INSERT INTO team_members (id, team_id, member_id, user_id, sort_order)
       VALUES (?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 1 FROM team_members WHERE team_id = ?), 0))`,
      [memberId, teamId, profileId, user.id, teamId],
    );
    memberKeysOf(memberId, team.kind === 'MENTORING').forEach((memberKey) => {
      const [, subType = ''] = memberKey.split(':');
      weekIds.forEach((weekId) =>
        execute(
          db,
          `INSERT OR IGNORE INTO attendance_records (team_id, week_id, member_id, sub_type, status)
           VALUES (?, ?, ?, ?, 'unmarked')`,
          [teamId, weekId, memberId, subType],
        ),
      );
    });
    return memberId;
  });
}

export function newTeamId(prefix: string, cohort: number): string {
  return `${prefix}_${cohort}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
