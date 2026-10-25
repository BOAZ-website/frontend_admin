import assert from 'node:assert/strict';
import test from 'node:test';

import {
  withdrawBlockMessageOf,
  withdrawBlocksOf,
} from '../src/entities/club-member/model/withdrawBlock';

const NONE = { operatorTeam: null, hostUsernames: null, leaderTeams: null };

test('계정이 없고 현재 반기 팀장도 아니면 막는 사유가 없다', () => {
  assert.deepEqual(withdrawBlocksOf(NONE), []);
  assert.equal(withdrawBlockMessageOf('홍길동', []), null);
});

test('운영진과 현재 반기 팀장 사유를 모두 모으고, 안내문에 먼저 할 일을 적는다', () => {
  const blocks = withdrawBlocksOf({
    operatorTeam: '기획팀',
    hostUsernames: 'host_a',
    leaderTeams: '테라폼 스터디',
  });
  assert.deepEqual(
    blocks.map((block) => block.code),
    ['MEMBER_IS_OPERATOR', 'MEMBER_IS_TEAM_LEADER'],
  );
  const message = withdrawBlockMessageOf('홍길동', blocks) ?? '';
  assert.ok(message.startsWith('홍길동님은 아래 이유로 탈퇴 처리할 수 없습니다.'));
  assert.ok(message.includes("운영진을 '없음'으로 바꿔 운영진 계정을 먼저 해지"));
  // HOST 계정은 팀장 사유에 함께 적고, 따로 줄을 만들지 않는다.
  assert.ok(message.includes('현재 반기 테라폼 스터디의 팀장(HOST 계정 host_a)입니다'));
  assert.ok(message.includes('팀장을 바꾸면 HOST 계정도 회수됩니다'));
  assert.ok(!message.includes('그룹 계정 관리'));
});

test('팀장이 아닌데 HOST 계정만 있으면(팀이 아직 없는 계정) 계정 삭제를 안내한다', () => {
  const blocks = withdrawBlocksOf({ ...NONE, hostUsernames: 'host_z' });
  assert.deepEqual(
    blocks.map((block) => block.code),
    ['MEMBER_HAS_HOST_ACCOUNT'],
  );
  assert.ok(blocks[0].message.includes('그룹 계정 관리에서 계정을 먼저 삭제'));
});
