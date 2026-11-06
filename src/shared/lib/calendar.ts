/** 달력 한 장의 칸 수(6주). */
const DAYS_IN_GRID = 42;

const pad = (value: number) => String(value).padStart(2, '0');

/** 날짜(로컬 시간)를 'YYYY-MM-DD'로 쓴다. */
export function isoOfLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'YYYY-MM-DD'를 그날 0시(로컬 시간)로 읽는다. */
export function localDateOfIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** 달력에 보일 6주(42칸)의 날짜('YYYY-MM-DD'). 그달 1일이 있는 주의 일요일부터 시작한다. month는 0부터 센다. */
export function calendarDaysOf(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  return Array.from({ length: DAYS_IN_GRID }, (_, index) =>
    isoOfLocalDate(new Date(year, month, 1 - first.getDay() + index)),
  );
}

/** 고를 수 있는 날짜인지. min·max는 'YYYY-MM-DD'이고 비어 있으면 그쪽 제한이 없다. */
export function isWithinRange(iso: string, min?: string, max?: string): boolean {
  return (!min || iso >= min) && (!max || iso <= max);
}
