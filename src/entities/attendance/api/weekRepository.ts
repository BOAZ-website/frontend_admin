import type { Database } from 'sql.js';

import { queryAll } from '@/shared/db/createDatabase';

import type { WeekInfo } from '../model/week';

/** 임시 DB의 weeks 테이블에서 주차 목록과 활성 상태를 읽는다. */
export function loadWeeks(db: Database): WeekInfo[] {
  return queryAll<{
    id: string;
    week_num: number;
    period: '방학' | '학기';
    label: string;
    status: WeekInfo['status'];
  }>(db, 'SELECT id, week_num, period, label, status FROM weeks ORDER BY week_num').map((row) => ({
    id: row.id,
    weekNum: row.week_num,
    period: row.period,
    label: row.label,
    status: row.status,
  }));
}
