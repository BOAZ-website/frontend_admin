import assert from 'node:assert/strict';
import test from 'node:test';

import { confirmLeave, registerLeaveGuard } from '../src/shared/lib/leaveGuard';

test('등록된 확인이 없으면 바로 떠나도 된다', () => {
  assert.equal(
    confirmLeave(() => assert.fail('바로 떠날 때는 proceed를 부르지 않는다')),
    true,
  );
});

test('확인 함수가 돌려준 boolean을 그대로 따른다', () => {
  const unregister = registerLeaveGuard(() => false);
  assert.equal(confirmLeave(), false);
  unregister();

  const unregisterAllow = registerLeaveGuard(() => true);
  assert.equal(confirmLeave(), true);
  unregisterAllow();
});

test('확인 함수가 머문 뒤 받은 proceed를 나중에 부르면 그때 옮긴다', async () => {
  let saved: () => void = () => {};
  const unregister = registerLeaveGuard((proceed) => {
    saved = proceed;
    return false;
  });
  let moved = 0;

  const canLeaveNow = confirmLeave(() => {
    moved += 1;
  });
  await Promise.resolve();
  saved();

  assert.equal(canLeaveNow, false);
  assert.equal(moved, 1);
  unregister();
});

test('등록을 풀면 다시 바로 떠나도 된다', () => {
  const unregister = registerLeaveGuard(() => false);
  unregister();
  assert.equal(confirmLeave(), true);
});
