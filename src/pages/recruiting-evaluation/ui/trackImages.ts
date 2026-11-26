import trackAnalysis from '@/shared/assets/tracks/track-analysis.png';
import trackEngineering from '@/shared/assets/tracks/track-engineering.png';
import trackVisualization from '@/shared/assets/tracks/track-visualization.png';

import type { TrackType } from '../model/types';

/** 부문 캐릭터. 학기 일정 달력(SemesterCalendar)과 같은 이미지다. 전체 지원 현황 지표와 서류 평가 제목이 쓴다. */
export const TRACK_IMAGE: Record<TrackType, string> = {
  ANALYSIS: trackAnalysis,
  VISUALIZATION: trackVisualization,
  ENGINEERING: trackEngineering,
};
