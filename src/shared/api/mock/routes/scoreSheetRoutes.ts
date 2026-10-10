/**
 * 엑셀 양식 점수표 API(BASE 중간·ADV 중간·BASE 최종·ADV 최종 집계).
 * 계산식은 점수 집계 화면(ScoresPage)이 하던 계산과 같다.
 *   · 출석점수 = 기본점수 + 지각·무단지각·조퇴·결석·무단결석 감점(0 미만이면 0).
 *     기본점수와 감점, 무단지각 3회 환산은 적용 중인 점수 규칙(DB)으로 계산한다(attendanceScore.ts)
 *   · 스터디 점수는 반기 스터디 팀의 출결로 계산한다(studyScore.ts: 스터디마다 개근·수료·감점 + 팀장 가점,
 *     참여한 스터디가 없으면 미이수 감점). BASE 점수표는 BASE 스터디 점수, ADV 점수표는 ADV 스터디 점수 칸에 넣는다
 *   · 친바·홍보·과제·MT·컨퍼런스 등 아직 데이터가 없는 활동 점수는 0
 * 회원은 반기에 진행되는 모든 팀(BASE·스터디·ADV)의 팀원이고, 주차별 출결은 요청한 구분(BASE/ADV)의 팀 기록을 쓴다.
 */
import type { Database } from 'sql.js';

import type {
  ScoreSheetGroup,
  ScoreSheetMemberDto,
  ScoreSheetResponse,
  SessionDto,
} from '@/entities/attendance/model/dto';
import type { AttendanceStatus } from '@/entities/attendance/model/types';
import {
  regularAttendanceSummary,
  regularRuleValue,
} from '@/entities/score-rule/model/attendanceScore';
import { getActiveRule } from '@/entities/score-rule/model/lib';
import { memberStudyScore, studyAbsenceCount } from '@/entities/score-rule/model/studyScore';
import type { ScoreRule } from '@/entities/score-rule/model/types';

import {
  listMembers,
  listTeams,
  loadSessions,
  type MemberDto,
  resolveSemester,
  semesterWeeks,
  type TeamDto,
} from '../queries';
import { ApiError, type MockRoute } from '../router';
import { oneOf } from '../validate';
import { listScoreRules } from './scoreRuleRoutes';

const SCORE_SHEET_GROUPS: readonly ScoreSheetGroup[] = ['BASE', 'ADV'];
const OFFICER_SCORE = 2;
const TEAM_ORDER: Record<TeamDto['group'], number> = { BASE: 0, STUDY: 1, ADV: 2 };

const round1 = (value: number) => Number(value.toFixed(1));

interface SheetMember {
  userId: string;
  name: string;
  term: number;
  track: string;
}

function attendanceScoreOf(rule: ScoreRule, statuses: readonly (AttendanceStatus | null)[]) {
  const summary = regularAttendanceSummary(rule, statuses);
  const baseScore = regularRuleValue(rule, 'baseScore');
  return {
    baseScore,
    lateCount: summary.lateCount,
    lateDeduction: summary.lateDeduction,
    earlyLeaveCount: summary.earlyLeaveCount,
    earlyLeaveDeduction: summary.earlyLeaveDeduction,
    absentCount: summary.absentCount,
    absentDeduction: summary.absentDeduction,
    attendanceScore: Math.max(0, baseScore + summary.totalDeduction),
  };
}

function buildRow(
  member: SheetMember,
  statuses: (AttendanceStatus | null)[],
  rule: ScoreRule,
  isLeader: boolean,
  isParallel: boolean,
  studyScore: number,
): ScoreSheetMemberDto {
  const { baseScore, ...attendance } = attendanceScoreOf(rule, statuses);
  // 아직 데이터가 연결되지 않은 활동 점수(스터디 점수만 출결로 계산한다)
  const zero = {
    baseStudyScore: studyScore,
    chinbaScore: 0,
    promoScore: 0,
    baseTaskScore: 0,
    mtScore: 0,
    etcScore: 0,
    baseFinalRefScore: 0,
    advStudyScore: studyScore,
    confScore: 0,
    termSessionScore: 0,
    finalTaskScore: 0,
    termStudyScore: 0,
    jointSessionScore: 0,
    finalEtcScore: 0,
    newRecruitPromoScore: 0,
    parallelMidScore: 0,
    parallelScore: 0,
    parallelAttendance: 0,
  };
  const officerScore = isLeader ? OFFICER_SCORE : 0;
  // 병행 포기('O')를 기록할 데이터가 아직 없어 병행점수는 그대로 더한다(현재 0점).
  const parallelGiveup = isParallel ? '미연동' : '-';
  const parallelAdded = zero.parallelScore;
  const commonActivity = zero.chinbaScore + zero.promoScore + zero.mtScore + zero.etcScore;
  const baseMidScore = round1(
    attendance.attendanceScore + zero.baseStudyScore + zero.baseTaskScore + commonActivity,
  );
  const advMidScore = round1(
    attendance.attendanceScore + zero.advStudyScore + zero.confScore + commonActivity,
  );
  const finalCommon =
    zero.termSessionScore +
    zero.termStudyScore +
    officerScore +
    zero.jointSessionScore +
    zero.finalEtcScore +
    zero.newRecruitPromoScore +
    parallelAdded;

  return {
    id: member.userId,
    name: member.name,
    term: member.term,
    track: member.track,
    statuses,
    baseDefaultScore: baseScore,
    ...attendance,
    ...zero,
    baseMidScore,
    advMidScore,
    officerScore,
    parallelGiveup,
    baseFinalScore: round1(baseMidScore + zero.finalTaskScore + finalCommon),
    advFinalScore: round1(advMidScore + finalCommon),
    isTop5: false,
  };
}

