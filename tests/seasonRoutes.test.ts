import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type {
  ArchiveReadiness,
  CreateSeasonRequest,
  CreateSeasonResult,
  EnrollmentList,
  SeasonDetail,
  SeasonListItem,
  SeasonPreview,
  SeasonWeek,
  WeekVoidResult,
} from '../src/entities/cohort/model/seasonDto';
import { ApiError } from '../src/shared/api/apiError';
import { recordWrite } from '../src/shared/api/mock/audit';
import { MOCK_ROUTES } from '../src/shared/api/mock/mockRoutes';
import { createRouter } from '../src/shared/api/mock/router';
import { createDatabase, execute, queryAll } from '../src/shared/db/createDatabase';

const read = (file: string) => readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
const schema = `${read('schema.sql')}
${read('event-schema.sql')}`;
const seed = `${read('seed.sql')}
${read('event-seed.sql')}`;

const BASE = '/api/v1/admin/attendance';

// 시드의 진행 반기는 26-2(id 27, ADV 26), 종료 반기는 26-1(id 26). 새 반기는 27-1(BASE 28, ADV 27).
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
  void_week_nos: [7],
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
  call('PUT', '/api/v1/mock/admin-session', { accountId: 1 });
  function call(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown) {
    return router.dispatch(db, method, path, body);
  }
  /** 성공 응답의 data. 포장({ status, data })도 함께 확인한다. */
  const data = <T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) => {
    const response = call(method, path, body) as { status: number; data: T };
    assert.ok(response.status === 200 || response.status === 201);
    return response.data;
  };
  const create = (patch: Partial<CreateSeasonRequest> = {}) =>
    data<CreateSeasonResult>('POST', `${BASE}/seasons`, { ...NEW_SEASON, ...patch });
  const weeksOf = (id: number) => data<SeasonWeek[]>('GET', `${BASE}/seasons/${id}/weeks`);
  const enrollmentsOf = (id: number) =>
    data<EnrollmentList>('GET', `${BASE}/seasons/${id}/enrollments`).enrollments;
  return { db, call, data, create, weeksOf, enrollmentsOf };
}

test('ATT-01: 반기 목록은 { status, data }로 감싸고 진행 예정 → 진행 → 종료 순이다', async () => {
  const { data, create } = await setup();
  create();
  const list = data<SeasonListItem[]>('GET', `${BASE}/seasons`);

  assert.deepEqual(
    list.map((item) => [item.name, item.status, item.is_editable]),
    [
      ['27-1', 'DRAFT', true],
      ['26-2', 'ACTIVE', false],
      ['26-1', 'ARCHIVED', false],
    ],
  );
  assert.equal(list[1].start_date, '2026-06-29');
});

test('ATT-02: 반기 상세에 점수 규칙, 1주차, ADV 팀장 입력 시작 주차(ADV 4주차)가 있다. 없는 반기는 404', async () => {
  const { data, call } = await setup();
  const detail = data<SeasonDetail>('GET', `${BASE}/seasons/27`);

  assert.equal(detail.score_rule_set.name, 'Version 3');
  assert.equal(detail.first_weeks.base.week_no, 2);
  assert.equal(detail.adv_leader_entry_from_week?.activity_week_no, 4);
  assert.deepEqual(
    detail.periods.map((period) => period.period_type),
    ['VACATION', 'SEMESTER'],
  );
  expectApiError(() => call('GET', `${BASE}/seasons/99`), 404, 'SEASON_NOT_FOUND');
});

test('ATT-82: 미리보기는 저장하지 않고 자동 명단과 중복 여부만 돌려준다', async () => {
  const { data } = await setup();
  // 미리보기는 점수 규칙 버전을 받지 않는다.
  const input = Object.fromEntries(
    Object.entries(NEW_SEASON).filter(([key]) => key !== 'score_rule_set_id'),
  );
  const preview = data<SeasonPreview>('POST', `${BASE}/seasons/preview`, input);

  assert.equal(preview.conflicts.duplicate_year_half, false);
  assert.ok(preview.roster_members.length > 0);
  assert.ok(preview.roster_members.every((member) => [28, 27].includes(member.term)));
  assert.equal(preview.adv_leader_entry_from_week_no, 5);
  assert.equal(data<SeasonListItem[]>('GET', `${BASE}/seasons`).length, 2);
  const duplicate = data<SeasonPreview>('POST', `${BASE}/seasons/preview`, {
    ...input,
    name: '26-2',
    half: 'H2',
  });
  assert.equal(duplicate.conflicts.duplicate_year_half, true);
});

