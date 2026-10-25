/**
 * 임시 API의 감사 기록. 라우터가 쓰기 요청(POST·PUT·PATCH·DELETE)을 처리할 때 이 모듈을 거쳐,
 * 요청이 성공하면 같은 트랜잭션 안에서 audit_log에 한 줄을 남긴다(실패하면 기록도 함께 되돌린다).
 * 어떤 요청이 어떤 액션인지는 아래 AUDIT_RULES에 모아 두어, 각 API 파일(출결 등)은 고치지 않는다.
 * 실제 백엔드에서는 서버가 같은 방식으로 기록한다(docs/spec/04-evaluation.md §4.5).
 */
import type { Database } from 'sql.js';

import { findAdminRow, toAdminAccount } from '@/entities/admin-account/api/adminAccountRepository';
import { insertAuditLog, type AuditLogInsert } from '@/entities/audit-log/api/auditLogRepository';
import type { AuditAction, AuditTargetType } from '@/entities/audit-log/model/types';
import { loadEventState } from '@/entities/event/api/eventRepository';
import { TEAM_API_PATHS } from '@/entities/study-team/model/dto';
import { queryAll } from '@/shared/db/createDatabase';

import type { HttpMethod, MockRequest, MockRoute } from './router';
import { currentSession } from './session';

/** 임시 API는 요청한 곳의 IP를 알 수 없어 이 컴퓨터 주소로 남긴다. */
const MOCK_IP = '127.0.0.1';

type Detail = Record<string, unknown>;

/**
 * 개인정보라 값을 기록에 남기지 않는 항목(키 이름을 소문자로 바꾸고 `_`·`-`를 뺀 모양).
 * 보낸 값과 바뀌기 전·후 값 모두 HIDDEN_VALUE로 바꾼다. 이름은 대상 이름으로 따로 보이므로(지금 DB에서 찾는다) 값은 남기지 않는다.
 * 실제 백엔드 계약이 snake_case(new_password)여도 같은 키로 본다.
 */
const SENSITIVE_KEYS: ReadonlySet<string> = new Set(['name', 'phone', 'email', 'birth', 'address']);
/** 이 글자가 이름에 들어간 키는 목록에 없어도 가린다(initialPassword, access_token 등). */
const SENSITIVE_KEY_PARTS: readonly string[] = ['password', 'token', 'secret'];
export const HIDDEN_VALUE = '(비공개)';

const normalizeKey = (key: string) => key.toLowerCase().replace(/[_-]/g, '');

const isSensitiveKey = (key: string): boolean => {
  const normalized = normalizeKey(key);
  return (
    SENSITIVE_KEYS.has(normalized) || SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
  );
};

/**
 * 값을 기록할 모양으로 바꾼다. 개인정보 키의 값은 가리고, 배열·객체는 안쪽까지 같은 규칙으로 가린다
 * (예: 행사 참가자 명단 배열의 각 참가자 name·phone).
 */
function maskDeep(value: unknown, key?: string): unknown {
  if (key !== undefined && isSensitiveKey(key)) return HIDDEN_VALUE;
  if (Array.isArray(value)) return value.map((item) => maskDeep(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [childKey, maskDeep(child, childKey)]),
    );
  }
  return value;
}

/**
 * 요청 본문을 기록할 모양으로 바꾼다. 개인정보 값은 안쪽까지 가린다. 본문이 없거나 비었으면 빈 값이다.
 * 본문 전체가 배열인 요청(행사 참가자 명단 저장 등)은 명단 전체를 기록마다 복제하지 않도록 인원 수와 ID 목록만 남긴다.
 */
function requestSummary(request: MockRequest): Detail {
  const { body } = request;
  if (Array.isArray(body)) {
    const ids = body.flatMap((item: unknown) =>
      item && typeof item === 'object' && typeof (item as Detail).id === 'string'
        ? [(item as Detail).id]
        : [],
    );
    return { request: { itemCount: body.length, ids } };
  }
  const entries = Object.entries(bodyOf(request));
  if (entries.length === 0) return {};
  return { request: maskDeep(bodyOf(request)) };
}

const snakeOf = (key: string) => key.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);

