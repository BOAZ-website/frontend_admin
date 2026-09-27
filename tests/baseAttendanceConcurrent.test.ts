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

test('BASE 병행 여부는 점수 집계와 같은 샘플 규칙으로 판정한다', () => {
  assert.equal(isConcurrentBaseMember('김서하', 2), true);
  assert.equal(isConcurrentBaseMember('고준서', 0), false);
});

test('BASE 예시 명단에는 명시적인 병행 인원이 포함된다', () => {
  assert.equal(isConcurrentBaseMember('정채원', 0), true);
  assert.equal(isConcurrentBaseMember('문지훈', 0), true);
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
