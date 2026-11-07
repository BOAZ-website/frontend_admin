import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { ClubMember, ClubMemberTermPage } from '../src/entities/club-member/model/types';
import { ApiError } from '../src/shared/api/apiError';
import { createRouter } from '../src/shared/api/mock/router';
import { clubMemberRoutes } from '../src/shared/api/mock/routes/clubMemberRoutes';
import { userRoutes } from '../src/shared/api/mock/routes/userRoutes';
import { createDatabase, execute, queryAll } from '../src/shared/db/createDatabase';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');
const BY_TERM = '/api/v1/club-members/by-term';

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter([...clubMemberRoutes, ...userRoutes]);
  const call = <T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) =>
    router.dispatch(db, method, path, body) as T;
  return { db, call };
}

function expectApiError(work: () => unknown, status: number) {
  assert.throws(work, (error: unknown) => error instanceof ApiError && error.status === status);
}

test('동아리원 목록은 임시 DB users 테이블 전체를 활동 상태 → 부문 → 이름 가나다순으로 돌려준다', async () => {
  const { db, call } = await setup();
  const members = call<ClubMember[]>('GET', '/api/v1/club-members');
  const userCount = queryAll<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM users')[0].n;

  assert.equal(members.length, userCount);
  const STATUS_ORDER = ['ACTIVE', 'COMPLETED', 'WITHDRAWN'];
  const TRACK_ORDER = ['분석', '시각화', '엔지니어링'];
  assert.ok(
    members.every((member, i) => {
      if (i === 0) return true;
      const prev = members[i - 1];
      const byStatus = STATUS_ORDER.indexOf(prev.status) - STATUS_ORDER.indexOf(member.status);
      const byTrack = TRACK_ORDER.indexOf(prev.track) - TRACK_ORDER.indexOf(member.track);
      if (byStatus !== 0) return byStatus < 0;
      // 탈동한 사람은 최신 기수부터다.
      if (member.status === 'WITHDRAWN' && prev.term !== member.term)
        return prev.term > member.term;
      return byTrack < 0 || (byTrack === 0 && prev.name <= member.name);
    }),
  );
  assert.equal(members.find((member) => member.id === 'u_27_01')?.role, 'PRESIDENT');
  assert.ok(members.filter((member) => member.term <= 25).every((m) => m.status === 'COMPLETED'));
});

test('동아리원을 추가하면 일반 회원으로 들어가고 활동 명단(members) 행도 생긴다', async () => {
  const { db, call } = await setup();
  const created = call<ClubMember>('POST', '/api/v1/club-members', {
    name: '홍길동',
    email: 'gildong@example.com',
    phone: '010-0000-0000',
    university: '',
    major: '',
    term: 20,
    track: '시각화',
    status: 'COMPLETED',
  });

  assert.equal(created.role, 'MEMBER');
  assert.equal(created.status, 'COMPLETED');
  assert.equal(created.operatorTeam, null);
  assert.ok(call<ClubMember[]>('GET', '/api/v1/club-members').some((m) => m.id === created.id));
  assert.equal(
    queryAll<{ n: number }>(
      db,
      'SELECT COUNT(*) AS n FROM members WHERE user_id = ? AND term = 20 AND track = ?',
      [created.id, '시각화'],
    )[0].n,
    1,
  );
});

test('추가할 때 필수 값이 없거나 같은 기수에 같은 이름이 있으면 거절한다', async () => {
  const { call } = await setup();
  const base = { name: '홍길동', email: 'g@example.com', phone: '010', term: 20, track: '분석' };
  const post = (body: unknown) => () => call('POST', '/api/v1/club-members', body);

  expectApiError(post({ ...base, name: '' }), 400);
  expectApiError(post({ ...base, email: 'not-an-email' }), 400);
  expectApiError(post({ ...base, term: 0 }), 400);
  expectApiError(post({ ...base, track: 'AI' }), 400);
  expectApiError(post({ ...base, name: '김서하', term: 27 }), 409);
});

test('수정은 보낸 값만 바꾼다', async () => {
  const { call } = await setup();
  const updated = call<ClubMember>('PATCH', '/api/v1/club-members/u_28_01', {
    status: 'COMPLETED',
    role: 'PRESIDENT',
  });

  assert.equal(updated.status, 'COMPLETED');
  assert.equal(updated.role, 'PRESIDENT');
  assert.equal(updated.name, '김서하');
  assert.equal(updated.email, 'seoha.k@yonsei.ac.kr');
  assert.equal(updated.university, '연세대학교');
  assert.equal(updated.major, '응용통계학과');

  const renamed = call<ClubMember>('PATCH', '/api/v1/club-members/u_28_01', {
    university: '서울대학교',
    major: '',
  });
  assert.equal(renamed.university, '서울대학교');
  assert.equal(renamed.major, '');
});

test('기수·부문을 바꾸면 그 기수·부문의 활동 명단(members) 행이 생긴다', async () => {
  const { db, call } = await setup();
  // 활동 중인 회원은 기수·부문을 고칠 수 없어, 먼저 수료로 바꾼다.
  call('PATCH', '/api/v1/club-members/u_28_01', { status: 'COMPLETED' });
  call('PATCH', '/api/v1/club-members/u_28_01', { term: 29, track: '시각화' });

  assert.equal(
    queryAll(db, 'SELECT 1 FROM members WHERE user_id = ? AND term = 29 AND track = ?', [
      'u_28_01',
      '시각화',
    ]).length,
    1,
  );
});

