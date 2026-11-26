import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_BUTTON_CLASS,
  TRACK_BUTTON_CLASS,
  trackButtonClassOf,
} from '../src/entities/user/model/trackAccent';

test('picks the track color from a backend code or a Korean label', () => {
  assert.equal(trackButtonClassOf('ANALYSIS'), TRACK_BUTTON_CLASS.분석);
  assert.equal(trackButtonClassOf('시각화'), TRACK_BUTTON_CLASS.시각화);
  assert.equal(trackButtonClassOf('ENGINEERING'), TRACK_BUTTON_CLASS.엔지니어링);
});

test('falls back to the default color when there is no single track', () => {
  assert.equal(trackButtonClassOf(null), DEFAULT_BUTTON_CLASS);
  assert.equal(trackButtonClassOf(undefined), DEFAULT_BUTTON_CLASS);
  assert.equal(trackButtonClassOf('ALL'), DEFAULT_BUTTON_CLASS);
});
