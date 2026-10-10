import assert from 'node:assert/strict';
import test from 'node:test';

import type { AttendeeRecord } from '../src/entities/event/model/types';
import { sessionLabelsFromHeader } from '../src/pages/attendance-events/model/eventFormat';
import {
  customStatusIn,
  statusColumnsOf,
  statusesOfAttendee,
  statusIn,
  withCustomStatus,
  withStatusIn,
} from '../src/pages/attendance-events/model/statusColumns';

function attendee(overrides: Partial<AttendeeRecord> = {}): AttendeeRecord {
  return {
    id: 'a1',
    eventId: 'e1',
    isExternal: false,
    name: '김서하',
    affiliation: '28기 분석',
    email: '',
    phone: '',
    status: 'unmarked',
    checkedInAt: '-',
    ...overrides,
  };
}

test('출결 열은 행사 출결 방식과 행사 열에 따라 정해진다', () => {
  const labels = (columns: ReturnType<typeof statusColumnsOf>) => columns.map((c) => c.label);

  assert.deepEqual(labels(statusColumnsOf({ attendanceFormat: 'NEWCOMER' }, false)), ['출결']);
  assert.deepEqual(labels(statusColumnsOf({ attendanceFormat: 'CONFERENCE' }, false)), [
    '1차 출결',
    '2차 출결',
  ]);
  assert.deepEqual(labels(statusColumnsOf({ attendanceFormat: 'CONFERENCE' }, true)), ['출석']);
  assert.deepEqual(
    labels(
      statusColumnsOf({ attendanceFormat: 'GENERAL', sessionLabels: ['MT', '해커톤'] }, false),
    ),
    ['MT', '해커톤'],
  );
  // 기타: 백엔드가 출결 값을 보내지 않으면 출결 열 없이 명단 파일의 열에 글자로 입력한다.
  assert.deepEqual(labels(statusColumnsOf({ attendanceFormat: 'OTHER' }, false)), []);
  // 기타: 백엔드가 보낸 출결 값이 있으면 그 값으로 출결 열 하나를 둔다.
  const [custom] = statusColumnsOf(
    { attendanceFormat: 'OTHER', statusOptions: [{ code: 'Y', label: '참석' }] },
    false,
  );
  assert.equal(custom?.kind, 'custom');
  // 기타가 아닌 방식은 출결 값이 프론트에 고정되어 있어 statusOptions를 무시한다.
  assert.deepEqual(
    labels(
      statusColumnsOf(
        { attendanceFormat: 'NEWCOMER', statusOptions: [{ code: 'Y', label: '참석' }] },
        false,
      ),
    ),
    ['출결'],
  );
  assert.deepEqual(
    statusesOfAttendee({ attendanceFormat: 'OTHER' }, attendee({ status: 'present' })),
    [],
  );
});

test('행사 열은 기록이 없으면 미정이고, 미정으로 바꾸면 기록을 지운다', () => {
  const [mt, hackathon] = statusColumnsOf(
    { attendanceFormat: 'GENERAL', sessionLabels: ['MT', '해커톤'] },
    false,
  );
  const base = attendee({ sessionStatuses: { MT: 'late' } });

  assert.equal(statusIn(base, mt), 'late');
  assert.equal(statusIn(base, hackathon), 'unmarked');

  const marked = withStatusIn(base, hackathon, 'present');
  assert.deepEqual(marked.sessionStatuses, { MT: 'late', 해커톤: 'present' });
  // 원래 참가자는 바뀌지 않는다.
  assert.deepEqual(base.sessionStatuses, { MT: 'late' });

  const cleared = withStatusIn(marked, mt, 'unmarked');
  assert.deepEqual(cleared.sessionStatuses, { 해커톤: 'present' });
});

test('통계용 출결 값은 참가자가 기록하는 열만 모은다', () => {
  // 컨퍼런스 외부 참석자는 2차가 없다.
  assert.deepEqual(
    statusesOfAttendee(
      { attendanceFormat: 'CONFERENCE' },
      attendee({ isExternal: true, status: 'present' }),
    ),
    ['present'],
  );
  assert.deepEqual(
    statusesOfAttendee(
      { attendanceFormat: 'CONFERENCE' },
      attendee({ status: 'present', secondStatus: 'earlyLeave' }),
    ),
    ['present', 'earlyLeave'],
  );
});

test('일반 행사형 명단 파일은 이름 뒤의 열을 행사 열로 읽는다', () => {
  assert.deepEqual(
    sessionLabelsFromHeader([
      '활동 TERM',
      '기수',
      '부문',
      '이름',
      'MT',
      '해커톤',
      '컨퍼톡',
      '홈커밍데이',
    ]),
    ['MT', '해커톤', '컨퍼톡', '홈커밍데이'],
  );
  // 비고는 행사 열이 아니다.
  assert.deepEqual(sessionLabelsFromHeader(['이름', 'MT', '비고']), ['MT']);
  assert.deepEqual(sessionLabelsFromHeader(['기수', '부문']), []);
});

test('기타 방식 출결은 고른 값을 다시 고르면 비운다', () => {
  const picked = withCustomStatus(attendee(), 'Y');
  assert.equal(customStatusIn(picked), 'Y');
  assert.equal(customStatusIn(withCustomStatus(picked, 'N')), 'N');
  assert.equal(customStatusIn(withCustomStatus(picked, 'Y')), undefined);
});