test('ATT-03: 확정하면 DRAFT 반기와 BASE·ADV 기수 활동 회원 명단이 생긴다(탈동 회원은 빠진다)', async () => {
  const { create, enrollmentsOf, db } = await setup();
  const created = create();

  assert.equal(created.status, 'DRAFT');
  assert.equal(created.void_weeks[0].week_no, 7);
  assert.equal(created.adv_leader_entry_from_week?.activity_week_no, 4);
  const roster = enrollmentsOf(created.id);
  const activeCount = queryAll<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM users WHERE term IN (28, 27) AND club_status = 'ACTIVE' AND deleted_at IS NULL",
  )[0].n;
  assert.equal(roster.length, activeCount);
  assert.ok(roster.every((row) => row.season_role === (row.term === 28 ? 'BASE' : 'ADV')));
  assert.ok(!roster.some((row) => row.member_id === 'u_28_14'));
});

test('ATT-03 실패: 이름·반기 불일치, 월~일이 아닌 기간, 겹침, 휴강 3주, 중복, 없는 점수 규칙, 모르는 필드', async () => {
  const { call, create } = await setup();
  const post = (patch: Record<string, unknown>) =>
    call('POST', `${BASE}/seasons`, { ...NEW_SEASON, ...patch });

  expectApiError(() => post({ half: 'H2' }), 400, 'INVALID_INPUT_VALUE');
  expectApiError(
    () =>
      post({
        periods: [
          { period_type: 'VACATION', start_date: '2026-12-29', end_date: '2027-02-28' },
          NEW_SEASON.periods[1],
        ],
      }),
    400,
    'INVALID_INPUT_VALUE',
  );
  expectApiError(
    () =>
      post({
        periods: [
          { period_type: 'VACATION', start_date: '2026-12-28', end_date: '2027-03-07' },
          NEW_SEASON.periods[1],
        ],
      }),
    400,
    'SEASON_PERIOD_OVERLAP',
  );
  expectApiError(() => post({ void_week_nos: [3, 4, 5] }), 400, 'SEASON_VOID_WEEK_LIMIT_EXCEEDED');
  expectApiError(() => post({ score_rule_set_id: 99 }), 404, 'SCORE_RULE_SET_NOT_FOUND');
  expectApiError(() => post({ extra: true }), 400, 'INVALID_INPUT_VALUE');
  expectApiError(() => post({ base_start_on: undefined }), 400, 'INVALID_INPUT_VALUE');
  create();
  expectApiError(() => post({}), 409, 'DUPLICATE_ACTIVITY_SEASON');
});

test('ATT-04: 진행 예정 반기는 이름·반기·기간을 고치고, 같은 달력 주의 주차 id·휴강은 그대로다', async () => {
  const { data, create, weeksOf, call } = await setup();
  const { id } = create();
  const before = weeksOf(id);
  const voidWeek = before.find((week) => week.is_void);

  // 방학을 한 주 앞당기면 주차 번호는 하나씩 밀리지만 같은 주의 id·휴강은 남는다.
  // ADV 팀장 입력 시작 주차 번호도 바뀌므로 함께 다시 정한다.
  data('PATCH', `${BASE}/seasons/${id}`, {
    name: '27-2',
    half: 'H2',
    periods: [{ period_type: 'VACATION', start_date: '2026-12-21', end_date: '2027-02-28' }],
    adv_leader_entry_from_week_id: null,
  });
  const after = weeksOf(id);
  const moved = after.find((week) => week.week_id === voidWeek?.week_id);
  assert.equal(moved?.week_no, (voidWeek?.week_no ?? 0) + 1);
  assert.equal(moved?.is_void, true);
  assert.equal(after.length, before.length + 1);
  const detail = data<SeasonDetail>('GET', `${BASE}/seasons/${id}`);
  assert.equal(detail.name, '27-2');
  assert.equal(detail.adv_leader_entry_from_week, null);
  expectApiError(
    () => call('PATCH', `${BASE}/seasons/${id}`, { base_term: 29 }),
    400,
    'INVALID_INPUT_VALUE',
  );
});

