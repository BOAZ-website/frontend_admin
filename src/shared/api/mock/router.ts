/**
 * 임시 API 라우터. `GET /api/v1/...` 같은 요청을 받아 등록된 핸들러로 보내고,
 * 쓰기 요청(POST·PUT·PATCH·DELETE)은 한 트랜잭션으로 묶어 실패하면 DB를 되돌린다.
 * VITE_API_BASE_URL이 없을 때만 client.ts가 이 라우터를 쓰고, 있으면 같은 경로를 fetch로 서버에 보낸다.
 */
import type { Database } from 'sql.js';

import { inTransaction } from '@/shared/db/createDatabase';

import { ApiError, type HttpMethod } from '../apiError';

export { ApiError, type HttpMethod };

export interface MockRequest {
  method: HttpMethod;
  path: string;
  params: Readonly<Record<string, string>>;
  query: URLSearchParams;
  body: unknown;
  db: Database;
}

export interface MockRoute {
  method: HttpMethod;
  /** 예: '/api/v1/study-teams/:teamId/members/:memberId' */
  pattern: string;
  /** 어떤 기능의 API인지 한 줄 설명. 엔드포인트 목록을 볼 때 쓴다. */
  summary: string;
  handler: (request: MockRequest) => unknown;
}

interface CompiledRoute extends MockRoute {
  regex: RegExp;
  paramNames: string[];
}

function compile(route: MockRoute): CompiledRoute {
  const paramNames: string[] = [];
  const source = route.pattern
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      paramNames.push(segment.slice(1));
      return '([^/]+)';
    })
    .join('/');
  return { ...route, regex: new RegExp(`^${source}/?$`), paramNames };
}

/** SQLite 제약 위반을 백엔드가 돌려줄 법한 HTTP 오류로 바꾼다. */
function toApiError(error: unknown): unknown {
  if (error instanceof ApiError || !(error instanceof Error)) return error;
  if (error.message.includes('UNIQUE constraint failed')) {
    return new ApiError(409, 'CONFLICT', '이미 같은 값이 등록되어 있습니다.');
  }
  if (error.message.includes('FOREIGN KEY constraint failed')) {
    return new ApiError(400, 'INVALID_REFERENCE', '존재하지 않는 대상을 가리키고 있습니다.');
  }
  if (error.message.includes('CHECK constraint failed')) {
    return new ApiError(400, 'INVALID_VALUE', '허용되지 않는 값이 포함되어 있습니다.');
  }
  return error;
}

export function createRouter(routes: readonly MockRoute[]) {
  const compiled = routes.map(compile);

  return {
    routes,
    dispatch(db: Database, method: HttpMethod, url: string, body: unknown): unknown {
      const { pathname, searchParams } = new URL(url, 'http://mock.local');
      const path = decodeURI(pathname);
      const matchedPath = compiled.filter((route) => route.regex.test(path));
      const route = matchedPath.find((item) => item.method === method);
      if (!route) {
        throw matchedPath.length > 0
          ? new ApiError(405, 'METHOD_NOT_ALLOWED', `${method} ${path}는 지원하지 않습니다.`)
          : new ApiError(404, 'ROUTE_NOT_FOUND', `${method} ${path} 경로가 없습니다.`);
      }

      const values = route.regex.exec(path)?.slice(1) ?? [];
      const params = Object.fromEntries(
        route.paramNames.map((name, index) => [name, decodeURIComponent(values[index])]),
      );
      const request: MockRequest = { method, path, params, query: searchParams, body, db };
      try {
        return method === 'GET'
          ? route.handler(request)
          : inTransaction(db, () => route.handler(request));
      } catch (error) {
        throw toApiError(error);
      }
    },
  };
}
