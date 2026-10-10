import assert from 'node:assert/strict';
import test from 'node:test';

import {
  conferenceSheetOf,
  importedStatusesOf,
  moveFreeformStatusColumn,
  statusCodeOf,
  statusOfKey,
} from '../src/pages/attendance-events/model/eventFormat';

test('컨퍼런스 명단 시트는 외부 여부와 행사 대상 기수로 정해진다', () => {
  const activeTerms = [27, 28];

  assert.equal(conferenceSheetOf({ isExternal: true }, activeTerms), 'EXTERNAL');
  assert.equal(conferenceSheetOf({ isExternal: false, term: 28 }, activeTerms), 'CURRENT');
  assert.equal(conferenceSheetOf({ isExternal: false, term: 26 }, activeTerms), 'OTHER_MEMBERS');
  // 기수를 모르는 내부 회원은 현재 활동기수로 단정하지 않는다.
  assert.equal(conferenceSheetOf({ isExternal: false }, activeTerms), 'OTHER_MEMBERS');
});

test('출결 코드는 행사 출결 방식마다 문서의 코드를 따른다', () => {
  assert.equal(statusCodeOf('CONFERENCE', 'present'), '1');
  assert.equal(statusCodeOf('CONFERENCE', 'absent'), '0');
  assert.equal(statusCodeOf('GENERAL', 'unexcusedAbsent'), 'X');
  assert.equal(statusCodeOf('GENERAL', 'unexcusedLate'), '0');
  assert.equal(statusOfKey('GENERAL', 'x'), 'unexcusedAbsent');
  assert.equal(statusOfKey('NEWCOMER', 'o'), 'present');
  // 방식에 없는 코드는 고를 수 없다.
  assert.equal(statusOfKey('CONFERENCE', '5'), undefined);
  // 신입 특칙형의 지각·조퇴·인정결석은 문서에 코드가 없어 키로 고르지 않고, 내보낼 때는 이름으로 적는다.
  assert.equal(statusOfKey('NEWCOMER', 'e'), undefined);
  assert.equal(statusCodeOf('NEWCOMER', 'earlyLeave'), '조퇴');
});

test('명단 파일의 출결 열은 방식별 문서 코드로 읽는다', () => {
  assert.deepEqual(importedStatusesOf('NEWCOMER', { 출석: 'O' }), { status: 'present' });
  assert.deepEqual(importedStatusesOf('NEWCOMER', { 출석: 'X' }), { status: 'absent' });
  assert.deepEqual(
    importedStatusesOf('CONFERENCE', { '1차 출석 확인': '3', '2차 출석 확인': '2' }),
    {
      status: 'late',
      secondStatus: 'earlyLeave',
    },
  );
  // 외부 참석자 시트: 출석 1 또는 공란
  assert.deepEqual(importedStatusesOf('CONFERENCE', { 출석: '1' }), {
    status: 'present',
    secondStatus: undefined,
  });
  assert.deepEqual(importedStatusesOf('CONFERENCE', { 출석: '' }), {
    status: undefined,
    secondStatus: undefined,
  });
  // 일반 행사형·기타는 이 규칙을 쓰지 않는다(일반 행사형은 행사 열, 기타는 열 그대로).
  assert.deepEqual(importedStatusesOf('OTHER', { 출석: 'O' }), {});
});

test('기타 방식에서 출결 코드를 정하면 명단의 출결 열을 출결 버튼으로 옮긴다', () => {
  const fields = [{ label: '기수' }, { label: '출결' }, { label: '전화번호' }];
  const attendees = [
    { customAnswers: { 출결: '참석' } },
    { customAnswers: { 출결: '모름' } },
    { customAnswers: {} },
  ];
  const options = [
    { code: '참석', label: '참석' },
    { code: '불참', label: '불참' },
  ];
  const moved = moveFreeformStatusColumn(fields, attendees, options);
  assert.deepEqual(
    moved.fields.map((f) => f.label),
    ['기수', '전화번호'],
  );
  assert.equal(moved.removedIndex, 1);
  // 코드와 같은 값만 고르고, 다른 값·빈칸은 고르지 않는다.
  assert.deepEqual(
    moved.attendees.map((a) => (a as { customStatus?: string }).customStatus),
    ['참석', undefined, undefined],
  );
  // 출결 코드가 없으면 열을 그대로 둔다.
  assert.equal(moveFreeformStatusColumn(fields, attendees, []).fields.length, 3);
});
