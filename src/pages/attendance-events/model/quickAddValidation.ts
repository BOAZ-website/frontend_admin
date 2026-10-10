/**
 * 참가자 추가 창의 입력 형식 검사. 형식이 틀린 칸이 있으면 추가하지 않고, 칸 아래에 고치는 방법을 빨갛게 보여 준다.
 * 비어 있는 칸은 이름을 빼고 검사하지 않는다(이름만 필수).
 */

export const NAME_REQUIRED_ERROR = '이름을 입력해 주세요.';

/** 열 이름으로 고른 형식 규칙. 해당하는 규칙이 없는 열은 아무 값이나 받는다. */
const FORMAT_RULES: readonly {
  matches: (label: string) => boolean;
  isValid: (value: string) => boolean;
  error: string;
}[] = [
  {
    matches: (label) => label.includes('기수'),
    isValid: (value) => /^\d+$/.test(value),
    error: '기수는 숫자만 입력해 주세요. 예: 28',
  },
  {
    matches: (label) => ['전화', '연락', '핸드폰', '휴대폰'].some((word) => label.includes(word)),
    isValid: (value) => /^01[016789]-?\d{3,4}-?\d{4}$/.test(value),
    error: '연락처는 010-1234-5678 형식으로 입력해 주세요.',
  },
  {
    matches: (label) => label.includes('메일') || label.toLowerCase().includes('email'),
    isValid: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    error: '이메일은 name@example.com 형식으로 입력해 주세요.',
  },
];

/** 추가 컬럼 한 칸의 형식 오류. 맞거나 비어 있으면 undefined다. */
export function quickAddFieldErrorOf(label: string, value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const rule = FORMAT_RULES.find((item) => item.matches(label));
  return rule && !rule.isValid(trimmed) ? rule.error : undefined;
}
