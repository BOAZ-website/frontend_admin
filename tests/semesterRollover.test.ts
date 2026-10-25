import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import { loadHosts } from '../src/entities/host-account/api/hostRepository';
import type { TeamListResponse } from '../src/entities/study-team/model/dto';
import type { AttendanceMetaResponse } from '../src/entities/attendance/model/dto';
import { createDatabase, queryAll } from '../src/shared/db/createDatabase';
import { createRouter } from '../src/shared/api/mock/router';
import { commonRoutes } from '../src/shared/api/mock/routes/commonRoutes';
import { userRoutes } from '../src/shared/api/mock/routes/userRoutes';
import { eventRoutes } from '../src/shared/api/mock/routes/eventRoutes';
import { teamRoutes } from '../src/shared/api/mock/routes/teamRoutes';

// 유저 DB + 행사 DB(앱과 같은 순서로 함께 올린다)
const read = (file: string) => readFileSync(new URL(`../db/${file}`, import.meta.url), 'utf8');
const schema = `${read('schema.sql')}\n${read('event-schema.sql')}`;
const seed = `${read('seed.sql')}\n${read('event-seed.sql')}`;
const router = createRouter([...commonRoutes, ...userRoutes, ...teamRoutes, ...eventRoutes]);

async function freshDb() {
  const SQL = await initSqlJs();
  return createDatabase(SQL, schema, seed);
}

test('현재 반기가 넘어가면 HOST 계정만 삭제하고 지난 팀·출결은 조회용으로 보존한다', async () => {
  const db = await freshDb();
  const oldTeams = router.dispatch(
    db,
    'GET',
    '/api/v1/study-teams?semester=26-2&period=all',
    undefined,
  ) as TeamListResponse;
  const oldRecordCount = queryAll<{ count: number }>(
    db,
    'SELECT COUNT(*) AS count FROM attendance_records',
  )[0].count;
  assert.ok(loadHosts(db).length > 0);

  router.dispatch(db, 'POST', '/api/v1/semesters', {
    cohort: 28,
    semester: '27-1',
    startDate: '2027-01-01',
    endDate: '2027-06-30',
    advTerm: 27,
    memberTerms: [27, 28],
  });
  router.dispatch(db, 'PATCH', '/api/v1/semesters/27-1', { isCurrent: true });

  assert.equal(loadHosts(db).length, 0);
  assert.equal(
    queryAll<{ count: number }>(db, 'SELECT COUNT(*) AS count FROM attendance_records')[0].count,
    oldRecordCount,
  );
  const archived = router.dispatch(
    db,
    'GET',
    '/api/v1/study-teams?semester=26-2&period=all',
    undefined,
  ) as TeamListResponse;
  assert.deepEqual(
    archived.teams.map((team) => team.id),
    oldTeams.teams.map((team) => team.id),
  );
});

test('이미 현재인 반기를 다시 저장해도 HOST 계정은 삭제하지 않는다', async () => {
  const db = await freshDb();
  const before = loadHosts(db).map((host) => host.id);

  router.dispatch(db, 'PATCH', '/api/v1/semesters/26-2', { isCurrent: true });

  assert.deepEqual(
    loadHosts(db).map((host) => host.id),
    before,
  );
});

test('반기 API가 다음 반기의 등록 여부를 내려주고 등록 뒤에는 중복 생성을 막는다', async () => {
  const db = await freshDb();
  const before = router.dispatch(
    db,
    'GET',
    '/api/v1/attendance/meta',
    undefined,
  ) as AttendanceMetaResponse;

  assert.equal(before.canCreateNextSemester, true);
  router.dispatch(db, 'POST', '/api/v1/semesters', {
    cohort: before.nextSemester.cohort,
    semester: before.nextSemester.semester,
    startDate: before.nextSemester.startDate,
    endDate: before.nextSemester.endDate,
    advTerm: before.nextSemester.advTerm,
    memberTerms: before.nextSemester.memberTerms,
  });

  const after = router.dispatch(
    db,
    'GET',
    '/api/v1/attendance/meta',
    undefined,
  ) as AttendanceMetaResponse;
  assert.equal(after.canCreateNextSemester, false);
  assert.equal(after.nextSemester.semester, before.nextSemester.semester);
});

