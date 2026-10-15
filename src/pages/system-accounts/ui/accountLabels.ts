import {
  ADMIN_ROLES,
  type AdminRole,
  type AuditActionType,
} from '@/entities/admin-account/model/types';

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  MASTER: '서비스운영팀장',
  SUPER: '대표진·차기대표진',
  TEAM: '일반 운영진',
};

export const ACTION_LABELS: Record<AuditActionType, string> = {
  ACCOUNT_CREATE: '계정 발급',
  ACCOUNT_UPDATE: '정보 수정',
  ACCOUNT_DELETE: '계정 삭제',
  PASSWORD_RESET: '비밀번호 변경',
  PERMISSION_CHANGE: '권한 변경',
};

export const ROLE_OPTIONS = ADMIN_ROLES.map((role) => ({
  value: role,
  label: `${role} (${ROLE_DESCRIPTIONS[role]})`,
}));

/** '2026-07-01 09:00:00' → '2026-07-01 09:00' */
export const formatDateTime = (value: string): string => value.replace('T', ' ').slice(0, 16);

/** 계정 발급·비밀번호 재설정 팝업의 임의 비밀번호. 비밀번호 정책(영문·숫자·특수문자 8자 이상)을 맞춘다. */
export const randomPassword = (): string => `Boaz!${Math.floor(1000 + Math.random() * 9000)}`;
