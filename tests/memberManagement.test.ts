import assert from 'node:assert/strict';
import test from 'node:test';

import type { ClubMember } from '../src/entities/club-member/model/types';
import {
  filterClubMembers,
  NOT_OPERATOR,
  summarizeClubMembers,
} from '../src/pages/member-management/model/memberManagement';

const ALL_FILTER = { query: '', term: 'ALL', track: 'ALL', status: 'ALL' } as const;

const MEMBERS: ClubMember[] = [
  {
    id: 'member-1',
    name: '김보아',
    email: 'boa@example.com',
    phone: '010-1111-1111',
    university: '서울대학교',
    major: '통계학과',
    term: 30,
    track: '분석',
    status: 'ACTIVE',
    role: 'MEMBER',
  },
  {
    id: 'member-2',
    name: '이즈',
    email: 'viz@example.com',
    phone: '010-2222-2222',
    university: '',
    major: '',
    term: 29,
    track: '시각화',
    status: 'ALUMNI',
    role: 'MEMBER',
  },
  {
    id: 'member-3',
    name: '박엔지',
    email: 'engineer@example.com',
    phone: '010-3333-3333',
    university: '연세대학교',
    major: '컴퓨터과학과',
    term: 30,
    track: '엔지니어링',
    status: 'ACTIVE',
    role: 'OPERATOR',
  },
];

test('이름과 이메일을 검색하고 기수·부문·상태 필터를 함께 적용한다', () => {
  assert.deepEqual(
    filterClubMembers(MEMBERS, {
      query: 'engineer',
      term: 30,
      track: '엔지니어링',
      status: 'ACTIVE',
    }).map((member) => member.id),
    ['member-3'],
  );

  assert.deepEqual(
    filterClubMembers(MEMBERS, {
      query: '김보아',
      term: 'ALL',
      track: 'ALL',
      status: 'ALL',
    }).map((member) => member.id),
    ['member-1'],
  );
});

test('필터 결과는 원본을 바꾸지 않고, 정렬하지 않아 서버가 준 순서를 그대로 둔다', () => {
  const originalIds = MEMBERS.map((member) => member.id);
  const result = filterClubMembers(MEMBERS, {
    query: '',
    term: 'ALL',
    track: 'ALL',
    status: 'ALL',
  });

  assert.deepEqual(
    result.map((member) => member.id),
    ['member-1', 'member-2', 'member-3'],
  );
  assert.deepEqual(
    MEMBERS.map((member) => member.id),
    originalIds,
  );
});

test('전체·활동·수료·운영진 인원을 요약한다', () => {
  assert.deepEqual(summarizeClubMembers(MEMBERS), {
    total: 3,
    active: 2,
    alumni: 1,
    operators: 1,
  });
});

test('운영진 필터로 팀별 운영진이나 운영진이 아닌 동아리원을 고르고, 없으면 전체로 본다', () => {
  const members = MEMBERS.map((member) => ({
    ...member,
    operatorTeam: member.id === 'member-3' ? '운영지원팀' : null,
  }));
  const base = { query: '', term: 'ALL', track: 'ALL', status: 'ALL' } as const;

  assert.deepEqual(
    filterClubMembers(members, { ...base, operator: '운영지원팀' }).map((member) => member.id),
    ['member-3'],
  );
  assert.deepEqual(
    filterClubMembers(members, { ...base, operator: NOT_OPERATOR }).map((member) => member.id),
    ['member-1', 'member-2'],
  );
  assert.equal(filterClubMembers(members, base).length, members.length);
});

test('부문 명단은 그 부문에서 탈퇴하지 않은 사람, 탈퇴 명단은 부문과 관계없이 탈퇴한 사람이다', () => {
  const withdrawn: ClubMember = { ...MEMBERS[0], id: 'member-4', status: 'WITHDRAWN' };
  const members = [...MEMBERS, withdrawn];
  const idsOf = (sheet: 'active' | 'alumni' | 'analysis' | 'engineering' | 'withdrawn') =>
    filterClubMembers(members, { ...ALL_FILTER, sheet }).map((member) => member.id);

  assert.deepEqual(idsOf('analysis'), ['member-1']);
  assert.deepEqual(idsOf('engineering'), ['member-3']);
  assert.deepEqual(idsOf('withdrawn'), ['member-4']);
  // 활동기수·수료기수 목록은 부문과 관계없이 그 활동 상태인 사람이다.
  assert.deepEqual(idsOf('active'), ['member-1', 'member-3']);
  assert.deepEqual(idsOf('alumni'), ['member-2']);
});