test('ATT-04 실패: 진행 반기는 409 SEASON_NOT_DRAFT, 팀장 주차 번호가 바뀌면 409 SEASON_ADV_ENTRY_WEEK_CHANGED', async () => {
  const { call, create } = await setup();
  expectApiError(
    () => call('PATCH', `${BASE}/seasons/27`, { name: '26-2' }),
    409,
    'SEASON_NOT_DRAFT',
  );
  const { id } = create();
  expectApiError(
    () =>
      call('PATCH', `${BASE}/seasons/${id}`, {
        periods: [{ period_type: 'VACATION', start_date: '2026-12-21', end_date: '2027-02-28' }],
      }),
    409,
    'SEASON_ADV_ENTRY_WEEK_CHANGED',
  );
});

test('ATT-09: 휴강은 반기 전체 2주까지이고, dry_run은 저장하지 않으며 감사 기록도 남기지 않는다', async () => {
  const { data, call, weeksOf, db } = await setup();
  const weeks = weeksOf(27);
  const auditCount = () => queryAll<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM audit_log')[0].n;
  const logsBefore = auditCount();

  const dry = data<WeekVoidResult>('PATCH', `${BASE}/weeks/${weeks[3].week_id}/void?dry_run=true`, {
    is_void: true,
  });
  assert.equal(dry.changed, true);
  assert.equal(weeksOf(27)[3].is_void, false);
  assert.equal(auditCount(), logsBefore);

  data('PATCH', `${BASE}/weeks/${weeks[3].week_id}/void`, { is_void: true });
  data('PATCH', `${BASE}/weeks/${weeks[4].week_id}/void`, { is_void: true });
  assert.equal(auditCount(), logsBefore + 2);
  expectApiError(
    () => call('PATCH', `${BASE}/weeks/${weeks[5].week_id}/void`, { is_void: true }),
    400,
    'SEASON_VOID_WEEK_LIMIT_EXCEEDED',
  );
  const again = data<WeekVoidResult>('PATCH', `${BASE}/weeks/${weeks[3].week_id}/void`, {
    is_void: true,
  });
  assert.equal(again.changed, false);
  const archivedWeek = weeksOf(26)[0];
  expectApiError(
    () => call('PATCH', `${BASE}/weeks/${archivedWeek.week_id}/void`, { is_void: true }),
    409,
    'SEASON_ARCHIVED',
  );
});

test('ATT-10·11·05: 마지막 주차가 끝나야 종료할 수 있고, 진행 반기가 없어야 활성화된다', async () => {
  const { data, call, create, db } = await setup();
  const { id } = create();
  expectApiError(
    () => call('PATCH', `${BASE}/seasons/${id}/activate`),
    409,
    'ACTIVE_SEASON_EXISTS',
  );
  const readiness = data<ArchiveReadiness>('GET', `${BASE}/seasons/27/archive-readiness`);
  assert.equal(readiness.can_archive, false);
  expectApiError(
    () => call('PATCH', `${BASE}/seasons/27/archive`, { confirm: true }),
    409,
    'SEASON_NOT_FINISHED',
  );

  // 26-2의 마지막 주차가 지난 것으로 만든다.
  execute(
    db,
    "UPDATE season_week SET end_date = '2026-01-04' WHERE activity_season_id = 27 AND week_no = (SELECT MAX(week_no) FROM season_week WHERE activity_season_id = 27)",
  );
  assert.equal(
    data<ArchiveReadiness>('GET', `${BASE}/seasons/27/archive-readiness`).can_archive,
    true,
  );
  data('PATCH', `${BASE}/seasons/27/archive`, { confirm: true });
  data('PATCH', `${BASE}/seasons/${id}/activate`);
  const statuses = data<SeasonListItem[]>('GET', `${BASE}/seasons`).map((s) => [s.name, s.status]);
  assert.deepEqual(statuses, [
    ['27-1', 'ACTIVE'],
    ['26-2', 'ARCHIVED'],
    ['26-1', 'ARCHIVED'],
  ]);
  expectApiError(
    () => call('PATCH', `${BASE}/seasons/27/archive`, { confirm: true }),
    409,
    'SEASON_ARCHIVED',
  );
});

test('ATT-83: 진행 예정 반기는 지울 수 있고 같은 이름으로 다시 만들 수 있다. 진행 반기는 409', async () => {
  const { data, call, create } = await setup();
  const { id } = create();
  data('DELETE', `${BASE}/seasons/${id}`);
  expectApiError(() => call('GET', `${BASE}/seasons/${id}`), 404, 'SEASON_NOT_FOUND');
  create();
  expectApiError(() => call('DELETE', `${BASE}/seasons/27`), 409, 'SEASON_NOT_DELETABLE');
});

