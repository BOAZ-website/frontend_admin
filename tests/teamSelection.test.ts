import assert from 'node:assert/strict';
import test from 'node:test';

import {
  replaceTeamLeader,
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

test('선택한 팀의 팀장만 변경한다', () => {
  const teams = [
    { id: 'adv-1', leaderName: '홍길동' },
    { id: 'adv-2', leaderName: '이보아' },
  ];
  const updated = replaceTeamLeader(teams, 'adv-1', '김보아');

  assert.equal(updated[0].leaderName, '김보아');
  assert.equal(updated[1], teams[1]);
  assert.notEqual(updated, teams);
  assert.deepEqual(replaceTeamLeader(teams, 'missing', '김보아'), teams);
});
