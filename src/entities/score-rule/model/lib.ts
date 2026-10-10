import type { ScoreRule } from './types';

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

/** 해당 날짜에 적용되는 최신 점수 규칙 버전. */
export function getRuleForDate(rules: ScoreRule[], date: string): ScoreRule | undefined {
  return rules
    .filter(
      (rule) =>
        rule.status !== 'DRAFT' &&
        rule.startDate <= date &&
        (rule.endDate === null || date <= rule.endDate),
    )
    .sort((a, b) => b.version - a.version)[0];
}

/** 현재 점수 계산에 사용하는 활성 규칙 버전. */
export function getActiveRule(rules: ScoreRule[]): ScoreRule | undefined {
  return rules.find((rule) => rule.status === 'ACTIVE');
}

/**
 * 날짜 범위를 보기 좋게 포맷팅합니다 (예: 2026.07.01 ~ 2026.12.31 또는 2026.07.01 ~ 진행 중)
 */
export function formatDateRange(startDate?: string, endDate?: string | null): string {
  const start = startDate ? startDate.replace(/-/g, '.') : '미지정';
  const end = endDate ? endDate.replace(/-/g, '.') : '진행 중';
  return `${start} ~ ${end}`;
}
