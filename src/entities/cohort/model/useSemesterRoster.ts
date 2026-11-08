import { fetchSemesterRoster, replaceSemesterMembers } from '../api/semesterApi';
import type { RosterEntryDto } from './dto';
import { useLoaded } from './useLoaded';

/** 반기 명단 Hook이 돌려주는 값. */
export interface SemesterRosterState {
  /** 저장된 명단. 읽는 중이면 null. */
  members: RosterEntryDto[] | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /** 명단을 통째로 바꾸고 다시 읽는다. 실패하면 오류를 던진다. */
  save: (userIds: string[]) => Promise<void>;
}

const loadMembers = async (semester: string): Promise<RosterEntryDto[]> =>
  (await fetchSemesterRoster(semester)).members;

/** 반기 하나의 출결·점수 명단. */
export function useSemesterRoster(semester: string): SemesterRosterState {
  const { data, isLoading, error, reload } = useLoaded(semester, loadMembers);
  return {
    members: data,
    isLoading,
    error,
    reload,
    save: async (userIds) => {
      await replaceSemesterMembers(semester, { userIds });
      reload();
    },
  };
}