test('같은 기수에 같은 이름이 있으면 409, 형식이 틀리면 400, 없는 동아리원은 404로 거절한다', async () => {
  const { call } = await setup();
  const patch = (body: unknown) => () => call('PATCH', '/api/v1/club-members/u_28_02', body);
  // 활동 중인 회원은 이름을 고칠 수 없어, 먼저 수료로 바꾼다.
  call('PATCH', '/api/v1/club-members/u_28_02', { status: 'COMPLETED' });

  expectApiError(patch({ name: '김서하' }), 409);
  expectApiError(patch({ track: 'AI' }), 400);
  expectApiError(patch({ email: 'not-an-email' }), 400);
  expectApiError(patch({ phone: '' }), 400);
  expectApiError(() => call('PATCH', '/api/v1/club-members/u_none', { role: 'MEMBER' }), 404);
});

test('기수 목록 API는 users 테이블의 기수를 큰 기수부터 돌려주고, 기수 변경을 반영한다', async () => {
  const { call } = await setup();

  assert.deepEqual(call<number[]>('GET', '/api/v1/users/terms'), [27, 26, 25]);
  call('PATCH', '/api/v1/club-members/u_25_01', { term: 28 });
  assert.deepEqual(call<number[]>('GET', '/api/v1/users/terms'), [28, 27, 26, 25]);
});

test('운영진 역할은 정보 수정으로 달거나 뗄 수 없고, 대표 역할과 지금과 같은 역할만 받는다', async () => {
  const { call } = await setup();
  const members = call<ClubMember[]>('GET', '/api/v1/club-members');
  const member = members.find((m) => m.role === 'MEMBER' && m.status !== 'WITHDRAWN')!;
  const operator = members.find((m) => m.role === 'OPERATOR')!;

  // 운영진 계정이 없는 회원을 OPERATOR로, 운영진을 MEMBER로 바꾸는 요청은 400이다.
  expectApiErrorCode(
    () => call('PATCH', `/api/v1/club-members/${member.id}`, { role: 'OPERATOR' }),
    400,
    'ROLE_FOLLOWS_OPERATOR',
  );
  expectApiErrorCode(
    () => call('PATCH', `/api/v1/club-members/${operator.id}`, { role: 'MEMBER' }),
    400,
    'ROLE_FOLLOWS_OPERATOR',
  );

  // 수정 팝업은 지금 역할을 그대로 보낸다. 이 값은 받고, 다른 정보도 그대로다.
  const same = call<ClubMember>('PATCH', `/api/v1/club-members/${member.id}`, { role: 'MEMBER' });
  assert.deepEqual(same, member);

  // 대표 역할은 운영진 지정과 따로 정하므로 받는다.
  const president = call<ClubMember>('PATCH', `/api/v1/club-members/${member.id}`, {
    role: 'PRESIDENT',
  });
  assert.equal(president.role, 'PRESIDENT');
});

test('탈동은 정보 수정에서 활동 상태를 탈동으로 바꿔 처리하고, 처음부터 탈동으로 추가할 수는 없다', async () => {
  const { call } = await setup();
  const members = call<ClubMember[]>('GET', '/api/v1/club-members');
  const member = members.find(
    (m) => m.role === 'MEMBER' && m.status === 'ACTIVE' && !m.leaderTeams && !m.hostUsernames,
  )!;

  expectApiErrorCode(
    () =>
      call('POST', '/api/v1/club-members', {
        name: '새회원',
        email: 'new@example.com',
        phone: '010-0000-0000',
        term: 27,
        track: '분석',
        status: 'WITHDRAWN',
      }),
    400,
    'CANNOT_CREATE_WITHDRAWN',
  );
  const withdrawn = call<ClubMember>('PATCH', `/api/v1/club-members/${member.id}`, {
    status: 'WITHDRAWN',
  });
  assert.equal(withdrawn.status, 'WITHDRAWN');
  // 이미 탈동한 사람도 지금 상태(탈동)를 그대로 보내 다른 정보를 고칠 수 있다.
  const edited = call<ClubMember>('PATCH', `/api/v1/club-members/${member.id}`, {
    status: 'WITHDRAWN',
    major: '통계학',
  });
  assert.equal(edited.major, '통계학');
});

function expectApiErrorCode(work: () => unknown, status: number, code: string) {
  assert.throws(
    work,
    (error: unknown) => error instanceof ApiError && error.status === status && error.code === code,
  );
}

/** 탈동 처리해도 남아야 하는 행 수(반기 명단·팀 소속·팀장 칸·출결 기록). */
function linkedRowCounts(db: Awaited<ReturnType<typeof setup>>['db'], id: string) {
  const count = (sql: string) => queryAll<{ n: number }>(db, sql, [id])[0].n;
  return {
    semesterMembers: count('SELECT COUNT(*) AS n FROM semester_members WHERE user_id = ?'),
    teamMembers: count('SELECT COUNT(*) AS n FROM team_members WHERE user_id = ?'),
    leaderOf: count('SELECT COUNT(*) AS n FROM teams WHERE leader_id = ?'),
    attendance: count(
      `SELECT COUNT(*) AS n FROM attendance_records r
         JOIN team_members tm ON tm.id = r.member_id WHERE tm.user_id = ?`,
    ),
  };
}

