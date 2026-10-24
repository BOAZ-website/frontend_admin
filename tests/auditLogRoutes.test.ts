import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { AdminAccount } from '../src/entities/admin-account/model/types';
import type { AuditActorOption, AuditLogPage } from '../src/entities/audit-log/model/dto';
import { AUDIT_ACTIONS } from '../src/entities/audit-log/model/types';
import { AUDIT_RULES, IGNORED_WRITES, recordWrite } from '../src/shared/api/mock/audit';
import { MOCK_ROUTES } from '../src/shared/api/mock/mockRoutes';
import { ApiError } from '../src/shared/api/apiError';
import { createRouter } from '../src/shared/api/mock/router';
import { createDatabase, queryAll } from '../src/shared/db/createDatabase';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(MOCK_ROUTES, { aroundWrite: recordWrite });
  const call = <T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ) => router.dispatch(db, method, path, body) as T;
  const logCount = () => queryAll<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM audit_log')[0].n;
  const latest = () => call<AuditLogPage>('GET', '/api/v1/admin/audit-logs?size=1').items[0];
  /** 기록 행의 원본 값(DB). 응답에는 대상이 없어 target_ids는 DB에서 읽는다. */
  const rowOf = (entryId: number) => {
    const row = queryAll<{ target_ids: string; detail: string | null }>(
      db,
      'SELECT target_ids, detail FROM audit_log WHERE id = ?',
      [entryId],
    )[0];
    return {
      targetIds: JSON.parse(row.target_ids) as string[],
      detail: (row.detail ? JSON.parse(row.detail) : null) as Record<string, unknown> | null,
    };
  };
  const targetIdsOf = (entryId: number) => rowOf(entryId).targetIds;
  /** 대상 id가 targetId인 시드 기록(한 건)의 응답 항목. */
  const entryOfTarget = (targetId: string) => {
    const id = queryAll<{ id: number }>(db, 'SELECT id FROM audit_log WHERE target_ids LIKE ?', [
      '%"' + targetId + '"%',
    ])[0].id;
    return call<AuditLogPage>('GET', '/api/v1/admin/audit-logs?size=200').items.find(
      (entry) => entry.id === id,
    );
  };
  return { db, call, logCount, latest, rowOf, targetIdsOf, entryOfTarget };
}

function expectApiError(work: () => unknown, status: number) {
  assert.throws(work, (error: unknown) => error instanceof ApiError && error.status === status);
}

test('모든 쓰기 API는 감사 액션이 정해져 있다(기록하지 않는 것은 따로 적는다)', () => {
  const missing = MOCK_ROUTES.filter((route) => route.method !== 'GET')
    .filter(
      (route) =>
        !AUDIT_RULES.some(
          (rule) => rule.method === route.method && rule.pattern === route.pattern,
        ) &&
        !IGNORED_WRITES.some(
          (item) => item.method === route.method && item.pattern === route.pattern,
        ),
    )
    .map((route) => `${route.method} ${route.pattern}`);

  assert.deepEqual(missing, []);
});

test('쓰기가 성공하면 수행자·액션·대상·API가 남고, 개인정보 값은 가리고 그 밖의 값은 전·후를 남긴다', async () => {
  const { call, latest, rowOf } = await setup();
  call('PATCH', '/api/v1/club-members/u_28_01', { phone: '010-9999-0000', major: '통계학과' });
  const entry = latest();

  assert.equal(entry.action, 'MEMBER_UPDATE');
  assert.equal(entry.category, 'SYSTEM');
  assert.equal(entry.actorId, 1);
  assert.equal(entry.actorName, '남민서');
  assert.deepEqual(rowOf(entry.id).targetIds, ['u_28_01']);
  assert.deepEqual(entry.api, { method: 'PATCH', path: '/api/v1/club-members/u_28_01' });
  // 연락처는 값을 남기지 않고, 전공은 보낸 값과 바뀌기 전·후를 남긴다.
  assert.ok(!JSON.stringify(entry.detail).includes('010-9999-0000'));
  assert.deepEqual(entry.requestBody, { phone: '(비공개)', major: '통계학과' });
  const changes = rowOf(entry.id).detail?.changes as Record<string, unknown[]>;
  assert.deepEqual(changes.phone, ['(비공개)', '(비공개)']);
  assert.equal(changes.major[1], '통계학과');
  assert.notEqual(changes.major[0], '통계학과');
  assert.deepEqual(entry.detail, rowOf(entry.id).detail);
});

