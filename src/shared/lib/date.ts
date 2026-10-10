const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** YYYY-MM-DD 형식이면서 실제로 있는 날짜인지(2026-02-30 같은 날짜는 false). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

const MAX_DATE_DIGITS = 8;
const YEAR_DIGITS = 4;
const YEAR_MONTH_DIGITS = 6;

/**
 * 입력한 글자를 YYYY-MM-DD로 맞춘다. 숫자만 남기고(최대 8자리) 하이픈을 자동으로 넣는다.
 * 연도 4자리를 다 쓰면 바로 "2026-"이 되고, 월 2자리를 쓰면 "2026-08-"이 된다.
 * 지우는 중(글자가 줄어드는 중)에는 끝의 하이픈을 다시 붙이지 않아 계속 지울 수 있다.
 */
export function formatDateInput(raw: string, previous = ''): string {
  const digits = raw.replace(/\D/g, '').slice(0, MAX_DATE_DIGITS);
  const isDeleting = raw.length < previous.length;
  const withYear = digits.slice(0, YEAR_DIGITS);
  const month = digits.slice(YEAR_DIGITS, YEAR_MONTH_DIGITS);
  const day = digits.slice(YEAR_MONTH_DIGITS);

  if (digits.length < YEAR_DIGITS) return withYear;
  if (digits.length === YEAR_DIGITS) return isDeleting ? withYear : `${withYear}-`;
  if (digits.length < YEAR_MONTH_DIGITS) return `${withYear}-${month}`;
  if (digits.length === YEAR_MONTH_DIGITS) {
    return isDeleting ? `${withYear}-${month}` : `${withYear}-${month}-`;
  }
  return `${withYear}-${month}-${day}`;
}