/** 현재 반기 팀 조건. 현재 반기 팀장은 탈동 처리할 수 없다. */
const CURRENT_TEAM = 'semester_cohort = (SELECT cohort FROM cohorts WHERE is_current = 1)';

/**
 * 탈동 처리할 수 있는 활동 회원(운영진·HOST 계정이 없고 현재 반기 팀장도 아닌 사람). 팀 소속·출결 기록이 있는 사람을 고른다.
 */
function activeLeaderId(db: Awaited<ReturnType<typeof setup>>['db']): string {
  return queryAll<{ id: string }>(
    db,
    `SELECT tm.user_id AS id FROM team_members tm JOIN users u ON u.id = tm.user_id
      WHERE u.club_status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM admin a WHERE a.user_id = tm.user_id)
        AND NOT EXISTS (SELECT 1 FROM host_accounts h WHERE h.user_id = tm.user_id)
        AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.leader_id = tm.user_id AND t.${CURRENT_TEAM})
        AND EXISTS (SELECT 1 FROM attendance_records r WHERE r.member_id = tm.id)
      LIMIT 1`,
  )[0].id;
}

/** 운영진이 아닌 현재 반기 팀장(활동 회원)과 그 팀 id. */
function currentLeaderOf(db: Awaited<ReturnType<typeof setup>>['db']) {
  return queryAll<{ userId: string; teamId: string; teamName: string }>(
    db,
    `SELECT t.leader_id AS userId, t.id AS teamId, t.team_name AS teamName
       FROM teams t JOIN users u ON u.id = t.leader_id
      WHERE t.${CURRENT_TEAM} AND u.club_status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM admin a WHERE a.user_id = t.leader_id)
        AND (SELECT COUNT(*) FROM teams x WHERE x.leader_id = t.leader_id AND x.${CURRENT_TEAM}) = 1
      LIMIT 1`,
  )[0];
}

test('현재 반기 팀장은 탈동 처리할 수 없고(409), 팀장을 바꾸면 탈동 처리된다', async () => {
  const { db, call } = await setup();
  const leader = currentLeaderOf(db);
  assert.ok(leader);
  execute(db, 'DELETE FROM host_accounts WHERE user_id = ?', [leader.userId]);
  const listed = call<ClubMember[]>('GET', '/api/v1/club-members').find(
    (m) => m.id === leader.userId,
  );
  assert.equal(listed?.leaderTeams, leader.teamName);

  expectApiErrorCode(
    () => call('PATCH', `/api/v1/club-members/${leader.userId}`, { status: 'WITHDRAWN' }),
    409,
    'MEMBER_IS_TEAM_LEADER',
  );
  assert.equal(
    call<ClubMember[]>('GET', '/api/v1/club-members').find((m) => m.id === leader.userId)?.status,
    'ACTIVE',
  );

  execute(db, 'UPDATE teams SET leader_id = NULL WHERE id = ?', [leader.teamId]);
  assert.equal(
    call<ClubMember>('PATCH', `/api/v1/club-members/${leader.userId}`, { status: 'WITHDRAWN' })
      .status,
    'WITHDRAWN',
  );
});

test('지난 반기 팀장은 탈동을 막지 않는다', async () => {
  const { db, call } = await setup();
  const leader = currentLeaderOf(db);
  execute(db, 'DELETE FROM host_accounts WHERE user_id = ?', [leader.userId]);
  // 반기를 넘겨 지금 팀이 지난 반기 팀이 되게 한다.
  const current = queryAll<{ cohort: number }>(
    db,
    'SELECT cohort FROM cohorts WHERE is_current = 1',
  )[0].cohort;
  execute(db, 'UPDATE cohorts SET is_current = 0 WHERE is_current = 1');
  execute(db, 'UPDATE cohorts SET is_current = 1 WHERE cohort = ?', [current - 1]);

  const listed = call<ClubMember[]>('GET', '/api/v1/club-members').find(
    (m) => m.id === leader.userId,
  );
  assert.equal(listed?.leaderTeams, null);
  assert.equal(
    call<ClubMember>('PATCH', `/api/v1/club-members/${leader.userId}`, { status: 'WITHDRAWN' })
      .status,
    'WITHDRAWN',
  );
  // 지난 반기 팀의 팀장 기록은 남는다.
  const leaderOf = queryAll<{ n: number }>(
    db,
    'SELECT COUNT(*) AS n FROM teams WHERE leader_id = ?',
    [leader.userId],
  )[0].n;
  assert.equal(leaderOf, 1);
});

test('탈동 처리는 행을 지우지 않고 활동 상태만 WITHDRAWN으로 바꾼 회원을 돌려준다', async () => {
  const { db, call } = await setup();
  const target = activeLeaderId(db);
  const before = linkedRowCounts(db, target);
  assert.ok(before.semesterMembers > 0 && before.teamMembers > 0);
  assert.ok(before.attendance > 0, '출결 기록이 있는 사람이어야 한다');
  const original = call<ClubMember[]>('GET', '/api/v1/club-members').find((m) => m.id === target);

  const withdrawn = call<ClubMember>('PATCH', `/api/v1/club-members/${target}`, {
    status: 'WITHDRAWN',
  });

  assert.equal(withdrawn.id, target);
  assert.equal(withdrawn.status, 'WITHDRAWN');
  assert.deepEqual({ ...withdrawn, status: original?.status }, original);
  const listed = call<ClubMember[]>('GET', '/api/v1/club-members').find((m) => m.id === target);
  assert.equal(listed?.status, 'WITHDRAWN');
  assert.deepEqual(linkedRowCounts(db, target), before);
});