test('실패한 쓰기는 기록되지 않는다', async () => {
  const { call, logCount } = await setup();
  const before = logCount();

  expectApiError(() => call('PATCH', '/api/v1/club-members/u_28_02', { name: '김서하' }), 409);
  assert.equal(logCount(), before);
});

test('동아리원 탈퇴 처리는 "동아리원 탈퇴 처리"로 기록되고, 처리 전 활동 상태를 남긴다', async () => {
  const { db, call, latest, targetIdsOf } = await setup();
  const member = queryAll<{ id: string; name: string; term: number; club_status: string }>(
    db,
    `SELECT id, name, term, club_status FROM users
      WHERE club_status = 'ACTIVE' AND id NOT IN (SELECT user_id FROM admin) LIMIT 1`,
  )[0];
  call('DELETE', `/api/v1/club-members/${member.id}`);
  const entry = latest();

  assert.equal(entry.action, 'MEMBER_DELETE');
  assert.equal(AUDIT_ACTIONS[entry.action].label, '동아리원 탈퇴 처리');
  assert.deepEqual(entry.api, { method: 'DELETE', path: `/api/v1/club-members/${member.id}` });
  assert.deepEqual(targetIdsOf(entry.id), [member.id]);
  // 처리 전(ACTIVE) → 처리 후(WITHDRAWN)를 남긴다. 이름은 detail에 넣지 않는다.
  assert.deepEqual(entry.detail?.changes, { status: [member.club_status, 'WITHDRAWN'] });
  assert.ok(!JSON.stringify(entry.detail).includes(member.name));
});

test('지운 팀은 기록할 때의 이름을 남긴다', async () => {
  const { call, latest, rowOf } = await setup();
  call('DELETE', '/api/v1/study-teams/study_e');
  const teamEntry = latest();
  assert.equal(teamEntry.action, 'TEAM_DELETE');
  assert.deepEqual(rowOf(teamEntry.id).targetIds, ['study_e']);
  assert.equal(rowOf(teamEntry.id).detail?.label, '쿠버네티스 스터디');
});

test('분류·수행자·기간·검색어로 거르고, 최신 기록부터 한 쪽씩 준다', async () => {
  const { call } = await setup();
  const list = (query: string) => call<AuditLogPage>('GET', `/api/v1/admin/audit-logs?${query}`);

  const content = list('category=CONTENT');
  assert.ok(content.total > 0);
  assert.ok(content.items.every((entry) => entry.category === 'CONTENT'));

  const byActor = list('actorId=6');
  assert.ok(byActor.items.every((entry) => entry.actorId === 6));

  const october = list('from=2026-10-01&to=2026-10-31');
  assert.ok(october.items.every((entry) => entry.occurredAt.startsWith('2026-10')));

  const searched = list('q=쿠버네티스');
  assert.ok(searched.total > 0);
  // 검색은 서버가 대상 이름으로 한다. 응답에는 대상이 없어, 기록 때 남긴 이름(detail.label)으로 본다.
  assert.ok(
    searched.items.every((entry) => String(entry.detail?.label ?? '').includes('쿠버네티스')),
  );

  const all = list('size=5');
  assert.equal(all.items.length, 5);
  assert.ok(
    all.items.every((entry, i) => i === 0 || all.items[i - 1].occurredAt >= entry.occurredAt),
  );
  const second = list('size=5&page=2');
  assert.notEqual(second.items[0].id, all.items[0].id);

  expectApiError(() => list('category=NOPE'), 400);
  expectApiError(() => list('from=2026/10/01'), 400);
});

test('수행자 선택지는 기록에 나온 계정이다', async () => {
  const { call } = await setup();
  const actors = call<AuditActorOption[]>('GET', '/api/v1/admin/audit-logs/actors');

  assert.ok(actors.some((actor) => actor.id === 1 && actor.name === '남민서'));
  assert.equal(new Set(actors.map((actor) => actor.id)).size, actors.length);
});

test('감사 로그 조회 권한이 없으면 403이다', async () => {
  const { call } = await setup();
  call('PUT', '/api/v1/mock/admin-session', { accountId: 4 });

  expectApiError(() => call('GET', '/api/v1/admin/audit-logs'), 403);
});

