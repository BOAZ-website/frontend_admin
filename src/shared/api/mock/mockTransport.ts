/**
 * 임시 API 요청 처리. client.ts가 VITE_API_BASE_URL이 없을 때 이 함수로 요청을 넘긴다.
 * 응답은 복사본을 돌려줘 화면이 응답 객체를 고쳐도 DB에 영향이 없게 한다(실제 네트워크 응답과 같다).
 */
import { getDatabase } from '@/shared/db/database';

import { createRouter, type HttpMethod, type MockRoute } from './router';
import { adminAccountRoutes } from './routes/adminAccountRoutes';
import { authRoutes } from './routes/authRoutes';
import { clubMemberRoutes } from './routes/clubMemberRoutes';
import { commonRoutes } from './routes/commonRoutes';
import { eventRoutes } from './routes/eventRoutes';
import { hostRoutes } from './routes/hostRoutes';
import { scoreRoutes } from './routes/scoreRoutes';
import { scoreRuleRoutes } from './routes/scoreRuleRoutes';
import { scoreSheetRoutes } from './routes/scoreSheetRoutes';
import { teamAttendanceRoutes } from './routes/teamAttendanceRoutes';
import { teamRoutes } from './routes/teamRoutes';
import { userRoutes } from './routes/userRoutes';

/** 임시 API 전체 경로 목록. 경로·설명은 리소스별 routes 파일에 함께 적혀 있다. */
export const MOCK_ROUTES: readonly MockRoute[] = [
  ...commonRoutes,
  ...userRoutes,
  ...teamRoutes,
  ...teamAttendanceRoutes,
  ...scoreRoutes,
  ...scoreRuleRoutes,
  ...scoreSheetRoutes,
  ...hostRoutes,
  ...eventRoutes,
  ...clubMemberRoutes,
  ...adminAccountRoutes,
  ...authRoutes,
];

const router = createRouter(MOCK_ROUTES);

export async function mockRequest<T>(method: HttpMethod, path: string, body: unknown): Promise<T> {
  const db = await getDatabase();
  const result = router.dispatch(db, method, path, body);
  return (result === undefined ? undefined : structuredClone(result)) as T;
}
