import { ADMIN_ROLES, type AdminRole } from '@/entities/admin-account/model/types';

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  MASTER: '서비스운영팀장',
  SUPER: '대표진·차기대표진',
  TEAM: '일반 운영진',
};

export const ROLE_OPTIONS = ADMIN_ROLES.map((role) => ({
  value: role,
  label: `${role} (${ROLE_DESCRIPTIONS[role]})`,
}));

const PASSWORD_CHARSETS = [
  'abcdefghijkmnopqrstuvwxyz',
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  '23456789',
  '!@#$%^&*',
] as const;
const RANDOM_PASSWORD_LENGTH = 16;

/** 0 이상 max 미만의 정수. 암호학적 난수(crypto.getRandomValues)를 쓴다. */
const randomIndex = (max: number): number => {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return value % max;
};

/**
 * 계정 발급·비밀번호 재설정 팝업의 임의 비밀번호(16자). 비밀번호 정책을 맞추도록 영문 소문자·대문자·숫자·
 * 특수문자(!@#$%^&*)를 한 글자 이상씩 넣고 자리를 섞는다. 헷갈리기 쉬운 l·I·O·0·1은 쓰지 않는다.
 */
export const randomPassword = (): string => {
  const allChars = PASSWORD_CHARSETS.join('');
  const chars = [
    ...PASSWORD_CHARSETS.map((charset) => charset[randomIndex(charset.length)]),
    ...Array.from(
      { length: RANDOM_PASSWORD_LENGTH - PASSWORD_CHARSETS.length },
      () => allChars[randomIndex(allChars.length)],
    ),
  ];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};