test('분류는 사이드바 메뉴 묶음 다섯 개이고, 그룹 계정(HOST) 관리는 출결 및 점수 시스템에 든다', async () => {
  const { call } = await setup();
  const list = (query: string) => call<AuditLogPage>('GET', `/api/v1/admin/audit-logs?${query}`);

  const system = list('category=SYSTEM&size=100');
  assert.ok(system.items.some((entry) => entry.action === 'PERMISSION_CHANGE'));
  assert.ok(system.items.some((entry) => entry.action === 'MEMBER_UPDATE'));

  const attendance = list('category=ATTENDANCE&size=100');
  assert.ok(attendance.items.some((entry) => entry.action === 'HOST_ACCOUNT_UPDATE'));
  assert.ok(attendance.items.some((entry) => entry.action === 'TEAM_CREATE'));
});

test('수행자의 기수·부문·등급과 지금 권한 여부가 함께 나온다', async () => {
  const { call, latest } = await setup();
  const all = call<AuditLogPage>('GET', '/api/v1/admin/audit-logs?size=100').items;

  const master = all.find((entry) => entry.actorId === 1);
  assert.equal(master?.actorUserId, 'u_26_01');
  assert.equal(master?.actorTerm, 26);
  assert.equal(master?.actorRole, 'MASTER');
  assert.equal(master?.actorHasPermission, true);
  assert.equal(master?.actorHasAccount, true);

  const host = all.find((entry) => entry.actorRole === 'HOST');
  assert.equal(host?.actorUserId, 'u_27_01');
  assert.equal(host?.actorHasPermission, true);

  // 운영진 계정이 지워진 사람: 기록할 때의 등급은 남고, 지금 권한은 없다.
  const former = all.find((entry) => entry.actorId === 99);
  assert.equal(former?.actorName, '오하린');
  assert.equal(former?.actorRole, 'TEAM');
  assert.equal(former?.actorHasPermission, false);
  assert.equal(former?.actorHasAccount, false);

  // 새로 남기는 기록에는 그때의 회원 id와 등급이 저장된다.
  call('PATCH', '/api/v1/club-members/u_28_01', { major: '통계학과' });
  assert.equal(latest().actorUserId, 'u_26_01');
  assert.equal(latest().actorRole, 'MASTER');
});

test('기록마다 권한 매트릭스의 어느 권한으로 생성·수정·삭제 중 무엇을 했는지 나온다', async () => {
  const { call } = await setup();
  const all = call<AuditLogPage>('GET', '/api/v1/admin/audit-logs?size=100').items;
  const find = (action: string) => all.find((entry) => entry.action === action);

  assert.deepEqual(find('CONTENT_DELETE')?.permission, {
    key: 'CONTENT_WRITE',
    label: '콘텐츠 CUD',
  });
  assert.equal(find('CONTENT_DELETE')?.operation, 'DELETE');
  assert.equal(find('PERMISSION_CHANGE')?.permission?.key, 'ADMIN_PERMISSION_WRITE');
  assert.equal(find('RECRUITMENT_CREATE')?.operation, 'CREATE');
  // HOST가 제출한 출결은 담당 스터디 입력 권한이다.
  const hostSubmit = all.find(
    (entry) => entry.action === 'ATTENDANCE_SUBMIT' && entry.actorRole === 'HOST',
  );
  assert.equal(hostSubmit?.permission?.key, 'ATTENDANCE_STUDY_ENTRY_OWN_GROUP_WRITE');
  // 권한 매트릭스에 항목이 없는 작업(동아리원 관리)은 권한이 비어 있다.
  assert.equal(find('MEMBER_UPDATE')?.permission, null);
});

test('권한으로 거르면 그 권한으로 한 기록만 남고, NONE은 매트릭스에 없는 작업이다', async () => {
  const { call } = await setup();
  const list = (query: string) => call<AuditLogPage>('GET', `/api/v1/admin/audit-logs?${query}`);

  const content = list('category=CONTENT&permission=CONTENT_WRITE');
  assert.ok(content.total > 0);
  assert.ok(content.items.every((entry) => entry.permission?.key === 'CONTENT_WRITE'));
  assert.equal(list('permission=CONTENT_READ').total, 0);

  const unmatched = list('permission=NONE&size=100');
  assert.ok(unmatched.total > 0);
  assert.ok(unmatched.items.every((entry) => entry.permission === null));

  expectApiError(() => list('permission=NOPE'), 400);
});

