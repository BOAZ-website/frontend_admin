import trackAnalysis from '@/shared/assets/tracks/track-analysis.png';
import trackEngineering from '@/shared/assets/tracks/track-engineering.png';
import trackVisualization from '@/shared/assets/tracks/track-visualization.png';

import { trackLabelOf } from './trackLabel';
import type { UserTrack } from './types';

/** 부문 캐릭터 이미지. 반기 관리 달력의 트랙 세션과 내 계정 창의 프로필 그림이 함께 쓴다. */
export const TRACK_IMAGE: Record<UserTrack, string> = {
  분석: trackAnalysis,
  시각화: trackVisualization,
  엔지니어링: trackEngineering,
};

/** 부문 코드(ENGINEERING 등)나 이름으로 캐릭터 이미지를 찾는다. 세 부문이 아니면(전부문·빈 값 등) null. */
export const trackImageOf = (track: string | null | undefined): string | null => {
  const label = trackLabelOf(track);
  return label && label in TRACK_IMAGE ? TRACK_IMAGE[label as UserTrack] : null;
};
