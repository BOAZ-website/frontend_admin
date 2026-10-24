/**
 * 임시 API 전체 경로 목록. 경로·설명은 리소스별 routes 파일에 함께 적혀 있다.
 * DB를 불러오지 않는 모듈이라 테스트에서도 그대로 가져다 쓴다.
 */
import type { MockRoute } from './router';
import { adminAccountRoutes } from './routes/adminAccountRoutes';
import { auditLogRoutes } from './routes/auditLogRoutes';
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

export const MOCK_ROUTES: readonly MockRoute[] = [
  ...authRoutes,
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
  ...auditLogRoutes,
];
