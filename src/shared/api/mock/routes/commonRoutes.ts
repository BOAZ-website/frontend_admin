/**
 * 출결 화면들이 공통으로 쓰는 기준 데이터: 반기(기수·반기 표기·현재 반기·ADV 기수·점수 집계 대상 기수),
 * 반기별 주차 진행 상태와 날짜, 부문. 회원 검색·이름 검증은 userRoutes.ts에 있다.
 * 화면이 계산하던 값(현재·다음 반기, 반기 표기, 기본 주차)은 모두 여기서 DB를 읽어 내려준다.
 */
import type { Database } from 'sql.js';

import type { WeekStatus } from '@/entities/attendance/model/week';
import type { AttendanceMetaResponse } from '@/entities/attendance/model/dto';
import type { SemesterDto } from '@/entities/cohort/model/dto';
import { listSemesterUsers, listUsers } from '@/entities/user/api/usersRepository';
import type { UserTrack } from '@/entities/user/model/types';
import { execute, queryAll } from '@/shared/db/createDatabase';

import { detachTeamsFromHosts, teamIdsOfSemester } from '../hostCleanup';
import {
  currentSemester,
  canCreateNextSemester,
  defaultWeekNumOf,
  findSemesterWeek,
  listSemesters,
  insertSemester,
  nextSemester,
  resolveSemester,
  semesterByCohort,
  semesterWeeks,
  STUDY_PERIODS,
  weekIdOf,
} from '../queries';
import { ApiError, type MockRoute } from '../router';
import {
  type Body,
  oneOf,
  optionalBoolean,
  optionalNumber,
  optionalString,
  parsePositiveInt,
  readBody,
  requiredString,
  stringArray,
  weekDatesOf,
} from '../validate';

const WEEK_STATUSES: readonly WeekStatus[] = ['CLOSED', 'OPEN', 'UPCOMING'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SEMESTER_PATTERN = /^\d{2}-[12]$/;

function dateOf(body: Body, key: string): string | undefined {
  const value = optionalString(body, key);
  if (value !== undefined && !DATE_PATTERN.test(value)) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 값은 YYYY-MM-DD 형식이어야 합니다.`);
  }
  return value;
}

function termsOf(body: Body, key: string): number[] | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some((item) => !Number.isInteger(item) || item <= 0)) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 값은 기수(양의 정수) 배열이어야 합니다.`);
  }
  return [...new Set(value as number[])];
}

function writeMemberTerms(db: Database, cohort: number, terms: readonly number[]): void {
  execute(db, 'DELETE FROM semester_member_terms WHERE cohort = ?', [cohort]);
  terms.forEach((term) =>
    execute(db, 'INSERT INTO semester_member_terms (cohort, term) VALUES (?, ?)', [cohort, term]),
  );
}

function semesterOrThrow(db: Database, cohort: number): SemesterDto {
  const semester = semesterByCohort(db, cohort);
  if (!semester) throw new ApiError(500, 'INTERNAL', '반기를 다시 읽지 못했습니다.');
  return semester;
}

