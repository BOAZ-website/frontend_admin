/**
 * 출결 점수 집계 API. 팀·회원(멘멘 스터디는 멘멘/친바 줄별)의 주차별 상태와 점수, 합계를 돌려준다.
 * 계산식은 출결 관리 화면(InternalCategoryAttendancePage)의 점수 계산과 같다.
 *   · 스터디: 결석 횟수로 개근(결석 0회)/수료(규칙의 최대 결석 횟수 이하)/감점 + 팀장 가산점(studyScore.ts)
 *   · ADV·BASE: 지각·조퇴·결석·무단결석 감점 + 무단지각 3회 환산(attendanceScore.ts)
 *   · period(방학·학기)를 주면 그 기간의 주차만 계산한다
 * 점수 규칙은 DB(score_rules)에서 반기 시작일에 적용되던 버전을 쓴다.
 */
import type { Database } from 'sql.js';

import type { AttendanceScoresResponse, TeamScoreDto } from '@/entities/attendance/model/dto';
import {
  regularAttendanceSummary,
  regularWeekPoints,
} from '@/entities/score-rule/model/attendanceScore';
import { getActiveRule } from '@/entities/score-rule/model/lib';
import { studyAbsenceCount, studyTeamScore } from '@/entities/score-rule/model/studyScore';
import type { ScoreRule } from '@/entities/score-rule/model/types';

import {
  listMembers,
  listTeams,
  loadSessions,
  MENTORING_SUB_TYPES,
  resolveSemester,
  semesterWeeks,
  STUDY_PERIODS,
  type SubType,
  TEAM_GROUPS,
  type TeamDto,
} from '../queries';
import { ApiError, type MockRoute } from '../router';
import { oneOf, parsePositiveInt } from '../validate';
import { listScoreRules } from './scoreRuleRoutes';

function teamScores(
  db: Database,
  team: TeamDto,
  rule: ScoreRule,
  weekNum: number | undefined,
  periodWeekNums: ReadonlySet<number> | undefined,
): TeamScoreDto {
  const sessions = loadSessions(db, team.id).filter(
    (session) =>
      session.weekStatus !== 'UPCOMING' &&
      (weekNum === undefined || session.weekNum === weekNum) &&
      (periodWeekNums === undefined || periodWeekNums.has(session.weekNum)),
  );
  const subTypes: readonly SubType[] = team.kind === 'MENTORING' ? MENTORING_SUB_TYPES : [''];

  const rows = listMembers(db, team.id).flatMap((member) =>
    subTypes.map((subType) => {
      const weeks = sessions.map((session) => {
        const status =
          session.records.find(
            (record) => record.memberId === member.id && record.subType === subType,
          )?.status ?? 'unmarked';
        return { weekNum: session.weekNum, status, points: regularWeekPoints(rule, status) };
      });
      const attendedCount = weeks.filter((week) => week.status === 'present').length;
      const isLeader = team.leaderId === member.userId;
      return {
        memberId: member.id,
        userId: member.userId,
        name: member.name,
        term: member.term,
        track: member.track,
        subType,
        isLeader,
        weeks,
        attendedCount,
        totalScore:
          team.group === 'STUDY'
            ? studyTeamScore(rule, studyAbsenceCount(weeks.map((week) => week.status)), isLeader)
            : regularAttendanceSummary(
                rule,
                weeks.map((week) => week.status),
              ).totalDeduction,
      };
    }),
  );

  return {
    teamId: team.id,
    teamName: team.teamName,
    group: team.group,
    track: team.track,
    kind: team.kind,
    members: rows,
  };
}

export const scoreRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/attendance/scores',
    summary: '팀·회원별 출결 점수 집계와 주차별 점수(semester·group·teamId·weekNum으로 거른다)',
    handler: ({ db, query }) => {
      const semester = resolveSemester(db, query.get('semester'));
      const group = oneOf(query.get('group') ?? undefined, TEAM_GROUPS, 'group');
      const teamId = query.get('teamId') ?? undefined;
      const weekNum = parsePositiveInt(query.get('weekNum'), 'weekNum');
      const period = oneOf(query.get('period') ?? undefined, STUDY_PERIODS, 'period');
      const periodWeekNums = period
        ? new Set(
            semesterWeeks(db, semester.cohort)
              .filter((week) => week.period === period)
              .map((week) => week.weekNum),
          )
        : undefined;
      const rule = getActiveRule(listScoreRules(db));
      if (!rule) {
        throw new ApiError(
          409,
          'SCORE_RULE_NOT_FOUND',
          `${semester.semester} 반기에 적용할 점수 규칙이 없습니다.`,
        );
      }

      const response: AttendanceScoresResponse = {
        semester,
        rule: { id: rule.id ?? null, name: rule.name, term: rule.term, version: rule.version },
        teams: listTeams(db, { semesterCohort: semester.cohort, group })
          .filter((team) => !teamId || team.id === teamId)
          .map((team) => teamScores(db, team, rule, weekNum, periodWeekNums)),
      };
      return response;
    },
  },
];
