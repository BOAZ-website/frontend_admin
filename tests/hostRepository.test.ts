import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

import { loadHosts, persistHosts } from '../src/entities/host-account/api/hostRepository';
import type { HostAccount } from '../src/entities/host-account/model/types';
import { createDatabase, queryAll } from '../src/shared/db/createDatabase';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

async function freshDb(): Promise<Database> {
  const SQL = await initSqlJs();
  return createDatabase(SQL, schema, seed);
}

function newHost(overrides: Partial<HostAccount> = {}): HostAccount {
  return {
    id: 'h_new',
    username: 'host_new',
    initialPassword: 'pw!',
    hostName: '홍길동',
    generation: '27기',
    track: '분석',
    role: '그룹리더',
    team: '분석 2팀',
    teamId: 'adv_t2',
    groupType: 'ADV',
    permissions: ['ADV'],
    assignedGroups: [{ type: 'ADV', teamName: '분석 2팀', teamId: 'adv_t2' }],
    createdAt: '2026-09-01',
    active: true,
    accountType: 'ADV',
    ...overrides,
  };
}

test('시드의 HOST 계정과 팀 이름, 권한·담당 그룹·겸직이 읽힌다', async () => {
  const hosts = loadHosts(await freshDb());

  assert.equal(hosts.length, 6);
  const adv = hosts.find((host) => host.id === 'h_adv1');
  assert.ok(adv);
  // 담당 팀은 스터디·ADV 출결이 쓰는 teams 테이블을 가리키고, 이름·구분은 거기서 읽는다.
  assert.equal(adv.teamId, 'adv_t1');
  assert.equal(adv.team, '분석 1팀');
  assert.equal(adv.userId, 'u_27_02');
  assert.equal(adv.hostName, '고준서');
  assert.equal(adv.generation, '27기');
  assert.equal(adv.track, '분석');
  assert.deepEqual(adv.permissions, ['ADV', 'STUDY']);
  assert.deepEqual(adv.assignedGroups, [
    { type: 'ADV', teamName: '분석 1팀', teamId: 'adv_t1' },
    { type: '스터디', teamName: 'LLM Agent & RAG 스터디', teamId: 'study_d' },
  ]);
  assert.deepEqual(adv.concurrentRoles, ['운영진', 'LLM Agent & RAG 스터디']);

  // 값이 없는 항목은 키가 없다(빈 목록과 다르게 취급된다).
  const study = hosts.find((host) => host.id === 'h3');
  assert.ok(study);
  assert.equal('concurrentRoles' in study, false);
  assert.equal('assignedGroups' in study, false);
});

test('계정을 발급하면 팀 이름과 자식 정보가 함께 저장된다', async () => {
  const db = await freshDb();
  const before = loadHosts(db);

  persistHosts(db, before, [...before, newHost({ concurrentRoles: ['운영진'] })]);
  const saved = loadHosts(db).find((host) => host.id === 'h_new');

  assert.ok(saved);
  assert.equal(saved.team, '분석 2팀');
  assert.equal(saved.teamId, 'adv_t2');
  assert.deepEqual(saved.permissions, ['ADV']);
  assert.deepEqual(saved.concurrentRoles, ['운영진']);
  assert.equal(saved.active, true);
});

test('계정을 고치면 자식 정보가 다시 쓰이고, 삭제하면 함께 지워진다', async () => {
  const db = await freshDb();
  const before = loadHosts(db);

  const changed = before.map((host) =>
    host.id === 'h_adv1'
      ? {
          ...host,
          team: '분석 3팀',
          teamId: 'adv_t3',
          permissions: ['ADV' as const],
          assignedGroups: [{ type: 'ADV', teamName: '분석 3팀', teamId: 'adv_t3' }],
        }
      : host,
  );
  persistHosts(db, before, changed);
  const edited = loadHosts(db).find((host) => host.id === 'h_adv1');
  assert.equal(edited?.team, '분석 3팀');
  assert.equal(edited?.teamId, 'adv_t3');
  assert.deepEqual(edited?.permissions, ['ADV']);
  assert.equal(edited?.assignedGroups?.length, 1);

  persistHosts(
    db,
    changed,
    changed.filter((host) => host.id !== 'h_adv1'),
  );
  assert.equal(
    loadHosts(db).some((host) => host.id === 'h_adv1'),
    false,
  );
  assert.equal(
    queryAll(db, 'SELECT 1 FROM host_permissions WHERE host_id = ?', ['h_adv1']).length,
    0,
  );
});

test('같은 아이디의 계정은 만들 수 없다', async () => {
  const db = await freshDb();
  const before = loadHosts(db);

  assert.throws(() =>
    persistHosts(db, before, [...before, newHost({ id: 'h_dup', username: 'host_a' })]),
  );
  assert.equal(loadHosts(db).length, 6);
});

test('팀 id 없이 이름만 있어도 teams에서 같은 이름의 팀을 찾아 잇는다', async () => {
  const db = await freshDb();
  const before = loadHosts(db);

  persistHosts(db, before, [
    ...before,
    newHost({
      id: 'h_byname',
      username: 'host_byname',
      teamId: undefined,
      team: '시각화 2팀',
      assignedGroups: [],
    }),
    newHost({
      id: 'h_none',
      username: 'host_none',
      teamId: undefined,
      team: '없는 팀',
      assignedGroups: [],
    }),
  ]);
  const hosts = loadHosts(db);

  assert.equal(hosts.find((host) => host.id === 'h_byname')?.teamId, 'adv_t5');
  // 없는 팀이면 팀 없음(팀 개설 대기)으로 저장된다.
  const waiting = hosts.find((host) => host.id === 'h_none');
  assert.equal(waiting?.teamId, undefined);
  assert.equal(waiting?.team, '');
});

test('팀이 지워지면 계정은 남고 그 팀 연결만 사라진다', async () => {
  const db = await freshDb();
  db.run("DELETE FROM teams WHERE id = 'adv_t1'");

  const adv = loadHosts(db).find((host) => host.id === 'h_adv1');
  assert.ok(adv);
  assert.equal(adv.teamId, undefined);
  assert.deepEqual(
    adv.assignedGroups?.map((group) => group.teamId),
    ['study_d'],
  );
});
