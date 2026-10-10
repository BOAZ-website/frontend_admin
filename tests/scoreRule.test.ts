import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import { getRuleForDate } from '../src/entities/score-rule/model/lib';
import type { ScoreRule } from '../src/entities/score-rule/model/types';
import { createRouter } from '../src/shared/api/mock/router';
import { scoreRuleRoutes } from '../src/shared/api/mock/routes/scoreRuleRoutes';
import { createDatabase } from '../src/shared/db/createDatabase';

test('날짜에 해당하는 최신 규칙을 적용하고 초안은 제외한다', () => {
  const draft = { version: 2, status: 'DRAFT', startDate: '2026-01-01' } as ScoreRule;
  const active = {
    version: 1,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: null,
  } as ScoreRule;
  assert.equal(getRuleForDate([draft, active], '2026-10-02'), active);
  assert.equal(getRuleForDate([], '2026-10-02'), undefined);
});

test('규칙 정보 수정은 제목과 기간을 저장하고 배점은 유지한다', async () => {
  const SQL = await initSqlJs();
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(scoreRuleRoutes);
  const rules = router.dispatch(db, 'GET', '/api/v1/score-rules', undefined) as ScoreRule[];
  const rule = rules[0];
  assert.ok(rule.id);

  router.dispatch(db, 'PATCH', `/api/v1/score-rules/${rule.id}`, {
    name: '새 규칙 제목',
    startDate: '2026-07-05',
    endDate: null,
  });

  const saved = router.dispatch(
    db,
    'GET',
    `/api/v1/score-rules/${rule.id}`,
    undefined,
  ) as ScoreRule;
  assert.equal(saved.name, '새 규칙 제목');
  assert.equal(saved.startDate, '2026-07-05');
  assert.equal(saved.endDate, null);
  assert.equal(saved.description, rule.description);
  assert.equal(saved.absentPenalty, rule.absentPenalty);
  const previous = router.dispatch(
    db,
    'GET',
    '/api/v1/score-rules/rule-26',
    undefined,
  ) as ScoreRule;
  assert.equal(previous.endDate, '2026-07-04');
});

test('새 버전을 만들면 이전 버전은 새 시작일 전날에 종료되고 새 버전은 진행 중이다', async () => {
  const SQL = await initSqlJs();
  const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(scoreRuleRoutes);
  const created = router.dispatch(db, 'POST', '/api/v1/score-rules', {
    term: 27,
    name: 'Version 4',
    startDate: '2026-10-05',
    endDate: null,
  }) as ScoreRule;
  const previous = router.dispatch(
    db,
    'GET',
    '/api/v1/score-rules/rule-27',
    undefined,
  ) as ScoreRule;

  assert.equal(created.endDate, null);
  assert.equal(created.status, 'ACTIVE');
  assert.equal(created.absentPenalty, 0);
  assert.equal(previous.endDate, '2026-10-04');
  assert.equal(previous.status, 'INACTIVE');
});