export const commonRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/attendance/meta',
    summary:
      '출결 화면 기준 데이터: 반기 목록·현재/다음 반기·부문·요청한 반기의 주차(상태·날짜)·기본 주차',
    handler: ({ db, query }) => {
      const semester = resolveSemester(db, query.get('semester'));
      const period = oneOf(query.get('period') ?? undefined, STUDY_PERIODS, 'period');
      const weeks = semesterWeeks(db, semester.cohort).filter(
        (week) => !period || week.period === period,
      );
      const response: AttendanceMetaResponse = {
        semesters: listSemesters(db),
        currentSemester: currentSemester(db),
        nextSemester: nextSemester(db),
        canCreateNextSemester: canCreateNextSemester(db),
        semester,
        // tracks 테이블의 CHECK와 외래 키가 회원 부문 값만 허용한다.
        tracks: queryAll<{ name: UserTrack }>(
          db,
          'SELECT name FROM tracks ORDER BY sort_order',
        ).map((row) => row.name),
        periods: [...STUDY_PERIODS],
        weeks,
        defaultWeekNum: defaultWeekNumOf(weeks),
      };
      return response;
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/semesters',
    summary:
      '반기 목록(현재 반기와 지난 반기, 큰 기수부터): 반기 표기·기간·현재 여부·ADV 기수·점수 집계 대상 기수·지금 주차와 기간',
    handler: ({ db }) => listSemesters(db),
  },
  {
    method: 'POST',
    pattern: '/api/v1/semesters',
    summary:
      '반기 등록. 새 반기 시작 때 다음 반기를 등록하는 데 쓴다(팀·출결은 그 반기가 현재 반기가 된 뒤에 만든다). 주차는 모두 진행 예정으로 생긴다',
    handler: ({ db, body }) => {
      const input = readBody(body);
      const cohort = optionalNumber(input, 'cohort');
      const label = requiredString(input, 'semester');
      const startDate = dateOf(input, 'startDate');
      const endDate = dateOf(input, 'endDate');
      if (!cohort || !startDate || !endDate) {
        throw new ApiError(400, 'BAD_REQUEST', 'cohort, startDate, endDate 값이 필요합니다.');
      }
      if (!SEMESTER_PATTERN.test(label)) {
        throw new ApiError(400, 'BAD_REQUEST', 'semester 값은 YY-1 또는 YY-2 형식이어야 합니다.');
      }
      insertSemester(db, {
        cohort,
        semester: label,
        startDate,
        endDate,
        isCurrent: false,
        advTerm: optionalNumber(input, 'advTerm') ?? null,
        memberTerms: termsOf(input, 'memberTerms') ?? [],
        currentWeekNum: null,
        currentPeriod: null,
        attendanceKinds: [],
      });
      return semesterOrThrow(db, cohort);
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/semesters/:semester',
    summary:
      '반기 수정(기간·ADV 기수·점수 집계 대상 기수). 다른 반기를 isCurrent: true로 바꾸면 지난 반기 팀을 HOST 계정에서 떼고(맡은 팀이 없어진 계정은 삭제) 팀·출결은 보존한다',
    handler: ({ db, params, body }) => {
      const semester = resolveSemester(db, params.semester);
      const input = readBody(body);
      if (optionalBoolean(input, 'isCurrent') === false) {
        throw new ApiError(
          400,
          'BAD_REQUEST',
          '현재 반기를 해제하려면 다른 반기를 현재 반기로 지정해 주세요.',
        );
      }
      if (optionalBoolean(input, 'isCurrent') === true) {
        const isRollover = currentSemester(db).cohort !== semester.cohort;
        execute(db, 'UPDATE cohorts SET is_current = 0 WHERE is_current = 1');
        execute(db, 'UPDATE cohorts SET is_current = 1 WHERE cohort = ?', [semester.cohort]);
        if (isRollover) {
          // 새 현재 반기에 없는 팀(지난 반기 팀)은 HOST 계정에서 떼고, 맡은 팀이 남지 않은 계정은 지운다.
          // 이 요청의 트랜잭션 안에서 함께 처리되므로 중간에 실패하면 반기 전환도 취소된다.
          const keep = teamIdsOfSemester(db, semester.cohort);
          detachTeamsFromHosts(db, (teamId) => !keep.has(teamId));
        }
      }
      execute(
        db,
        `UPDATE cohorts SET start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date)
          WHERE cohort = ?`,
        [dateOf(input, 'startDate') ?? null, dateOf(input, 'endDate') ?? null, semester.cohort],
      );
      if ('advTerm' in input) {
        execute(db, 'UPDATE cohorts SET adv_term = ? WHERE cohort = ?', [
          optionalNumber(input, 'advTerm') ?? null,
          semester.cohort,
        ]);
      }
      const memberTerms = termsOf(input, 'memberTerms');
      if (memberTerms) writeMemberTerms(db, semester.cohort, memberTerms);
      return semesterOrThrow(db, semester.cohort);
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/semesters/:semester/members',
    summary:
      '반기별 출결 회원 명단 전체 등록. 본문에 없는 기존 명단은 빠지고 전역 사용자 정보는 유지된다',
    handler: ({ db, params, body }) => {
      const { cohort } = resolveSemester(db, params.semester);
      const userIds = stringArray(readBody(body), 'userIds', { required: true });
      const existingIds = new Set(listUsers(db).map((user) => user.id));
      const missing = userIds.filter((id) => !existingIds.has(id));
      if (missing.length > 0) {
        throw new ApiError(
          400,
          'USER_NOT_FOUND',
          `등록되지 않은 사용자입니다: ${missing.join(', ')}`,
        );
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
      return listSemesterUsers(db, cohort);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/semesters/:semester/weeks',
    summary: '반기의 주차별 진행 상태(종료·진행 중·진행 예정)와 날짜',
    handler: ({ db, params }) => semesterWeeks(db, resolveSemester(db, params.semester).cohort),
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/semesters/:semester/weeks/:weekNum',
    summary: '반기의 한 주차 진행 상태·날짜 변경(주차 열기·마감)',
    handler: ({ db, params, body }) => {
      const { cohort } = resolveSemester(db, params.semester);
      const weekNum = parsePositiveInt(params.weekNum, 'weekNum') as number;
      const weekId = weekIdOf(db, weekNum);
      const input = readBody(body);
      const status = oneOf(optionalString(input, 'status'), WEEK_STATUSES, 'status');
      if (status) {
        execute(
          db,
          `INSERT INTO semester_weeks (cohort, week_id, status) VALUES (?, ?, ?)
           ON CONFLICT(cohort, week_id) DO UPDATE SET status = excluded.status`,
          [cohort, weekId, status],
        );
      }
      if ('date' in input) {
        const date = dateOf(input, 'date');
        if (date) {
          execute(
            db,
            `INSERT INTO cohort_week_dates (cohort, week_num, date) VALUES (?, ?, ?)
             ON CONFLICT(cohort, week_num) DO UPDATE SET date = excluded.date`,
            [cohort, weekNum, date],
          );
        } else {
          execute(db, 'DELETE FROM cohort_week_dates WHERE cohort = ? AND week_num = ?', [
            cohort,
            weekNum,
          ]);
        }
      }
      return findSemesterWeek(db, cohort, weekNum);
    },
  },
  {
    method: 'PUT',
    pattern: '/api/v1/semesters/:semester/week-dates',
    summary: '반기의 주차별 날짜 한 번에 저장(본문에 없는 주차의 날짜는 삭제)',
    handler: ({ db, params, body }) => {
      const { cohort } = resolveSemester(db, params.semester);
      const weekDates = weekDatesOf(readBody(body)) ?? {};
      execute(db, 'DELETE FROM cohort_week_dates WHERE cohort = ?', [cohort]);
      Object.entries(weekDates).forEach(([weekNum, date]) =>
        execute(db, 'INSERT INTO cohort_week_dates (cohort, week_num, date) VALUES (?, ?, ?)', [
          cohort,
          Number(weekNum),
          date,
        ]),
      );
      return semesterWeeks(db, cohort);
    },
  },
];
