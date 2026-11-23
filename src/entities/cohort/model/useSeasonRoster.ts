import { fetchEnrollments } from '../api/seasonApi';
import type { RosterEntryDto } from './dto';
import { useLoaded } from './useLoaded';

/** 반기 명단 Hook이 돌려주는 값. */
export interface SeasonRosterState {
  /** 저장된 명단. 읽는 중이면 null. */
  members: RosterEntryDto[] | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
}

const loadMembers = (key: string): Promise<RosterEntryDto[]> => fetchEnrollments(Number(key));

/** 반기 하나의 출결·점수 명단(ATT-18). 고치기는 행마다 API를 부른다(useExistingSemester). */
export function useSeasonRoster(seasonId: number): SeasonRosterState {
  const { data, isLoading, error, reload } = useLoaded(String(seasonId), loadMembers);
  return { members: data, isLoading, error, reload };
}
