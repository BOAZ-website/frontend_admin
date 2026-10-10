import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isConcurrentBaseMember,
  shouldShowConcurrentColumn,
  shouldShowMatrixTrack,
  sortConcurrentMembersLast,
} from '../src/pages/attendance-internal-category/model/baseAttendanceConcurrent';

test('BASE 전체 출결표는 트랙 필터와 관계없이 부문 컬럼을 표시한다', () => {
  assert.equal(shouldShowMatrixTrack('SESSION', '분석'), true);
  assert.equal(shouldShowMatrixTrack('ADV', '분석'), false);
  assert.equal(shouldShowMatrixTrack('ADV', 'ALL'), true);
});

test('병행 여부 컬럼은 BASE와 ADV 출결 매트릭스에 표시한다', () => {
  assert.equal(shouldShowConcurrentColumn('SESSION'), true);
  assert.equal(shouldShowConcurrentColumn('ADV'), true);
  assert.equal(shouldShowConcurrentColumn('STUDY'), false);
});

test('같은 기수 BASE와 ADV에 동일한 사용자 ID가 있을 때만 병행으로 판정한다', () => {
  const base = { id: 'base_27_analysis', cohort: 27 } as Parameters<
    typeof isConcurrentBaseMember
  >[3][number];
  const adv = { id: 'adv_27_analysis_1', cohort: 27 } as Parameters<
    typeof isConcurrentBaseMember
  >[4][number];
  const older = { id: 'adv_26_analysis_1', cohort: 26 } as Parameters<
    typeof isConcurrentBaseMember
  >[4][number];
  const members = {
    [base.id]: [{ id: `${base.id}_u1` }],
    [adv.id]: [{ id: `${adv.id}_u1` }],
    [older.id]: [{ id: `${older.id}_u2` }],
  } as unknown as Parameters<typeof isConcurrentBaseMember>[5];
  assert.equal(
    isConcurrentBaseMember(`${base.id}_u1`, base.id, 27, [base], [adv, older], members),
    true,
  );
  assert.equal(
    isConcurrentBaseMember(`${base.id}_u2`, base.id, 27, [base], [adv, older], members),
    false,
  );
  assert.equal(
    isConcurrentBaseMember(`${base.id}_u1`, base.id, 26, [base], [adv, older], members),
    false,
  );
});

test('기존 그룹 내부 순서를 유지하면서 병행 인원을 마지막 행으로 이동한다', () => {
  const members = [
    { id: '1', name: '고준서', isConcurrent: false },
    { id: '2', name: '김서하', isConcurrent: true },
    { id: '3', name: '박지훈', isConcurrent: false },
    { id: '4', name: '문지훈', isConcurrent: true },
  ];

  assert.deepEqual(
    sortConcurrentMembersLast(members).map((member) => member.id),
    ['1', '3', '2', '4'],
  );
});
