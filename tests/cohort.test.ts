import assert from 'node:assert/strict';
import test from 'node:test';

import { cohortsOf, isPastCohort } from '../src/entities/cohort/model/lib';

test('기수 목록은 중복 없이 큰 기수부터다', () => {
  assert.deepEqual(cohortsOf([26, 27, 26]), [27, 26]);
  assert.deepEqual(cohortsOf([]), []);
});

test('다음 기수가 생기면 이전 기수는 자동으로 지난 기수가 된다', () => {
  assert.equal(isPastCohort(27, 27), false);
  assert.equal(isPastCohort(27, 28), true);
  assert.equal(isPastCohort(26, 27), true);
});
