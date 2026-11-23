/**
 * 출결 화면이 쓰는 옛 반기 API(/api/v1/semesters)와 반기 데이터 검사.
 * 반기 관리 API(/api/v1/admin/attendance/seasons ...)는 seasonRoutes.test.ts에서 본다.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { SemesterDto, SemesterWeekDto } from '../src/entities/cohort/model/dto';
import type {
  CreateSeasonRequest,
  EnrollmentList,
  SeasonDetail,
  SeasonWeek,
} from '../src/entities/cohort/model/seasonDto';
import { activityWeekDates, commonWeeksOf } from '../src/entities/cohort/model/schedule';
import { ApiError } from '../src/shared/api/apiError';
import { recordWrite } from '../src/shared/api/mock/audit';
import { MOCK_ROUTES } from '../src/shared/api/mock/mockRoutes';
import { createRouter } from '../src/shared/api/mock/router';
import { createDatabase, queryAll } from '../src/shared/db/createDatabase';

const read = (file: string) => readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
const schema = `${read('schema.sql')}
${read('event-schema.sql')}`;
const seed = `${read('seed.sql')}
${read('event-seed.sql')}`;

const BASE = '/api/v1/admin/attendance';

// 진행 예정 반기 27-1(BASE 28, ADV 27). 기간은 월요일 시작·일요일 끝이다.
const NEW_SEASON: CreateSeasonRequest = {
  name: '27-1',
  half: 'H1',
  base_term: 28,
  adv_term: 27,
  score_rule_set_id: 1,
  periods: [
    { period_type: 'VACATION', start_date: '2026-12-28', end_date: '2027-02-28' },
    { period_type: 'SEMESTER', start_date: '2027-03-01', end_date: '2027-06-27' },
  ],
  base_start_on: '2027-01-04',
  adv_start_on: '2027-01-04',
  vacation_study_start_on: '2027-01-04',
  semester_study_start_on: '2027-03-01',
};

function expectApiError(work: () => unknown, status: number, code: string) {
  assert.throws(
    work,
    (error: unknown) => error instanceof ApiError && error.status === status && error.code === code,
  );
}

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(MOCK_ROUTES, { aroundWrite: recordWrite });
  const call = <T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ) => router.dispatch(db, method, path, body) as T;
  call('PUT', '/api/v1/mock/admin-session', { accountId: 1 });
  const dataOf = <T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown) =>
    call<{ data: T }>(method, path, body).data;
  const createDraft = () => dataOf<{ id: number }>('POST', `${BASE}/seasons`, NEW_SEASON);
  return { db, call, dataOf, createDraft };
}

test('반기 목록의 includePreparing은 true·false만 받는다', async () => {
  const { call } = await setup();

  expectApiError(() => call('GET', '/api/v1/semesters?includePreparing=yes'), 400, 'BAD_REQUEST');
  assert.deepEqual(
    call<SemesterDto[]>('GET', '/api/v1/semesters').map((semester) => semester.semester),
    ['26-2', '26-1'],
  );
});

test('진행·종료 반기의 기간·ADV 기수는 옛 반기 수정 API로도 바꿀 수 없다(409 SEMESTER_LOCKED). 진행 예정 반기는 바꿀 수 있다', async () => {
  const { call, createDraft } = await setup();
  const semesterOf = (label: string) =>
    call<SemesterDto[]>('GET', '/api/v1/semesters?includePreparing=true').find(
      (s) => s.semester === label,
    );
  const before = semesterOf('26-2');

  expectApiError(
    () => call('PATCH', '/api/v1/semesters/26-2', { advTerm: 25 }),
    409,
    'SEMESTER_LOCKED',
  );
  expectApiError(
    () => call('PATCH', '/api/v1/semesters/26-1', { endDate: '2026-07-31' }),
    409,
    'SEMESTER_LOCKED',
  );
  assert.deepEqual(semesterOf('26-2'), before);

  createDraft();
  call('PATCH', '/api/v1/semesters/27-1', { endDate: '2027-06-27' });
  assert.equal(semesterOf('27-1')?.endDate, '2027-06-27');
});

test('반기 관리에서 1주차 시작일을 바꿔도 출결 화면이 읽는 주차 API 값은 바뀌지 않는다(따로 관리)', async () => {
  const { db, call, dataOf, createDraft } = await setup();
  const { id } = createDraft();
  const weekDates = () =>
    queryAll<{ week_num: number; date: string }>(
      db,
      'SELECT week_num, date FROM cohort_week_dates WHERE cohort = ? ORDER BY week_num',
      [id],
    );
  const before = call<SemesterWeekDto[]>('GET', '/api/v1/semesters/27-1/weeks');
  const datesBefore = weekDates();

  dataOf('PATCH', `${BASE}/seasons/${id}`, {
    base_start_on: '2027-01-11',
    semester_study_start_on: '2027-03-08',
  });

  assert.deepEqual(call<SemesterWeekDto[]>('GET', '/api/v1/semesters/27-1/weeks'), before);
  assert.deepEqual(weekDates(), datesBefore);
});

test('활동별 주차 날짜는 1주차 시작일에 7일씩 더한 값이다', () => {
  const weeks = activityWeekDates('2027-01-05');

  assert.equal(weeks.length, 8);
  assert.deepEqual(weeks[0], { weekNum: 1, date: '2027-01-05' });
  assert.deepEqual(weeks[2], { weekNum: 3, date: '2027-01-19' });
  // 연도·윤년 경계도 7일 단위로 넘어간다.
  assert.equal(activityWeekDates('2027-12-28')[1].date, '2028-01-04');
  assert.equal(activityWeekDates('2028-02-26')[1].date, '2028-03-04');
  assert.deepEqual(activityWeekDates('not-a-date'), []);
});

test('시드가 SQL로 만든 공통 주차는 화면·임시 API의 계산(commonWeeksOf)과 같다', async () => {
  const { dataOf } = await setup();

  for (const id of [26, 27]) {
    const { periods } = dataOf<SeasonDetail>('GET', `${BASE}/seasons/${id}`);
    const rangeOf = (type: 'VACATION' | 'SEMESTER') => {
      const period = periods.find((item) => item.period_type === type);
      return { startDate: period?.start_date ?? '', endDate: period?.end_date ?? '' };
    };
    const weeks = dataOf<SeasonWeek[]>('GET', `${BASE}/seasons/${id}/weeks`);
    assert.deepEqual(
      weeks.map((week) => ({
        weekNo: week.week_no,
        periodType: week.period_type,
        startDate: week.start_date,
        endDate: week.end_date,
      })),
      commonWeeksOf(rangeOf('VACATION'), rangeOf('SEMESTER')),
    );
  }
  // 26-1의 설 연휴(공통 8주차)는 휴강이다.
  const voidNos = dataOf<SeasonWeek[]>('GET', `${BASE}/seasons/26/weeks`)
    .filter((week) => week.is_void)
    .map((week) => week.week_no);
  assert.deepEqual(voidNos, [8]);
});

test('병행 수료: BASE·ADV 등록이 모두 같은 병행 부문이고 두 반기가 종료됐고 수료 상태면 true, 아니면 false, 병행하지 않으면 null', async () => {
  const { db, dataOf } = await setup();
  const userId = 'u_26_01';
  const completedOf = () =>
    dataOf<EnrollmentList>('GET', `${BASE}/seasons/27/enrollments`).enrollments.find(
      (row) => row.member_id === userId,
    )?.is_parallel_completed;
  const run = (sql: string, params: (string | number)[] = []) => db.run(sql, params);
  // 26-1(종료)에 BASE, 26-2(진행)에 ADV로 같은 병행 부문을 둔다.
  run('UPDATE member_enrollment SET parallel_track = NULL WHERE member_id = ?', [userId]);
  assert.equal(completedOf(), null);

  run(
    `INSERT OR REPLACE INTO member_enrollment (member_id, activity_season_id, season_role, parallel_track)
     VALUES (?, 26, 'BASE', '시각화')`,
    [userId],
  );
  run(
    "UPDATE member_enrollment SET season_role = 'ADV', parallel_track = '시각화' WHERE member_id = ? AND activity_season_id = 27",
    [userId],
  );
  run("UPDATE users SET club_status = 'COMPLETED' WHERE id = ?", [userId]);
  // 26-2가 아직 진행 중이라 수료가 아니다.
  assert.equal(completedOf(), false);

  run('UPDATE cohorts SET is_current = 0 WHERE cohort = 27');
  assert.equal(completedOf(), true);
});
