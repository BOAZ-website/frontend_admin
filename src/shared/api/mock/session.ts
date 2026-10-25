/**
 * 임시 API의 로그인 세션 흉내. DB마다 로그인한 계정 하나를 기억한다. 실제 서버는 토큰으로 요청자를 안다.
 * 세션이 없으면(로그인 전, 로그아웃 뒤) 요청자가 없다. 요청자가 필요한 API는 401 UNAUTHORIZED로 거절한다.
 * 새로고침하면 DB가 새로 만들어져 세션도 사라진다(개발 모드에서는 화면이 저장해 둔 아이디로 되살린다).
 */
import type { Database } from 'sql.js';

export type MockSession = { kind: 'ADMIN'; adminId: number } | { kind: 'HOST'; hostId: string };

const sessions = new WeakMap<Database, MockSession>();

export const currentSession = (db: Database): MockSession | null => sessions.get(db) ?? null;

export const setSession = (db: Database, session: MockSession): void => {
  sessions.set(db, session);
};

export const clearSession = (db: Database): void => {
  sessions.delete(db);
};
