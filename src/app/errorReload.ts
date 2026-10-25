/**
 * 처리하지 못한 화면 오류 뒤의 자동 새로고침 규칙(main.tsx의 GlobalErrorBoundary가 쓴다).
 *
 * 오류가 날 때마다 시각을 세션 저장소에 남기고, ERROR_RELOAD_WINDOW_MS 안에 ERROR_RELOAD_LIMIT번까지만 새로고침한다.
 * 그보다 많이 나면 새로고침을 멈추고 안내 화면을 그리게 한다. 늦게(새로고침 몇 초 뒤) 나는 오류도 같은 상한에 걸린다.
 * 새로고침할 때는 화면을 되살리는 저장값(boaz_*)을 지운다. 저장값 때문에 난 오류가 새로고침 뒤 다시 나지 않게 하기 위해서다.
 */

/** 최근 오류 새로고침 시각 목록(JSON 배열, 밀리초)을 담는 세션 저장소 키. */
export const ERROR_RELOAD_KEY = 'boaz_error_reloads';
export const ERROR_RELOAD_WINDOW_MS = 60_000;
export const ERROR_RELOAD_LIMIT = 2;

/**
 * 새로고침해도 지우지 않는 저장값. 로그인 표시·아이디(지우면 다시 로그인해야 한다)와
 * 사용자가 직접 고친 문구 템플릿(지우면 작성한 내용이 사라진다)이다.
 */
const KEPT_STORAGE_KEYS: ReadonlySet<string> = new Set([
  'boaz_is_logged_in',
  'boaz_username',
  'boaz_custom_notify_template',
]);

/** 지울 저장값: boaz_로 시작하고 KEPT_STORAGE_KEYS에 없는 키. */
export const isScreenRestoreKey = (key: string): boolean =>
  key.startsWith('boaz_') && !KEPT_STORAGE_KEYS.has(key);

/** 시각 목록에 지금을 더하고, 시간 창 밖의 시각은 뺀다. */
export const nextReloadTimes = (times: readonly number[], now: number): number[] => [
  ...times.filter((time) => now - time < ERROR_RELOAD_WINDOW_MS),
  now,
];

const readTimes = (storage: Storage): number[] => {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(ERROR_RELOAD_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((time) => typeof time === 'number') : [];
  } catch {
    return [];
  }
};

/**
 * 오류 한 번을 기록하고 새로고침해도 되는지 돌려준다. 되면 화면 복원용 저장값을 지운다.
 * 저장소를 쓸 수 없으면 횟수를 셀 수 없으므로 새로고침하지 않는다(무한 새로고침을 막는다).
 */
export function recordErrorReload(now = Date.now()): boolean {
  try {
    const times = nextReloadTimes(readTimes(sessionStorage), now);
    sessionStorage.setItem(ERROR_RELOAD_KEY, JSON.stringify(times));
    if (times.length > ERROR_RELOAD_LIMIT) return false;
    Object.keys(localStorage)
      .filter(isScreenRestoreKey)
      .forEach((key) => localStorage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}
