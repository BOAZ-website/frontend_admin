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

/** 같은 캐릭터를 백엔드 부문 코드로 찾는 표. 서류 평가 화면(지원 현황 지표·제목)이 쓴다. */
export const TRACK_IMAGE_BY_CODE: Record<'ANALYSIS' | 'VISUALIZATION' | 'ENGINEERING', string> = {
  ANALYSIS: TRACK_IMAGE.분석,
  VISUALIZATION: TRACK_IMAGE.시각화,
  ENGINEERING: TRACK_IMAGE.엔지니어링,
};

/** 부문 코드(ENGINEERING 등)나 이름으로 캐릭터 이미지를 찾는다. 세 부문이 아니면(전부문·빈 값 등) null. */
export const trackImageOf = (track: string | null | undefined): string | null => {
  const label = trackLabelOf(track);
  return label && label in TRACK_IMAGE ? TRACK_IMAGE[label as UserTrack] : null;
};
