import { fetchMyAccount } from '@/entities/admin-account/api/adminAccountApi';
import { useLoaded } from '@/shared/lib/useLoaded';

import { visibleTracksOf } from './applicantList';
import type { TrackType } from './types';

// useLoaded는 참조가 바뀌지 않는 함수를 받아야 해서 모듈 최상위에 둔다.
const loadMyAccount = () => fetchMyAccount();

/** 로그인한 계정이 전체 지원 현황 지표에서 볼 부문(visibleTracksOf). 읽는 중이거나 읽지 못하면 빈 목록이다. */
export function useVisibleTracks(): TrackType[] {
  return visibleTracksOf(useLoaded('me', loadMyAccount).data);
}
