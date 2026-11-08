/**
 * 그룹(ADV 팀·스터디)의 진행 상태. 백엔드 HOST 계정·그룹 리더 설계문서(2026-11-06판) 4.1의 판정을 임시 DB로 옮겼다.
 *  · 시작 전: 현재 반기보다 뒤 반기의 팀(백엔드: Season DRAFT)
 *  · 진행 중: 현재 반기의 팀. 스터디는 자기 기간(semester_periods의 방학·학기)의 종료일까지(당일 포함)
 *  · 종료: 지난 반기의 팀, 현재 반기여도 기간이 끝난 스터디
 * 그룹 계정 관리 표, HOST 계정 발급, HOST 계정 정리가 모두 이 판정을 쓴다.
 * 반기 상태(준비·진행·종료)가 생기면(반기 관리 SYS-SEM) 반기 비교를 그 상태로 바꾼다.
 */
import type { Database } from 'sql.js';

import { queryAll } from '@/shared/db/createDatabase';
import { localDateTime } from '@/shared/lib/date';

export type GroupState = 'UPCOMING' | 'IN_PROGRESS' | 'ENDED';

/** 오늘 날짜(YYYY-MM-DD, 이 컴퓨터 시각). toISOString은 UTC라 오전에 하루 전 날짜가 된다. */
export const todayOf = (): string => localDateTime().slice(0, 10);

interface GroupRow extends Record<string, unknown> {
  id: string;
  group_type: 'ADV' | 'STUDY';
  semester_cohort: number;
  current_cohort: number;
  period_end: string | null;
}

/** 모든 ADV 팀·스터디의 진행 상태(팀 id → 상태). 현재 반기가 없으면 빈 목록이다. */
export function groupStates(db: Database, today: string = todayOf()): Map<string, GroupState> {
  const rows = queryAll<GroupRow>(
    db,
    `SELECT t.id, t.group_type, t.semester_cohort, c.cohort AS current_cohort, p.end_date AS period_end
       FROM teams t
       JOIN cohorts c ON c.is_current = 1
       LEFT JOIN semester_periods p ON p.cohort = t.semester_cohort AND p.period = t.period
      WHERE t.group_type IN ('ADV', 'STUDY')`,
  );
  return new Map(rows.map((row) => [row.id, stateOf(row, today)]));
}

function stateOf(row: GroupRow, today: string): GroupState {
  if (row.semester_cohort > row.current_cohort) return 'UPCOMING';
  if (row.semester_cohort < row.current_cohort) return 'ENDED';
  // ADV 팀은 기간이 없어 반기만 본다(설계 4.1). 기간이 정해지지 않은 스터디는 반기 끝까지 진행 중이다.
  const isPeriodOver =
    row.group_type === 'STUDY' && row.period_end !== null && row.period_end < today;
  return isPeriodOver ? 'ENDED' : 'IN_PROGRESS';
}