/** 표의 한 행에서 요청 본문의 항목(이름을 snake_case로 바꿔 찾는다)만 읽는다. 없는 열은 뺀다. */
function rowValues(request: MockRequest, table: string, id: string | undefined): Detail {
  if (id === undefined) return {};
  const row = queryAll<Record<string, unknown>>(request.db, `SELECT * FROM ${table} WHERE id = ?`, [
    id,
  ])[0];
  if (!row) return {};
  return Object.fromEntries(
    Object.keys(bodyOf(request))
      .filter((key) => snakeOf(key) in row)
      .map((key) => [key, row[snakeOf(key)]]),
  );
}

/** 처리 전·후 행을 비교해 바뀐 항목의 [전, 후] 값을 남긴다. 개인정보 값은 가린다. */
function rowChanges(before: Detail, after: Detail): Detail {
  const changes = Object.fromEntries(
    Object.keys(before)
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map((key) => [key, [maskDeep(before[key], key), maskDeep(after[key] ?? null, key)]]),
  );
  return Object.keys(changes).length > 0 ? { changes } : {};
}

interface AuditRule {
  method: HttpMethod;
  pattern: string;
  action: AuditAction;
  targetType: AuditTargetType;
  /** 대상 ID 목록. 생성 요청은 응답(result)에서 새 ID를 읽는다. */
  targets: (request: MockRequest, result: unknown) => string[];
  /** 처리하기 전에 읽어 둘 값(바뀌기 전 등급·권한 등). detail에 before로 넘긴다. */
  before?: (request: MockRequest, targetIds: readonly string[]) => Detail;
  detail?: (request: MockRequest, context: DetailContext) => Detail;
  /** 수정 요청에서 바뀌기 전·후 값을 비교할 테이블(대상 id로 한 행을 읽는다). */
  compareTable?: string;
}

interface DetailContext {
  before: Detail;
  targetIds: readonly string[];
}

/** 객체 본문. 배열 본문(명단 저장 등)과 본문 없음은 빈 객체다(배열은 requestSummary가 따로 다룬다). */
const bodyOf = (request: MockRequest): Detail =>
  request.body && typeof request.body === 'object' && !Array.isArray(request.body)
    ? (request.body as Detail)
    : {};

/** 경로 값 하나를 대상 ID로 쓴다. */
const param =
  (name: string) =>
  ({ params }: MockRequest): string[] =>
    params[name] ? [params[name]] : [];

/** 생성 응답의 id를 대상 ID로 쓴다. */
const resultId = (_request: MockRequest, result: unknown): string[] => {
  const id = (result as { id?: unknown } | null)?.id;
  return id === undefined || id === null ? [] : [String(id)];
};

/**
 * 운영진 계정 하나의 등급·팀·유효 권한. 계정 발급·삭제·권한 변경 기록에서 누구에게 무엇을 줬는지 남기는 데 쓴다.
 * 권한은 권한 이름(키)만 남긴다. 계정이 없으면 빈 값이다.
 */
function adminSnapshot(request: MockRequest, accountId: string | undefined): Detail {
  const row = accountId === undefined ? undefined : findAdminRow(request.db, Number(accountId));
  if (!row) return {};
  return {
    role: row.role,
    teamName: row.team_name,
    permissions: toAdminAccount(request.db, row).effectivePermissions,
  };
}

const keysOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** 처리 전·후 권한을 비교해 더한 권한·뺀 권한을 남긴다. 바뀐 것이 없으면 빈 값이다. */
function permissionDiff(before: Detail, after: Detail): Detail {
  const beforeKeys = new Set(keysOf(before.permissions));
  const afterKeys = new Set(keysOf(after.permissions));
  const added = [...afterKeys].filter((key) => !beforeKeys.has(key));
  const removed = [...beforeKeys].filter((key) => !afterKeys.has(key));
  return {
    ...(added.length > 0 ? { added } : {}),
    ...(removed.length > 0 ? { removed } : {}),
  };
}

