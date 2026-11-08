import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';

import type { AuditLogPage } from '../src/entities/audit-log/model/dto';
import { recordWrite } from '../src/shared/api/mock/audit';
import { MOCK_ROUTES } from '../src/shared/api/mock/mockRoutes';
import { createRouter } from '../src/shared/api/mock/router';
import { createDatabase } from '../src/shared/db/createDatabase';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

async function setup() {
  const SQL = await initSqlJs();
  const db = createDatabase(SQL, schema, seed);
  const router = createRouter(MOCK_ROUTES, { aroundWrite: recordWrite });
  const call = <T>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown) =>
    router.dispatch(db, method, path, body) as T;
  // 임시 API는 세션이 없으면 요청자가 없다. 시험은 1번 계정으로 로그인한 채 시작한다.
  call('PUT', '/api/v1/mock/admin-session', { accountId: 1 });
  const latest = () => call<AuditLogPage>('GET', '/api/v1/admin/audit-logs?size=1').items[0];
  return { call, latest };
}

test('동아리원 생년월일(birthDate)은 감사 기록에서 (비공개)로 가리고 병행 부문은 그대로 남긴다', async () => {
  const { call, latest } = await setup();
  call('POST', '/api/v1/club-members', {
    name: '홍길동',
    email: 'gildong@example.com',
    phone: '010-0000-0000',
    term: 20,
    track: '시각화',
    status: 'COMPLETED',
    birthDate: '2000-01-31',
    parallelTrack: '분석',
  });
  const entry = latest();

  assert.equal(entry.requestBody?.birthDate, '(비공개)');
  assert.equal(entry.requestBody?.parallelTrack, '분석');
  assert.ok(!JSON.stringify(entry).includes('2000-01-31'));
});
