import assert from 'node:assert/strict';
import test from 'node:test';

import type { ClubMember } from '../src/entities/club-member/model/types';
import {
  candidatesOf,
  matchesFilter,
  parseTerm,
} from '../src/pages/system-accounts/model/credentialCandidates';

const member = (id: string, name: string, term: number, status: ClubMember['status']) =>
  ({ id, name, term, track: '분석', status }) as ClubMember;

test('발급 후보는 활동 중인 동아리원만, 기수 큰 순·이름 순이다', () => {
  const list = candidatesOf([
    member('a', '나', 26, 'ACTIVE'),
    member('b', '가', 27, 'ACTIVE'),
    member('c', '다', 27, 'WITHDRAWN'),
    member('d', '가', 26, 'ACTIVE'),
  ]);

  assert.deepEqual(
    list.map((m) => m.id),
    ['b', 'd', 'a'],
  );
});

test('기수 칸은 "27"·"27기"를 숫자로 읽고, 비면 null, 숫자가 아니면 NaN이다', () => {
  assert.equal(parseTerm('27기'), 27);
  assert.equal(parseTerm(' 27 '), 27);
  assert.equal(parseTerm(''), null);
  assert.ok(Number.isNaN(parseTerm('스물')));
});

test('이름·부문은 일부만 맞아도 되고 기수는 같아야 한다', () => {
  const target = member('a', '홍길동', 27, 'ACTIVE');

  assert.ok(matchesFilter(target, { name: '길', term: null, track: '분' }));
  assert.ok(!matchesFilter(target, { name: '', term: 26, track: '' }));
});
