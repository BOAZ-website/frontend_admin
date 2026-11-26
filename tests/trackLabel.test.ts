import assert from 'node:assert/strict';
import test from 'node:test';

import { trackLabelOf } from '../src/entities/user/model/trackLabel';

test('turns backend track codes into Korean labels', () => {
  assert.equal(trackLabelOf('ENGINEERING'), '엔지니어링');
  assert.equal(trackLabelOf('ANALYSIS'), '분석');
  assert.equal(trackLabelOf('VISUALIZATION'), '시각화');
  assert.equal(trackLabelOf('ALL'), '전부문');
});

test('passes Korean labels and unknown values through', () => {
  assert.equal(trackLabelOf('분석'), '분석');
  assert.equal(trackLabelOf('NEW_TRACK'), 'NEW_TRACK');
});

test('returns null for empty values', () => {
  assert.equal(trackLabelOf(''), null);
  assert.equal(trackLabelOf(null), null);
  assert.equal(trackLabelOf(undefined), null);
});
