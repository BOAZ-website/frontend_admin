import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { TeamListResponse } from '../src/entities/study-team/model/dto';
import { ApiError } from '../src/shared/api/apiError';
import { MOCK_ROUTES } from '../src/shared/api/mock/mockRoutes';
import { createRouter } from '../src/shared/api/mock/router';
import { clearSession } from '../src/shared/api/mock/session';
import { createDatabase, execute } from '../src/shared/db/createDatabase';

// 출결 입력 탭의 담당 그룹 판정: 백엔드 HOST 계정·그룹 리더 설계문서 2026-11-06판 5.3·5.5.

const read = (file: string) => readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
const schema = `${read('schema.sql')}\n${read('event-schema.sql')}`;
const seed = `${read('seed.sql')}\n${read('event-seed.sql')}`;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// 시드: 4번 boaz_ops_1(운영지원팀), 6번 boaz_plan_1(기획팀, 출결 입력 권한 없음).
// HOST 101 host_c(u_27_01, study_c 팀장), 102 host_adv_ana1(u_27_02, adv_t1·study_d 팀장).
// 현재 반기(26-2)는 1~2주차 종료, 3주차 진행 중, 4주차부터 진행 예정이다.
const OPS_ID = 4;
const PLANNER_ID = 6;
const HOST_STUDY_C = 101;
const HOST_ADV_T1 = 102;
const OPEN_WEEK = 3;
const CLOSED_WEEK = 2;

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  // 오늘 날짜와 상관없이 현재 반기의 방학·학기 스터디가 모두 진행 중이게 한다.
  execute(db, "UPDATE semester_periods SET end_date = '2999-12-31'");
  const router = createRouter(MOCK_ROUTES);
  const call = <T>(method: Method, path: string, body?: unknown) =>
    router.dispatch(db, method, path, body) as T;
  const actAs = (accountId: number) => call('PUT', '/api/v1/mock/admin-session', { accountId });
  const saveStudy = (teamId: string, week: number) =>
    call('PUT', `/api/v1/study-teams/${teamId}/weeks/${week}/attendance`, { records: [] });
  const saveAdv = (teamId: string, week: number) =>
    call('PUT', `/api/v1/adv-teams/${teamId}/weeks/${week}/attendance`, { records: [] });
  const entryTeamIds = (path: string) =>
    call<TeamListResponse>('GET', `${path}?period=all&scope=entry`).teams.map((team) => team.id);
  return { db, call, actAs, saveStudy, saveAdv, entryTeamIds };
}

function expectApiError(work: () => unknown, status: number, code: string) {
  assert.throws(
    work,
    (error: unknown) => error instanceof ApiError && error.status === status && error.code === code,
  );
}

// ── 쓰기(제출·저장) ───────────────────────────────────────────────

test('모든 그룹 권한(운영지원팀)은 담당 그룹·마감 제한 없이 입력한다', async () => {
  const { actAs, saveStudy, saveAdv } = await setup();
  actAs(OPS_ID);

  assert.doesNotThrow(() => saveStudy('study_c', OPEN_WEEK));
  assert.doesNotThrow(() => saveStudy('study_c', CLOSED_WEEK));
  assert.doesNotThrow(() => saveAdv('adv_t1', OPEN_WEEK));
});

test('HOST는 본인이 팀장인 진행 중 그룹의 마감 전 주차에 입력하고 제출한다', async () => {
  const { call, actAs, saveStudy } = await setup();
  actAs(HOST_STUDY_C);

  assert.doesNotThrow(() => saveStudy('study_c', OPEN_WEEK));
  const memberId = (call('GET', '/api/v1/study-teams/study_c') as { members: { id: string }[] })
    .members[0].id;
  assert.doesNotThrow(() =>
    call('POST', `/api/v1/study-teams/study_c/weeks/${OPEN_WEEK}/submit`, {
      records: [{ memberId, status: 'present' }],
    }),
  );
});

test('HOST가 마감된 주차를 고치면 409 WEEK_CLOSED다', async () => {
  const { actAs, saveStudy } = await setup();
  actAs(HOST_STUDY_C);

  expectApiError(() => saveStudy('study_c', CLOSED_WEEK), 409, 'WEEK_CLOSED');
});

test('HOST가 다른 그룹에 입력하면 403이다', async () => {
  const { actAs, saveStudy } = await setup();
  actAs(HOST_STUDY_C);

  expectApiError(() => saveStudy('study_d', OPEN_WEEK), 403, 'ACCESS_DENIED');
});