test('팀장이 아닌데 HOST 계정이 있으면 탈동 처리할 수 없고(409), 계정을 지우면 탈동 처리된다', async () => {
  const { db, call } = await setup();
  // 시드의 HOST 계정 host_c(계정 주인 u_27_01). 팀장 사유는 따로 보므로 팀장을 먼저 비운다.
  execute(db, 'UPDATE teams SET leader_id = NULL WHERE leader_id = ?', ['u_27_01']);
  const listed = call<ClubMember[]>('GET', '/api/v1/club-members').find((m) => m.id === 'u_27_01');
  assert.equal(listed?.hostUsernames, 'host_c');

  expectApiErrorCode(
    () => call('PATCH', '/api/v1/club-members/u_27_01', { status: 'WITHDRAWN' }),
    409,
    'MEMBER_HAS_HOST_ACCOUNT',
  );
  // 계정은 그대로이고 활동 상태도 바뀌지 않는다.
  assert.equal(queryAll(db, "SELECT 1 FROM host_accounts WHERE username = 'host_c'").length, 1);

  execute(db, "DELETE FROM host_accounts WHERE username = 'host_c'");
  assert.equal(
    call<ClubMember>('PATCH', '/api/v1/club-members/u_27_01', { status: 'WITHDRAWN' }).status,
    'WITHDRAWN',
  );
});

test('HOST 계정이 있는 현재 반기 팀장은 팀장 사유 하나로 409를 받고, 팀장을 바꾸라고 알린다', async () => {
  const { db, call } = await setup();
  const leader = currentLeaderOf(db);
  execute(db, 'DELETE FROM host_accounts WHERE user_id = ?', [leader.userId]);
  execute(
    db,
    "INSERT INTO host_accounts (id, username, initial_password, user_id, created_at) VALUES ('h_t', 'host_t', 'x', ?, '2026-10-25 10:00')",
    [leader.userId],
  );
  assert.throws(
    () => call('PATCH', `/api/v1/club-members/${leader.userId}`, { status: 'WITHDRAWN' }),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === 'MEMBER_IS_TEAM_LEADER' &&
      error.message.includes('HOST 계정 host_t') &&
      error.message.includes('팀장을 먼저 바꿔') &&
      !error.message.includes('그룹 계정 관리'),
  );
});

test('탈동 처리한 사람은 기수별 활동 페이지와 부문 페이지에서 빠진다', async () => {
  const { db, call } = await setup();
  const target = activeLeaderId(db);
  const { term, track } = queryAll<{ term: number; track: string }>(
    db,
    'SELECT term, track FROM users WHERE id = ?',
    [target],
  )[0];
  const pageOf = (query: string) =>
    call<ClubMemberTermPage>('GET', `${BY_TERM}?${query}&term=${term}`).members.map((m) => m.id);
  const trackQueryOf = `track=${encodeURIComponent(track)}`;
  assert.ok(pageOf('status=ACTIVE').includes(target));
  assert.ok(pageOf(trackQueryOf).includes(target));

  call('PATCH', `/api/v1/club-members/${target}`, { status: 'WITHDRAWN' });

  assert.ok(!pageOf('status=ACTIVE').includes(target));
  assert.ok(!pageOf('status=COMPLETED').includes(target));
  assert.ok(!pageOf(trackQueryOf).includes(target));
  assert.ok(!pageOf(`status=ACTIVE&${trackQueryOf}`).includes(target));
});

test('수료 회원도 탈동 처리하면 수료 페이지에서 빠진다', async () => {
  const { db, call } = await setup();
  const alumniId = queryAll<{ id: string }>(
    db,
    "SELECT id FROM users WHERE club_status = 'COMPLETED' AND term = 25 AND id NOT IN (SELECT user_id FROM admin) LIMIT 1",
  )[0].id;

  assert.equal(
    call<ClubMember>('PATCH', `/api/v1/club-members/${alumniId}`, { status: 'WITHDRAWN' }).status,
    'WITHDRAWN',
  );
  const page = call<ClubMemberTermPage>('GET', `${BY_TERM}?status=COMPLETED&term=25`);
  assert.ok(!page.members.some((m) => m.id === alumniId));
});

test('탈동 처리: 없는 회원은 404다', async () => {
  const { call } = await setup();

  expectApiError(() => call('PATCH', '/api/v1/club-members/u_none', { status: 'WITHDRAWN' }), 404);
});

test('운영진은 탈동 처리할 수 없다(409 MEMBER_IS_OPERATOR)', async () => {
  const { db, call } = await setup();
  const operatorId = queryAll<{ user_id: string }>(db, 'SELECT user_id FROM admin LIMIT 1')[0]
    .user_id;

  expectApiErrorCode(
    () => call('PATCH', `/api/v1/club-members/${operatorId}`, { status: 'WITHDRAWN' }),
    409,
    'MEMBER_IS_OPERATOR',
  );
  const operator = call<ClubMember[]>('GET', '/api/v1/club-members').find(
    (m) => m.id === operatorId,
  );
  assert.ok(operator);
  assert.notEqual(operator.status, 'WITHDRAWN');
});

