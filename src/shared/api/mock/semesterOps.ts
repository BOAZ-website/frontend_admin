/**
 * 반기 임시 API 공용 처리: 현재 반기 전환(HOST 팀 떼기 포함), 명단 교체, 일정 요청 검증.
 * 반기 수정(PATCH)과 반기 관리(준비 → 활성화)가 같은 규칙을 쓴다. DB 읽기·쓰기는 entities/cohort/api/semesterRepository.ts.
 */
import type { Database } from 'sql.js';

import type { SemesterScheduleInput } from '@/entities/cohort/api/semesterRepository';
import type { DateRange, SemesterActivity } from '@/entities/cohort/model/dto';
import { ACTIVITY_WEEK_COUNT } from '@/entities/cohort/model/schedule';
import { execute, queryAll } from '@/shared/db/createDatabase';
import { isValidIsoDate } from '@/shared/lib/date';

import { detachTeamsFromHosts, teamIdsOfSemester } from './hostCleanup';
import { ApiError } from './router';
import { readBody } from './validate';

/** 1주차 시작일·무효 주차를 따로 정하는 활동. */
export const SEMESTER_ACTIVITIES: readonly SemesterActivity[] = [
  'BASE',
  'ADV',
  'STUDY_VACATION',
  'STUDY_TERM',
];

const currentCohort = (db: Database): number | null =>
  queryAll<{ cohort: number }>(db, 'SELECT cohort FROM cohorts WHERE is_current = 1')[0]?.cohort ??
  null;

/**
 * 이 반기를 현재 반기(진행)로 만든다. 준비 반기였으면 준비 표시를 지운다.
 * 다른 반기에서 넘어오면 지난 반기 팀을 HOST 계정에서 뗀다(요청 트랜잭션 안).
 */
export function makeSemesterCurrent(db: Database, cohort: number): void {
  const isRollover = currentCohort(db) !== cohort;
  execute(db, 'UPDATE cohorts SET is_current = 0 WHERE is_current = 1');
  execute(db, 'UPDATE cohorts SET is_current = 1, is_preparing = 0 WHERE cohort = ?', [cohort]);
  if (isRollover) {
    // 새 현재 반기에 없는 팀(지난 반기 팀)은 HOST 계정에서 떼고, 맡은 팀이 남지 않은 계정은 지운다.
    const keep = teamIdsOfSemester(db, cohort);
    detachTeamsFromHosts(db, (teamId) => !keep.has(teamId));
  }
}

/** 반기 출결 회원 명단을 통째로 바꾼다. 없는 사용자가 있으면 아무것도 바꾸지 않고 400. */
export function replaceSemesterMemberIds(
  db: Database,
  cohort: number,
  userIds: readonly string[],
): void {
  const existing = new Set(queryAll<{ id: string }>(db, 'SELECT id FROM users').map((u) => u.id));
  const missing = userIds.filter((id) => !existing.has(id));
  if (missing.length > 0) {
    throw new ApiError(400, 'USER_NOT_FOUND', `등록되지 않은 사용자입니다: ${missing.join(', ')}`);
  }
  execute(db, 'DELETE FROM semester_members WHERE cohort = ?', [cohort]);
  [...new Set(userIds)].forEach((userId) =>
    execute(
      db,
      `INSERT INTO semester_members (cohort, user_id, name, term, track)
       SELECT ?, id, name, term, track FROM users WHERE id = ?`,
      [cohort, userId],
    ),
  );
}

const badDate = (message: string) => new ApiError(400, 'INVALID_DATE_RANGE', message);

function checkDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !isValidIsoDate(value)) {
    throw new ApiError(400, 'BAD_REQUEST', `${label}은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.`);
  }
  return value;
}

function checkRange(value: unknown, label: string): DateRange {
  if (value === undefined || value === null) {
    throw new ApiError(400, 'BAD_REQUEST', `${label} 기간이 필요합니다.`);
  }
  const range = readBody(value);
  const startDate = checkDate(range.startDate, `${label} 시작일`);
  const endDate = checkDate(range.endDate, `${label} 종료일`);
  if (startDate > endDate) throw badDate(`${label} 시작일은 종료일보다 늦을 수 없습니다.`);
  return { startDate, endDate };
}

const badInvalidWeek = () =>
  new ApiError(
    400,
    'BAD_REQUEST',
    `무효 주차는 활동(${SEMESTER_ACTIVITIES.join(', ')})과 1~${ACTIVITY_WEEK_COUNT}주차로 지정해야 합니다.`,
  );

/**
 * 일정 요청 본문(SaveSemesterScheduleRequest 모양)을 검증해 정리된 값으로 돌려준다.
 * 날짜 형식·순서, 시작일이 반기 안인지, 무효 주차 범위를 본다.
 */
export function checkSchedule(body: unknown): SemesterScheduleInput {
  const request = readBody(body);
  const vacation = checkRange(request.vacation, '방학');
  const term = checkRange(request.term, '학기');
  if (vacation.endDate >= term.startDate) {
    throw badDate('방학 종료일은 학기 시작일보다 앞이어야 합니다.');
  }
  const starts: SemesterScheduleInput['starts'] = {};
  const activityStarts = readBody(request.activityStarts);
  SEMESTER_ACTIVITIES.forEach((activity) => {
    const value = activityStarts[activity];
    if (value === undefined || value === null) return;
    const date = checkDate(value, `${activity} 시작일`);
    if (date < vacation.startDate || date > term.endDate) {
      throw badDate(`${activity} 시작일은 방학 시작일과 학기 종료일 사이여야 합니다.`);
    }
    starts[activity] = date;
  });
  const invalid = new Map<string, SemesterScheduleInput['invalidWeeks'][number]>();
  const weeks = request.invalidWeeks ?? [];
  if (!Array.isArray(weeks)) throw badInvalidWeek();
  weeks.forEach((item: unknown) => {
    const week = readBody(item);
    const activity = SEMESTER_ACTIVITIES.find((value) => value === week.activity);
    const { weekNum, reason } = week;
    if (
      !activity ||
      typeof weekNum !== 'number' ||
      !Number.isInteger(weekNum) ||
      weekNum < 1 ||
      weekNum > ACTIVITY_WEEK_COUNT ||
      (reason !== undefined && typeof reason !== 'string')
    ) {
      throw badInvalidWeek();
    }
    invalid.set(`${activity}:${weekNum}`, { activity, weekNum, reason: reason ?? '' });
  });
  return { vacation, term, starts, invalidWeeks: [...invalid.values()] };
}