function scoreSheet(
  db: Database,
  semesterLabel: string | null,
  group: ScoreSheetGroup,
): ScoreSheetResponse {
  const semester = resolveSemester(db, semesterLabel);
  const rules = listScoreRules(db);
  const semesterRule = getActiveRule(rules);
  if (!semesterRule) {
    throw new ApiError(
      409,
      'SCORE_RULE_NOT_FOUND',
      `${semester.semester} 반기에 적용할 점수 규칙이 없습니다.`,
    );
  }

  const teams = listTeams(db, { semesterCohort: semester.cohort }).sort(
    (a, b) => TEAM_ORDER[a.group] - TEAM_ORDER[b.group],
  );
  const membersByTeam = new Map<string, MemberDto[]>(
    teams.map((team) => [team.id, listMembers(db, team.id)]),
  );
  const groupTeams = teams.filter((team) => team.group === group);
  const sessionsByTeam = new Map<string, SessionDto[]>(
    groupTeams.map((team) => [team.id, loadSessions(db, team.id)]),
  );

  const sessionWeekNums = new Set(
    [...sessionsByTeam.values()].flatMap((sessions) => sessions.map((session) => session.weekNum)),
  );
  const weeks = semesterWeeks(db, semester.cohort).filter((week) =>
    sessionWeekNums.has(week.weekNum),
  );

  const members = new Map<string, SheetMember>();
  teams.forEach((team) =>
    (membersByTeam.get(team.id) ?? []).forEach((member) => {
      if (!members.has(member.userId)) {
        members.set(member.userId, {
          userId: member.userId,
          name: member.name,
          term: member.term,
          track: member.track,
        });
      }
    }),
  );
  const leaderIds = new Set(
    teams
      .filter((team) => team.group !== 'BASE')
      .map((team) => team.leaderId)
      .filter(Boolean),
  );
  const isMemberOf = (team: TeamDto, userId: string) =>
    (membersByTeam.get(team.id) ?? []).some((member) => member.userId === userId);

  // 스터디 점수: 반기 스터디 팀마다 진행한 회차의 결석 횟수로 매긴다(멘멘 스터디는 멘멘 줄 기준).
  const studyTeams = teams.filter((team) => team.group === 'STUDY');
  const studySessionsByTeam = new Map<string, SessionDto[]>(
    studyTeams.map((team) => [
      team.id,
      loadSessions(db, team.id).filter((session) => session.weekStatus !== 'UPCOMING'),
    ]),
  );
  const studyScoreOf = (userId: string) =>
    memberStudyScore(
      semesterRule,
      studyTeams.flatMap((team) => {
        const teamMember = (membersByTeam.get(team.id) ?? []).find(
          (item) => item.userId === userId,
        );
        if (!teamMember) return [];
        const subType = team.kind === 'MENTORING' ? '멘멘' : '';
        const statuses = (studySessionsByTeam.get(team.id) ?? []).map(
          (session) =>
            session.records.find(
              (record) => record.memberId === teamMember.id && record.subType === subType,
            )?.status ?? null,
        );
        return [{ absenceCount: studyAbsenceCount(statuses), isLeader: team.leaderId === userId }];
      }),
    );

  const rows = [...members.values()]
    .sort((a, b) => a.term - b.term || a.name.localeCompare(b.name, 'ko'))
    .map((member) => {
      const team = groupTeams.find((item) => isMemberOf(item, member.userId));
      const teamMemberId = team
        ? (membersByTeam.get(team.id) ?? []).find((item) => item.userId === member.userId)?.id
        : undefined;
      const sessions = team ? (sessionsByTeam.get(team.id) ?? []) : [];
      const statuses = weeks.map(
        (week) =>
          sessions
            .find((session) => session.weekNum === week.weekNum)
            ?.records.find((record) => record.memberId === teamMemberId && record.subType === '')
            ?.status ?? null,
      );
      // 병행: 회원 기수와 같은 기수의 BASE 트랙과 스터디·ADV 팀에 함께 속한 경우
      const inSameTerm = (groups: TeamDto['group'][]) =>
        teams.some(
          (item) =>
            groups.includes(item.group) &&
            item.cohort === member.term &&
            isMemberOf(item, member.userId),
        );
      const isParallel = inSameTerm(['BASE']) && inSameTerm(['STUDY', 'ADV']);
      return buildRow(
        member,
        statuses,
        semesterRule,
        leaderIds.has(member.userId),
        isParallel,
        studyScoreOf(member.userId),
      );
    });

  return { semester, group, weeks, members: rows };
}

export const scoreSheetRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/attendance/score-sheet',
    summary:
      '엑셀 양식 점수표: 회원별 주차 출결·감점·출석점수·중간/최종 점수(semester, group=BASE|ADV)',
    handler: ({ db, query }) =>
      scoreSheet(
        db,
        query.get('semester'),
        oneOf(query.get('group') ?? 'BASE', SCORE_SHEET_GROUPS, 'group') as ScoreSheetGroup,
      ),
  },
];
