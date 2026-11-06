import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { AuditLogPage } from '../src/entities/audit-log/model/dto';
import type {
  StartSemesterRequest,
  SaveSemesterScheduleRequest,
  SemesterDto,
  SemesterRosterDto,
  SemesterScheduleDto,
  SemesterWeekDto,
} from '../src/entities/cohort/model/dto';
import { activityWeekDates } from '../src/entities/cohort/model/schedule';
import { loadHosts } from '../src/entities/host-account/api/hostRepository';
import { ApiError } from '../src/shared/api/apiError';
import { recordWrite } from '../src/shared/api/mock/audit';
import { MOCK_ROUTES } from '../src/shared/api/mock/mockRoutes';
import { createRouter } from '../src/shared/api/mock/router';
import { createDatabase, queryAll } from '../src/shared/db/createDatabase';

// 유저 DB + 행사 DB(앱과 같은 순서로 함께 올린다)
const read = (file: string) => readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
const schema = `${read('schema.sql')}
${read('event-schema.sql')}`;
const seed = `${read('seed.sql')}
${read('event-seed.sql')}`;

// 시드의 진행 반기는 26-2(기수 27, ADV 26). 새 반기는 27-1(BASE 28, ADV 27).
const SCHEDULE: SaveSemesterScheduleRequest = {
  vacation: { startDate: '2027-01-01', endDate: '2027-02-28' },
  term: { startDate: '2027-03-02', endDate: '2027-06-30' },
  activityStarts: { BASE: '2027-01-05', STUDY_TERM: '2027-03-09' },
  invalidWeeks: [{ activity: 'BASE', weekNum: 3, reason: '설 연휴' }],
};
const START: StartSemesterRequest = {
  semester: '27-1',
  baseTerm: 28,
  advTerm: 27,
  schedule: SCHEDULE,
  userIds: [],
};

/** shouldCloseWeeks: 시드 26-2의 진행 중인 주차를 먼저 마감한다(마감하지 않으면 새 반기 시작이 409다). */
async function setup({ shouldCloseWeeks = true } = {}) {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(MOCK_ROUTES, { aroundWrite: recordWrite });
  const call = <T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ) => router.dispatch(db, method, path, body) as T;
  // 임시 API는 세션이 없으면 요청자가 없다. 시험은 1번 계정으로 로그인한 채 시작한다.
  call('PUT', '/api/v1/mock/admin-session', { accountId: 1 });
  // 따로 정하지 않으면 BASE·ADV 기수(28·27)의 활동 중 회원을 골라 만든다(화면에서 고르는 것과 같은 결과).
  const activeIds = queryAll<{ id: string }>(
    db,
    "SELECT id FROM users WHERE club_status = 'ACTIVE' AND term IN (27, 28) ORDER BY id",
  ).map((row) => row.id);
  /** 새 반기를 시작한다(기본은 27-1). 만들면 바로 진행 반기가 된다. */
  const start = (patch: Partial<StartSemesterRequest> = {}) =>
    call<SemesterDto>('POST', '/api/v1/semesters/start', {
      ...START,
      userIds: activeIds,
      ...patch,
    });
  /** 시드 26-2의 진행 중인 주차(3주차)를 마감한다. */
  const closeOpenWeeks = () =>
    call('PATCH', '/api/v1/semesters/26-2/weeks/3', { status: 'CLOSED' });
  if (shouldCloseWeeks) closeOpenWeeks();
  const roster = (semester: string) =>
    call<SemesterRosterDto>('GET', `/api/v1/semesters/${semester}/roster`).members;
  const currentLabels = () =>
    queryAll<{ semester_label: string }>(
      db,
      'SELECT semester_label FROM cohorts WHERE is_current = 1',
    ).map((row) => row.semester_label);
  const count = (table: string) =>
    queryAll<{ n: number }>(db, `SELECT COUNT(*) AS n FROM ${table}`)[0].n;
  const weekDates = (cohort: number) =>
    queryAll<{ week_num: number; date: string }>(
      db,
      'SELECT week_num, date FROM cohort_week_dates WHERE cohort = ? ORDER BY week_num',
      [cohort],
    );
  return { db, call, closeOpenWeeks, start, roster, currentLabels, count, weekDates };
}

