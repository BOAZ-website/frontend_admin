import { fetchSemesterWeeks, updateSemesterWeek } from '../api/semesterApi';
import type { SemesterWeekDto } from './dto';
import { useLoaded } from './useLoaded';

/** 반기 주차 Hook이 돌려주는 값. */
export interface SemesterWeeksState {
  /** 읽는 중이거나 semester가 null이면 null. */
  weeks: SemesterWeekDto[] | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /** 주차를 마감(CLOSED)하고 다시 읽는다. 실패하면 오류를 던진다. */
  closeWeek: (weekNum: number) => Promise<void>;
}

/** 반기 하나의 주차 진행 상태. semester가 null이면 읽지 않는다. */
export function useSemesterWeeks(semester: string | null): SemesterWeeksState {
  const { data, isLoading, error, reload } = useLoaded(semester, fetchSemesterWeeks);
  return {
    weeks: semester === null ? null : data,
    isLoading,
    error,
    reload,
    closeWeek: async (weekNum) => {
      if (semester === null) return;
      await updateSemesterWeek(semester, weekNum, { status: 'CLOSED' });
      reload();
    },
  };
}
