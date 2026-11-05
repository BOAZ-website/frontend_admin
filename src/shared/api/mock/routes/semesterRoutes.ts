/**
 * 반기 관리 API(계약 초안: docs/spec/06-system.md §4.6): 준비 반기 만들기 → 명단 확인·예외 수정(PUT /:semester/members) → 활성화.
 * 반기는 따로 종료하지 않는다. 다음 반기를 활성화할 때 이전 진행 반기가 종료된다.
 * 반기는 미리 만들지 않는다. 준비 반기는 한 번에 하나이고, 활성화하면 이전 진행 반기는 종료된다(HOST 팀 떼기는 반기 수정과 같다).
 * 권한(ATTENDANCE_ROSTER_READ·WRITE)은 권한 목록에 아직 없고 임시 API는 경로별 권한을 검사하지 않는다.
 */
import {
  findSemesterSchedule,
  listAutoRosterIds,
  listSemesterRoster,
  updateSemesterSchedule,
} from '@/entities/cohort/api/semesterRepository';
import type { SemesterDto } from '@/entities/cohort/model/dto';
import { execute, queryAll } from '@/shared/db/createDatabase';

import { insertSemester, resolveSemester, semesterByCohort, semesterWeeks } from '../queries';
import { ApiError, type MockRoute } from '../router';
import { checkSchedule, makeSemesterCurrent, replaceSemesterMemberIds } from '../semesterOps';
import { type Body, optionalNumber, readBody } from '../validate';

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

const reread = (db: Parameters<typeof semesterByCohort>[0], cohort: number): SemesterDto => {
  const semester = semesterByCohort(db, cohort);
  if (!semester) throw new ApiError(500, 'INTERNAL', '반기를 다시 읽지 못했습니다.');
  return semester;
};

const notStatus = (code: string, message: string) => new ApiError(409, code, message);

export const semesterRoutes: MockRoute[] = [
  {
    method: 'POST',
    pattern: '/api/v1/semesters/prepare',
    summary:
      '준비 반기 만들기: 반기 + 일정·시작일·무효 주차 저장, BASE·ADV 기수의 활동 중 회원으로 명단 자동 생성(실패하면 모두 취소). 진행 반기는 바꾸지 않는다',
    handler: ({ db, body }) => {
      const input = readBody(body);
      const label = input.semester;
      if (typeof label !== 'string' || !SEMESTER_PATTERN.test(label)) {
        throw new ApiError(400, 'BAD_REQUEST', 'semester 값은 YY-1 또는 YY-2 형식이어야 합니다.');
      }
      const { baseTerm, advTerm } = checkTerms(input);
      const latest = queryAll<{ cohort: number | null }>(
        db,
        'SELECT MAX(cohort) AS cohort FROM cohorts',
      )[0].cohort;
      if (latest !== null && baseTerm <= latest) {
        throw new ApiError(
          400,
          'INVALID_TERM',
          'BASE 기수는 지금까지 등록된 반기보다 큰 기수여야 합니다.',
        );
      }
      if (queryAll(db, 'SELECT cohort FROM cohorts WHERE is_preparing = 1').length > 0) {
        throw notStatus(
          'SEMESTER_PREPARING_EXISTS',
          '준비 중인 반기가 이미 있습니다. 활성화하거나 삭제한 뒤 만드세요.',
        );
      }
      const clash = queryAll<{ cohort: number }>(
        db,
        'SELECT cohort FROM cohorts WHERE cohort = ? OR semester_label = ? OR adv_term = ?',
        [baseTerm, label, advTerm],
      );
      if (clash.length > 0) {
        throw notStatus(
          'SEMESTER_DUPLICATE',
          '같은 반기 표기·기수·ADV 기수의 반기가 이미 있습니다.',
        );
      }
      const schedule = checkSchedule(input.schedule);

      insertSemester(db, {
        cohort: baseTerm,
        semester: label,
        startDate: schedule.vacation.startDate,
        endDate: schedule.term.endDate,
        isCurrent: false,
        status: 'PREPARING',
        advTerm,
        memberTerms: [advTerm, baseTerm],
        currentWeekNum: null,
        currentPeriod: null,
        attendanceKinds: [],
      });
      updateSemesterSchedule(db, baseTerm, schedule);
      replaceSemesterMemberIds(db, baseTerm, listAutoRosterIds(db, baseTerm, advTerm));
      return reread(db, baseTerm);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/semesters/:semester/roster',
    summary:
      '반기에 저장된 출결·점수 명단. 구분은 BASE·ADV 기수면 BASE·ADV, 그 밖은 EXTRA(예외 추가)',
    handler: ({ db, params }) => {
      const semester = resolveSemester(db, params.semester);
      return listSemesterRoster(db, semester.cohort, semester.advTerm);
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/semesters/:semester/activate',
    summary:
      '준비 반기 활성화: 진행 반기로 만들고 이전 진행 반기는 종료(지난 반기 팀을 HOST 계정에서 뗌). 명단이 비었거나 이전 반기에 진행 중인 주차가 있으면 409',
    handler: ({ db, params }) => {
      const semester = resolveSemester(db, params.semester);
      if (semester.status !== 'PREPARING') {
        throw notStatus('SEMESTER_NOT_PREPARING', '준비 반기만 활성화할 수 있습니다.');
      }
      if (listSemesterRoster(db, semester.cohort, semester.advTerm).members.length === 0) {
        throw notStatus('ROSTER_EMPTY', '명단이 비어 있는 반기는 활성화할 수 없습니다.');
      }
      const current = queryAll<{ cohort: number; semester_label: string }>(
        db,
        'SELECT cohort, semester_label FROM cohorts WHERE is_current = 1',
      )[0];
      const openWeeks = current
        ? semesterWeeks(db, current.cohort).filter((week) => week.status === 'OPEN')
        : [];
      if (current && openWeeks.length > 0) {
        throw notStatus(
          'SEMESTER_WEEK_IN_PROGRESS',
          `${current.semester_label}에 진행 중인 주차(${openWeeks.map((week) => week.label).join(', ')})가 있어 종료할 수 없습니다. 반기 관리에서 ${current.semester_label}을 열어 주차를 마감한 뒤 활성화하세요.`,
        );
      }
      makeSemesterCurrent(db, semester.cohort);
      return reread(db, semester.cohort);
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/semesters/:semester',
    summary: '준비 반기 삭제(일정·명단도 함께 지움). 진행·종료 반기는 409',
    handler: ({ db, params }) => {
      const semester = resolveSemester(db, params.semester);
      if (semester.status !== 'PREPARING') {
        throw notStatus('SEMESTER_NOT_PREPARING', '준비 반기만 삭제할 수 있습니다.');
      }
      execute(db, 'DELETE FROM cohorts WHERE cohort = ?', [semester.cohort]);
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
      if (semester.status === 'ENDED') {
        throw notStatus('SEMESTER_ARCHIVED', '종료된 반기의 일정은 수정할 수 없습니다.');
      }
      const { cohort } = semester;
      updateSemesterSchedule(db, cohort, checkSchedule(body));
      return findSemesterSchedule(db, cohort);
    },
  },
];