// ── GET /api/v1/club-members/by-term (한 페이지 = 한 기수) ──────────────────

const TRACK_ORDER = ['분석', '시각화', '엔지니어링'];

function isTrackThenNameOrder(members: readonly ClubMember[]): boolean {
  return members.every((member, i) => {
    if (i === 0) return true;
    const prev = members[i - 1];
    const byTrack = TRACK_ORDER.indexOf(prev.track) - TRACK_ORDER.indexOf(member.track);
    if (byTrack !== 0) return byTrack < 0;
    if (prev.name !== member.name) return prev.name < member.name;
    return prev.id <= member.id;
  });
}

test('기수별 명단: term 없이 ACTIVE를 읽으면 가장 큰 활동 기수 한 페이지와 활동 기수 전체 목록을 준다', async () => {
  const { db, call } = await setup();
  const page = call<ClubMemberTermPage>('GET', `${BY_TERM}?status=ACTIVE`);
  const activeTerms = queryAll<{ term: number }>(
    db,
    "SELECT DISTINCT term FROM users WHERE club_status = 'ACTIVE' ORDER BY term DESC",
  ).map((row) => row.term);
  const expectedCount = queryAll<{ n: number }>(
    db,
    "SELECT COUNT(*) AS n FROM users WHERE club_status = 'ACTIVE' AND term = ?",
    [activeTerms[0]],
  )[0].n;

  assert.equal(page.status, 'ACTIVE');
  assert.equal(page.term, activeTerms[0]);
  assert.deepEqual(page.terms, activeTerms);
  assert.equal(page.members.length, expectedCount);
  assert.ok(page.members.length > 0);
  assert.ok(page.members.every((m) => m.term === page.term && m.status === 'ACTIVE'));
  assert.ok(isTrackThenNameOrder(page.members));
});

test('기수별 명단: ALUMNI와 수료 기수(25기)를 보내면 그 기수 수료자만 부문 → 이름 순으로 준다', async () => {
  const { db, call } = await setup();
  const page = call<ClubMemberTermPage>('GET', `${BY_TERM}?status=COMPLETED&term=25`);
  const expectedIds = queryAll<{ id: string }>(
    db,
    "SELECT id FROM users WHERE club_status = 'COMPLETED' AND term = 25",
  ).map((row) => row.id);

  assert.equal(page.status, 'COMPLETED');
  assert.equal(page.term, 25);
  assert.ok(page.terms.includes(25));
  assert.ok(page.members.length > 0);
  assert.deepEqual(page.members.map((m) => m.id).sort(), [...expectedIds].sort());
  assert.ok(page.members.every((m) => m.term === 25 && m.status === 'COMPLETED'));
  assert.ok(isTrackThenNameOrder(page.members));
});

test('기수별 명단: 탈동자와 다른 기수 사람은 섞이지 않는다', async () => {
  const { call } = await setup();
  // 시드에서 u_27_07·u_28_14는 27기 탈동이다.
  const page27 = call<ClubMemberTermPage>('GET', `${BY_TERM}?status=ACTIVE&term=27`);
  const page26 = call<ClubMemberTermPage>('GET', `${BY_TERM}?status=ACTIVE&term=26`);

  assert.equal(page27.term, 27);
  assert.ok(!page27.members.some((m) => m.id === 'u_27_07' || m.id === 'u_28_14'));
  assert.ok(page27.members.every((m) => m.term === 27 && m.status === 'ACTIVE'));
  assert.ok(page26.members.every((m) => m.term === 26 && m.status === 'ACTIVE'));
  assert.ok(!page27.members.some((m) => page26.members.some((o) => o.id === m.id)));
});

test('기수별 명단: 그 상태인 사람이 없는 기수를 보내면 term은 그대로, members는 빈 배열이다', async () => {
  const { call } = await setup();
  const activeEmpty = call<ClubMemberTermPage>('GET', `${BY_TERM}?status=ACTIVE&term=25`);
  const alumniEmpty = call<ClubMemberTermPage>('GET', `${BY_TERM}?status=COMPLETED&term=20`);

  assert.equal(activeEmpty.term, 25);
  assert.deepEqual(activeEmpty.members, []);
  assert.ok(!activeEmpty.terms.includes(25));
  assert.equal(alumniEmpty.term, 20);
  assert.deepEqual(alumniEmpty.members, []);
});

test('기수별 명단: status가 없거나 ACTIVE·ALUMNI가 아니거나 term이 1 이상 정수가 아니면 400', async () => {
  const { call } = await setup();
  const get = (query: string) => () => call('GET', `${BY_TERM}${query}`);

  expectApiError(get(''), 400);
  expectApiError(get('?term=28'), 400);
  expectApiError(get('?status=WITHDRAWN'), 400);
  expectApiError(get('?status=ACTIVE&term=0'), 400);
  expectApiError(get('?status=ACTIVE&term=abc'), 400);
  expectApiError(get('?status=ACTIVE&term=1.5'), 400);
});

