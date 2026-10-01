import assert from 'node:assert/strict';
import test from 'node:test';

import type { HostAccount } from '../src/entities/host-account/model/types';
import {
  addPermissionToHost,
  findHostAccountByIdentity,
} from '../src/pages/attendance-hosts/model/accountLookup';

const accounts: HostAccount[] = [
  {
    id: 'host-1',
    username: 'host_ana_1',
    initialPassword: 'initial-password',
    hostName: '고준서 (분석 1팀)',
    generation: '27기',
    track: '분석',
    team: '분석 1팀',
    groupType: 'ADV',
    permissions: ['ADV'],
    assignedGroups: [{ type: 'ADV', teamName: '분석 1팀' }],
    createdAt: '2026-09-13',
    active: true,
    accountType: 'ADV',
  },
];

test('이름, 기수, 부문이 모두 일치하는 계정을 찾는다', () => {
  assert.equal(
    findHostAccountByIdentity(accounts, {
      name: '고준서',
      generation: '27기',
      track: '분석',
    })?.id,
    'host-1',
  );
});

test('기수나 부문이 다르면 기존 계정으로 판정하지 않는다', () => {
  assert.equal(
    findHostAccountByIdentity(accounts, {
      name: '고준서',
      generation: '26기',
      track: '분석',
    }),
    null,
  );
  assert.equal(
    findHostAccountByIdentity(accounts, {
      name: '고준서',
      generation: '27기',
      track: '시각화',
    }),
    null,
  );
});

test('기존 권한과 그룹을 보존하면서 새 권한을 한 번만 추가한다', () => {
  const updated = addPermissionToHost(accounts[0], 'STUDY', {
    type: '스터디',
    teamName: '방학 스터디 A팀',
  });
  const repeated = addPermissionToHost(updated, 'STUDY', {
    type: '스터디',
    teamName: '방학 스터디 A팀',
  });

  assert.deepEqual(repeated.permissions, ['ADV', 'STUDY']);
  assert.deepEqual(repeated.assignedGroups, [
    { type: 'ADV', teamName: '분석 1팀' },
    { type: '스터디', teamName: '방학 스터디 A팀' },
  ]);
});
