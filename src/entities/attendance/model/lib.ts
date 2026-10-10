export function sessionKey(w: string, a: string, t: string) {
  return `${w}|${a}|${t}`;
}

export const ALL_8_WEEKS = Array.from({ length: 8 }, (_, i) => ({
  id: `w${i + 1}`,
  weekNum: i + 1,
  label: `${i + 1}주차`,
}));