function expectApiError(work: () => unknown, status: number, code: string) {
  assert.throws(
    work,
    (error: unknown) => error instanceof ApiError && error.status === status && error.code === code,
  );
}

test('새 반기를 시작하면 바로 진행 반기가 되고 이전 진행 반기는 종료되며, 명단은 보낸 회원 그대로이고 구분은 기수로 정해진다', async () => {
  const { call, start, roster, currentLabels } = await setup();

  const created = start({ userIds: ['u_27_02', 'u_25_01'] });

  assert.equal(created.status, 'ACTIVE');
  assert.equal(created.isCurrent, true);
  assert.equal(created.cohort, 28);
  assert.equal(created.advTerm, 27);
  assert.equal(created.startDate, '2027-01-01');
  assert.equal(created.endDate, '2027-06-30');
  assert.deepEqual(currentLabels(), ['27-1']);
  const semesters = call<SemesterDto[]>('GET', '/api/v1/semesters');
  assert.equal(semesters.find((s) => s.semester === '26-2')?.status, 'ENDED');
  assert.ok(semesters.some((s) => s.semester === '27-1'));
  assert.deepEqual(
    roster('27-1').map((m) => [m.userId, m.kind]),
    [
      ['u_27_02', 'ADV'],
      ['u_25_01', 'EXTRA'],
    ],
  );
});

test('새 반기를 시작하면 기간·활동별 1주차 시작일·무효 주차가 저장된다', async () => {
  const { call, start } = await setup();
  start();

  const schedule = call<SemesterScheduleDto>('GET', '/api/v1/semesters/27-1/schedule');

  assert.deepEqual(schedule.vacation, SCHEDULE.vacation);
  assert.deepEqual(schedule.term, SCHEDULE.term);
  assert.deepEqual(schedule.activityStarts, {
    BASE: '2027-01-05',
    ADV: null,
    STUDY_VACATION: null,
    STUDY_TERM: '2027-03-09',
  });
  assert.deepEqual(schedule.invalidWeeks, [{ activity: 'BASE', weekNum: 3, reason: '설 연휴' }]);
  assert.equal(schedule.weeks.BASE.find((week) => week.weekNum === 3)?.isInvalid, true);
  assert.equal(schedule.weeks.BASE.filter((week) => week.isInvalid).length, 1);
  assert.deepEqual(schedule.weeks.ADV, []);
});

test('진행 반기 명단에서 사람을 빼고 다른 기수 사람을 더하면 더한 사람은 수료 기수(EXTRA)로 나온다', async () => {
  const { call, start, roster } = await setup();
  start();
  const before = roster('27-1').map((m) => m.userId);

  call('PUT', '/api/v1/semesters/27-1/members', { userIds: [...before.slice(1), 'u_26_01'] });

  const saved = roster('27-1');
  assert.equal(saved.length, before.length);
  assert.ok(!saved.some((m) => m.userId === before[0]));
  assert.equal(saved.find((m) => m.userId === 'u_26_01')?.kind, 'EXTRA');
});

test('명단 변경 실패: 없는 회원 id는 400 USER_NOT_FOUND이고 명단은 그대로다', async () => {
  const { call, start, roster } = await setup();
  start();
  const before = roster('27-1');

  expectApiError(
    () => call('PUT', '/api/v1/semesters/27-1/members', { userIds: ['u_99_99'] }),
    400,
    'USER_NOT_FOUND',
  );

  assert.deepEqual(roster('27-1'), before);
});

test('새 반기를 시작하면 이전 반기 팀이 HOST 계정에서 떨어지고 지난 팀은 남는다(반기 수정과 같다)', async () => {
  const { db, start, count } = await setup();
  assert.ok(loadHosts(db).length > 0);
  const teams = count('teams');

  start();

  assert.equal(loadHosts(db).length, 0);
  assert.equal(count('teams'), teams);
});

test('준비 단계가 없어 활성화 API도 없다', async () => {
  const { call } = await setup();

  expectApiError(() => call('POST', '/api/v1/semesters/26-2/activate'), 404, 'ROUTE_NOT_FOUND');
});

