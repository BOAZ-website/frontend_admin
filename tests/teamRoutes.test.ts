import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { TeamListResponse } from '../src/entities/study-team/model/dto';
import { createDatabase } from '../src/shared/db/createDatabase';
import { createRouter } from '../src/shared/api/mock/router';
import { teamRoutes } from '../src/shared/api/mock/routes/teamRoutes';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

test('현재 팀 목록은 sessions 포함 여부와 무관하게 현재 반기·현재 기간의 같은 팀을 반환한다', async () => {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(teamRoutes);
  const list = router.dispatch(db, 'GET', '/api/v1/study-teams', undefined) as TeamListResponse;
  const withSessions = router.dispatch(
    db,
    'GET',
    '/api/v1/study-teams?include=sessions',
    undefined,
  ) as TeamListResponse;

  assert.ok(list.semester.currentPeriod);
  assert.ok(list.teams.every((team) => team.period === list.semester.currentPeriod));
  assert.deepEqual(
    list.teams.map((team) => team.id),
    withSessions.teams.map((team) => team.id),
  );
});

test('기간을 명시하거나 모든 반기를 요청하면 API가 그 범위를 그대로 따른다', async () => {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(teamRoutes);
  const semester = router.dispatch(
    db,
    'GET',
    '/api/v1/study-teams?period=학기',
    undefined,
  ) as TeamListResponse;
  const allPeriods = router.dispatch(
    db,
    'GET',
    '/api/v1/study-teams?period=all',
    undefined,
  ) as TeamListResponse;
  const all = router.dispatch(
    db,
    'GET',
    '/api/v1/study-teams?semester=all',
    undefined,
  ) as TeamListResponse;

  assert.ok(semester.teams.length > 0);
  assert.ok(semester.teams.every((team) => team.period === '학기'));
  assert.deepEqual(new Set(allPeriods.teams.map((team) => team.period)), new Set(['방학', '학기']));
  assert.ok(all.teams.some((team) => team.semester !== all.semester.semester));
});
