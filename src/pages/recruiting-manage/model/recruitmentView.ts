/**
 * 리크루팅 관리 화면의 계산 함수. 화면 코드에서 떼어 내 테스트한다(tests/recruitmentView.test.ts).
 */
import type { QuestionChange } from '@/entities/recruitment/model/useQuestions';
import type { Question, QuestionCategory, Recruitment } from '@/entities/recruitment/model/types';

/** 문항 분류 이름과 화면에 보이는 순서. */
export const CATEGORY_LABEL: Readonly<Record<QuestionCategory, string>> = {
  COMMON: '전체 공통',
  ANALYSIS: '데이터 분석',
  ENGINEERING: '데이터 엔지니어링',
  VISUALIZATION: '데이터 시각화',
};
export const CATEGORY_ORDER: readonly QuestionCategory[] = [
  'COMMON',
  'ANALYSIS',
  'ENGINEERING',
  'VISUALIZATION',
];

/** 모집 예정 · 모집 진행 중 · 모집 마감. API에 값이 없어 접수 기간으로 계산한다. */
export type RecruitmentStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED';

/** now는 한국 시각 'YYYY-MM-DDTHH:mm:ss'(shared/lib/date.ts의 kstDateTime). 같은 형식끼리라 문자열로 비교한다. */
export function recruitmentStatusOf(
  recruitment: Pick<Recruitment, 'start_date' | 'end_date'>,
  now: string,
): RecruitmentStatus {
  if (now < recruitment.start_date) return 'UPCOMING';
  return now <= recruitment.end_date ? 'ACTIVE' : 'CLOSED';
}

/** 날짜 입력값('YYYY-MM-DD')을 접수 시작(0시) 또는 마감(23시 59분 59초) 일시로 바꾼다. */
export function toDateTime(date: string, edge: 'start' | 'end'): string {
  return `${date}T${edge === 'start' ? '00:00:00' : '23:59:59'}`;
}

/**
 * 공고 수정 요청에 넣을 접수 일시. 날짜를 바꾸지 않은 쪽은 뺀다.
 * 화면은 날짜만 고치므로, 그대로 둔 날짜까지 보내면 0시·23시 59분이 아닌 기존 시각을 덮어쓴다.
 */
export function changedPeriod(
  original: Pick<Recruitment, 'start_date' | 'end_date'> | undefined,
  startDate: string,
  endDate: string,
): { start_date?: string; end_date?: string } {
  return {
    ...(original?.start_date.slice(0, 10) === startDate
      ? {}
      : { start_date: toDateTime(startDate, 'start') }),
    ...(original?.end_date.slice(0, 10) === endDate
      ? {}
      : { end_date: toDateTime(endDate, 'end') }),
  };
}

/** 전형 일정 한 단계. 서버는 이 모양을 검사하지 않으므로 화면이 정한 키 이름이다. */
export interface ScheduleStep {
  step: string;
  startDate: string;
  endDate: string;
}

const isScheduleStep = (value: unknown): value is ScheduleStep =>
  typeof value === 'object' &&
  value !== null &&
  ['step', 'startDate', 'endDate'].every((key) => typeof Reflect.get(value, key) === 'string');

/** 서버가 준 전형 일정 중 화면에 그릴 수 있는 항목만 고른다. */
export function scheduleStepsOf(schedule: readonly unknown[]): ScheduleStep[] {
  return schedule.filter(isScheduleStep);
}

/** 같은 분류에서 가장 큰 순서 번호 다음 번호. 중간에 빈 번호가 있어도 겹치지 않는다. */
export function nextOrderNum(questions: readonly Question[], category: QuestionCategory): number {
  return (
    Math.max(0, ...questions.filter((q) => q.category === category).map((q) => q.order_num)) + 1
  );
}

/**
 * 문항을 같은 분류 안에서 한 칸 옮기는 수정 요청 목록. 옮길 수 없으면 빈 목록이다.
 * 서버가 같은 분류의 순서 번호 중복을 막으므로, 빈 번호로 먼저 옮긴 뒤 두 번호를 바꾼다(차례로 보내야 한다).
 */
export function moveQuestionChanges(
  questions: readonly Question[],
  questionId: number,
  direction: 'UP' | 'DOWN',
): QuestionChange[] {
  const target = questions.find((q) => q.question_id === questionId);
  if (!target) return [];
  const siblings = questions
    .filter((q) => q.category === target.category)
    .sort((a, b) => a.order_num - b.order_num);
  const neighbor = siblings[siblings.indexOf(target) + (direction === 'UP' ? -1 : 1)];
  if (!neighbor) return [];
  return [
    { questionId, request: { order_num: nextOrderNum(questions, target.category) } },
    { questionId: neighbor.question_id, request: { order_num: target.order_num } },
    { questionId, request: { order_num: neighbor.order_num } },
  ];
}

/** 양식의 {이름} 자리를 값으로 바꾼다. 값을 주지 않은 변수는 그대로 둔다. */
export function fillMessageTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? values[key] : match,
  );
}
