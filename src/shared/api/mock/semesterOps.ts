/**
 * 반기 임시 API 공용 처리: 현재 반기 전환(HOST 팀 떼기 포함), 상태 검사, 반기 기록 건수, 휴강 영향 건수.
 * 옛 반기 API(commonRoutes.ts)와 반기 관리 API(seasonRoutes.ts)가 함께 쓴다.
 */
import type { Database } from 'sql.js';

import type { CommonWeek, SemesterDto } from '@/entities/cohort/model/dto';
import { execute, queryAll } from '@/shared/db/createDatabase';

import { cleanupHostAccounts } from './hostCleanup';
import { ApiError } from './router';

const currentCohort = (db: Database): number | null =>
  queryAll<{ cohort: number }>(db, 'SELECT cohort FROM cohorts WHERE is_current = 1')[0]?.cohort ??
  null;

/**
 * 이 반기를 현재 반기(진행)로 만든다. 준비 반기였으면 준비 표시를 지운다.
 * 다른 반기에서 넘어오면 시작 전·진행 중인 그룹을 맡지 않은 HOST 계정을 지운다(요청 트랜잭션 안, 설계 3.4).
 */
export function makeSemesterCurrent(db: Database, cohort: number): void {
  const isRollover = currentCohort(db) !== cohort;
  execute(db, 'UPDATE cohorts SET is_current = 0 WHERE is_current = 1');
  execute(db, 'UPDATE cohorts SET is_current = 1, is_preparing = 0 WHERE cohort = ?', [cohort]);
  if (isRollover) {
    // 지난 반기 팀은 종료된 그룹이 되므로 그 팀만 맡은 HOST 계정을 지운다.
    // 리더 연결(admin_group_leader)은 트리거가 새 현재 반기 기준으로 다시 만든다.
    cleanupHostAccounts(db);
  }
}

/**
 * 삭제는 진행 예정 반기만 한다. 진행 중·종료 반기는 409 SEMESTER_LOCKED.
 * message는 막을 때 보일 문구다. 예: '진행 중이거나 종료된 반기는 삭제할 수 없습니다.'
 */
export function assertPreparing(semester: SemesterDto, message: string): void {
  if (semester.status !== 'PREPARING') throw new ApiError(409, 'SEMESTER_LOCKED', message);
}

/** 반기에 묶인 기록 건수. 출결은 입력하지 않은 칸(unmarked)을 빼고 센다. 반기를 지워도 이 기록은 남는다. */
export interface SemesterRecordCounts {
  teams: number;
  attendance: number;
  events: number;
}

export function semesterRecordCounts(db: Database, cohort: number): SemesterRecordCounts {
  const countOf = (sql: string) => queryAll<{ n: number }>(db, sql, [cohort])[0].n;
  return {
    teams: countOf('SELECT COUNT(*) AS n FROM teams WHERE semester_cohort = ?'),
    attendance: countOf(
      `SELECT COUNT(*) AS n FROM attendance_records r JOIN teams t ON t.id = r.team_id
        WHERE t.semester_cohort = ? AND r.status <> 'unmarked'`,
    ),
    events: countOf('SELECT COUNT(*) AS n FROM events WHERE semester_cohort = ?'),
  };
}

/**
 * 공통 주차 하나를 휴강으로 바꾸면 계산에서 빠지는 출결 세션·기록 수(백엔드 ATT-09 impact).
 * 출결 주차 날짜(cohort_week_dates)가 그 주 안에 있는 세션을 센다. 기록은 입력된 것(unmarked 제외)만 센다.
 * shortcut: 승인 대기 제출·스터디 회차 수는 임시 DB에 없어 세지 않는다. 백엔드 연동 때 서버 값으로 바뀐다.
 */
export function voidImpactOf(
  db: Database,
  cohort: number,
  week: CommonWeek,
): { sessionCount: number; recordCount: number } {
  const row = queryAll<{ sessions: number; records: number }>(
    db,
    `SELECT COUNT(DISTINCT s.team_id || '|' || s.week_id) AS sessions,
            COUNT(r.member_id) AS records
       FROM attendance_sessions s
       JOIN teams t ON t.id = s.team_id
       JOIN weeks w ON w.id = s.week_id
       JOIN cohort_week_dates d ON d.cohort = t.semester_cohort AND d.week_num = w.week_num
       LEFT JOIN attendance_records r
         ON r.team_id = s.team_id AND r.week_id = s.week_id AND r.status <> 'unmarked'
      WHERE t.semester_cohort = ? AND d.date BETWEEN ? AND ?`,
    [cohort, week.startDate, week.endDate],
  )[0];
  return { sessionCount: row?.sessions ?? 0, recordCount: row?.records ?? 0 };
}
