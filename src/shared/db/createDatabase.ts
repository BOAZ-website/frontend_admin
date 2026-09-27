import type { Database, SqlJsStatic } from 'sql.js';

/** 빈 SQLite DB를 만들고 스키마와 시드(mock 데이터)를 순서대로 실행한다. */
export function createDatabase(SQL: SqlJsStatic, schemaSql: string, seedSql: string): Database {
  const db = new SQL.Database();
  db.run(schemaSql);
  db.run(seedSql);
  return db;
}

type SqlValue = string | number | null;

/** SELECT 결과를 객체 배열로 돌려준다. 값은 항상 바인딩 파라미터로 넘긴다(SQL 문자열 연결 금지). */
export function queryAll<T extends Record<string, unknown>>(
  db: Database,
  sql: string,
  params: SqlValue[] = [],
): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

/** INSERT / UPDATE / DELETE 실행. */
export function execute(db: Database, sql: string, params: SqlValue[] = []): void {
  db.run(sql, params);
}

/** 여러 쓰기를 한 트랜잭션으로 묶는다. 실패하면 되돌리고 오류를 다시 던진다. */
export function inTransaction<T>(db: Database, work: () => T): T {
  db.run('BEGIN');
  try {
    const result = work();
    db.run('COMMIT');
    return result;
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }
}