test('기수별 명단: 동아리원을 추가하면 그 기수 페이지에 나타난다', async () => {
  const { call } = await setup();
  const created = call<ClubMember>('POST', '/api/v1/club-members', {
    name: '홍길동',
    email: 'gildong@example.com',
    phone: '010-0000-0000',
    university: '',
    major: '',
    term: 20,
    track: '시각화',
    status: 'COMPLETED',
  });

  const page = call<ClubMemberTermPage>('GET', `${BY_TERM}?status=COMPLETED&term=20`);
  assert.ok(page.members.some((m) => m.id === created.id));
  assert.ok(page.terms.includes(20));
});

test('기수별 명단: 활동 상태를 ALUMNI로 바꾸면 ACTIVE 페이지에서 빠지고 COMPLETED 페이지에 나타난다', async () => {
  const { call } = await setup();
  call('PATCH', '/api/v1/club-members/u_28_01', { status: 'COMPLETED' });

  const active = call<ClubMemberTermPage>('GET', `${BY_TERM}?status=ACTIVE&term=27`);
  const alumni = call<ClubMemberTermPage>('GET', `${BY_TERM}?status=COMPLETED&term=27`);

  assert.ok(!active.members.some((m) => m.id === 'u_28_01'));
  assert.ok(alumni.members.some((m) => m.id === 'u_28_01'));
  assert.ok(alumni.terms.includes(27));
});

// ── by-term의 track 조건 (2026-10-22 변경 계약) ──────────────────────────────

const STATUS_ORDER = ['ACTIVE', 'COMPLETED'];

/** 활동 상태(활동 → 수료) → 부문 → 이름 → id 순인지 본다. */
function isStatusTrackNameOrder(members: readonly ClubMember[]): boolean {
  return members.every((member, i) => {
    if (i === 0) return true;
    const prev = members[i - 1];
    const byStatus = STATUS_ORDER.indexOf(prev.status) - STATUS_ORDER.indexOf(member.status);
    if (byStatus !== 0) return byStatus < 0;
    const byTrack = TRACK_ORDER.indexOf(prev.track) - TRACK_ORDER.indexOf(member.track);
    if (byTrack !== 0) return byTrack < 0;
    if (prev.name !== member.name) return prev.name < member.name;
    return prev.id <= member.id;
  });
}

const trackQuery = (track: string) => `track=${encodeURIComponent(track)}`;

test('기수별 명단(track): status 없이 track=분석만 보내면 분석 부문의 활동·수료자만 활동 → 수료 → 이름 순으로 준다', async () => {
  const { db, call } = await setup();
  // 시드의 27기 분석은 모두 활동이라, 한 명을 수료로 바꿔 같은 기수에 활동·수료가 섞이게 한다.
  const activeAnalysts = queryAll<{ id: string }>(
    db,
    "SELECT id FROM users WHERE track = '분석' AND term = 27 AND club_status = 'ACTIVE' ORDER BY name DESC",
  );
  const toAlumni = activeAnalysts[0].id;
  call('PATCH', `/api/v1/club-members/${toAlumni}`, { status: 'COMPLETED' });
  const withdrawnIds = queryAll<{ id: string }>(
    db,
    "SELECT id FROM users WHERE track = '분석' AND term = 27 AND club_status = 'WITHDRAWN'",
  ).map((row) => row.id);
  const expectedIds = queryAll<{ id: string }>(
    db,
    "SELECT id FROM users WHERE track = '분석' AND term = 27 AND club_status IN ('ACTIVE', 'COMPLETED')",
  ).map((row) => row.id);

  const page = call<ClubMemberTermPage>('GET', `${BY_TERM}?${trackQuery('분석')}&term=27`);

  assert.equal(page.status, null);
  assert.equal(page.track, '분석');
  assert.equal(page.term, 27);
  assert.ok(withdrawnIds.length > 0, '시드에 27기 분석 탈동자가 있어야 한다');
  assert.ok(!page.members.some((m) => withdrawnIds.includes(m.id)));
  assert.ok(page.members.every((m) => m.track === '분석' && m.term === 27));
  assert.ok(page.members.every((m) => m.status === 'ACTIVE' || m.status === 'COMPLETED'));
  assert.deepEqual(page.members.map((m) => m.id).sort(), [...expectedIds].sort());
  assert.ok(isStatusTrackNameOrder(page.members));
  // 수료로 바꾼 사람은 이름이 가장 뒤가 아니어도 활동자 뒤에 온다.
  assert.equal(page.members.at(-1)?.id, toAlumni);
  assert.equal(page.members.at(-1)?.status, 'COMPLETED');
});

