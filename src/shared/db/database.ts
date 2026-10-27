import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

import eventSchemaSql from '../../../db/event-schema.sql?raw';
import eventSeedSql from '../../../db/event-seed.sql?raw';
import schemaSql from '../../../db/schema.sql?raw';
import seedSql from '../../../db/seed.sql?raw';

import { createDatabase } from './createDatabase';

let databasePromise: Promise<Database> | null = null;

/**
 * 앱 전체가 공유하는 임시 DB. 처음 호출될 때 만든다(새로고침하면 예시 데이터 상태로 초기화).
 * 유저 DB(schema.sql + seed.sql)와 행사 DB(event-schema.sql + event-seed.sql)를 따로 정의하고,
 * 임시 구현에서는 한 SQLite에 함께 올린다. 행사 DB 쪽은 유저 DB 테이블과 외래 키·조인 없이 동작한다.
 *
 * [개발용 테스트 계정 추가]
 * - 기존 스키마 및 시드 데이터를 모두 불러온 후, 개발 환경(DEV)에서만 seed.dev.sql을 추가 실행한다.
 * - 전체 일반 권한 테스트 계정(boaz_dev_all)과 해당 계정의 권한 설정을 추가한다.
 * - 기존 회원·관리자·행사 데이터 및 권한 검사 로직은 변경하지 않는다.
 * - 일반 배포 환경에서는 개발용 시드 데이터를 실행하지 않는다.
 */
export function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = initSqlJs({
      locateFile: () => sqlWasmUrl,
    })
      .then(async (SQL) => {
        const db = createDatabase(
          SQL,
          `${schemaSql}\n${eventSchemaSql}`,
          `${seedSql}\n${eventSeedSql}`,
        );

        if (import.meta.env.DEV) {
          const { default: devSeedSql } = await import('../../../db/seed-dev.sql?raw');

          db.run(devSeedSql);
        }

        return db;
      })
      .catch((error: unknown) => {
        databasePromise = null;
        throw error;
      });
  }

  return databasePromise;
}