/** 등급·팀처럼 개인정보가 아닌 값은 바뀌기 전·후를 함께 남긴다. */
function valueChanges(before: Detail, after: Detail, keys: readonly string[]): Detail {
  const changes = Object.fromEntries(
    keys
      .filter((key) => before[key] !== undefined && before[key] !== after[key])
      .map((key) => [key, [before[key], after[key] ?? null]]),
  );
  return Object.keys(changes).length > 0 ? { changes } : {};
}

const firstTarget = (_request: MockRequest, targetIds: readonly string[]) => targetIds[0];

/** 동아리원 한 명의 활동 상태(users.club_status). 회원이 없으면 빈 값이다. */
/** 회원에게 연결된 HOST 계정 아이디(탈퇴 처리 때 함께 지워진다). */
function hostUsernamesOf(request: MockRequest, userId: string | undefined): string[] {
  if (userId === undefined) return [];
  return queryAll<{ username: string }>(
    request.db,
    'SELECT username FROM host_accounts WHERE user_id = ? ORDER BY username',
    [userId],
  ).map((row) => row.username);
}

function memberStatus(request: MockRequest, userId: string | undefined): Detail {
  if (userId === undefined) return {};
  const row = queryAll<{ club_status: string }>(
    request.db,
    'SELECT club_status FROM users WHERE id = ?',
    [userId],
  )[0];
  return row ? { status: row.club_status } : {};
}

/** 바꾼 항목의 이름만 남긴다(값은 남기지 않는다. 비밀번호·연락처 같은 값이 기록에 들어가지 않게 한다). */
const changedFields = (request: MockRequest): Detail => ({ fields: Object.keys(bodyOf(request)) });

const GROUP_RULES = (Object.keys(TEAM_API_PATHS) as (keyof typeof TEAM_API_PATHS)[]).flatMap(
  (group): AuditRule[] => {
    const base = TEAM_API_PATHS[group];
    const team = { targetType: 'TEAM' as const, targets: param('teamId') };
    return [
      {
        method: 'POST',
        pattern: base,
        action: 'TEAM_CREATE',
        targetType: 'TEAM',
        targets: resultId,
        detail: () => ({ group }),
      },
      {
        method: 'PATCH',
        pattern: `${base}/:teamId`,
        action: 'TEAM_UPDATE',
        ...team,
        detail: (r) => ({ group, ...changedFields(r) }),
        compareTable: 'teams',
      },
      {
        method: 'DELETE',
        pattern: `${base}/:teamId`,
        action: 'TEAM_DELETE',
        ...team,
        detail: () => ({ group }),
      },
      {
        method: 'POST',
        pattern: `${base}/:teamId/members`,
        action: 'TEAM_MEMBER_ADD',
        ...team,
        detail: (r) => ({ group, userId: bodyOf(r).userId ?? null }),
      },
      {
        method: 'DELETE',
        pattern: `${base}/:teamId/members/:memberId`,
        action: 'TEAM_MEMBER_REMOVE',
        ...team,
        detail: (r) => ({ group, memberId: r.params.memberId }),
      },
      {
        method: 'PUT',
        pattern: `${base}/:teamId/weeks/:weekNum/attendance`,
        action: 'ATTENDANCE_EDIT',
        ...team,
        detail: (r) => ({ group, week: Number(r.params.weekNum) }),
      },
      {
        method: 'POST',
        pattern: `${base}/:teamId/weeks/:weekNum/submit`,
        action: 'ATTENDANCE_SUBMIT',
        ...team,
        detail: (r) => ({ group, week: Number(r.params.weekNum) }),
      },
    ];
  },
);

const semesterOf = (request: MockRequest): string[] => {
  const value = request.params.semester ?? bodyOf(request).semester;
  return typeof value === 'string' && value ? [value] : [];
};

