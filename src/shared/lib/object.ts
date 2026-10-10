/** 지정한 키를 뺀 새 객체. 원본은 바꾸지 않는다. */
export function withoutKeys<T extends object, K extends keyof T>(
  source: T,
  ...keys: readonly K[]
): Omit<T, K> {
  const copy = { ...source };
  keys.forEach((key) => delete copy[key]);
  return copy;
}
