import assert from 'node:assert/strict';
import test from 'node:test';

import { sortTeamNames } from '../src/pages/system-accounts/model/teamOrder';

test('권한 관리 팀 순서는 대표진 → 차기대표진 → 가나다순이고, 차기대표진을 대표진에 묶지 않는다', () => {
  const sorted = sortTeamNames(['홍보팀', '차기대표진', '기획팀', '대표진', '기획팀']);

  assert.deepEqual(sorted, ['대표진', '차기대표진', '기획팀', '홍보팀']);
});