test('팀장에서 해임된 HOST는 그 그룹에 입력할 수 없다', async () => {
  const { db, actAs, saveStudy } = await setup();
  execute(db, "UPDATE teams SET leader_id = 'u_28_08' WHERE id = 'study_c'");
  actAs(HOST_STUDY_C);

  expectApiError(() => saveStudy('study_c', OPEN_WEEK), 403, 'ACCESS_DENIED');
});

test('기간이 끝난 스터디(종료된 그룹)에는 팀장이어도 입력할 수 없다', async () => {
  const { db, actAs, saveStudy } = await setup();
  execute(
    db,
    "UPDATE semester_periods SET start_date = '2000-01-01', end_date = '2000-01-02' WHERE period = '학기'",
  );
  actAs(HOST_STUDY_C);

  expectApiError(() => saveStudy('study_c', OPEN_WEEK), 403, 'ACCESS_DENIED');
});

test('담당 그룹 권한을 계정 예외로 회수하면 팀장이어도 입력할 수 없다', async () => {
  const { db, actAs, saveStudy } = await setup();
  execute(
    db,
    `INSERT INTO admin_permission_override (admin_id, permission, effect, granted_by, created_at)
     VALUES (?, 'ATTENDANCE_STUDY_ENTRY_OWN_GROUP_WRITE', 'REVOKE', ?, '2026-11-08')`,
    [HOST_STUDY_C, OPS_ID],
  );
  actAs(HOST_STUDY_C);

  expectApiError(() => saveStudy('study_c', OPEN_WEEK), 403, 'ACCESS_DENIED');
});

test('출결 입력 권한이 없는 운영진은 403, 로그인하지 않았으면 401이다', async () => {
  const { db, actAs, saveStudy } = await setup();
  actAs(PLANNER_ID);
  expectApiError(() => saveStudy('study_c', OPEN_WEEK), 403, 'ACCESS_DENIED');

  clearSession(db);
  expectApiError(() => saveStudy('study_c', OPEN_WEEK), 401, 'UNAUTHORIZED');
});

test('ADV 팀장은 반기의 팀장 입력 시작 주차부터 입력한다(기본 4주차)', async () => {
  const { db, actAs, saveAdv } = await setup();
  actAs(HOST_ADV_T1);

  expectApiError(() => saveAdv('adv_t1', OPEN_WEEK), 409, 'LEADER_ENTRY_NOT_OPEN');

  execute(db, 'UPDATE cohorts SET adv_leader_entry_from_week = ? WHERE is_current = 1', [
    OPEN_WEEK,
  ]);
  assert.doesNotThrow(() => saveAdv('adv_t1', OPEN_WEEK));
});

test('ADV 팀장 입력 시작 주차는 비워 둘 수 없다', async () => {
  const { db } = await setup();

  assert.throws(
    () => execute(db, 'UPDATE cohorts SET adv_leader_entry_from_week = NULL WHERE is_current = 1'),
    /NOT NULL/,
  );
});

// ── 그룹 목록(scope=entry) ────────────────────────────────────────

test('출결 입력 탭 목록: HOST에게는 본인이 팀장인 진행 중 그룹만 보인다', async () => {
  const { db, actAs, entryTeamIds } = await setup();
  actAs(HOST_ADV_T1);

  assert.deepEqual(entryTeamIds('/api/v1/adv-teams'), ['adv_t1']);
  assert.deepEqual(entryTeamIds('/api/v1/study-teams'), ['study_d']);

  execute(
    db,
    "UPDATE semester_periods SET start_date = '2000-01-01', end_date = '2000-01-02' WHERE period = '학기'",
  );
  assert.throws(() => entryTeamIds('/api/v1/study-teams'), /권한이 없습니다/);
});

test('출결 입력 탭 목록: 모든 그룹 조회 권한이 있으면 전체가 보인다', async () => {
  const { call, actAs, entryTeamIds } = await setup();
  actAs(OPS_ID);

  const all = call<TeamListResponse>('GET', '/api/v1/study-teams?period=all').teams.map(
    (team) => team.id,
  );
  assert.deepEqual(entryTeamIds('/api/v1/study-teams'), all);
  assert.ok(all.length > 1);
});

test('반기 API가 ADV 팀장 입력 시작 주차를 내려준다', async () => {
  const { call, actAs } = await setup();
  actAs(OPS_ID);

  const meta = call<{ currentSemester: { advLeaderEntryFromWeek: number } }>(
    'GET',
    '/api/v1/attendance/meta',
  );
  assert.equal(meta.currentSemester.advLeaderEntryFromWeek, 4);
});