test('같은 날짜를 from·to로 주면 그날 기록만 나온다', async () => {
  const { call } = await setup();
  const day = call<AuditLogPage>('GET', '/api/v1/admin/audit-logs?from=2026-09-22&to=2026-09-22');
  assert.ok(day.total > 0);
  assert.ok(day.items.every((entry) => entry.occurredAt.startsWith('2026-09-22')));
});

test('계정을 발급하면 누구에게 어떤 등급·팀·권한을 줬는지 상세에 남는다', async () => {
  const { call, latest, rowOf } = await setup();
  call('POST', '/api/v1/admin/accounts', {
    userId: 'u_28_11',
    username: 'boaz_pr_lead',
    password: 'Boaz!2027',
    role: 'TEAM',
    teamName: '홍보팀',
  });
  const entry = latest();
  const { targetIds, detail } = rowOf(entry.id);

  assert.equal(entry.action, 'ADMIN_ACCOUNT_CREATE');
  assert.equal(targetIds.length, 1);
  assert.equal(detail?.role, 'TEAM');
  assert.equal(detail?.teamName, '홍보팀');
  assert.ok(((detail?.permissions as string[] | undefined)?.length ?? 0) > 0);
  assert.ok(!JSON.stringify(entry.detail).includes('Boaz!2027'));
  assert.deepEqual(entry.api, { method: 'POST', path: '/api/v1/admin/accounts' });
  assert.deepEqual(entry.requestBody, {
    userId: 'u_28_11',
    username: 'boaz_pr_lead',
    password: '(비공개)',
    role: 'TEAM',
    teamName: '홍보팀',
  });
});

test('권한을 바꾸면 더한 권한과 뺀 권한이 남는다', async () => {
  const { call, latest, rowOf } = await setup();
  const before = call<AdminAccount[]>('GET', '/api/v1/admin/accounts').find(
    (account) => account.id === 6,
  )!;
  const removedKey = before.effectivePermissions.find((key) => key !== 'CONTENT_WRITE')!;
  const next = [
    ...before.effectivePermissions.filter((key) => key !== removedKey),
    'AUDIT_LOG_READ',
  ];
  call('PUT', '/api/v1/admin/accounts/6/permissions', { permissions: next });
  const entry = latest();
  const { detail } = rowOf(entry.id);

  assert.equal(entry.action, 'PERMISSION_CHANGE');
  assert.deepEqual(detail?.added, ['AUDIT_LOG_READ']);
  assert.deepEqual(detail?.removed, [removedKey]);
});

test('콘텐츠 기록에는 종류·제목과, Body에 올린 파일({ name, url }, 사진만 주소)이 남는다', async () => {
  const { entryOfTarget } = await setup();
  const entry = entryOfTarget('archive-112');
  const files = entry?.requestBody?.files as { name: string; url: string | null }[] | undefined;

  assert.equal(entry?.detail?.kind, 'ARCHIVE');
  assert.equal(entry?.detail?.label, '26기 분석 컨퍼런스 프로젝트');
  assert.deepEqual(entry?.api, { method: 'POST', path: '/api/v1/admin/archiving/projects' });
  // 상세 팝업이 쓰는 모양: { name, url } 배열. 사진 1개는 주소가 있고, PDF 2개는 url이 null이다.
  assert.ok(Array.isArray(files));
  assert.ok(files.every((file) => Object.keys(file).sort().join(',') === 'name,url'));
  assert.deepEqual(
    files.map((file) => [file.name, typeof file.url === 'string' && file.url.startsWith('http')]),
    [
      ['대표이미지.jpg', true],
      ['발표자료.pdf', false],
      ['결과보고서.pdf', false],
    ],
  );
  assert.equal(files[1].url, null);
  assert.equal(files[2].url, null);
});

test('콘텐츠 삭제 기록은 Body가 없고(null), 지운 사진 2장은 기록 원본(detail.files)에 남는다', async () => {
  const { entryOfTarget } = await setup();
  const entry = entryOfTarget('archive-87');
  const files = entry?.detail?.files as { name: string; url: string | null }[] | undefined;

  assert.deepEqual(entry?.api, {
    method: 'DELETE',
    path: '/api/v1/admin/archiving/activities/archive-87',
  });
  assert.equal(entry?.requestBody, null);
  assert.deepEqual(
    files?.map((file) => [file.name, file.url !== null]),
    [
      ['발표회_01.jpg', true],
      ['발표회_02.jpg', true],
    ],
  );
});

