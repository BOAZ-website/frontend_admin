import assert from 'node:assert/strict';
import test from 'node:test';

import { DUAL_ROLE_ADMIN_ACCOUNT } from '../src/pages/system-accounts/model/initialAccounts';

test('ADV와 스터디를 함께 담당하는 사용자에게 운영진 계정 예시가 연결된다', () => {
  const account = DUAL_ROLE_ADMIN_ACCOUNT;

  assert.equal(account.user_id, 'u_27_02');
  assert.equal(account.username, 'boaz_dual_leader');
  assert.equal(account.team_name, '운영지원팀');
});
