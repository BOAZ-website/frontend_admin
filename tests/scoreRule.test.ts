import assert from 'node:assert/strict';
import test from 'node:test';

import { getRuleForDate, getRuleForTerm } from '../src/entities/score-rule/model/lib';
import type { ScoreRule } from '../src/entities/score-rule/model/types';

test('초안은 출결 점수 규칙으로 적용하지 않는다', () => {
  const draft = { term: 28, status: 'DRAFT', startDate: '2026-01-01' } as ScoreRule;
  assert.equal(getRuleForTerm([draft], 28), undefined);
  assert.equal(getRuleForDate([draft], '2026-10-02'), undefined);
  assert.equal(getRuleForDate([], '2026-10-02'), undefined);
});
