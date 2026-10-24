/**
 * 임시 DB의 audit_log 테이블 읽기·쓰기. 임시 API(auditLogRoutes, 라우터의 쓰기 기록)가 쓴다.
 * 대상 이름은 저장하지 않고 읽을 때 지금 DB에서 찾는다. 사람이 아닌 대상(팀·행사 등)은 지워져도
 * 알아볼 수 있게 기록할 때 이름을 detail.label에 남겨 두고, 지금 DB에 없으면 그 값을 쓴다.
 */
import type { Database } from 'sql.js';

import { findAdminRow, toAdminAccount } from '@/entities/admin-account/api/adminAccountRepository';
import { execute, queryAll } from '@/shared/db/createDatabase';

import { NO_MATRIX_PERMISSION } from '../model/categoryPermissions';
import { usedPermissionOf } from '../model/permissionOf';
import type { AuditActorOption, AuditLogPage, AuditLogQuery } from '../model/dto';
import {
  AUDIT_ACTIONS,
  actionsOf,
  isAuditAction,
  type AuditAction,
  type AuditActorRole,
  type AuditLogEntry,
  type AuditTargetType,
} from '../model/types';

export const DEFAULT_AUDIT_PAGE_SIZE = 50;

interface AuditRow {
  id: number;
  occurred_at: string;
  actor_admin_id: number | null;
  actor_user_id: string | null;
  actor_role: AuditActorRole | null;
  action: string;
  target_type: AuditTargetType;
  target_ids: string;
  api_method: string | null;
  api_path: string | null;
  detail: string | null;
  ip: string | null;
}

export interface AuditLogInsert {
  occurredAt: string;
  actorId: number | null;
  /** 기록할 때의 수행자 회원 id와 등급. 계정이 지워져도 누가 어떤 등급으로 했는지 남긴다. */
  actorUserId: string | null;
  actorRole: AuditActorRole | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetIds: readonly string[];
  /** 호출한 API의 메서드와 실제 경로. */
  apiMethod: string | null;
  apiPath: string | null;
  detail: Readonly<Record<string, unknown>> | null;
  ip: string | null;
}

