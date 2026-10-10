import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cohortsOf,
  currentCohortOf,
  DEFAULT_CURRENT_COHORT,
  isPastCohort,
} from '../src/entities/cohort/model/lib';

test('기수 목록은 중복 없이 큰 기수부터이고, 값이 없으면 기본 기수로 본다', () => {
  assert.deepEqual(cohortsOf([26, 27, 26, undefined]), [27, 26]);
  assert.deepEqual(cohortsOf([]), []);
});

test('현재 기수는 가장 큰 기수이고, 없으면 기본 기수다', () => {
  assert.equal(currentCohortOf([27, 26]), 27);
  assert.equal(currentCohortOf([]), DEFAULT_CURRENT_COHORT);
});

test('다음 기수가 생기면 이전 기수는 자동으로 지난 기수가 된다', () => {
  assert.equal(isPastCohort(27, currentCohortOf([27, 26])), false);
  assert.equal(isPastCohort(27, currentCohortOf([28, 27, 26])), true);
  assert.equal(isPastCohort(26, currentCohortOf([27, 26])), true);
});
