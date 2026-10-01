import { baseTeamId } from '@/entities/study-team/model/db';
import type { UserTrack } from '@/entities/user/model/types';

import type { TeamMeta } from '../ui/InternalCategoryAttendancePage';

/** 출결 생성에서 고를 수 있는 BASE 트랙(부문). 팀·트랙원·출결 생성은 저장소(createBaseAttendanceRecords)가 맡는다. */
export const BASE_CREATE_TRACKS: readonly UserTrack[] = ['분석', '시각화', '엔지니어링'];

const BASE_TRACK_DESCRIPTIONS: Record<UserTrack, string> = {
  분석: '데이터 분석 & 머신러닝',
  시각화: '데이터 시각화 & 대시보드',
  엔지니어링: '데이터 엔지니어링 & MLOps',
};

/**
 * BASE 트랙 목록. 분석·시각화·엔지니어링은 DB에 데이터가 없는 기수에서도 항상 보이도록,
 * 그 기수의 트랙 팀이 있으면 그 팀을, 없으면 빈 트랙(트랙원 0명)을 채워 넣는다.
 */
export function buildBaseTrackTeams(teams: readonly TeamMeta[], cohort: number): TeamMeta[] {
  return BASE_CREATE_TRACKS.map(
    (track) =>
      teams.find((team) => team.track === track && team.id === baseTeamId(cohort, track)) ?? {
        id: baseTeamId(cohort, track),
        name: track,
        leader: '',
        description: BASE_TRACK_DESCRIPTIONS[track],
        memberCount: 0,
        track,
      },
  );
}