test('ATT-18·19·21·22: 명단 추가·병행 수정·취소는 행마다 하고, version이 다르면 409', async () => {
  const { data, call, enrollmentsOf, db } = await setup();
  const roster = enrollmentsOf(27);
  // 26-2 명단에 없는 탈동 회원.
  const withdrawn = queryAll<{ id: string }>(
    db,
    `SELECT id FROM users WHERE club_status = 'WITHDRAWN'
        AND id NOT IN (SELECT member_id FROM member_enrollment
                        WHERE activity_season_id = 27 AND deleted_at IS NULL)
      LIMIT 1`,
  )[0].id;
  // 26-2 명단에 없는 수료 회원을 하나 둔다(이름은 가짜 값).
  const completed = 'u_test_completed';
  execute(
    db,
    "INSERT INTO users (id, name, term, track, club_status) VALUES (?, '김수료', 24, '분석', 'COMPLETED')",
    [completed],
  );
  const target = roster.find((row) => row.season_role === 'BASE' && row.groups.length === 0);
  assert.ok(target);

  // 수료 회원을 스터디 참여로 더한다.
  const added = data<{ enrollment_id: number; season_role: string; is_rejoined: boolean }>(
    'POST',
    `${BASE}/seasons/27/enrollments`,
    { member_id: completed, season_role: 'COMPLETED' },
  );
  assert.equal(added.season_role, 'COMPLETED');
  assert.equal(added.is_rejoined, false);
  expectApiError(
    () =>
      call('POST', `${BASE}/seasons/27/enrollments`, {
        member_id: completed,
        season_role: 'COMPLETED',
      }),
    409,
    'DUPLICATE_ENROLLMENT',
  );
  expectApiError(
    () =>
      call('POST', `${BASE}/seasons/27/enrollments`, {
        member_id: withdrawn,
        season_role: 'ADV',
      }),
    409,
    'MEMBER_WITHDRAWN',
  );

  const parallel = target.track === 'ANALYSIS' ? 'ENGINEERING' : 'ANALYSIS';
  data('PATCH', `${BASE}/enrollments/${target.enrollment_id}`, {
    version: target.version,
    parallel_track: parallel,
  });
  const updated = enrollmentsOf(27).find((row) => row.enrollment_id === target.enrollment_id);
  assert.equal(updated?.parallel_track, parallel);
  assert.equal(updated?.version, target.version + 1);
  expectApiError(
    () =>
      call('PATCH', `${BASE}/enrollments/${target.enrollment_id}`, {
        version: target.version,
        parallel_track: null,
      }),
    409,
    'OPTIMISTIC_LOCK_CONFLICT',
  );

  expectApiError(
    () => call('DELETE', `${BASE}/enrollments/${added.enrollment_id}`),
    400,
    'MISSING_PARAMETER',
  );
  data('DELETE', `${BASE}/enrollments/${added.enrollment_id}?version=0`);
  assert.ok(!enrollmentsOf(27).some((row) => row.enrollment_id === added.enrollment_id));
  const rejoined = data<{ is_rejoined: boolean }>('POST', `${BASE}/seasons/27/enrollments`, {
    member_id: completed,
    season_role: 'COMPLETED',
  });
  assert.equal(rejoined.is_rejoined, true);
});

test('ATT-22: 출결 기록이 있는 회원은 명단에서 뺄 수 없다(409 ENROLLMENT_IN_USE)', async () => {
  const { db, call, enrollmentsOf } = await setup();
  const userId = queryAll<{ user_id: string }>(
    db,
    `SELECT tm.user_id FROM attendance_records r
       JOIN team_members tm ON tm.id = r.member_id JOIN teams t ON t.id = r.team_id
      WHERE t.semester_cohort = 27 AND r.status <> 'unmarked' AND tm.user_id IS NOT NULL LIMIT 1`,
  )[0]?.user_id;
  const row = enrollmentsOf(27).find((item) => item.member_id === userId);
  assert.ok(row);
  expectApiError(
    () => call('DELETE', `${BASE}/enrollments/${row.enrollment_id}?version=${row.version}`),
    409,
    'ENROLLMENT_IN_USE',
  );
});

test('반기 쓰기는 반기 이름을 대상으로 감사 기록에 남는다', async () => {
  const { db, create } = await setup();
  create();
  const last = queryAll<{ action: string; target_ids: string }>(
    db,
    'SELECT action, target_ids FROM audit_log ORDER BY id DESC LIMIT 1',
  )[0];
  assert.equal(last.action, 'SEMESTER_CREATE');
  assert.deepEqual(JSON.parse(last.target_ids), ['27-1']);
});
