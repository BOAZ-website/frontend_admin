import { fetchSeason, fetchSeasonWeeks, updateSeason } from '../api/seasonApi';
import type { SemesterScheduleDto } from './dto';
import type { SeasonInfo, SeasonPatch, SeasonWeek } from './season';
import { useLoaded } from './useLoaded';

/** 반기 상세(ATT-02)와 공통 주차(ATT-08)를 함께 읽어 일정 모양으로 합친 값. */
export interface SeasonSchedule {
  info: SeasonInfo;
  schedule: SemesterScheduleDto;
  weeks: SeasonWeek[];
}

/** 반기 일정 Hook이 돌려주는 값. */
export interface SeasonScheduleState {
  /** 읽는 중이면 null. */
  data: SeasonSchedule | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /** 진행 예정 반기를 고치고 다시 읽는다(ATT-04). 실패하면 오류를 던진다. */
  save: (patch: SeasonPatch) => Promise<void>;
}

// 상세에는 주차 목록이 없고 주차 목록에는 기간·시작일이 없어 두 API를 함께 부른다.
async function loadSchedule(key: string): Promise<SeasonSchedule> {
  const seasonId = Number(key);
  const [info, weeks] = await Promise.all([fetchSeason(seasonId), fetchSeasonWeeks(seasonId)]);
  return {
    info,
    weeks,
    schedule: {
      vacation: info.vacation,
      term: info.term,
      activityStarts: info.activityStarts,
      weeks,
    },
  };
}

/** 반기 하나의 상세·기간·1주차 시작일·공통 주차. */
export function useSeasonSchedule(seasonId: number): SeasonScheduleState {
  const { data, isLoading, error, reload } = useLoaded(String(seasonId), loadSchedule);
  return {
    data,
    isLoading,
    error,
    reload,
    save: async (patch) => {
      await updateSeason(seasonId, patch);
      reload();
    },
  };
}
