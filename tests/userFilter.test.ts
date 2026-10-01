import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addMembers,
  filterUsers,
  findLeader,
  formatUserLabel,
  toggleLeader,
  toggleMember,
  type MemberSelection,
} from '../src/entities/user/model/lib';
import type { UserProfile } from '../src/entities/user/model/types';

const users: UserProfile[] = [
  { id: '1', name: '남민서', term: 26, track: '분석' },
  { id: '2', name: '문지훈', term: 27, track: '시각화' },
  { id: '3', name: '고준서', term: 27, track: '분석' },
];

test('필터가 모두 비어 있으면 전체를 기수·부문·이름 순으로 반환한다', () => {
  const result = filterUsers(users, { terms: [], tracks: [], keyword: '' });
  assert.deepEqual(
    result.map((u) => u.id),
    ['1', '3', '2'],
  );
});

test('기수와 부문을 함께 지정하면 교집합만 반환한다', () => {
  const result = filterUsers(users, { terms: [27], tracks: ['분석'], keyword: '' });
  assert.deepEqual(
    result.map((u) => u.id),
    ['3'],
  );
});

test('이름 키워드로 추가로 좁힌다', () => {
  const result = filterUsers(users, { terms: [], tracks: [], keyword: '문지' });
  assert.deepEqual(
    result.map((u) => u.id),
    ['2'],
  );
});

test('원본 배열을 변경하지 않는다', () => {
  const copy = [...users];
  filterUsers(users, { terms: [], tracks: [], keyword: '' });
  assert.deepEqual(users, copy);
});

test('라벨은 "기수 부문 이름" 형식이다', () => {
  assert.equal(formatUserLabel(users[0]), '26기 분석 남민서');
});

const [a, b] = users;
const empty: MemberSelection = { members: [], leaderId: null };

test('스터디장으로 지정하면 스터디원에도 자동 포함된다', () => {
  const next = toggleLeader(empty, a);
  assert.deepEqual(
    next.members.map((m) => m.id),
    ['1'],
  );
  assert.equal(next.leaderId, '1');
});

test('스터디장은 1명만 지정된다', () => {
  const next = toggleLeader(toggleLeader(empty, a), b);
  assert.equal(next.leaderId, '2');
  assert.deepEqual(
    next.members.map((m) => m.id),
    ['1', '2'],
  );
});

test('스터디장을 스터디원에서 빼면 스터디장 지정도 해제된다', () => {
  const next = toggleMember(toggleLeader(empty, a), a);
  assert.deepEqual(next, { members: [], leaderId: null });
});

test('결과 전체 선택은 이미 선택된 회원을 중복 추가하지 않는다', () => {
  const next = addMembers(toggleMember(empty, a), users);
  assert.equal(next.members.length, 3);
  assert.equal(findLeader(toggleLeader(next, b))?.id, '2');
});
