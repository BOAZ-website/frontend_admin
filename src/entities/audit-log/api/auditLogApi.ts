/**
 * 보안 감사 로그 API 호출. 화면은 경로를 직접 쓰지 않고 이 함수들을 부른다.
 */
import { api, withQuery } from '@/shared/api/client';

import type {
  AuditActorOption,
  AuditFilterOptions,
  AuditLogPage,
  AuditLogQuery,
} from '../model/dto';

const AUDIT_LOG_PATH = '/api/v1/admin/audit-logs';

/** 조건에 맞는 기록을 최신 기록부터 한 쪽씩 읽는다. */
export function fetchAuditLogs(query: AuditLogQuery): Promise<AuditLogPage> {
  return api.get(withQuery(AUDIT_LOG_PATH, { ...query }));
}

/** 수행자 필터 선택지(기록에 나온 계정). */
export function fetchAuditActors(): Promise<AuditActorOption[]> {
  return api.get(`${AUDIT_LOG_PATH}/actors`);
}

/** 분류·권한 필터 선택지. 분류와 권한 묶음의 대응은 서버가 정한다. */
export function fetchAuditFilters(): Promise<AuditFilterOptions> {
  return api.get(`${AUDIT_LOG_PATH}/filters`);
}
