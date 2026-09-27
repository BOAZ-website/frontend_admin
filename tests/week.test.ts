import assert from 'node:assert/strict';
import test from 'node:test';

import { currentPeriodOf, defaultWeekNum, isHeldWeek, weekStatusOf, type WeekInfo } from '../src/entities/attendance/model/week';

const week = (weekNum: number, status: WeekInfo['status']): WeekInfo => ({
  id: `w${weekNum}`,
  weekNum,
  period: weekNum <= 8 ? '방학' : '학기',
  label: `${weekNum}주차`,
  status,
});

const weeks: WeekInfo[] = [week(1, 'CLOSED'), week(2, 'CLOSED'), week(3, 'OPEN'), week(4, 'UPCOMING')];

test('주차 상태는 데이터에서 읽고, 목록에 없는 주차는 진행 예정으로 본다', () => {
  assert.equal(weekStatusOf(weeks, 3), 'OPEN');
  assert.equal(weekStatusOf(weeks, 4), 'UPCOMING');
  assert.equal(weekStatusOf(weeks, 99), 'UPCOMING');
});

test('종료·진행 중 주차만 진행된 주차로 본다', () => {
  assert.equal(isHeldWeek(weeks, 1), true);
  assert.equal(isHeldWeek(weeks, 3), true);
  assert.equal(isHeldWeek(weeks, 4), false);
});

test('기본 주차는 가장 뒤의 진행 중 주차, 없으면 마지막 종료 주차, 없으면 첫 주차', () => {
  assert.equal(defaultWeekNum(weeks), 3);
  assert.equal(defaultWeekNum([week(1, 'CLOSED'), week(2, 'CLOSED'), week(3, 'UPCOMING')]), 2);
  assert.equal(defaultWeekNum([week(5, 'UPCOMING'), week(6, 'UPCOMING')]), 5);
  assert.equal(defaultWeekNum([]), 1);
});

test('진행 중 주차가 여러 개면 가장 뒤의 주차를 기본으로 한다', () => {
  assert.equal(defaultWeekNum([week(3, 'OPEN'), week(4, 'OPEN'), week(5, 'UPCOMING')]), 4);
});

test('현재 기간은 기본 주차가 속한 기간이고, 주차 목록이 비면 알 수 없다', () => {
  assert.equal(currentPeriodOf(weeks), '방학');
  assert.equal(currentPeriodOf([week(8, 'CLOSED'), week(9, 'OPEN')]), '학기');
  assert.equal(currentPeriodOf([week(3, 'OPEN'), week(9, 'UPCOMING')]), '방학');
  assert.equal(currentPeriodOf([]), null);
});
