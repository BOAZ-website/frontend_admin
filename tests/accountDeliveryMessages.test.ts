import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAccountDelivery } from '../src/shared/config/accountDeliveryMessages';

const BASE = { name: '홍길동', username: 'boaz_hong', password: 'Boaz!2027' };

test('전달문은 자리에 값을 채우고, 팀을 옮겼으면 팀 줄을 남긴다', () => {
  const { title, text } = buildAccountDelivery('changeWithPassword', {
    ...BASE,
    fromTeam: '기획팀',
    toTeam: '홍보팀',
  });
  assert.equal(title, '홍길동 운영진 계정 변경');
  assert.ok(text.includes('• 팀: 기획팀 → 홍보팀'));
  assert.ok(text.includes('• 로그인 아이디: boaz_hong'));
  assert.ok(text.includes('• 새 비밀번호: Boaz!2027'));
  assert.ok(!text.includes('{'));
});

test('값이 null이거나 빈 문자열인 자리가 든 줄은 통째로 빠진다', () => {
  for (const empty of [null, undefined, '', '  ']) {
    const { text } = buildAccountDelivery('changeWithPassword', {
      ...BASE,
      fromTeam: empty,
      toTeam: '홍보팀',
    });
    assert.ok(!text.includes('• 팀:'), `fromTeam=${JSON.stringify(empty)}`);
    // 다른 줄은 그대로 남는다.
    assert.ok(text.includes('• 로그인 아이디: boaz_hong'));
    assert.ok(text.includes('로그인 후 비밀번호를 바꿔 주세요.'));
  }
});
