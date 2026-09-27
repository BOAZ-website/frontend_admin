import type { AttendanceStatus } from './types';

export function sessionKey(w: string, a: string, t: string) {
  return `${w}|${a}|${t}`;
}

export function calcScore(s: AttendanceStatus) {
  if (s === 'present' || s === 'excusedAbsent' || s === 'remote') return 1;
  if (s === 'late' || s === 'earlyLeave') return 0.5;
  return 0;
}

export const ALL_8_WEEKS = Array.from({ length: 8 }, (_, i) => ({
  id: `w${i + 1}`,
  weekNum: i + 1,
  label: `${i + 1}주차`,
}));

export const ALL_SEMESTER_WEEKS = Array.from({ length: 8 }, (_, i) => ({
  id: `w${i + 9}`,
  weekNum: i + 9,
  label: `${i + 9}주차`,
}));
