import { fetchSemesterSchedule, saveSemesterSchedule } from '../api/semesterApi';
import type { SaveSemesterScheduleRequest, SemesterScheduleDto } from './dto';
import { useLoaded } from './useLoaded';

/** 반기 일정 Hook이 돌려주는 값. */
export interface SemesterScheduleState {
  /** 읽는 중이면 null. */
  schedule: SemesterScheduleDto | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /** 일정을 통째로 저장하고 다시 읽는다. 실패하면 오류를 던진다. */
  save: (request: SaveSemesterScheduleRequest) => Promise<void>;
}

/** 반기 하나의 기간·활동별 1주차 시작일·무효 주차. */
export function useSemesterSchedule(semester: string): SemesterScheduleState {
  const { data, isLoading, error, reload } = useLoaded(semester, fetchSemesterSchedule);
  return {
    schedule: data,
    isLoading,
    error,
    reload,
    save: async (request) => {
      await saveSemesterSchedule(semester, request);
      reload();
    },
  };
}