test('반기 전환은 출결 HOST 테이블과 운영진의 맡은 그룹 외의 데이터는 변경하지 않는다', async () => {
  const db = await freshDb();
  // 맡은 그룹(admin_group_leader)은 현재 반기 팀 기준이라 반기를 넘기면 다시 만들어진다.
  const hostTables = new Set([
    'host_accounts',
    'host_permissions',
    'host_assigned_groups',
    'host_concurrent_roles',
    'admin_group_leader',
  ]);
  const tables = queryAll<{ name: string }>(
    db,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
    .map(({ name }) => name)
    .filter((name) => !hostTables.has(name));
  const countsBefore = Object.fromEntries(
    tables.map((name) => [
      name,
      queryAll<{ count: number }>(db, `SELECT COUNT(*) AS count FROM ${name}`)[0].count,
    ]),
  );

  router.dispatch(db, 'POST', '/api/v1/semesters', {
    cohort: 28,
    semester: '27-1',
    startDate: '2027-01-01',
    endDate: '2027-06-30',
    advTerm: 27,
    memberTerms: [27, 28],
  });
  const countsAfterCreation = Object.fromEntries(
    tables.map((name) => [
      name,
      queryAll<{ count: number }>(db, `SELECT COUNT(*) AS count FROM ${name}`)[0].count,
    ]),
  );
  router.dispatch(db, 'PATCH', '/api/v1/semesters/27-1', { isCurrent: true });
  const countsAfterRollover = Object.fromEntries(
    tables.map((name) => [
      name,
      queryAll<{ count: number }>(db, `SELECT COUNT(*) AS count FROM ${name}`)[0].count,
    ]),
  );

  // 반기 생성 자체가 추가하는 기준 행은 전환 전에 생긴다. 전환은 그 외 테이블을 더 건드리지 않는다.
  assert.deepEqual(countsAfterRollover, countsAfterCreation);
  assert.ok(Object.keys(countsBefore).length > 0);
  assert.equal(loadHosts(db).length, 0);
  // 새 반기에는 아직 팀이 없어 지난 반기 팀의 맡은 그룹 연결이 남지 않는다.
  assert.equal(
    queryAll<{ count: number }>(db, 'SELECT COUNT(*) AS count FROM admin_group_leader')[0].count,
    0,
  );
});

test('새 반기는 빈 회원 명단으로 시작하고 반기 API로 등록한 회원만 조회한다', async () => {
  const db = await freshDb();
  const currentUsers = router.dispatch(db, 'GET', '/api/v1/users?semester=26-2', undefined) as {
    id: string;
  }[];
  assert.ok(currentUsers.length > 0);

  router.dispatch(db, 'POST', '/api/v1/semesters', {
    cohort: 28,
    semester: '27-1',
    startDate: '2027-01-01',
    endDate: '2027-06-30',
    advTerm: 27,
    memberTerms: [27, 28],
  });
  assert.deepEqual(router.dispatch(db, 'GET', '/api/v1/users?semester=27-1', undefined), []);

  const registered = router.dispatch(db, 'PUT', '/api/v1/semesters/27-1/members', {
    userIds: ['u_27_01', 'u_28_01'],
  }) as { id: string }[];
  assert.deepEqual(
    registered.map(({ id }) => id),
    ['u_28_01', 'u_27_01'],
  );
  assert.deepEqual(
    (router.dispatch(db, 'GET', '/api/v1/users?semester=27-1', undefined) as { id: string }[]).map(
      ({ id }) => id,
    ),
    ['u_28_01', 'u_27_01'],
  );

  const registeredName = (
    router.dispatch(db, 'GET', '/api/v1/users?semester=27-1', undefined) as {
      id: string;
      name: string;
    }[]
  ).find(({ id }) => id === 'u_27_01')?.name;
  db.run("UPDATE users SET name = '변경된 시스템 계정 이름' WHERE id = 'u_27_01'");
  assert.equal(
    (
      router.dispatch(db, 'GET', '/api/v1/users?semester=27-1', undefined) as {
        id: string;
        name: string;
      }[]
    ).find(({ id }) => id === 'u_27_01')?.name,
    registeredName,
  );
});

test('팀에는 해당 반기 명단에 등록된 회원만 추가할 수 있다', async () => {
  const db = await freshDb();
  router.dispatch(db, 'POST', '/api/v1/semesters', {
    cohort: 28,
    semester: '27-1',
    startDate: '2027-01-01',
    endDate: '2027-06-30',
    advTerm: 27,
    memberTerms: [27, 28],
  });
  router.dispatch(db, 'PUT', '/api/v1/semesters/27-1/members', {
    userIds: ['u_28_01'],
  });

  assert.throws(
    () =>
      router.dispatch(db, 'POST', '/api/v1/study-teams', {
        semester: '27-1',
        name: '새 반기 스터디',
        track: '분석',
        studyKind: 'GENERAL',
        period: '방학',
        memberIds: ['u_28_02'],
      }),
    /해당 반기 명단에 등록되지 않은 회원/,
  );
});

test('출결 핵심 데이터는 반기 외래 키로 직접 귀속된다', async () => {
  const db = await freshDb();
  const teamColumns = queryAll<{ name: string }>(db, 'PRAGMA table_info(teams)').map(
    ({ name }) => name,
  );
  const eventColumns = queryAll<{ name: string }>(db, 'PRAGMA table_info(events)').map(
    ({ name }) => name,
  );

  assert.ok(teamColumns.includes('semester_cohort'));
  assert.ok(eventColumns.includes('semester_cohort'));
  assert.equal(
    queryAll<{ count: number }>(
      db,
      'SELECT COUNT(*) AS count FROM teams WHERE semester_cohort IS NULL',
    )[0].count,
    0,
  );
  assert.equal(
    queryAll<{ count: number }>(
      db,
      'SELECT COUNT(*) AS count FROM events WHERE semester_cohort IS NULL',
    )[0].count,
    0,
  );
});

test('행사 API도 요청한 반기의 데이터만 반환한다', async () => {
  const db = await freshDb();
  router.dispatch(db, 'POST', '/api/v1/semesters', {
    cohort: 28,
    semester: '27-1',
    startDate: '2027-01-01',
    endDate: '2027-06-30',
    advTerm: 27,
    memberTerms: [27, 28],
  });
  db.run(`INSERT INTO events (
    id, semester_cohort, title, status, event_date, start_time, end_time,
    checkin_method, created_at
  ) VALUES ('future_event', 28, '다음 반기 행사', 'UPCOMING', '2027-01-02', '10:00', '11:00', 'MANUAL', '2027-01-01')`);

  const current = router.dispatch(db, 'GET', '/api/v1/events', undefined) as { id: string }[];
  const future = router.dispatch(db, 'GET', '/api/v1/events?semester=27-1', undefined) as {
    id: string;
  }[];

  assert.equal(
    current.some(({ id }) => id === 'future_event'),
    false,
  );
  assert.deepEqual(
    future.map(({ id }) => id),
    ['future_event'],
  );
});
