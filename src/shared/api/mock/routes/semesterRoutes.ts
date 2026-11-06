/**
 * 반기 관리 API(계약 초안: docs/spec/06-system.md §4.6): 새 반기 시작(고른 명단과 함께, 바로 진행 반기가 됨) → 명단 수정(PUT /:semester/members).
 * 반기는 따로 종료하지 않는다. 새 반기를 시작하면 이전 진행 반기가 종료된다(HOST 팀 떼기는 반기 수정과 같다). 반기는 미리 만들지 않는다.
 * 권한(ATTENDANCE_ROSTER_READ·WRITE)은 권한 목록에 아직 없고 임시 API는 경로별 권한을 검사하지 않는다.
 * 종료 반기는 서비스운영팀장(MASTER)만 일정·명단을 고치고 지운다. 반기 삭제는 행을 지우지 않고 deleted_at만 채운다.
 */
import type { Database } from 'sql.js';

import {
  findSemesterSchedule,
  listSemesterRoster,
  updateSemesterSchedule,
} from '@/entities/cohort/api/semesterRepository';
import type { SemesterDto } from '@/entities/cohort/model/dto';
import { execute, queryAll } from '@/shared/db/createDatabase';
import { localDateTime } from '@/shared/lib/date';

import { insertSemester, resolveSemester, semesterByCohort, semesterWeeks } from '../queries';
import { ApiError, type MockRoute } from '../router';
import {
  checkSchedule,
  assertArchivedEditable,
  assertUsersExist,
  makeSemesterCurrent,
  replaceSemesterMemberIds,
  semesterRecordCounts,
} from '../semesterOps';
import { type Body, oneOf, optionalNumber, readBody, stringArray } from '../validate';

const SEMESTER_PATTERN = /^\d{2}-[12]$/;

function checkTerms(body: Body) {
  const baseTerm = optionalNumber(body, 'baseTerm');
  const advTerm = optionalNumber(body, 'advTerm');
  if (!baseTerm || !advTerm) {
    throw new ApiError(400, 'BAD_REQUEST', 'baseTerm, advTerm 값이 필요합니다.');
  }
  if (advTerm >= baseTerm) {
    throw new ApiError(400, 'INVALID_TERM', 'ADV 기수는 BASE 기수보다 작아야 합니다.');
  }
  return { baseTerm, advTerm };
}

const reread = (db: Database, cohort: number): SemesterDto => {
  const semester = semesterByCohort(db, cohort);
  if (!semester) throw new ApiError(500, 'INTERNAL', '반기를 다시 읽지 못했습니다.');
  return semester;
};

const notStatus = (code: string, message: string) => new ApiError(409, code, message);

/**
 * 새 반기 시작 요청을 검증한다: 표기 형식, 기수, 표기·기수 중복, 일정.
 * 지운 반기는 중복 검사에서 빠진다. 같은 기수의 지운 반기는 만들 때 비운다(cohort가 키라서).
 */
