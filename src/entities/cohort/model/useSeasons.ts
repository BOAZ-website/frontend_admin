import {
  activateSeason,
  archiveSeason,
  createSeason,
  deleteSeason,
  fetchArchiveReadiness,
  fetchSeasons,
} from '../api/seasonApi';
import type { Season, SeasonArchiveReadiness, SeasonInput } from './season';
import { useLoaded } from './useLoaded';

/** 반기 관리 목록 Hook이 돌려주는 값. */
export interface SeasonsState {
  /** 진행 예정·진행·종료 반기 전체. 읽는 중이면 null. */
  seasons: Season[] | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /** 반기를 확정한다(진행 예정 반기가 된다). 성공하면 목록을 다시 읽는다. 실패하면 오류를 던진다. */
  create: (input: SeasonInput & { scoreRuleSetId: number }) => Promise<{ id: number }>;
  /** 진행 예정 반기를 진행 반기로 만든다. 진행 반기가 남아 있으면 409 ACTIVE_SEASON_EXISTS. */
  activate: (season: Season) => Promise<void>;
  /** 진행 반기를 종료할 수 있는지 점검한다(목록은 다시 읽지 않는다). */
  checkArchive: (season: Season) => Promise<SeasonArchiveReadiness>;
  /** 진행 반기를 종료한다. 성공하면 목록을 다시 읽는다. */
  archive: (season: Season) => Promise<void>;
  /** 진행 예정 반기를 지운다. */
  remove: (season: Season) => Promise<void>;
}

const loadAll = (): Promise<Season[]> => fetchSeasons();

/** 반기 관리 화면의 반기 목록과 상태 변경. 쓰기가 성공하면 목록을 다시 읽는다(R7-6). */
export function useSeasons(): SeasonsState {
  const { data, isLoading, error, reload } = useLoaded('all', loadAll);
  const thenReload =
    <A extends unknown[], R>(write: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const result = await write(...args);
      reload();
      return result;
    };
  return {
    seasons: data,
    isLoading,
    error,
    reload,
    create: thenReload(createSeason),
    activate: thenReload((season: Season) => activateSeason(season.id)),
    checkArchive: (season) => fetchArchiveReadiness(season.id),
    archive: thenReload((season: Season) => archiveSeason(season.id)),
    remove: thenReload((season: Season) => deleteSeason(season.id)),
  };
}
