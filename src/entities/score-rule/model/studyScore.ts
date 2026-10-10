/**
 * 스터디 활동점수 계산. 팀별 점수 API와 점수표 API, 출결 점수 규칙 탭이 같은 규칙으로 계산·설명한다.
 *
 * 스터디 하나 이상 이수(참여)한 경우, 스터디마다:
 *   - 진행한 회차를 모두 출석 → 개근 가점(studyPerfectBonus, 기본 +3)
 *   - 결석이 studyPassMaxAbsences회(기본 2회) 이하 → 수료 가점(studyPassBonus, 기본 +1)
 *   - 그보다 많이 결석 → 감점(studyFailPenalty, 기본 -5)
 * 스터디를 하나도 이수(참여)하지 않은 경우 → 감점(studyNoneCompletedPenalty, 기본 -5)
 * 스터디 이수와 상관없이, 팀장을 맡은 스터디마다 → 가점(studyLeaderBonus, 기본 +1)
 *
 * 스터디 안에서 지각·조퇴로 처리해도 활동점수상으로는 출석으로 본다. 진행했는데 기록이 없는 회차는 결석으로 센다.
 */
import type { AttendanceStatus } from '@/entities/attendance/model/types';

import type { ScoreRule } from './types';

const ATTENDED_STATUSES: readonly AttendanceStatus[] = [
  'present',
  'late',
  'unexcusedLate',
  'earlyLeave',
  'remote',
];

export const STUDY_SCORE_DEFAULTS = {
  studyPerfectBonus: 3,
  studyPassBonus: 1,
  studyPassMaxAbsences: 2,
  studyFailPenalty: -5,
  studyNoneCompletedPenalty: -5,
  studyLeaderBonus: 1,
} as const;

type StudyScoreKey = keyof typeof STUDY_SCORE_DEFAULTS;

export function studyRuleValue(rule: Pick<ScoreRule, StudyScoreKey>, key: StudyScoreKey): number {
  return rule[key] ?? STUDY_SCORE_DEFAULTS[key];
}

/** 진행한 회차의 출결 중 결석으로 세는 회차 수. */
export function studyAbsenceCount(statuses: readonly (AttendanceStatus | null)[]): number {
  return statuses.filter((status) => status === null || !ATTENDED_STATUSES.includes(status)).length;
}

/** 스터디 하나의 점수(팀장 가점 포함). */
export function studyTeamScore(
  rule: Pick<ScoreRule, StudyScoreKey>,
  absenceCount: number,
  isLeader: boolean,
): number {
  const base =
    absenceCount === 0
      ? studyRuleValue(rule, 'studyPerfectBonus')
      : absenceCount <= studyRuleValue(rule, 'studyPassMaxAbsences')
        ? studyRuleValue(rule, 'studyPassBonus')
        : studyRuleValue(rule, 'studyFailPenalty');
  return base + (isLeader ? studyRuleValue(rule, 'studyLeaderBonus') : 0);
}

/** 한 회원의 스터디 점수 합계. 참여한 스터디가 없으면 미이수 감점이다. */
export function memberStudyScore(
  rule: Pick<ScoreRule, StudyScoreKey>,
  studies: readonly { absenceCount: number; isLeader: boolean }[],
): number {
  if (studies.length === 0) {
    return studyRuleValue(rule, 'studyNoneCompletedPenalty');
  }
  return studies.reduce(
    (sum, study) => sum + studyTeamScore(rule, study.absenceCount, study.isLeader),
    0,
  );
}
