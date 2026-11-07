import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLUB_MEMBER_STATUS_LABELS,
  CLUB_MEMBER_STATUSES,
  isIdentityLockedStatus,
  isLeftClubStatus,
} from '../src/entities/club-member/model/types';

test('활동 상태 코드는 네 가지이고 화면 이름은 활동기수·수료·미수료·탈퇴다', () => {
  assert.deepEqual(CLUB_MEMBER_STATUSES, ['ACTIVE', 'COMPLETED', 'NOT_COMPLETED', 'WITHDRAWN']);
  assert.deepEqual(
    CLUB_MEMBER_STATUSES.map((status) => CLUB_MEMBER_STATUS_LABELS[status]),
    ['활동기수', '수료', '미수료', '탈퇴'],
  );
});

test('미수료·탈퇴만 나간 상태이고, 이름·기수·부문 잠금은 활동기수에만 걸린다', () => {
  assert.deepEqual(CLUB_MEMBER_STATUSES.filter(isLeftClubStatus), ['NOT_COMPLETED', 'WITHDRAWN']);
  assert.deepEqual(CLUB_MEMBER_STATUSES.filter(isIdentityLockedStatus), ['ACTIVE']);
});
