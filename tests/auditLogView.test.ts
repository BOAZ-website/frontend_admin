import assert from 'node:assert/strict';
import test from 'node:test';

import type { AuditFilterOptions } from '../src/entities/audit-log/model/dto';
import {
  hashOfSheet,
  pageNumbersOf,
  permissionOptionsOf,
  sheetOfHash,
} from '../src/pages/system-audit/model/auditLogView';
import { calendarGridOf, dateOfIso } from '../src/pages/system-audit/model/calendar';
import { isoDateOf } from '../src/shared/lib/date';

test('쪽 번호는 지금 쪽을 가운데 두고 최대 5개, 처음·끝에서는 끝까지 붙는다', () => {
  assert.deepEqual(pageNumbersOf(1, 3), [1, 2, 3]);
  assert.deepEqual(pageNumbersOf(5, 10), [3, 4, 5, 6, 7]);
  assert.deepEqual(pageNumbersOf(10, 10), [6, 7, 8, 9, 10]);
});

test('주소의 분류는 아는 분류만 읽고, 모르면 전체다', () => {
  assert.equal(sheetOfHash('#system-audit/SYSTEM'), 'SYSTEM');
  assert.equal(sheetOfHash('#system-audit/toString'), 'ALL');
  assert.equal(sheetOfHash('#other/SYSTEM'), 'ALL');
  assert.equal(hashOfSheet('ALL'), '#system-audit/all');
  assert.equal(hashOfSheet(null), '#system-audit');
});

test('전체 분류의 권한 선택지는 분류마다의 권한을 합치되 겹치는 것은 하나만 남긴다', () => {
  const permission = (key: string) => ({ key, label: key });
  const filters: AuditFilterOptions = {
    categories: [
      { key: 'SYSTEM', label: '시스템', permissions: [permission('A'), permission('B')] },
      { key: 'ATTENDANCE', label: '출결', permissions: [permission('B'), permission('C')] },
    ],
  };

  assert.deepEqual(
    permissionOptionsOf(filters, 'ALL').map((option) => option.value),
    ['ALL', 'A', 'B', 'C'],
  );
  assert.deepEqual(permissionOptionsOf(null, 'SYSTEM'), [{ value: 'ALL', label: '전체' }]);
});

test('달력은 그달 1일이 있는 주의 일요일부터 42칸이다', () => {
  const grid = calendarGridOf(2026, 10);

  assert.equal(grid.length, 42);
  assert.equal(isoDateOf(grid[0]), '2026-11-01');
  assert.equal(isoDateOf(dateOfIso('2026-02-28')), '2026-02-28');
});
