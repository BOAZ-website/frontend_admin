import assert from 'node:assert/strict';
import test from 'node:test';

import { isActivePage, PAGE_LABELS } from '../src/shared/config/pageLabels';

test('화면 ID 목록에 있는 값만 주소 해시·저장값으로 받는다', () => {
  assert.equal(isActivePage('system-members'), true);
  assert.equal(isActivePage('att-scores'), true);
  assert.ok(Object.keys(PAGE_LABELS).every(isActivePage));

  assert.equal(isActivePage(''), false);
  assert.equal(isActivePage('unknown-page'), false);
  assert.equal(isActivePage('toString'), false);
  assert.equal(isActivePage('__proto__'), false);
});
