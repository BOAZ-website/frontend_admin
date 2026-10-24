/**
 * 보안 감사 로그 조회 API(SYS-LOG). 기록은 라우터가 쓰기 요청마다 남기고(../audit.ts), 이 파일은 읽기만 한다.
 * 조회에는 "보안 감사 로그 조회"(AUDIT_LOG_READ) 권한이 필요하다.
 */
import {
  DEFAULT_AUDIT_PAGE_SIZE,
  listAuditActors,
  listAuditLogs,
} from '@/entities/audit-log/api/auditLogRepository';
import {
  auditFilterOptions,
  isPermissionFilter,
} from '@/entities/audit-log/model/categoryPermissions';
import type { AuditLogQuery } from '@/entities/audit-log/model/dto';
import {
  AUDIT_CATEGORIES,
  isAuditAction,
  type AuditCategory,
} from '@/entities/audit-log/model/types';

import { ApiError, type MockRoute } from '../router';
import { requireAny } from './adminAccountRoutes';

const MAX_PAGE_SIZE = 200;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const badRequest = (message: string) => new ApiError(400, 'BAD_REQUEST', message);

const positiveInt = (value: string | null, key: string): number | undefined => {
  if (value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1)
    throw badRequest(`${key} 값은 1 이상의 정수여야 합니다.`);
  return number;
};

const dateOf = (value: string | null, key: string): string | undefined => {
  if (value === null || value === '') return undefined;
  if (!DATE_PATTERN.test(value)) throw badRequest(`${key} 값은 YYYY-MM-DD 형식이어야 합니다.`);
  return value;
};

/** 쿼리 문자열을 조회 조건으로 바꾼다. 모르는 분류·액션·권한, 틀린 날짜·쪽 번호는 400이다. */
function queryOf(query: URLSearchParams): AuditLogQuery {
  const category = query.get('category') || undefined;
  if (category && !AUDIT_CATEGORIES.some((item) => item.id === category)) {
    throw badRequest('category 값이 올바르지 않습니다.');
  }
  const actionText = query.get('action') || undefined;
  if (actionText && !isAuditAction(actionText)) throw badRequest('action 값이 올바르지 않습니다.');
  const action = actionText && isAuditAction(actionText) ? actionText : undefined;
  const permission = query.get('permission') || undefined;
  if (permission && !isPermissionFilter(permission)) {
    throw badRequest('permission 값이 올바르지 않습니다.');
  }
  const size = positiveInt(query.get('size'), 'size') ?? DEFAULT_AUDIT_PAGE_SIZE;
  if (size > MAX_PAGE_SIZE) throw badRequest(`size 값은 ${MAX_PAGE_SIZE} 이하여야 합니다.`);
  return {
    category: category as AuditCategory | undefined,
    action,
    permission,
    actorId: positiveInt(query.get('actorId'), 'actorId'),
    from: dateOf(query.get('from'), 'from'),
    to: dateOf(query.get('to'), 'to'),
    q: query.get('q') ?? undefined,
    page: positiveInt(query.get('page'), 'page'),
    size,
  };
}

export const auditLogRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/admin/audit-logs',
    summary:
      '감사 로그 목록(최신 기록부터, 한 쪽씩). 분류(category)·액션(action)·권한(permission, NONE이면 매트릭스에 없는 작업)·수행자(actorId)·기간(from·to)·검색어(q)로 거른다',
    handler: ({ db, query }) => {
      requireAny(db, 'AUDIT_LOG_READ');
      return listAuditLogs(db, queryOf(query));
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/audit-logs/actors',
    summary: '감사 로그의 수행자 필터 선택지(기록에 나온 계정, 지워진 계정 포함)',
    handler: ({ db }) => {
      requireAny(db, 'AUDIT_LOG_READ');
      return listAuditActors(db);
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/admin/audit-logs/filters',
    summary:
      '감사 로그의 분류·권한 필터 선택지. 분류마다 권한 매트릭스 권한(매트릭스에 없는 작업이 있으면 NONE 포함)을 준다',
    handler: ({ db }) => {
      requireAny(db, 'AUDIT_LOG_READ');
      return auditFilterOptions();
    },
  },
];
