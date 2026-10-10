/**
 * 활동 기수(cohort) 보조 함수. 현재 반기, 반기 표기('26-2'), ADV 기수 같은 값은 화면이 계산하지 않고
 * 반기 API(GET /api/v1/attendance/meta, /api/v1/semesters)에서 받는다. 여기에는 받은 값을 다루는 함수만 둔다.
 */

/** 중복 없이 큰 기수부터 정렬한다. */
export function cohortsOf(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => b - a);
}

/** 고른 기수가 현재 기수보다 앞선(지난) 기수인지. */
export function isPastCohort(cohort: number, currentCohort: number): boolean {
  return cohort < currentCohort;
}

/** 기수 → 반기 표기 대응표에서 표기를 찾는다. 대응표에 없으면 기수 번호를 그대로 보여준다. */
export function cohortLabelOf(labels: Readonly<Record<number, string>>, cohort: number): string {
  return labels[cohort] ?? `${cohort}기`;
}