export function insertAuditLog(db: Database, log: AuditLogInsert): void {
  execute(
    db,
    `INSERT INTO audit_log
       (occurred_at, actor_admin_id, actor_user_id, actor_role, action, target_type, target_ids,
        api_method, api_path, detail, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.occurredAt,
      log.actorId,
      log.actorUserId,
      log.actorRole,
      log.action,
      log.targetType,
      JSON.stringify(log.targetIds),
      log.apiMethod,
      log.apiPath,
      log.detail ? JSON.stringify(log.detail) : null,
      log.ip,
    ],
  );
}

const parseJson = <T>(text: string | null, fallback: T): T => {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

const firstValue = <T>(db: Database, sql: string, id: string): T | undefined =>
  queryAll<{ value: T }>(db, sql, [id])[0]?.value;

/** 대상 하나의 화면 이름. 지금 DB에서 찾고, 없으면 기록할 때 남긴 이름이나 "삭제된 ..."을 쓴다. */
function targetLabel(
  db: Database,
  type: AuditTargetType,
  id: string,
  savedLabel: string | undefined,
): string {
  switch (type) {
    case 'USER':
      return (
        firstValue<string>(
          db,
          "SELECT name || ' (' || term || '기)' AS value FROM users WHERE id = ?",
          id,
        ) ?? '삭제된 동아리원'
      );
    case 'ADMIN':
      return (
        firstValue<string>(
          db,
          'SELECT u.name AS value FROM admin a JOIN users u ON u.id = a.user_id WHERE a.id = ?',
          id,
        ) ?? '삭제된 계정'
      );
    case 'HOST':
      return (
        firstValue<string>(db, 'SELECT username AS value FROM host_accounts WHERE id = ?', id) ??
        savedLabel ??
        '삭제된 HOST 계정'
      );
    case 'TEAM':
      return (
        firstValue<string>(db, 'SELECT team_name AS value FROM teams WHERE id = ?', id) ??
        savedLabel ??
        '삭제된 팀'
      );
    case 'SCORE_RULE':
      return (
        firstValue<string>(db, 'SELECT name AS value FROM score_rules WHERE id = ?', id) ??
        savedLabel ??
        '삭제된 규칙'
      );
    default:
      return savedLabel ?? id;
  }
}

type ActorFields = Pick<
  AuditLogEntry,
  | 'actorUserId'
  | 'actorName'
  | 'actorTerm'
  | 'actorTrack'
  | 'actorTeam'
  | 'actorRole'
  | 'actorHasPermission'
  | 'actorHasAccount'
>;

/**
 * 수행자의 이름·기수·부문·등급과 지금 권한 여부. 회원 id와 등급은 기록에 남긴 값을 먼저 쓰고,
 * 없으면(예전 기록) 지금 운영진 계정에서 찾는다. 이름·기수·부문은 지금 회원 정보에서 읽는다.
 */
function actorOf(db: Database, row: AuditRow): ActorFields {
  const adminAtLog = row.actor_admin_id === null ? undefined : findAdminRow(db, row.actor_admin_id);
  const userId = row.actor_user_id ?? adminAtLog?.user_id ?? null;
  const user =
    userId === null
      ? undefined
      : queryAll<{ name: string; term: number; track: string }>(
          db,
          'SELECT name, term, track FROM users WHERE id = ?',
          [userId],
        )[0];
  const adminId =
    userId === null
      ? undefined
      : queryAll<{ id: number }>(db, 'SELECT id FROM admin WHERE user_id = ?', [userId])[0]?.id;
  const adminNow = adminId === undefined ? undefined : findAdminRow(db, adminId);
  const hostCount = (activeOnly: boolean) =>
    userId === null
      ? 0
      : queryAll<{ n: number }>(
          db,
          `SELECT COUNT(*) AS n FROM host_accounts WHERE user_id = ?${activeOnly ? ' AND active = 1' : ''}`,
          [userId],
        )[0].n;
  const hasAdminPermission = adminNow
    ? toAdminAccount(db, adminNow).effectivePermissions.length > 0
    : false;
  return {
    actorUserId: user ? userId : null,
    actorName: user?.name ?? null,
    actorTerm: user?.term ?? null,
    actorTrack: user?.track ?? null,
    actorTeam: adminNow?.team_name ?? null,
    actorRole: row.actor_role ?? adminAtLog?.role ?? null,
    actorHasPermission: hasAdminPermission || hostCount(true) > 0,
    actorHasAccount: adminNow !== undefined || hostCount(false) > 0,
  };
}

/**
 * 기록 때 남긴 요청 본문(detail.request) 그대로. 개인정보 값은 기록할 때 이미 가려져 있다.
 * 객체가 아니거나 비어 있으면(GET·DELETE, 보낸 값 없는 예시 기록) null이다.
 */
function requestBodyOf(
  detail: Readonly<Record<string, unknown>> | null,
): Readonly<Record<string, unknown>> | null {
  const request = detail?.request;
  if (!request || typeof request !== 'object' || Array.isArray(request)) return null;
  return Object.keys(request).length > 0 ? (request as Record<string, unknown>) : null;
}

/** 응답 한 줄과, 검색어로 거를 때만 쓰는 대상 이름(응답에는 싣지 않는다). */
interface ListedEntry {
  entry: AuditLogEntry;
  targetLabels: string[];
}

function targetLabelsOf(db: Database, row: AuditRow, detail: Record<string, unknown> | null) {
  const savedLabel = typeof detail?.label === 'string' ? detail.label : undefined;
  return parseJson<string[]>(row.target_ids, []).map((id) =>
    targetLabel(db, row.target_type, id, savedLabel),
  );
}

function toListedEntry(db: Database, row: AuditRow): ListedEntry | null {
  if (!isAuditAction(row.action)) return null;
  const detail = parseJson<Record<string, unknown> | null>(row.detail, null);
  return {
    entry: toEntry(db, row, row.action, detail),
    targetLabels: targetLabelsOf(db, row, detail),
  };
}

function toEntry(
  db: Database,
  row: AuditRow,
  action: AuditAction,
  detail: Record<string, unknown> | null,
): AuditLogEntry {
  const actor = actorOf(db, row);
  const targetIds = parseJson<string[]>(row.target_ids, []);
  return {
    id: row.id,
    occurredAt: row.occurred_at,
    actorId: row.actor_admin_id,
    ...actor,
    ...usedPermissionOf({
      action,
      detail,
      actorId: row.actor_admin_id,
      actorRole: actor.actorRole,
      targetIds,
    }),
    action,
    category: AUDIT_ACTIONS[action].category,
    targetType: row.target_type,
    api: row.api_method && row.api_path ? { method: row.api_method, path: row.api_path } : null,
    requestBody: requestBodyOf(detail),
    detail,
    ip: row.ip,
  };
}

/** 권한 필터와 맞춰 볼 값. 매트릭스에 항목이 없는 작업은 NONE이다. */
const permissionKeyOf = (entry: AuditLogEntry): string =>
  entry.permission?.key ?? NO_MATRIX_PERMISSION;

/** 검색어가 수행자 이름·대상 이름·액션 이름·쓴 권한 이름 중 하나에 들어 있는지. */
const matchesText = ({ entry, targetLabels }: ListedEntry, text: string): boolean =>
  [
    entry.actorName ?? '',
    AUDIT_ACTIONS[entry.action].label,
    entry.permission?.label ?? '',
    ...targetLabels,
  ].some((value) => value.includes(text));

/**
 * 조건에 맞는 기록을 최신 기록부터 한 쪽씩 돌려준다. 분류·액션·수행자·기간은 SQL로 거르고,
 * 검색어와 권한은 대상 이름·쓴 권한을 찾은 뒤에 거른다(둘 다 저장하지 않고 읽을 때 정하기 때문이다).
 */
export function listAuditLogs(db: Database, query: AuditLogQuery): AuditLogPage {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (query.action) {
    where.push('action = ?');
    params.push(query.action);
  } else if (query.category) {
    const actions = actionsOf(query.category);
    where.push(`action IN (${actions.map(() => '?').join(', ')})`);
    params.push(...actions);
  }
  if (query.actorId !== undefined) {
    where.push('actor_admin_id = ?');
    params.push(query.actorId);
  }
  if (query.from) {
    where.push('substr(occurred_at, 1, 10) >= ?');
    params.push(query.from);
  }
  if (query.to) {
    where.push('substr(occurred_at, 1, 10) <= ?');
    params.push(query.to);
  }
  const rows = queryAll<AuditRow & Record<string, unknown>>(
    db,
    `SELECT * FROM audit_log ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY occurred_at DESC, id DESC`,
    params,
  );

  const text = query.q?.trim() ?? '';
  const entries = rows
    .map((row) => toListedEntry(db, row))
    .filter((listed): listed is ListedEntry => listed !== null)
    .filter((listed) => !text || matchesText(listed, text))
    .map((listed) => listed.entry)
    .filter((entry) => !query.permission || permissionKeyOf(entry) === query.permission);

  const size = query.size ?? DEFAULT_AUDIT_PAGE_SIZE;
  const lastPage = Math.max(1, Math.ceil(entries.length / size));
  const page = Math.min(Math.max(1, query.page ?? 1), lastPage);
  return {
    items: entries.slice((page - 1) * size, page * size),
    total: entries.length,
    page,
    size,
  };
}

/** 기록에 한 번이라도 나온 수행자. 운영진 계정 관리와 같은 순서(팀 → 이름)로, 지워진 계정은 맨 뒤에 둔다. */
export function listAuditActors(db: Database): AuditActorOption[] {
  return queryAll<{ id: number; name: string | null; teamName: string | null }>(
    db,
    `SELECT DISTINCT l.actor_admin_id AS id, u.name AS name, a.team_name AS teamName
       FROM audit_log l
       LEFT JOIN admin a ON a.id = l.actor_admin_id
       LEFT JOIN users u ON u.id = a.user_id
      WHERE l.actor_admin_id IS NOT NULL
      ORDER BY u.name IS NULL, a.team_name, u.name, l.actor_admin_id`,
  );
}
