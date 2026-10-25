import type { InternalCategory } from '../ui/InternalCategoryAttendancePage';

/** BASE·스터디·ADV 출결 관리 페이지 제목. 페이지와 읽는 중 틀이 같은 제목을 쓴다. */
export const CATEGORY_TITLES: Readonly<Record<InternalCategory, string>> = {
  SESSION: 'BASE Term 출결 관리',
  STUDY: '스터디 출결 관리',
  ADV: 'ADV Term 출결 관리',
};
