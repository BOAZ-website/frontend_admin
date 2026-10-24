/**
 * 임시 API의 로그인 세션 흉내. DB마다 로그인한 계정 하나를 기억한다. 실제 서버는 토큰으로 요청자를 안다.
 * 세션이 없으면(로그인 전, 로그아웃 뒤) 1번 운영진 계정(서비스운영팀장)으로 본다.
 * 새로고침하면 DB가 새로 만들어져 세션도 사라진다(화면은 저장해 둔 아이디로 되살린다).
 */
import type { Database } from 'sql.js';

export type MockSession = { kind: 'ADMIN'; adminId: number } | { kind: 'HOST'; hostId: string };

/** 세션이 없을 때 보는 운영진 계정 id. */
export const DEFAULT_ADMIN_ID = 1;

const sessions = new WeakMap<Database, MockSession>();

export const currentSession = (db: Database): MockSession =>
  sessions.get(db) ?? { kind: 'ADMIN', adminId: DEFAULT_ADMIN_ID };

export const setSession = (db: Database, session: MockSession): void => {
  sessions.set(db, session);
};

export const clearSession = (db: Database): void => {
  sessions.delete(db);
};