/** 쓰기 API와 감사 액션의 대응. 기록하지 않는 쓰기 API는 IGNORED_WRITES에 적는다. */
export const AUDIT_RULES: readonly AuditRule[] = [
  // 계정·권한
  {
    method: 'POST',
    pattern: '/api/v1/admin/accounts',
    action: 'ADMIN_ACCOUNT_CREATE',
    targetType: 'ADMIN',
    targets: resultId,
    detail: (r, { targetIds }) => adminSnapshot(r, targetIds[0]),
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/admin/accounts/:accountId',
    action: 'ADMIN_ACCOUNT_UPDATE',
    targetType: 'ADMIN',
    targets: param('accountId'),
    before: (r, ids) => adminSnapshot(r, firstTarget(r, ids)),
    detail: (r, { before, targetIds }) => {
      const after = adminSnapshot(r, targetIds[0]);
      return {
        ...changedFields(r),
        ...valueChanges(before, after, ['role', 'teamName']),
        ...permissionDiff(before, after),
      };
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/admin/accounts/:accountId/password',
    action: 'ADMIN_PASSWORD_RESET',
    targetType: 'ADMIN',
    targets: param('accountId'),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/admin/accounts/:accountId',
    action: 'ADMIN_ACCOUNT_DELETE',
    targetType: 'ADMIN',
    targets: param('accountId'),
    // 지운 계정이 가지고 있던 등급·팀·권한을 남긴다.
    before: (r, ids) => adminSnapshot(r, firstTarget(r, ids)),
    detail: (_r, { before }) => before,
  },
  {
    method: 'PUT',
    pattern: '/api/v1/admin/accounts/:accountId/permissions',
    action: 'PERMISSION_CHANGE',
    targetType: 'ADMIN',
    targets: param('accountId'),
    before: (r, ids) => adminSnapshot(r, firstTarget(r, ids)),
    detail: (r, { before, targetIds }) => permissionDiff(before, adminSnapshot(r, targetIds[0])),
  },
  {
    method: 'PUT',
    pattern: '/api/v1/admin/operators/:userId',
    action: 'OPERATOR_ASSIGN',
    targetType: 'USER',
    targets: param('userId'),
    // 옮기기 전 팀을 함께 남겨 어느 팀에서 어느 팀으로 옮겼는지 보이게 한다.
    before: (r, ids) => ({
      previousTeamName:
        queryAll<{ team_name: string }>(r.db, 'SELECT team_name FROM admin WHERE user_id = ?', [
          ids[0] ?? '',
        ])[0]?.team_name ?? null,
    }),
    detail: (r, { before }) => ({ teamName: bodyOf(r).teamName ?? null, ...before }),
  },
  {
    method: 'POST',
    pattern: '/api/v1/hosts',
    action: 'HOST_ACCOUNT_CREATE',
    targetType: 'HOST',
    targets: resultId,
    // 어느 팀 출결을 맡는 계정인지 남긴다.
    detail: (r, { targetIds }) => {
      const row = queryAll<{ team_name: string | null; account_type: string | null }>(
        r.db,
        `SELECT t.team_name, h.account_type
           FROM host_accounts h LEFT JOIN teams t ON t.id = h.team_id
          WHERE h.id = ?`,
        [targetIds[0] ?? ''],
      )[0];
      return row ? { teamName: row.team_name, group: row.account_type } : {};
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/hosts/:hostId',
    action: 'HOST_ACCOUNT_UPDATE',
    targetType: 'HOST',
    targets: param('hostId'),
    detail: changedFields,
    compareTable: 'host_accounts',
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/hosts/:hostId',
    action: 'HOST_ACCOUNT_DELETE',
    targetType: 'HOST',
    targets: param('hostId'),
  },

  // 동아리원
  {
    method: 'POST',
    pattern: '/api/v1/club-members',
    action: 'MEMBER_CREATE',
    targetType: 'USER',
    targets: resultId,
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/club-members/:memberId',
    action: 'MEMBER_UPDATE',
    targetType: 'USER',
    targets: param('memberId'),
    detail: changedFields,
    compareTable: 'users',
  },
  {
    // 동아리원 탈퇴 처리. 행은 지우지 않고 활동 상태만 탈퇴(WITHDRAWN)로 바꾼다.
    method: 'DELETE',
    pattern: '/api/v1/club-members/:memberId',
    action: 'MEMBER_DELETE',
    targetType: 'USER',
    targets: param('memberId'),
    // 처리 전 활동 상태와 연결된 HOST 계정을 읽어 두고, 상태는 [전, 후]로, 함께 지운 HOST 계정은 아이디로 남긴다.
    before: (r, ids) => ({ ...memberStatus(r, ids[0]), hostUsernames: hostUsernamesOf(r, ids[0]) }),
    detail: (r, { before, targetIds }) => {
      const hostUsernames = before.hostUsernames as string[];
      return {
        ...valueChanges(before, memberStatus(r, targetIds[0]), ['status']),
        ...(hostUsernames.length > 0 ? { deletedHostAccounts: hostUsernames } : {}),
      };
    },
  },

  // 출결: 행사·점수 규칙·반기
  {
    method: 'POST',
    pattern: '/api/v1/events',
    action: 'EVENT_CREATE',
    targetType: 'EVENT',
    targets: resultId,
  },
  {
    method: 'PUT',
    pattern: '/api/v1/events/:eventId',
    action: 'EVENT_UPDATE',
    targetType: 'EVENT',
    targets: param('eventId'),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/events/:eventId',
    action: 'EVENT_DELETE',
    targetType: 'EVENT',
    targets: param('eventId'),
  },
  {
    method: 'PUT',
    pattern: '/api/v1/events/:eventId/attendees',
    action: 'EVENT_ATTENDEES_UPDATE',
    targetType: 'EVENT',
    targets: param('eventId'),
  },
  {
    method: 'POST',
    pattern: '/api/v1/events/:eventId/attendees',
    action: 'EVENT_ATTENDEES_UPDATE',
    targetType: 'EVENT',
    targets: param('eventId'),
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/events/:eventId/attendees/:attendeeId',
    action: 'EVENT_ATTENDEES_UPDATE',
    targetType: 'EVENT',
    targets: param('eventId'),
  },
  {
    method: 'POST',
    pattern: '/api/v1/score-rules',
    action: 'SCORE_RULE_CREATE',
    targetType: 'SCORE_RULE',
    targets: resultId,
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/score-rules/:ruleId',
    action: 'SCORE_RULE_UPDATE',
    targetType: 'SCORE_RULE',
    targets: param('ruleId'),
    detail: changedFields,
    compareTable: 'score_rules',
  },
  {
    method: 'POST',
    pattern: '/api/v1/score-rules/:ruleId/activate',
    action: 'SCORE_RULE_ACTIVATE',
    targetType: 'SCORE_RULE',
    targets: param('ruleId'),
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/score-rules/:ruleId',
    action: 'SCORE_RULE_DELETE',
    targetType: 'SCORE_RULE',
    targets: param('ruleId'),
  },
  {
    method: 'POST',
    pattern: '/api/v1/semesters',
    action: 'SEMESTER_CREATE',
    targetType: 'SEMESTER',
    targets: semesterOf,
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/semesters/:semester',
    action: 'SEMESTER_UPDATE',
    targetType: 'SEMESTER',
    targets: semesterOf,
    detail: changedFields,
  },
  {
    method: 'PUT',
    pattern: '/api/v1/semesters/:semester/members',
    action: 'SEMESTER_MEMBERS_SET',
    targetType: 'SEMESTER',
    targets: semesterOf,
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/semesters/:semester/weeks/:weekNum',
    action: 'SEMESTER_WEEK_UPDATE',
    targetType: 'SEMESTER',
    targets: semesterOf,
    detail: (r) => ({ week: Number(r.params.weekNum) }),
  },
  {
    method: 'PUT',
    pattern: '/api/v1/semesters/:semester/week-dates',
    action: 'SEMESTER_WEEK_DATES',
    targetType: 'SEMESTER',
    targets: semesterOf,
  },

  // 스터디·팀(그룹별 경로), 주차 출결 입력
  ...GROUP_RULES,
];

/**
 * 기록하지 않는 쓰기 API. 로그인·로그아웃과 임시 API 전용 세션 전환은 관리 작업이 아니다.
 * 로그인 요청에는 비밀번호가 들어 있어 본문도 남기지 않는다.
 */
export const IGNORED_WRITES: readonly { method: HttpMethod; pattern: string }[] = [
  { method: 'POST', pattern: '/api/v1/auth/login' },
  { method: 'POST', pattern: '/api/v1/auth/logout' },
  { method: 'PUT', pattern: '/api/v1/mock/admin-session' },
];

const ruleOf = (route: MockRoute): AuditRule | undefined =>
  AUDIT_RULES.find((rule) => rule.method === route.method && rule.pattern === route.pattern);

/** 사람이 아닌 대상의 이름. 지워진 뒤에도 알아볼 수 있게 기록에 남긴다. */
function nonPersonLabel(db: Database, type: AuditTargetType, id: string): string | undefined {
  const first = (sql: string) => queryAll<{ value: string }>(db, sql, [id])[0]?.value;
  switch (type) {
    case 'TEAM':
      return first('SELECT team_name AS value FROM teams WHERE id = ?');
    case 'SCORE_RULE':
      return first('SELECT name AS value FROM score_rules WHERE id = ?');
    case 'HOST':
      return first('SELECT username AS value FROM host_accounts WHERE id = ?');
    case 'EVENT':
      return loadEventState(db).events.find((event) => event.id === id)?.title;
    case 'SEMESTER':
      return `${id} 반기`;
    default:
      return undefined;
  }
}

/**
 * 요청한 계정과 그 회원 id·등급. 계정이 나중에 지워지거나 등급이 바뀌어도 기록에는 그때 값이 남는다.
 * HOST 세션이면 운영진 계정 id는 없고(null), 회원 id는 HOST 계정 주인, 등급은 HOST다.
 * 세션이 없으면(로그인 전에 부른 임시 API) 수행자를 모두 비운다.
 */
function actorSnapshot(
  db: Database,
): Pick<AuditLogInsert, 'actorId' | 'actorUserId' | 'actorRole'> {
  const session = currentSession(db);
  if (!session) return { actorId: null, actorUserId: null, actorRole: null };
  if (session.kind === 'HOST') {
    const userId = queryAll<{ user_id: string | null }>(
      db,
      'SELECT user_id FROM host_accounts WHERE id = ?',
      [session.hostId],
    )[0]?.user_id;
    return { actorId: null, actorUserId: userId ?? null, actorRole: 'HOST' };
  }
  const admin = findAdminRow(db, session.adminId);
  return {
    actorId: session.adminId,
    actorUserId: admin?.user_id ?? null,
    actorRole: admin?.role ?? null,
  };
}

/** 'YYYY-MM-DD HH:MM:SS'(이 컴퓨터 시각). */
function now(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 쓰기 요청 하나를 처리하고 감사 기록을 남긴다. 라우터가 트랜잭션 안에서 부른다.
 * 대상 이름은 처리 전에 읽어 둔다(삭제 요청은 처리 뒤에 대상이 없다).
 */
export function recordWrite(request: MockRequest, route: MockRoute, run: () => unknown): unknown {
  const rule = ruleOf(route);
  if (!rule) return run();
  const { db } = request;
  const beforeIds = rule.targets(request, undefined);
  const before = rule.before?.(request, beforeIds) ?? {};
  const rowBefore = rule.compareTable ? rowValues(request, rule.compareTable, beforeIds[0]) : {};
  const labelBefore =
    beforeIds.length === 1 ? nonPersonLabel(db, rule.targetType, beforeIds[0]) : undefined;

  const result = run();

  const targetIds = beforeIds.length > 0 ? beforeIds : rule.targets(request, result);
  const label =
    labelBefore ??
    (targetIds.length === 1 ? nonPersonLabel(db, rule.targetType, targetIds[0]) : undefined);
  const ruleDetail = rule.detail?.(request, { before, targetIds }) ?? {};
  const rowDetail = rule.compareTable
    ? rowChanges(rowBefore, rowValues(request, rule.compareTable, targetIds[0]))
    : {};
  const detail = {
    ...ruleDetail,
    ...rowDetail,
    ...requestSummary(request),
    ...(label ? { label } : {}),
  };
  insertAuditLog(db, {
    occurredAt: now(),
    ...actorSnapshot(db),
    action: rule.action,
    targetType: rule.targetType,
    targetIds,
    apiMethod: request.method,
    apiPath: request.path,
    detail: Object.keys(detail).length > 0 ? detail : null,
    ip: MOCK_IP,
  });
  return result;
}
