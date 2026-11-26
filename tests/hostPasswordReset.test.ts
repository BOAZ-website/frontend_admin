import assert from 'node:assert/strict';
import test from 'node:test';

import { passwordResetBlockReasonOf } from '../src/pages/attendance-hosts/model/passwordResetBlock';

const ME_ID = 5;
const meWith = (...permissions: string[]) => ({ id: ME_ID, effectivePermissions: permissions });
const HOST = { id: 101, username: 'host_a', role: 'HOST' as const };
const OPERATOR = { id: 7, username: 'boaz_ops_1', role: 'TEAM' as const };
const MASTER = { id: 1, username: 'boaz_master', role: 'MASTER' as const };

test('HOST 계정 발급 CUD 권한이 있으면 HOST 계정을 재설정할 수 있다', () => {
  assert.equal(passwordResetBlockReasonOf(meWith('HOST_ACCOUNT_WRITE'), HOST), null);
});

test('HOST 계정 발급 CUD 권한도 타 계정 정보 수정 권한도 없으면 HOST 계정 재설정을 막는다', () => {
  assert.match(
    passwordResetBlockReasonOf(meWith('HOST_ACCOUNT_READ'), HOST) ?? '',
    /권한이 없습니다/,
  );
});

test('운영진 계정은 타 계정 정보 수정 권한이 있어야 재설정할 수 있다', () => {
  assert.match(
    passwordResetBlockReasonOf(meWith('HOST_ACCOUNT_WRITE'), OPERATOR) ?? '',
    /타 계정 정보 수정/,
  );
  assert.equal(passwordResetBlockReasonOf(meWith('ADMIN_ACCOUNT_WRITE'), OPERATOR), null);
});

test('본인 계정은 내 계정 창에서 바꾸라고 막는다', () => {
  assert.match(
    passwordResetBlockReasonOf(meWith('ADMIN_ACCOUNT_WRITE'), { ...OPERATOR, id: ME_ID }) ?? '',
    /내 계정/,
  );
});

test('서비스운영팀장(MASTER) 계정은 다른 사람이 재설정할 수 없다', () => {
  assert.match(passwordResetBlockReasonOf(meWith('ADMIN_ACCOUNT_WRITE'), MASTER) ?? '', /MASTER/);
});

test('내 권한을 읽지 못했으면 막지 않고 서버 판정에 맡긴다', () => {
  assert.equal(passwordResetBlockReasonOf(null, OPERATOR), null);
});