test('시작 실패: 진행 반기에 진행 중인 주차가 있으면 409 SEMESTER_WEEK_IN_PROGRESS이고, 마감하면 시작된다', async () => {
  const { start, closeOpenWeeks, currentLabels, count } = await setup({ shouldCloseWeeks: false });
  const cohorts = count('cohorts');

  assert.throws(
    () => start(),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === 'SEMESTER_WEEK_IN_PROGRESS' &&
      error.message.includes('3주차'),
  );
  assert.deepEqual(currentLabels(), ['26-2']);
  assert.equal(count('cohorts'), cohorts);

  closeOpenWeeks();
  start();

  assert.deepEqual(currentLabels(), ['27-1']);
});

test('반기를 따로 종료하는 API는 없다', async () => {
  const { call } = await setup();

  expectApiError(() => call('POST', '/api/v1/semesters/26-2/end'), 404, 'ROUTE_NOT_FOUND');
});

test('진행 반기는 지울 수 없다(409 SEMESTER_ACTIVE)', async () => {
  const { call } = await setup();

  expectApiError(() => call('DELETE', '/api/v1/semesters/26-2'), 409, 'SEMESTER_ACTIVE');
});

test('시작 실패: 표기 형식이 틀리면 400이다', async () => {
  const { start } = await setup();

  for (const semester of ['27-3', '2027-1', '']) {
    expectApiError(() => start({ semester }), 400, 'BAD_REQUEST');
  }
});

test('시작 실패: 표기·기수·ADV 기수가 겹치면 409 SEMESTER_DUPLICATE이다', async () => {
  const { start } = await setup();

  expectApiError(() => start({ semester: '26-2' }), 409, 'SEMESTER_DUPLICATE');
  expectApiError(() => start({ baseTerm: 28, advTerm: 26 }), 409, 'SEMESTER_DUPLICATE');
  start();
  expectApiError(
    () => start({ semester: '27-2', baseTerm: 29, advTerm: 27 }),
    409,
    'SEMESTER_DUPLICATE',
  );
});

test('시작 실패: 기수가 잘못되면 400 INVALID_TERM이다', async () => {
  const { start } = await setup();

  expectApiError(() => start({ baseTerm: 28, advTerm: 28 }), 400, 'INVALID_TERM');
  expectApiError(() => start({ baseTerm: 27, advTerm: 26, semester: '27-1' }), 400, 'INVALID_TERM');
});

test('시작 실패: 방학·학기 날짜가 어긋나면 400 INVALID_DATE_RANGE이다', async () => {
  const { start } = await setup();
  const withSchedule = (patch: Partial<SaveSemesterScheduleRequest>) =>
    start({ schedule: { ...SCHEDULE, ...patch } });

  expectApiError(
    () => withSchedule({ vacation: { startDate: '2027-03-01', endDate: '2027-01-01' } }),
    400,
    'INVALID_DATE_RANGE',
  );
  expectApiError(
    () => withSchedule({ term: { startDate: '2027-07-01', endDate: '2027-03-02' } }),
    400,
    'INVALID_DATE_RANGE',
  );
  // 방학 종료일이 학기 시작일보다 앞이어야 한다.
  expectApiError(
    () => withSchedule({ vacation: { startDate: '2027-01-01', endDate: '2027-03-02' } }),
    400,
    'INVALID_DATE_RANGE',
  );
  // 활동 시작일은 반기 기간 안이어야 한다.
  expectApiError(
    () => withSchedule({ activityStarts: { BASE: '2026-12-01' } }),
    400,
    'INVALID_DATE_RANGE',
  );
});

