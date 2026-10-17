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

/** 계정 발급·비밀번호 재설정 팝업의 임의 비밀번호. 비밀번호 정책(영문·숫자·특수문자 8자 이상)을 맞춘다. */
export const randomPassword = (): string => `Boaz!${Math.floor(1000 + Math.random() * 9000)}`;
