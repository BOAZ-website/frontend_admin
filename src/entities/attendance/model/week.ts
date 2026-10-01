/**
 * 주차의 활성 상태는 코드가 아니라 DB(weeks 테이블)의 status가 정한다.
 *  - CLOSED   종료: 기록은 보이고 입력은 잠긴다
 *  - OPEN     진행 중: 출결을 입력할 수 있다
 *  - UPCOMING 진행 예정: 아직 열리지 않았다(미정, 입력 불가)
 */
export type WeekStatus = 'CLOSED' | 'OPEN' | 'UPCOMING';

/**
 * ADV 출결은 이 주차까지는 ADV 출결 관리 탭에서 입력·제출하고, 그다음 주차부터는 팀이 ADV 출결 입력 탭에서 작성한다.
 * 두 탭은 같은 DB를 보므로 입력 탭의 이 주차까지는 출결 관리 탭에서 입력한 값이 그대로 보인다.
 */
export const ADV_DIRECT_SELECT_LAST_WEEK = 3;

export interface WeekInfo {
  id: string;
  weekNum: number;
  period: '방학' | '학기';
  label: string;
  status: WeekStatus;
}

/** 주차 번호의 상태. 목록에 없는 주차는 아직 열리지 않은 것으로 본다. */
export function weekStatusOf(weeks: readonly WeekInfo[], weekNum: number): WeekStatus {
  return weeks.find((week) => week.weekNum === weekNum)?.status ?? 'UPCOMING';
}

/** 진행 예정이 아닌(종료·진행 중) 주차인지. 출결 기록이 존재하고 조회 대상이 되는 주차다. */
export function isHeldWeek(weeks: readonly WeekInfo[], weekNum: number): boolean {
  return weekStatusOf(weeks, weekNum) !== 'UPCOMING';
}

/** 지금 진행 중인 기간. 기본 주차(진행 중 → 마지막 종료 주차)가 속한 기간이며, 주차 목록이 비어 있으면 알 수 없어 null이다. */
export function currentPeriodOf(weeks: readonly WeekInfo[]): WeekInfo['period'] | null {
  if (weeks.length === 0) return null;
  const weekNum = defaultWeekNum(weeks);
  return weeks.find((week) => week.weekNum === weekNum)?.period ?? null;
}

/**
 * 화면이 처음 보여줄 주차. 진행 중인 주차가 있으면 가장 뒤의 진행 중 주차,
 * 없으면 종료된 주차 중 가장 뒤, 그것도 없으면 첫 주차.
 */
export function defaultWeekNum(weeks: readonly WeekInfo[]): number {
  const sorted = [...weeks].sort((a, b) => a.weekNum - b.weekNum);
  const open = sorted.filter((week) => week.status === 'OPEN').at(-1);
  if (open) return open.weekNum;
  const closed = sorted.filter((week) => week.status === 'CLOSED').at(-1);
  return closed?.weekNum ?? sorted[0]?.weekNum ?? 1;
}
