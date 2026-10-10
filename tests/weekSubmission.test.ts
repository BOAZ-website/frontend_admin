import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWeekSubmission,
  countUnmarked,
  submissionKey,
} from '../src/pages/attendance-internal-category/model/weekSubmission';
import { submitWeekAttendance } from '../src/entities/attendance/api/submitWeekApi';

const attendee = (over: Record<string, unknown>) =>
  ({
    id: 'a_w3',
    originalId: 'a',
    eventId: 'evt',
    teamId: 'base_analysis',
    teamName: '분석',
    name: '가',
    term: 28,
    track: '분석',
    status: 'present',
    checkedInAt: '14:00',
    weekNum: 3,
    ...over,
  }) as never;

test('제출 요청은 그 팀·주차 사람들의 상태값만 담는다', () => {
  const submission = buildWeekSubmission('BASE', 27, 3, 'base_analysis', [
    attendee({}),
    attendee({ id: 'b_w3', originalId: 'b', name: '나', status: 'late', memo: '10분 지각' }),
    attendee({ id: 'c_w3', originalId: 'c', name: '다', teamId: 'base_vis' }), // 다른 팀
    attendee({ id: 'd_w2', originalId: 'd', name: '라', weekNum: 2 }), // 다른 주차
  ]);

  assert.equal(submission.cohort, 27);
  assert.equal(submission.weekNum, 3);
  assert.equal(submission.teamId, 'base_analysis');
  assert.deepEqual(
    submission.records.map((record) => [record.memberId, record.status]),
    [
      ['a', 'present'],
      ['b', 'late'],
    ],
  );
  assert.equal(submission.records[1].memo, '10분 지각');
  assert.equal('memo' in submission.records[0], false);
});

test('미정 상태의 인원 수를 센다', () => {
  const submission = buildWeekSubmission('BASE', 27, 3, 'base_analysis', [
    attendee({ status: 'unmarked' }),
    attendee({ id: 'b_w3', originalId: 'b', status: 'present' }),
    attendee({ id: 'c_w3', originalId: 'c', status: 'unmarked' }),
  ]);
  assert.equal(countUnmarked(submission), 2);
});

test('제출 여부 키는 기수·팀·주차로 정해진다', () => {
  assert.equal(submissionKey(27, 'base_analysis', 3), '27|base_analysis|3');
  assert.notEqual(submissionKey(27, 'base_analysis', 3), submissionKey(26, 'base_analysis', 3));
});

test('서버 주소가 없으면 임시 구현이 제출 시각을 돌려주고, 대상이 없으면 거부한다', async () => {
  const result = await submitWeekAttendance({
    group: 'BASE',
    cohort: 27,
    teamId: 'base_analysis',
    weekNum: 3,
    records: [{ memberId: 'a', name: '가', term: 28, track: '분석', status: 'present' }],
  });
  assert.ok(!Number.isNaN(Date.parse(result.submittedAt)));

  await assert.rejects(
    submitWeekAttendance({
      group: 'BASE',
      cohort: 27,
      teamId: 'base_analysis',
      weekNum: 3,
      records: [],
    }),
    /제출할 출결 대상이 없습니다/,
  );
});

test('ADV 제출 요청은 group=ADV로 만들어진다', () => {
  const submission = buildWeekSubmission('ADV', 26, 3, 'adv_t1', [
    attendee({ teamId: 'adv_t1', name: '가', weekNum: 3 }),
  ]);
  assert.equal(submission.group, 'ADV');
  assert.equal(submission.teamId, 'adv_t1');
  assert.equal(submission.records.length, 1);
});