test('기수별 명단(track): track만 보내면 terms는 그 부문 활동·수료자가 있는 기수 전체 큰 순, term이 없으면 terms[0] 페이지다', async () => {
  const { db, call } = await setup();
  // 20기 분석 탈동자, 19기 시각화 수료자를 넣는다. 분석 terms에는 둘 다 들어가면 안 된다.
  const base = { phone: '010-0000-0000', university: '', major: '' };
  // 탈동으로 바로 추가할 수는 없으므로 추가한 뒤 탈동 처리한다.
  const withdrawnId = call<ClubMember>('POST', '/api/v1/club-members', {
    ...base,
    email: 'w20@example.com',
    name: '탈동분석',
    term: 20,
    track: '분석',
  }).id;
  call('PATCH', `/api/v1/club-members/${withdrawnId}`, { status: 'WITHDRAWN' });
  call('POST', '/api/v1/club-members', {
    ...base,
    email: 'a19@example.com',
    name: '수료시각화',
    term: 19,
    track: '시각화',
    status: 'COMPLETED',
  });
  const expectedTerms = queryAll<{ term: number }>(
    db,
    "SELECT DISTINCT term FROM users WHERE track = '분석' AND club_status IN ('ACTIVE', 'COMPLETED') ORDER BY term DESC",
  ).map((row) => row.term);

  const page = call<ClubMemberTermPage>('GET', `${BY_TERM}?${trackQuery('분석')}`);

  assert.deepEqual(page.terms, expectedTerms);
  assert.ok(!page.terms.includes(20));
  assert.ok(!page.terms.includes(19));
  assert.ok(page.terms.includes(25), '분석 25기 수료자가 있으므로 25기가 들어간다');
  assert.equal(page.term, expectedTerms[0]);
  assert.ok(page.members.length > 0);
  assert.ok(page.members.every((m) => m.term === expectedTerms[0] && m.track === '분석'));

  const visual = call<ClubMemberTermPage>('GET', `${BY_TERM}?${trackQuery('시각화')}`);
  assert.ok(visual.terms.includes(19));
});

test('기수별 명단(track): status와 track을 함께 보내면 두 조건을 모두 만족하는 사람만 준다', async () => {
  const { db, call } = await setup();
  const expectedIds = queryAll<{ id: string }>(
    db,
    "SELECT id FROM users WHERE track = '시각화' AND term = 26 AND club_status = 'ACTIVE'",
  ).map((row) => row.id);
  const expectedTerms = queryAll<{ term: number }>(
    db,
    "SELECT DISTINCT term FROM users WHERE track = '시각화' AND club_status = 'ACTIVE' ORDER BY term DESC",
  ).map((row) => row.term);

  const page = call<ClubMemberTermPage>(
    'GET',
    `${BY_TERM}?status=ACTIVE&${trackQuery('시각화')}&term=26`,
  );

  assert.equal(page.status, 'ACTIVE');
  assert.equal(page.track, '시각화');
  assert.equal(page.term, 26);
  assert.deepEqual(page.terms, expectedTerms);
  assert.ok(expectedIds.length > 0);
  assert.deepEqual(page.members.map((m) => m.id).sort(), [...expectedIds].sort());
  assert.ok(page.members.every((m) => m.status === 'ACTIVE' && m.track === '시각화'));
  assert.ok(isStatusTrackNameOrder(page.members));

  // 수료 + 엔지니어링: term이 없으면 그 조건의 가장 큰 기수(25기)다.
  const alumni = call<ClubMemberTermPage>(
    'GET',
    `${BY_TERM}?status=COMPLETED&${trackQuery('엔지니어링')}`,
  );
  assert.equal(alumni.term, 25);
  assert.deepEqual(alumni.terms, [25]);
  assert.ok(alumni.members.length > 0);
  assert.ok(alumni.members.every((m) => m.status === 'COMPLETED' && m.track === '엔지니어링'));
});

test('기수별 명단(track): status만 보내면 응답의 track은 null이다', async () => {
  const { call } = await setup();
  const page = call<ClubMemberTermPage>('GET', `${BY_TERM}?status=ACTIVE`);

  assert.equal(page.status, 'ACTIVE');
  assert.equal(page.track, null);
});

test('기수별 명단(track): status·track이 둘 다 없거나 track이 세 부문이 아니면 400', async () => {
  const { call } = await setup();
  const get = (query: string) => () => call('GET', `${BY_TERM}${query}`);

  expectApiError(get(''), 400);
  expectApiError(get('?term=27'), 400);
  expectApiError(get(`?${trackQuery('기획')}`), 400);
  expectApiError(get('?track=ANALYSIS'), 400);
  expectApiError(get(`?status=ACTIVE&${trackQuery('기획')}`), 400);
  expectApiError(get(`?status=WITHDRAWN&${trackQuery('분석')}`), 400);
  expectApiError(get(`?${trackQuery('분석')}&term=0`), 400);
});

test('활동 상태를 미수료(NOT_COMPLETED)로 바꿀 수 있고, 기수별 명단에는 나오지 않는다', async () => {
  const { call } = await setup();

  const updated = call<ClubMember>('PATCH', '/api/v1/club-members/u_28_01', {
    status: 'NOT_COMPLETED',
  });

  assert.equal(updated.status, 'NOT_COMPLETED');
  for (const status of ['ACTIVE', 'COMPLETED']) {
    const page = call<{ members: ClubMember[] }>(
      'GET',
      `/api/v1/club-members/by-term?status=${status}`,
    );
    assert.ok(!page.members.some((member) => member.id === 'u_28_01'));
  }
});

test('활동 중인 회원의 이름·기수·부문은 고칠 수 없고(400 ACTIVE_MEMBER_IDENTITY_LOCKED) 연락처는 고칠 수 있다', async () => {
  const { call } = await setup();
  const before = call<ClubMember[]>('GET', '/api/v1/club-members').find((m) => m.id === 'u_28_01')!;
  assert.equal(before.status, 'ACTIVE');

  for (const body of [{ name: '홍길동' }, { term: 26 }, { track: '시각화' }]) {
    expectApiErrorCode(
      () => call('PATCH', '/api/v1/club-members/u_28_01', body),
      400,
      'ACTIVE_MEMBER_IDENTITY_LOCKED',
    );
  }
  // 같은 값을 보내는 것은 바꾸는 것이 아니라 통과한다.
  call('PATCH', '/api/v1/club-members/u_28_01', { name: before.name, phone: '010-0000-0000' });
});

