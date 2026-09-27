import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

import schemaSql from '../../../db/schema.sql?raw';
import seedSql from '../../../db/seed.sql?raw';

import { createDatabase } from './createDatabase';

let databasePromise: Promise<Database> | null = null;

/** 앱 전체가 공유하는 임시 DB. 처음 호출될 때 schema.sql + seed.sql로 만든다(새로고침하면 seed 상태로 초기화). */
export function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = initSqlJs({ locateFile: () => sqlWasmUrl }).then((SQL) =>
      createDatabase(SQL, schemaSql, seedSql),
    );
  }
  return databasePromise;
}