function checkStart(db: Database, body: unknown) {
  const input = readBody(body);
  const label = input.semester;
  if (typeof label !== 'string' || !SEMESTER_PATTERN.test(label)) {
    throw new ApiError(400, 'BAD_REQUEST', 'semester 값은 YY-1 또는 YY-2 형식이어야 합니다.');
  }
  const { baseTerm, advTerm } = checkTerms(input);
  const latest = queryAll<{ cohort: number | null }>(
    db,
    'SELECT MAX(cohort) AS cohort FROM cohorts WHERE deleted_at IS NULL',
  )[0].cohort;
  if (latest !== null && baseTerm <= latest) {
    throw new ApiError(
      400,
      'INVALID_TERM',
      'BASE 기수는 지금까지 등록된 반기보다 큰 기수여야 합니다.',
    );
  }
  const clash = queryAll<{ cohort: number }>(
    db,
    `SELECT cohort FROM cohorts
      WHERE deleted_at IS NULL AND (cohort = ? OR semester_label = ? OR adv_term = ?)`,
    [baseTerm, label, advTerm],
  );
  if (clash.length > 0) {
    throw notStatus('SEMESTER_DUPLICATE', '같은 반기 표기·기수·ADV 기수의 반기가 이미 있습니다.');
  }
  // shortcut: 지운 반기는 만들 때 행을 비우고 다시 넣는다(cohort가 키라서). 그 행을 팀·점수 규칙이 가리키면 비울 수 없어 막는다.
  // 실제 백엔드에서 반기 키를 기수와 떼면 없앨 제약이다.
  const isReferenced =
    queryAll(
      db,
      `SELECT 1 FROM cohorts c
        WHERE c.cohort = ? AND c.deleted_at IS NOT NULL
          AND (EXISTS (SELECT 1 FROM teams WHERE semester_cohort = c.cohort)
               OR EXISTS (SELECT 1 FROM score_rules WHERE term = c.cohort))`,
      [baseTerm],
    ).length > 0;
  if (isReferenced) {
    throw notStatus(
      'SEMESTER_DUPLICATE',
      `지운 ${baseTerm}기 반기에 팀·점수 규칙이 연결되어 있어 같은 기수로 만들 수 없습니다.`,
    );
  }
  return { input, label, baseTerm, advTerm, schedule: checkSchedule(input.schedule) };
}

/** 탈동한 회원은 새 반기 명단에 넣지 않는다. 지난 반기 명단(PUT /members)은 그 뒤에 탈동한 사람도 남아 있어 막지 않는다. */
function assertNotWithdrawn(db: Database, userIds: readonly string[]): void {
  if (userIds.length === 0) return;
  const withdrawn = queryAll<{ name: string }>(
    db,
    `SELECT name FROM users WHERE club_status = 'WITHDRAWN' AND id IN (${userIds.map(() => '?').join(', ')})`,
    [...userIds],
  );
  if (withdrawn.length > 0) {
    throw new ApiError(
      400,
      'USER_WITHDRAWN',
      `탈동한 회원은 명단에 넣을 수 없습니다: ${withdrawn.map((u) => u.name).join(', ')}`,
    );
  }
}

/** 진행 반기에 진행 중인 주차가 있으면 종료할 수 없다(409). 반기 관리에서 주차를 마감한 뒤 새 반기를 시작한다. */
function assertNoOpenWeek(db: Database): void {
  const current = queryAll<{ cohort: number; semester_label: string }>(
    db,
    'SELECT cohort, semester_label FROM cohorts WHERE is_current = 1',
  )[0];
  if (!current) return;
  const openWeeks = semesterWeeks(db, current.cohort).filter((week) => week.status === 'OPEN');
  if (openWeeks.length > 0) {
    throw notStatus(
      'SEMESTER_WEEK_IN_PROGRESS',
      `${current.semester_label}에 진행 중인 주차(${openWeeks.map((week) => week.label).join(', ')})가 있어 종료할 수 없습니다. 주차를 마감한 뒤 새 반기를 시작하세요.`,
    );
  }
}

