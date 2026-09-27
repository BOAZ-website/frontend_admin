import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import { loadWeekDates, persistWeekDates } from '../src/entities/cohort/api/cohortRepository';
import { createDatabase } from '../src/shared/db/createDatabase';
import { formatDateInput, isValidIsoDate } from '../src/shared/lib/date';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

async function freshDb() {
  const SQL = await initSqlJs();
  return createDatabase(SQL, schema, seed);
}

test('시드: 27기·26기 방학 1~8주차 날짜가 DB에 있다', async () => {
  const dates = loadWeekDates(await freshDb());
  assert.equal(Object.keys(dates[27]).length, 8);
  assert.equal(dates[27][1], '2026-07-07');
  assert.equal(dates[27][8], '2026-08-25');
  assert.equal(dates[26][1], '2025-07-08');
  assert.equal(dates[25], undefined);
});

test('주차 날짜를 저장하면 바뀐 주차만 반영되고, 빠진 주차는 삭제된다', async () => {
  const db = await freshDb();
  const before = loadWeekDates(db);

  const next = {
    ...before,
    27: { ...before[27], 3: '2026-07-22' }, // 3주차 수정
    28: { 1: '2027-07-06', 2: '2027-07-13' }, // 새 기수
  };
  delete next[27][8]; // 8주차 삭제
  persistWeekDates(db, before, next);

  const after = loadWeekDates(db);
  assert.equal(after[27][3], '2026-07-22');
  assert.equal(after[27][2], before[27][2]);
  assert.equal(after[27][8], undefined);
  assert.deepEqual(after[28], { 1: '2027-07-06', 2: '2027-07-13' });
  assert.deepEqual(after[26], before[26]);
});

test('DB는 YYYY-MM-DD가 아닌 날짜와 범위 밖 주차를 거부한다', async () => {
  const db = await freshDb();
  assert.throws(() => persistWeekDates(db, {}, { 30: { 1: '2026/07/07' } }));
  assert.throws(() => persistWeekDates(db, {}, { 30: { 17: '2026-07-07' } }));
});

test('날짜 형식 검사: 형식이 맞고 실제로 있는 날짜만 유효하다', () => {
  assert.equal(isValidIsoDate('2026-07-07'), true);
  assert.equal(isValidIsoDate('2028-02-29'), true);
  assert.equal(isValidIsoDate('2026-02-29'), false);
  assert.equal(isValidIsoDate('2026-13-01'), false);
  assert.equal(isValidIsoDate('2026-7-7'), false);
  assert.equal(isValidIsoDate(''), false);
});

test('날짜 입력은 연도 4자리 뒤에 -, 월 2자리 뒤에 -가 자동으로 붙는다', () => {
  assert.equal(formatDateInput('2'), '2');
  assert.equal(formatDateInput('202', ''), '202');
  assert.equal(formatDateInput('2026', '202'), '2026-');
  assert.equal(formatDateInput('2026-0', '2026-'), '2026-0');
  assert.equal(formatDateInput('2026-08', '2026-0'), '2026-08-');
  assert.equal(formatDateInput('2026-08-0', '2026-08-'), '2026-08-0');
  assert.equal(formatDateInput('2026-08-04', '2026-08-0'), '2026-08-04');
});

test('숫자만 이어서 쳐도, 붙여넣어도 YYYY-MM-DD로 맞춰진다', () => {
  assert.equal(formatDateInput('20260804'), '2026-08-04');
  assert.equal(formatDateInput('2026/08/04'), '2026-08-04');
  assert.equal(formatDateInput('abc20260804999'), '2026-08-04');
  assert.equal(formatDateInput(''), '');
});

test('지우는 중에는 끝의 하이픈을 다시 붙이지 않는다', () => {
  assert.equal(formatDateInput('2026', '2026-'), '2026');
  assert.equal(formatDateInput('2026-08', '2026-08-'), '2026-08');
  assert.equal(formatDateInput('2026-0', '2026-08'), '2026-0');
  assert.equal(formatDateInput('202', '2026'), '202');
});
