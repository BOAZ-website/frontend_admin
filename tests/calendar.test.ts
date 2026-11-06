import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calendarDaysOf,
  isoOfLocalDate,
  isWithinRange,
  localDateOfIso,
} from '../src/shared/lib/calendar';

test('달력은 그달 1일이 있는 주의 일요일부터 42칸이다', () => {
  const days = calendarDaysOf(2026, 10);

  assert.equal(days.length, 42);
  assert.equal(days[0], '2026-11-01');
  assert.equal(days[41], '2026-12-12');
  // 1일이 토요일인 달은 앞달 날짜로 시작한다.
  assert.equal(calendarDaysOf(2026, 7)[0], '2026-07-26');
});

test('날짜 문자열과 로컬 날짜는 서로 바꿔도 같은 값이다(윤년 포함)', () => {
  for (const iso of ['2028-02-29', '2026-12-31', '2027-01-01']) {
    assert.equal(isoOfLocalDate(localDateOfIso(iso)), iso);
  }
});

test('범위 검사는 비어 있는 쪽 제한을 두지 않고 경계 날짜를 포함한다', () => {
  assert.ok(isWithinRange('2027-01-01', '2027-01-01', '2027-06-30'));
  assert.ok(isWithinRange('2027-06-30', '2027-01-01', '2027-06-30'));
  assert.ok(!isWithinRange('2026-12-31', '2027-01-01'));
  assert.ok(isWithinRange('2030-01-01', undefined, undefined));
});
