/**
 * 활동 기수(cohort). 팀·출결 기록이 어느 기수의 활동에 속하는지를 나타내며, 회원의 기수(users.term)와는 별개다.
 * 가장 큰 기수가 "현재 기수"이고, 그보다 작은 기수는 지난 기수(아카이브 조회 대상)다.
 * 다음 기수의 출결을 만들면 그 기수가 가장 커지므로 이전 기수는 자동으로 지난 기수가 된다.
 */

/** 기수 정보가 없는 데이터(목 데이터 등)가 속하는 기수이자, 아무 기수도 없을 때의 현재 기수. */
export const DEFAULT_CURRENT_COHORT = 27;

/** 활동 기수를 운영 반기로 표시한다. 예: 26기 → 26-1, 27기 → 26-2. */
export function formatCohortLabel(cohort: number): string {
  const year = Math.floor(cohort / 2) + 13;
  const half = cohort % 2 === 0 ? 1 : 2;
  return `${year}-${half}`;
}

/** 중복 없이 큰 기수부터 정렬한다. 값이 없는 항목은 기본 기수로 본다. */
export function cohortsOf(values: readonly (number | undefined)[]): number[] {
  return [...new Set(values.map((value) => value ?? DEFAULT_CURRENT_COHORT))].sort((a, b) => b - a);
}

/** 현재 기수 = 가장 큰 기수. 목록이 비어 있으면 기본 기수. */
export function currentCohortOf(cohorts: readonly number[]): number {
  return cohorts.length === 0 ? DEFAULT_CURRENT_COHORT : Math.max(...cohorts);
}

export function isPastCohort(cohort: number, currentCohort: number): boolean {
  return cohort < currentCohort;
}
