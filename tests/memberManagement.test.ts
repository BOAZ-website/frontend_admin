import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterClubMembers,
  summarizeClubMembers,
  type ClubMember,
} from '../src/pages/member-management/model/memberManagement';

const MEMBERS: ClubMember[] = [
  {
    id: 'member-1',
    name: '김보아',
    email: 'boa@example.com',
    phone: '010-1111-1111',
    cohort: 30,
    track: 'ANALYSIS',
    status: 'ACTIVE',
    role: 'MEMBER',
    joinedAt: '2026-07-01',
  },
  {
    id: 'member-2',
    name: '이즈',
    email: 'viz@example.com',
    phone: '010-2222-2222',
    cohort: 29,
    track: 'VISUALIZATION',
    status: 'ALUMNI',
    role: 'MEMBER',
    joinedAt: '2025-07-01',
  },
  {
    id: 'member-3',
    name: '박엔지',
    email: 'engineer@example.com',
    phone: '010-3333-3333',
    cohort: 30,
    track: 'ENGINEERING',
    status: 'ACTIVE',
    role: 'OPERATOR',
    joinedAt: '2026-07-01',
  },
];

test('이름과 이메일을 검색하고 기수·부문·상태 필터를 함께 적용한다', () => {
  assert.deepEqual(
    filterClubMembers(MEMBERS, {
      query: 'engineer',
      cohort: 30,
      track: 'ENGINEERING',
      status: 'ACTIVE',
    }).map((member) => member.id),
    ['member-3'],
  );

  assert.deepEqual(
    filterClubMembers(MEMBERS, {
      query: '김보아',
      cohort: 'ALL',
      track: 'ALL',
      status: 'ALL',
    }).map((member) => member.id),
    ['member-1'],
  );
});

test('필터 결과는 원본을 바꾸지 않고 최신 기수와 이름순으로 정렬된다', () => {
  const originalIds = MEMBERS.map((member) => member.id);
  const result = filterClubMembers(MEMBERS, {
    query: '',
    cohort: 'ALL',
    track: 'ALL',
    status: 'ALL',
  });

  assert.deepEqual(result.map((member) => member.id), ['member-1', 'member-3', 'member-2']);
  assert.deepEqual(MEMBERS.map((member) => member.id), originalIds);
});

test('전체·활동·수료·운영진 인원을 요약한다', () => {
  assert.deepEqual(summarizeClubMembers(MEMBERS), {
    total: 3,
    active: 2,
    alumni: 1,
    operators: 1,
  });
});
