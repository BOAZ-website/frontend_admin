import assert from 'node:assert/strict';
import test from 'node:test';

import { matchMember, memberCheckOf } from '../src/pages/attendance-events/model/memberLookup';

const candidates = [
  { id: 'u_28_01', name: '김서하', term: 28, track: '분석' as const },
  { id: 'u_26_99', name: '김서하', term: 26, track: '시각화' as const },
];

test('이름과 기수가 모두 같은 회원만 연결한다', () => {
  assert.deepEqual(matchMember({ name: '김서하', term: 28 }, candidates), {
    userId: 'u_28_01',
    name: '김서하',
    term: 28,
    track: '분석',
  });
  // 동명이인이어도 기수로 가린다.
  assert.equal(matchMember({ name: '김서하', term: 26 }, candidates)?.userId, 'u_26_99');
});

test('기수를 모르거나 맞는 회원이 없으면 연결하지 않는다', () => {
  assert.equal(matchMember({ name: '김서하' }, candidates), undefined);
  assert.equal(matchMember({ name: '김서하', term: 27 }, candidates), undefined);
  assert.equal(matchMember({ name: '홍길동', term: 28 }, []), undefined);
});

test('회원 DB에 없는 사람은 현재 활동 기수인지로 나눈다', () => {
  const member = { userId: 'u_28_01', name: '김서하', term: 28, track: '분석' };
  const activeTerms = [26, 27];
  assert.equal(memberCheckOf({ term: 28, isExternal: false }, member, activeTerms), 'member');
  // 현재 활동 기수인데 없으면 오타일 수 있다.
  assert.equal(
    memberCheckOf({ term: 27, isExternal: false }, undefined, activeTerms),
    'currentNotInDb',
  );
  // 이전에 수료한 기수는 회원 DB에 없을 수 있다(정상).
  assert.equal(
    memberCheckOf({ term: 22, isExternal: false }, undefined, activeTerms),
    'pastNotInDb',
  );
  // 활동 기수를 모르면 현재 기수인지 가릴 수 없다.
  assert.equal(memberCheckOf({ term: 27, isExternal: false }, undefined, undefined), 'pastNotInDb');
  // 외부 참가자·기수 모름은 확인하지 않는다.
  assert.equal(memberCheckOf({ term: 27, isExternal: true }, undefined, activeTerms), 'unchecked');
  assert.equal(memberCheckOf({ isExternal: false }, undefined, activeTerms), 'unchecked');
});

test('이름이 같아도 기수가 다른 이전 기수는 회원으로 연결하지 않는다', () => {
  const dbMembers = [{ id: 'u_28_11', name: '박지훈', term: 28, track: '분석' as const }];
  assert.equal(matchMember({ name: '박지훈', term: 23 }, dbMembers), undefined);
});
