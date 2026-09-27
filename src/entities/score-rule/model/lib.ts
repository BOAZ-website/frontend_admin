import type { ScoreRule, ScoreRuleStatus } from './types';

/**
 * YYYY-MM-DD 형식의 오늘 날짜를 반환합니다.
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 기수(Term)에 해당하는 점수 규칙을 조회합니다.
 * 집계 화면(ScoresPage) 등에서 과거/특정 기수의 배점 기준을 조회할 때 사용됩니다.
 */
export function getRuleForTerm(
  rules: ScoreRule[],
  term: number | string
): ScoreRule | undefined {
  const termNum = typeof term === 'string' ? parseInt(term.replace(/[^0-9]/g, ''), 10) : term;
  if (isNaN(termNum)) return undefined;
  
  // 1. 해당 기수의 ACTIVE 규칙 우선
  const activeRule = rules.find((r) => r.term === termNum && r.status === 'ACTIVE');
  if (activeRule) return activeRule;

  // 2. 해당 기수의 규칙 중 가장 최근 버전
  return rules
    .filter((r) => r.term === termNum)
    .sort((a, b) => (b.version || 0) - (a.version || 0))[0];
}

/**
 * 특정 일자(기본값: 오늘)가 적용 기간(startDate ~ endDate)에 포함되는 유효 점수 규칙을 조회합니다.
 * 실시간 출결 입력 및 현재 시점 조회 시 사용됩니다.
 */
export function getRuleForDate(
  rules: ScoreRule[],
  dateStr: string = getTodayString()
): ScoreRule {
  // 1. 날짜 범위(startDate <= dateStr <= endDate)에 일치하는 활성 규칙 탐색
  const matchedRule = rules.find((r) => {
    if (r.status === 'DRAFT') return false;
    const isAfterStart = !r.startDate || r.startDate <= dateStr;
    const isBeforeEnd = !r.endDate || dateStr <= r.endDate;
    return isAfterStart && isBeforeEnd;
  });

  if (matchedRule) return matchedRule;

  // 2. 일치하는 기간이 없을 경우 ACTIVE 상태인 규칙 반환
  const activeRule = rules.find((r) => r.status === 'ACTIVE');
  if (activeRule) return activeRule;

  // 3. 최후의 수단으로 첫 번째 규칙 반환
  return rules[0];
}

/**
 * 규칙의 날짜와 오늘 날짜를 비교하여 실제 운영 상태를 계산합니다.
 */
export function getRuleEffectiveStatus(
  rule: ScoreRule,
  todayStr: string = getTodayString()
): {
  status: ScoreRuleStatus;
  label: string;
  badgeClass: string;
  isCurrent: boolean;
} {
  if (rule.status === 'DRAFT') {
    return {
      status: 'DRAFT',
      label: '초안 (작성 중)',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      isCurrent: false,
    };
  }

  const isAfterStart = !rule.startDate || rule.startDate <= todayStr;
  const isBeforeEnd = !rule.endDate || todayStr <= rule.endDate;

  if (!isAfterStart) {
    return {
      status: 'SCHEDULED',
      label: '시작 예정',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      isCurrent: false,
    };
  }

  if (!isBeforeEnd || rule.status === 'INACTIVE') {
    return {
      status: 'INACTIVE',
      label: '적용 만료 (과거 기수)',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      isCurrent: false,
    };
  }

  return {
    status: 'ACTIVE',
    label: '현재 적용 중',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold',
    isCurrent: true,
  };
}

/**
 * 날짜 범위를 보기 좋게 포맷팅합니다 (예: 2026.07.01 ~ 2026.12.31 또는 2026.07.01 ~ 지속)
 */
export function formatDateRange(startDate?: string, endDate?: string | null): string {
  const start = startDate ? startDate.replace(/-/g, '.') : '미지정';
  const end = endDate ? endDate.replace(/-/g, '.') : '기수 종료 시까지';
  return `${start} ~ ${end}`;
}
