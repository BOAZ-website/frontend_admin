import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ERROR_RELOAD_LIMIT,
  ERROR_RELOAD_WINDOW_MS,
  isScreenRestoreKey,
  nextReloadTimes,
} from '../src/app/errorReload';

test('시간 창 안의 오류만 세어, 상한을 넘으면 새로고침을 멈춘다', () => {
  let times: number[] = [];
  const reloadAllowed = (now: number) => {
    times = nextReloadTimes(times, now);
    return times.length <= ERROR_RELOAD_LIMIT;
  };

  assert.equal(reloadAllowed(0), true);
  // 새로고침 10초 뒤에 같은 오류가 나도(5초 타이머였다면 지워졌을 때) 센다.
  assert.equal(reloadAllowed(10_000), true);
  assert.equal(reloadAllowed(20_000), false);
  // 시간 창이 지나면 다시 새로고침한다.
  assert.equal(reloadAllowed(20_000 + ERROR_RELOAD_WINDOW_MS), true);
});

test('화면 복원용 boaz_ 저장값만 지우고, 로그인 표시·아이디·문구 템플릿은 남긴다', () => {
  for (const key of [
    'boaz_active_page',
    'boaz_event_selected_id',
    'boaz_BASE_cohort',
    'boaz_ADV_selected_team',
    'boaz_sidebar_width',
  ]) {
    assert.equal(isScreenRestoreKey(key), true, key);
  }
  for (const key of [
    'boaz_is_logged_in',
    'boaz_username',
    'boaz_custom_notify_template',
    'other_app_key',
  ]) {
    assert.equal(isScreenRestoreKey(key), false, key);
  }
});
