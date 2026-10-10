/**
 * 정규 활동(BASE·ADV) 출결 점수 계산. 점수 API(팀별 점수·점수표)가 이 함수로 계산하고, 화면은 API 결과를 보여 준다.
 * 배점은 모두 점수 규칙(DB)의 값을 쓰며, 규칙에 값이 없을 때만 「관리자 시스템 관련 현행 운영 방식」 문서의 배점을 쓴다.
 *
 *   · 지각 → 지각 감점(latePenalty, 기본 -1)
 *   · 조퇴 → 조퇴 감점(earlyLeavePenalty, 기본 -1)
 *   · 일반 결석 → 결석 감점(absentPenalty, 기본 -3)
 *   · 무단결석 → 무단결석 감점(unexcusedAbsentPenalty, 기본 -4)
 *   · 인정결석 → 인정결석 점수(excusedAbsentScore, 기본 0)
 *   · 출석·비대면 → 0
 *   · 무단지각 → 지각으로 처리하고 횟수를 센다. unexcusedLatesPerAbsence회(기본 3회)마다 그 횟수의
 *     지각 감점 대신 무단결석 1회로 환산한 감점(unexcusedLatePenalty, 기본 -4)을 매긴다.
 */
import type { AttendanceStatus } from '@/entities/attendance/model/types';

import type { ScoreRule } from './types';

const REGULAR_DEFAULTS = {
  baseScore: 10,
  latePenalty: -1,
  earlyLeavePenalty: -1,
  absentPenalty: -3,
  unexcusedAbsentPenalty: -4,
  unexcusedLatePenalty: -4,
  excusedAbsentScore: 0,
  unexcusedLatesPerAbsence: 3,
} as const;

type RegularScoreKey = keyof typeof REGULAR_DEFAULTS;
type RegularRule = Pick<ScoreRule, RegularScoreKey>;

export function regularRuleValue(rule: RegularRule, key: RegularScoreKey): number {
  return rule[key] ?? REGULAR_DEFAULTS[key];
}

/**
 * 한 주차의 감점(주차별 표시용). 무단지각은 그 주에는 지각 감점으로 보이고,
 * 3회 환산은 합계(regularAttendanceSummary)에서 반영한다.
 */
export function regularWeekPoints(rule: RegularRule, status: AttendanceStatus | null): number {
  switch (status) {
    case 'late':
    case 'unexcusedLate':
      return regularRuleValue(rule, 'latePenalty');
    case 'earlyLeave':
      return regularRuleValue(rule, 'earlyLeavePenalty');
    case 'absent':
      return regularRuleValue(rule, 'absentPenalty');
    case 'unexcusedAbsent':
      return regularRuleValue(rule, 'unexcusedAbsentPenalty');
    case 'excusedAbsent':
      return regularRuleValue(rule, 'excusedAbsentScore');
    default:
      return 0;
  }
}

export interface RegularAttendanceSummary {
  /** 지각 횟수(무단지각 포함). */
  lateCount: number;
  /** 지각 감점 합계. 무단지각 3회 환산 감점을 포함한다. */
  lateDeduction: number;
  /** 무단결석 1회로 환산한 횟수. */
  convertedUnexcusedLates: number;
  earlyLeaveCount: number;
  earlyLeaveDeduction: number;
  /** 결석 횟수(무단결석 포함). */
  absentCount: number;
  absentDeduction: number;
  /** 감점 합계(지각 + 조퇴 + 결석 + 인정결석 점수). */
  totalDeduction: number;
}

/** 여러 주차 출결의 감점 합계. */
export function regularAttendanceSummary(
  rule: RegularRule,
  statuses: readonly (AttendanceStatus | null)[],
): RegularAttendanceSummary {
  const count = (target: AttendanceStatus) => statuses.filter((status) => status === target).length;
  const latePenalty = regularRuleValue(rule, 'latePenalty');

  const unexcusedLateCount = count('unexcusedLate');
  // 환산 횟수가 0 이하이면 환산하지 않는다(모두 지각으로 처리).
  const latesPerAbsence = regularRuleValue(rule, 'unexcusedLatesPerAbsence');
  const convertedUnexcusedLates =
    latesPerAbsence > 0 ? Math.floor(unexcusedLateCount / latesPerAbsence) : 0;
  const remainingUnexcusedLates = unexcusedLateCount - convertedUnexcusedLates * latesPerAbsence;
  const lateDeduction =
    (count('late') + remainingUnexcusedLates) * latePenalty +
    convertedUnexcusedLates * regularRuleValue(rule, 'unexcusedLatePenalty');

  const earlyLeaveCount = count('earlyLeave');
  const earlyLeaveDeduction = earlyLeaveCount * regularRuleValue(rule, 'earlyLeavePenalty');

  const absentDeduction =
    count('absent') * regularRuleValue(rule, 'absentPenalty') +
    count('unexcusedAbsent') * regularRuleValue(rule, 'unexcusedAbsentPenalty') +
    count('excusedAbsent') * regularRuleValue(rule, 'excusedAbsentScore');

  return {
    lateCount: count('late') + unexcusedLateCount,
    lateDeduction,
    convertedUnexcusedLates,
    earlyLeaveCount,
    earlyLeaveDeduction,
    absentCount: count('absent') + count('unexcusedAbsent'),
    absentDeduction,
    totalDeduction: lateDeduction + earlyLeaveDeduction + absentDeduction,
  };
}