export const semesterRoutes: MockRoute[] = [
  {
    method: 'POST',
    pattern: '/api/v1/semesters/start',
    summary:
      '새 반기 시작: 반기 + 일정·시작일·무효 주차 + 고른 명단(userIds)을 저장하고 바로 진행 반기로 만든다. 이전 진행 반기는 종료(지난 반기 팀을 HOST 계정에서 뗌). 실패하면 모두 취소. 명단은 자동으로 채우지 않는다. 없는 회원은 400 USER_NOT_FOUND, 탈동 회원은 400 USER_WITHDRAWN, 빈 명단은 409 ROSTER_EMPTY, 이전 반기에 진행 중인 주차가 있으면 409 SEMESTER_WEEK_IN_PROGRESS',
    handler: ({ db, body }) => {
      const { input, label, baseTerm, advTerm, schedule } = checkStart(db, body);
      const userIds = stringArray(input, 'userIds');
      assertUsersExist(db, userIds);
      assertNotWithdrawn(db, userIds);
      if (userIds.length === 0) {
        throw notStatus('ROSTER_EMPTY', '명단에 사람을 더한 뒤 반기를 시작하세요.');
      }
      assertNoOpenWeek(db);
      // 같은 기수의 지운 반기가 남아 있으면 비운다(가리키는 팀·점수 규칙이 없는 것은 checkStart가 확인했다).
      execute(db, 'DELETE FROM cohorts WHERE cohort = ? AND deleted_at IS NOT NULL', [baseTerm]);

      insertSemester(db, {
        cohort: baseTerm,
        semester: label,
        startDate: schedule.vacation.startDate,
        endDate: schedule.term.endDate,
        isCurrent: false,
        status: 'ACTIVE',
        advTerm,
        memberTerms: [advTerm, baseTerm],
        currentWeekNum: null,
        currentPeriod: null,
        attendanceKinds: [],
      });
      updateSemesterSchedule(db, baseTerm, schedule);
      replaceSemesterMemberIds(db, baseTerm, userIds);
      makeSemesterCurrent(db, baseTerm);
      return reread(db, baseTerm);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/semesters/:semester/roster',
    summary:
      '반기에 저장된 출결·점수 명단. 구분은 BASE·ADV 기수면 BASE·ADV, 그 밖은 EXTRA(수료 기수)',
    handler: ({ db, params }) => {
      const semester = resolveSemester(db, params.semester);
      return listSemesterRoster(db, semester.cohort, semester.advTerm);
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/semesters/:semester',
    summary:
      '종료 반기 삭제(soft delete: deleted_at만 채우고 팀·출결·행사 기록은 남긴다). 진행 반기는 409, 종료 반기는 서비스운영팀장만. 종료 반기에 기록이 있으면 force=true일 때만 지운다',
    handler: ({ db, params, query }) => {
      const semester = resolveSemester(db, params.semester);
      if (semester.status === 'ACTIVE') {
        throw notStatus('SEMESTER_ACTIVE', '진행 중인 반기는 삭제할 수 없습니다.');
      }
      assertArchivedEditable(db, semester, '종료된 반기는 서비스운영팀장만 삭제할 수 있습니다.');
      const isForced =
        oneOf(query.get('force') ?? undefined, ['true', 'false'], 'force') === 'true';
      const records = semesterRecordCounts(db, semester.cohort);
      if (semester.status === 'ENDED' && !isForced && Object.values(records).some((n) => n > 0)) {
        throw notStatus(
          'SEMESTER_HAS_RECORDS',
          `${semester.semester}에 팀 ${records.teams}개, 출결 ${records.attendance}건, 행사 ${records.events}개 기록이 있습니다. 반기를 지워도 이 기록은 지워지지 않습니다.`,
        );
      }
      execute(db, 'UPDATE cohorts SET deleted_at = ? WHERE cohort = ?', [
        localDateTime(),
        semester.cohort,
      ]);
      return semester;
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/semesters/:semester/schedule',
    summary: '반기 일정: 방학·학기 기간, 활동별 1주차 시작일과 주차 날짜, 무효 주차',
    handler: ({ db, params }) =>
      findSemesterSchedule(db, resolveSemester(db, params.semester).cohort),
  },
  {
    method: 'PUT',
    pattern: '/api/v1/semesters/:semester/schedule',
    summary:
      '반기 일정 통째로 저장(기간·시작일·무효 주차). 출결 생성 창이 읽는 주차 날짜(cohort_week_dates)도 시작일로 다시 채운다',
    handler: ({ db, params, body }) => {
      const semester = resolveSemester(db, params.semester);
      assertArchivedEditable(
        db,
        semester,
        '종료된 반기의 일정은 서비스운영팀장만 고칠 수 있습니다.',
      );
      const { cohort } = semester;
      updateSemesterSchedule(db, cohort, checkSchedule(body));
      return findSemesterSchedule(db, cohort);
    },
  },
];
