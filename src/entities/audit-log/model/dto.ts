import type { AuditAction, AuditCategory, AuditLogEntry, AuditUsedPermission } from './types';

/** 감사 로그 조회 조건. 빈 값은 보내지 않는다. 정렬은 서버가 한다(최신 기록부터). */
export interface AuditLogQuery {
  category?: AuditCategory;
  action?: AuditAction;
  /** 권한 매트릭스의 권한 이름. 'NONE'이면 매트릭스에 항목이 없는 작업. */
  permission?: string;
  actorId?: number;
  /** 'YYYY-MM-DD'. 그날 0시부터. */
  from?: string;
  /** 'YYYY-MM-DD'. 그날 끝까지. */
  to?: string;
  /** 수행자 이름·대상 이름·액션 이름 검색어. */
  q?: string;
  /** 1부터 시작한다. */
  page?: number;
  size?: number;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  /** 조건에 맞는 전체 기록 수. */
  total: number;
  page: number;
  size: number;
}

/** 수행자 필터 선택지. 기록에 한 번이라도 나온 계정이다. */
export interface AuditActorOption {
  id: number;
  /** 계정이 지워졌으면 null. */
  name: string | null;
  teamName: string | null;
}

/** 감사 로그 필터의 분류 하나와 그 분류의 권한 선택지. */
export interface AuditFilterCategory {
  key: AuditCategory;
  label: string;
  /**
   * 권한 선택지(권한 매트릭스 순서). 매트릭스에 없는 작업이 있는 분류는 맨 끝에 key 'NONE'("매트릭스에 없음")이 있다.
   * 분류를 고르지 않았을 때(전체)는 모든 분류의 선택지를 key가 겹치지 않게 합쳐 쓴다.
   */
  permissions: AuditUsedPermission[];
}

/** 감사 로그 필터 선택지(GET /api/v1/admin/audit-logs/filters). 분류와 권한 묶음의 대응은 서버가 정한다. */
export interface AuditFilterOptions {
  categories: AuditFilterCategory[];
}
