import assert from 'node:assert/strict';
import test from 'node:test';

import { randomPassword } from '../src/pages/system-accounts/ui/accountLabels';

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

test('임의 비밀번호는 16자이고 비밀번호 정책을 지키며 매번 다르다', () => {
  const generated = Array.from({ length: 50 }, randomPassword);
  assert.ok(generated.every((password) => password.length === 16));
  assert.ok(generated.every((password) => PASSWORD_PATTERN.test(password)));
  assert.equal(new Set(generated).size, generated.length);
});