/** 반기 명단·로그인 계정·팀장 어디에도 걸리지 않은, 잘못 등록한 회원을 하나 만든다. */
function addMistakenMember(call: Awaited<ReturnType<typeof setup>>['call']): ClubMember {
  return call<ClubMember>('POST', '/api/v1/club-members', {
    name: '잘못등록',
    email: 'wrong@example.com',
    phone: '010-0000-0000',
    term: 27,
    track: '분석',
  });
}

test('삭제(DELETE)는 잘못 등록한 회원을 목록에서 지우고, 다시 읽으면 404다', async () => {
  const { db, call } = await setup();
  const mistaken = addMistakenMember(call);
  // 추가하면 활동 명단 행이 생기므로, 반기 명단에 오르지 않은 상태인지 확인한다.
  assert.equal(
    queryAll(db, 'SELECT 1 FROM semester_members WHERE user_id = ?', [mistaken.id]).length,
    0,
  );

  call('DELETE', `/api/v1/club-members/${mistaken.id}`);

  assert.ok(!call<ClubMember[]>('GET', '/api/v1/club-members').some((m) => m.id === mistaken.id));
  expectApiError(
    () => call('PATCH', `/api/v1/club-members/${mistaken.id}`, { major: '통계학' }),
    404,
  );
  // 행은 남는다(soft delete).
  assert.equal(queryAll(db, 'SELECT 1 FROM users WHERE id = ?', [mistaken.id]).length, 1);
});

test('반기 명단에 오른 회원과 운영진은 삭제할 수 없다(409)', async () => {
  const { db, call } = await setup();
  const enrolled = queryAll<{ user_id: string }>(
    db,
    `SELECT user_id FROM semester_members
      WHERE user_id NOT IN (SELECT user_id FROM admin) LIMIT 1`,
  )[0].user_id;
  const operator = queryAll<{ user_id: string }>(db, 'SELECT user_id FROM admin LIMIT 1')[0]
    .user_id;

  expectApiErrorCode(
    () => call('DELETE', `/api/v1/club-members/${enrolled}`),
    409,
    'MEMBER_HAS_ENROLLMENTS',
  );
  expectApiErrorCode(
    () => call('DELETE', `/api/v1/club-members/${operator}`),
    409,
    'MEMBER_IS_OPERATOR',
  );
});

test('잘못 등록해 지운 회원과 같은 이름·기수로 다시 등록할 수 있다', async () => {
  const { call } = await setup();
  const mistaken = addMistakenMember(call);
  call('DELETE', `/api/v1/club-members/${mistaken.id}`);

  const again = addMistakenMember(call);

  assert.notEqual(again.id, mistaken.id);
  assert.equal(again.name, mistaken.name);
});

test('수료·탈동에서 활동으로 되돌리면서 이름·기수·부문을 함께 바꿀 수는 없다', async () => {
  const { call } = await setup();
  call('PATCH', '/api/v1/club-members/u_28_01', { status: 'COMPLETED' });

  expectApiErrorCode(
    () => call('PATCH', '/api/v1/club-members/u_28_01', { status: 'ACTIVE', track: '시각화' }),
    400,
    'ACTIVE_MEMBER_IDENTITY_LOCKED',
  );
});

test('생년월일·병행 부문은 추가·수정으로 저장되고, null이면 지우고 보내지 않으면 그대로다', async () => {
  const { call } = await setup();
  const created = call<ClubMember>('POST', '/api/v1/club-members', {
    name: '홍길동',
    email: 'gildong@example.com',
    phone: '010-0000-0000',
    term: 20,
    track: '시각화',
    status: 'COMPLETED',
    birthDate: '2000-01-31',
    parallelTrack: '분석',
  });
  assert.equal(created.birthDate, '2000-01-31');
  assert.equal(created.parallelTrack, '분석');

  const path = `/api/v1/club-members/${created.id}`;
  const kept = call<ClubMember>('PATCH', path, { major: '통계학' });
  assert.equal(kept.birthDate, '2000-01-31');
  assert.equal(kept.parallelTrack, '분석');

  const cleared = call<ClubMember>('PATCH', path, { birthDate: null, parallelTrack: null });
  assert.equal(cleared.birthDate, null);
  assert.equal(cleared.parallelTrack, null);
});

test('생년월일 형식이 틀리거나 병행 부문이 부문과 같으면 400이다', async () => {
  const { call } = await setup();
  const path = '/api/v1/club-members/u_28_01';
  const track = call<ClubMember[]>('GET', '/api/v1/club-members').find(
    (m) => m.id === 'u_28_01',
  )?.track;

  expectApiError(() => call('PATCH', path, { birthDate: '' }), 400);
  expectApiError(() => call('PATCH', path, { birthDate: '2000/01/31' }), 400);
  expectApiError(() => call('PATCH', path, { parallelTrack: '없는부문' }), 400);
  expectApiError(() => call('PATCH', path, { parallelTrack: track }), 400);
});