test('응답 항목에는 지운 필드(targets·detailItems·attachments)가 없다', async () => {
  const { call } = await setup();
  call('PATCH', '/api/v1/club-members/u_28_01', { major: '통계학과' });
  const items = call<AuditLogPage>('GET', '/api/v1/admin/audit-logs?size=200').items;

  assert.ok(items.length > 0);
  for (const entry of items) {
    for (const key of ['targets', 'detailItems', 'attachments']) {
      assert.ok(!(key in entry), `기록 ${entry.id}에 ${key}가 남아 있다`);
    }
  }
});

// ── requestBody: 기록에 남긴 보낸 값(2026-10-22 감사 로그 API Body 계약) ──

test('POST 기록의 requestBody는 보낸 값 그대로이고, 이름·연락처·이메일은 (비공개)로 가린다', async () => {
  const { call, latest } = await setup();
  const body = {
    name: '홍길동',
    email: 'gildong@example.com',
    phone: '010-1234-5678',
    university: '한국대학교',
    major: '통계학과',
    term: 20,
    track: '시각화',
    status: 'ALUMNI',
  };
  call('POST', '/api/v1/club-members', body);
  const entry = latest();

  assert.equal(entry.action, 'MEMBER_CREATE');
  assert.deepEqual(entry.requestBody, {
    ...body,
    name: '(비공개)',
    email: '(비공개)',
    phone: '(비공개)',
  });
  const text = JSON.stringify(entry.requestBody);
  assert.ok(!text.includes('홍길동') && !text.includes('gildong') && !text.includes('1234-5678'));
});

test('DELETE 기록의 requestBody는 null이다', async () => {
  const { db, call, latest } = await setup();
  const memberId = queryAll<{ id: string }>(
    db,
    `SELECT id FROM users
      WHERE club_status = 'ACTIVE' AND id NOT IN (SELECT user_id FROM admin) LIMIT 1`,
  )[0].id;
  call('DELETE', `/api/v1/club-members/${memberId}`);
  const entry = latest();

  assert.equal(entry.api?.method, 'DELETE');
  assert.equal(entry.requestBody, null);
});

test('시드의 POST·PATCH·PUT 예시 기록 중 requestBody가 있는 것이 있고, 개인정보 키는 (비공개)다', async () => {
  const { call } = await setup();
  const first = call<AuditLogPage>('GET', '/api/v1/admin/audit-logs?size=200&page=1');
  const pageCount = Math.ceil(first.total / first.size);
  const entries = [first.items];
  for (let page = 2; page <= pageCount; page += 1) {
    entries.push(call<AuditLogPage>('GET', `/api/v1/admin/audit-logs?size=200&page=${page}`).items);
  }
  const writes = entries
    .flat()
    .filter((entry) => ['POST', 'PATCH', 'PUT'].includes(entry.api?.method ?? ''));

  assert.ok(writes.length > 0, '시드에 POST·PATCH·PUT 예시 기록이 있어야 한다');
  // 본문을 받지 않는 API(제출·적용 등)의 예시 기록은 null일 수 있어 한 건 이상만 본다.
  assert.ok(
    writes.some((entry) => entry.requestBody !== null),
    '보낸 값이 채워진 POST·PATCH·PUT 예시 기록이 한 건 이상 있어야 한다',
  );
  for (const entry of writes) {
    for (const key of ['name', 'phone', 'email', 'password']) {
      const value = entry.requestBody?.[key];
      if (value !== undefined) assert.equal(value, '(비공개)', `${entry.api?.path}의 ${key}`);
    }
  }
});

test('비밀번호 변경 기록의 requestBody는 새 비밀번호·현재 비밀번호를 (비공개)로 가린다', async () => {
  const { db, call, latest } = await setup();
  const accountId = queryAll<{ id: number }>(
    db,
    'SELECT id FROM admin WHERE username IS NOT NULL AND id <> 1 LIMIT 1',
  )[0].id;
  call('PATCH', `/api/v1/admin/accounts/${accountId}/password`, {
    newPassword: 'New!Pass2027',
    currentPassword: 'Old!Pass2026',
  });
  const entry = latest();

  assert.equal(entry.action, 'ADMIN_PASSWORD_RESET');
  assert.deepEqual(entry.requestBody, { newPassword: '(비공개)', currentPassword: '(비공개)' });
  assert.ok(!JSON.stringify(entry).includes('New!Pass2027'));
  assert.ok(!JSON.stringify(entry).includes('Old!Pass2026'));
});
