/**
 * 임시 API 요청 처리. client.ts가 VITE_API_BASE_URL이 없을 때 이 함수로 요청을 넘긴다.
 * 응답은 복사본을 돌려줘 화면이 응답 객체를 고쳐도 DB에 영향이 없게 한다(실제 네트워크 응답과 같다).
 */
import { getDatabase } from '@/shared/db/database';

import { recordWrite } from './audit';
import { MOCK_ROUTES } from './mockRoutes';
import { createRouter, type HttpMethod } from './router';

// 쓰기 요청은 성공하면 감사 로그에 남긴다(audit.ts).
const router = createRouter(MOCK_ROUTES, { aroundWrite: recordWrite });

export async function mockRequest<T>(method: HttpMethod, path: string, body: unknown): Promise<T> {
  const db = await getDatabase();
  const result = router.dispatch(db, method, path, body);
  return (result === undefined ? undefined : structuredClone(result)) as T;
}
