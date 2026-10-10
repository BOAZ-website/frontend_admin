import assert from 'node:assert/strict';
import test from 'node:test';

import { applyAttendeePatch, attendeePatchOf } from '../src/entities/event/model/attendeePatch';
import type { AttendeeRecord } from '../src/entities/event/model/types';
import { withoutKeys } from '../src/shared/lib/object';

function attendee(overrides: Partial<AttendeeRecord> = {}): AttendeeRecord {
  return {
    id: 'a1',
    eventId: 'e1',
    isExternal: false,
    name: '김서하',
    affiliation: '',
    email: '',
    phone: '',
    status: 'unmarked',
    checkedInAt: '-',
    customAnswers: { 기수: '28기', '뒤풀이 비용': '' },
    ...overrides,
  };
}

test('바뀐 칸만 부분 저장 본문에 담는다', () => {
  const before = attendee();
  assert.deepEqual(
    attendeePatchOf(before, { ...before, status: 'present', checkedInAt: '14:00' }),
    {
      status: 'present',
      checkedInAt: '14:00',
    },
  );
  // 추가 컬럼은 바뀐 키만
  assert.deepEqual(
    attendeePatchOf(before, {
      ...before,
      customAnswers: { ...before.customAnswers, '뒤풀이 비용': 'O' },
    }),
    { customAnswers: { '뒤풀이 비용': 'O' } },
  );
  // 기타 출결을 미정으로 되돌리면 null
  const picked = attendee({ customStatus: '참석' });
  const cleared = withoutKeys(picked, 'customStatus');
  assert.deepEqual(attendeePatchOf(picked, cleared), { customStatus: null });
  assert.deepEqual(attendeePatchOf(before, before), {});
});

test('부분 저장 본문을 적용하면 보낸 칸만 바뀐다', () => {
  const base = attendee({ customStatus: '참석', memo: '메모' });
  const next = applyAttendeePatch(base, { status: 'late', customAnswers: { '뒤풀이 비용': 'X' } });
  assert.equal(next.status, 'late');
  assert.equal(next.memo, '메모');
  assert.deepEqual(next.customAnswers, { 기수: '28기', '뒤풀이 비용': 'X' });
  assert.equal(next.customStatus, '참석');
  assert.equal(applyAttendeePatch(base, { customStatus: null }).customStatus, undefined);
});
