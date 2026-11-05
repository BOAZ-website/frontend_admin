/** 달력 한 장의 칸 수(6주). */
const DAYS_IN_GRID = 42;

/** 'YYYY-MM-DD'를 그날 0시(로컬 시간)로 읽는다. */
export function dateOfIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** 달력에 보일 6주(42칸). 그달 1일이 있는 주의 일요일부터 시작한다. month는 0부터 센다. */
export function calendarGridOf(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  return Array.from(
    { length: DAYS_IN_GRID },
    (_, index) => new Date(year, month, 1 - first.getDay() + index),
  );
}
