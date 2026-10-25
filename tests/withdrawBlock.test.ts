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

test('운영진·HOST 계정·현재 반기 팀장 사유를 모두 모으고, 안내문에 먼저 할 일을 적는다', () => {
  const blocks = withdrawBlocksOf({
    operatorTeam: '기획팀',
    hostUsernames: 'host_a',
    leaderTeams: '테라폼 스터디',
  });
  assert.deepEqual(
    blocks.map((block) => block.code),
    ['MEMBER_IS_OPERATOR', 'MEMBER_HAS_HOST_ACCOUNT', 'MEMBER_IS_TEAM_LEADER'],
  );
  const message = withdrawBlockMessageOf('홍길동', blocks) ?? '';
  assert.ok(message.startsWith('홍길동님은 아래 이유로 탈퇴 처리할 수 없습니다.'));
  assert.ok(message.includes("운영진을 '없음'으로 바꿔 운영진 계정을 먼저 해지"));
  assert.ok(message.includes('그룹 계정 관리에서 계정을 먼저 삭제'));
  assert.ok(message.includes('현재 반기 테라폼 스터디의 팀장입니다'));
});