test('실패한 시작은 반기·명단·현재 반기·HOST 계정·감사 기록을 바꾸지 않는다', async () => {
  const { db, start, currentLabels, count } = await setup();
  const hosts = loadHosts(db).length;
  const tables = ['cohorts', 'semester_members', 'semester_periods', 'audit_log'];
  const before = tables.map(count);
  const failures: Partial<StartSemesterRequest>[] = [
    { semester: 'xx' },
    { semester: '26-2' },
    { baseTerm: 28, advTerm: 28 },
    { schedule: { ...SCHEDULE, term: { startDate: '2027-07-01', endDate: '2027-03-02' } } },
    { userIds: [] },
  ];

  failures.forEach((patch) => assert.throws(() => start(patch), ApiError));

  assert.deepEqual(tables.map(count), before);
  assert.deepEqual(currentLabels(), ['26-2']);
  assert.equal(loadHosts(db).length, hosts);
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

test('출결 생성 창 주차 날짜는 BASE(없으면 방학 스터디) 시작일로 1~8주차, 학기 스터디 시작일로 9~16주차를 채운다', async () => {
  const { call, start, weekDates } = await setup();

  start();
  assert.deepEqual(
    weekDates(28),
    [
      ...activityWeekDates('2027-01-05'),
      ...activityWeekDates('2027-03-09').map((week) => ({ ...week, weekNum: week.weekNum + 8 })),
    ].map((week) => ({ week_num: week.weekNum, date: week.date })),
  );

  // BASE가 없으면 방학 스터디 시작일을 쓴다. 시작일이 모두 없으면 비운다.
  call('PUT', '/api/v1/semesters/27-1/schedule', {
    ...SCHEDULE,
    activityStarts: { STUDY_VACATION: '2027-01-06' },
  });
  assert.deepEqual(
    weekDates(28).map((week) => week.week_num),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
  assert.equal(weekDates(28)[0].date, '2027-01-06');

  call('PUT', '/api/v1/semesters/27-1/schedule', { ...SCHEDULE, activityStarts: {} });
  assert.deepEqual(weekDates(28), []);
});

test('진행 반기의 일정을 저장하면 그대로 다시 읽히고 이전 값은 통째로 교체된다', async () => {
  const { db, call, start } = await setup();
  start();
  const next: SaveSemesterScheduleRequest = {
    vacation: { startDate: '2027-01-04', endDate: '2027-02-27' },
    term: { startDate: '2027-03-03', endDate: '2027-06-29' },
    activityStarts: { ADV: '2027-01-11' },
    invalidWeeks: [
      { activity: 'ADV', weekNum: 2 },
      { activity: 'ADV', weekNum: 2, reason: '중복' },
    ],
  };

  const saved = call<SemesterScheduleDto>('PUT', '/api/v1/semesters/27-1/schedule', next);
  const read = call<SemesterScheduleDto>('GET', '/api/v1/semesters/27-1/schedule');

  assert.deepEqual(saved, read);
  assert.deepEqual(read.vacation, next.vacation);
  assert.deepEqual(read.term, next.term);
  assert.equal(read.activityStarts.ADV, '2027-01-11');
  assert.equal(read.activityStarts.BASE, null);
  assert.equal(read.invalidWeeks.length, 1);
  assert.equal(read.invalidWeeks[0].weekNum, 2);
  assert.equal(read.weeks.ADV[1].isInvalid, true);
  assert.deepEqual(read.weeks.BASE, []);
  // 반기 전체 기간은 방학 시작~학기 종료로 갱신된다.
  const semester = queryAll<{ start_date: string; end_date: string }>(
    db,
    "SELECT start_date, end_date FROM cohorts WHERE semester_label = '27-1'",
  )[0];
  assert.equal(semester.start_date, '2027-01-04');
  assert.equal(semester.end_date, '2027-06-29');
});

test('일정 저장은 날짜 형식·순서·무효 주차 범위가 틀리면 400이고 저장된 값은 그대로다', async () => {
  const { call, start } = await setup();
  start();
  const put = (patch: Partial<SaveSemesterScheduleRequest>) =>
    call('PUT', '/api/v1/semesters/27-1/schedule', { ...SCHEDULE, ...patch });

  expectApiError(
    () => put({ vacation: { startDate: '2027/01/01', endDate: '2027-02-28' } }),
    400,
    'BAD_REQUEST',
  );
  expectApiError(
    () => put({ term: { startDate: '2027-06-30', endDate: '2027-03-02' } }),
    400,
    'INVALID_DATE_RANGE',
  );
  expectApiError(
    () => put({ invalidWeeks: [{ activity: 'BASE', weekNum: 9 }] }),
    400,
    'BAD_REQUEST',
  );

  const read = call<SemesterScheduleDto>('GET', '/api/v1/semesters/27-1/schedule');
  assert.deepEqual(read.vacation, SCHEDULE.vacation);
  assert.equal(read.invalidWeeks.length, 1);
});

test('서비스운영팀장이 아니면 종료 반기 일정은 조회만 되고 저장하면 409 SEMESTER_ARCHIVED이다', async () => {
  const { call, start } = await setup();
  start();

  const past = call<SemesterScheduleDto>('GET', '/api/v1/semesters/26-2/schedule');
  assert.ok(past.weeks);
  call('PUT', '/api/v1/mock/admin-session', { accountId: 2 });
  expectApiError(
    () => call('PUT', '/api/v1/semesters/26-2/schedule', SCHEDULE),
    409,
    'SEMESTER_ARCHIVED',
  );
  expectApiError(() => call('GET', '/api/v1/semesters/99-9/schedule'), 404, 'NOT_FOUND');
});

test('새 반기 시작·일정 저장은 감사 기록에 액션과 요청 API로 남고 실패는 남지 않는다', async () => {
  const { call, start, count } = await setup();
  const latest = () => call<AuditLogPage>('GET', '/api/v1/admin/audit-logs?size=1').items[0];

  start();
  assert.equal(latest().action, 'SEMESTER_CREATE');
  assert.deepEqual(latest().api, { method: 'POST', path: '/api/v1/semesters/start' });

  call('PUT', '/api/v1/semesters/27-1/schedule', SCHEDULE);
  const updated = latest();
  assert.equal(updated.action, 'SEMESTER_SCHEDULE_SET');
  assert.deepEqual(updated.api, { method: 'PUT', path: '/api/v1/semesters/27-1/schedule' });
  assert.deepEqual(updated.requestBody, SCHEDULE);

  const logs = count('audit_log');
  assert.throws(
    () =>
      call('PUT', '/api/v1/semesters/27-1/schedule', {
        ...SCHEDULE,
        invalidWeeks: [{ activity: 'BASE', weekNum: 9 }],
      }),
    ApiError,
  );
  assert.throws(() => start({ semester: '26-2' }), ApiError);
  assert.equal(count('audit_log'), logs);
});

test('반기 관리에서 저장한 활동별 날짜·휴강이 출결 화면이 읽는 주차 API에 같은 값으로 나온다', async () => {
  const { call, start } = await setup();
  start();

  const weeks = call<SemesterWeekDto[]>('GET', '/api/v1/semesters/27-1/weeks');

  const week = (weekNum: number) => weeks.find((item) => item.weekNum === weekNum);
  assert.deepEqual(week(1)?.activityDates, { BASE: '2027-01-05' });
  assert.deepEqual(week(3)?.invalidActivities, ['BASE']);
  assert.deepEqual(week(4)?.invalidActivities, []);
  // 학기 스터디 1주차는 반기 주차 표의 9주차다.
  assert.deepEqual(week(9)?.activityDates, { STUDY_TERM: '2027-03-09' });
});

test('명단 조회 실패: 없는 반기는 404이고, 서비스운영팀장이 아닌 계정이 지난 반기 명단을 바꾸면 409 SEMESTER_ARCHIVED이다', async () => {
  const { call } = await setup();

  expectApiError(() => call('GET', '/api/v1/semesters/99-9/roster'), 404, 'NOT_FOUND');
  call('PUT', '/api/v1/mock/admin-session', { accountId: 2 });
  expectApiError(
    () => call('PUT', '/api/v1/semesters/26-1/members', { userIds: [] }),
    409,
    'SEMESTER_ARCHIVED',
  );
});

test('시작 실패: 달력에 없는 날짜(평년 2월 29일)는 400 BAD_REQUEST이다', async () => {
  const { start } = await setup();

  expectApiError(
    () => start({ schedule: { ...SCHEDULE, activityStarts: { BASE: '2027-02-29' } } }),
    400,
    'BAD_REQUEST',
  );
});

test('반기 목록의 includePreparing은 true·false만 받는다', async () => {
  const { call } = await setup();

  expectApiError(() => call('GET', '/api/v1/semesters?includePreparing=yes'), 400, 'BAD_REQUEST');
});

// ─── 명단은 골라서 추가(자동으로 채우지 않음) ───

test('명단이 비어 있으면 409 ROSTER_EMPTY이고 반기도 만들어지지 않는다', async () => {
  const { start, count, currentLabels } = await setup();
  const cohorts = count('cohorts');

  expectApiError(() => start({ userIds: [] }), 409, 'ROSTER_EMPTY');

  assert.equal(count('cohorts'), cohorts);
  assert.deepEqual(currentLabels(), ['26-2']);
});

test('명단에 없는 회원 id는 400 USER_NOT_FOUND, 탈동 회원은 400 USER_WITHDRAWN이고 반기도 만들어지지 않는다', async () => {
  const { start, count } = await setup();
  const cohorts = count('cohorts');

  expectApiError(() => start({ userIds: ['u_99_99'] }), 400, 'USER_NOT_FOUND');
  expectApiError(() => start({ userIds: ['u_27_02', 'u_27_07'] }), 400, 'USER_WITHDRAWN');

  assert.equal(count('cohorts'), cohorts);
});

// ─── 종료 반기: 서비스운영팀장(MASTER)만 수정·삭제 ───

test('서비스운영팀장은 종료 반기의 일정·명단을 고칠 수 있다', async () => {
  const { call, roster } = await setup();
  const schedule: SaveSemesterScheduleRequest = {
    vacation: { startDate: '2026-01-01', endDate: '2026-02-28' },
    term: { startDate: '2026-03-02', endDate: '2026-06-30' },
    activityStarts: { BASE: '2026-01-06' },
    invalidWeeks: [{ activity: 'BASE', weekNum: 2 }],
  };

  const saved = call<SemesterScheduleDto>('PUT', '/api/v1/semesters/26-1/schedule', schedule);
  call('PUT', '/api/v1/semesters/26-1/members', { userIds: ['u_26_01'] });

  assert.deepEqual(saved.invalidWeeks, [{ activity: 'BASE', weekNum: 2, reason: '' }]);
  assert.deepEqual(
    roster('26-1').map((m) => m.userId),
    ['u_26_01'],
  );
});

test('서비스운영팀장이 아니면 종료 반기를 지울 수 없다(409 SEMESTER_ARCHIVED)', async () => {
  const { call } = await setup();
  call('PUT', '/api/v1/mock/admin-session', { accountId: 2 });

  expectApiError(() => call('DELETE', '/api/v1/semesters/25-2'), 409, 'SEMESTER_ARCHIVED');
});

test('기록이 없는 종료 반기는 바로 지워지고, 기록이 있으면 409 SEMESTER_HAS_RECORDS로 건수를 알린다', async () => {
  const { call } = await setup();

  call('DELETE', '/api/v1/semesters/25-2');

  assert.throws(
    () => call('DELETE', '/api/v1/semesters/26-1'),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === 'SEMESTER_HAS_RECORDS' &&
      error.message.includes('팀 6개') &&
      error.message.includes('출결 192건'),
  );
  const labels = call<SemesterDto[]>('GET', '/api/v1/semesters').map((s) => s.semester);
  assert.ok(!labels.includes('25-2'));
  assert.ok(labels.includes('26-1'));
});

test('force=true로 지우면 반기만 목록·조회에서 빠지고 팀·출결 기록과 감사 기록은 남으며, 삭제 기록에 묶인 건수가 남는다', async () => {
  const { call, count } = await setup();
  const tables = ['cohorts', 'teams', 'attendance_records', 'audit_log'];
  const before = tables.map(count);

  call('DELETE', '/api/v1/semesters/26-1?force=true');

  assert.deepEqual(tables.map(count), [before[0], before[1], before[2], before[3] + 1]);
  expectApiError(() => call('GET', '/api/v1/semesters/26-1/roster'), 404, 'NOT_FOUND');
  const latest = call<AuditLogPage>('GET', '/api/v1/admin/audit-logs?size=1').items[0];
  assert.equal(latest.action, 'SEMESTER_DELETE');
  assert.equal(latest.detail?.teams, 6);
  assert.equal(latest.detail?.attendance, 192);
  assert.equal(latest.detail?.events, 0);
});
