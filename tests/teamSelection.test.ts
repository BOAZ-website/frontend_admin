import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveConfiguredTeam,
  type ConfiguredTeam,
} from '../src/pages/attendance-hosts/model/teamSelection';

const advTeams: ConfiguredTeam[] = [
  {
    id: 'adv-1',
    teamName: '분석 1팀',
    defaultLeader: '홍길동',
    track: '분석',
  },
];

const studyTeams: ConfiguredTeam[] = [
  {
    id: 'study-1',
    teamName: '추천시스템 스터디',
    defaultLeader: '김보아',
    track: '엔지니어링',
  },
];

test('선택한 그룹 유형의 구성된 팀을 ID로 찾는다', () => {
  assert.deepEqual(resolveConfiguredTeam('ADV', 'adv-1', advTeams, studyTeams), advTeams[0]);
  assert.deepEqual(resolveConfiguredTeam('스터디', 'study-1', advTeams, studyTeams), studyTeams[0]);
});

test('다른 그룹 유형의 팀이나 선택하지 않은 팀은 반환하지 않는다', () => {
  assert.equal(resolveConfiguredTeam('ADV', 'study-1', advTeams, studyTeams), null);
  assert.equal(resolveConfiguredTeam('스터디', '', advTeams, studyTeams), null);
});
