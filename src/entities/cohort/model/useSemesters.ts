import { deleteSemester, fetchSemesters, startSemester } from '../api/semesterApi';
import type { StartSemesterRequest, SemesterDto } from './dto';
import { useLoaded } from './useLoaded';

/** 반기 관리 목록 Hook이 돌려주는 값. */
export interface SemestersState {
  /** 진행·종료 반기 전체(큰 기수부터). 읽는 중이면 null. */
  semesters: SemesterDto[] | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /** 새 반기를 만들고 바로 진행 반기로 만든다(이전 진행 반기는 종료). 성공하면 목록을 다시 읽는다. 실패하면 오류를 던진다. */
  start: (request: StartSemesterRequest) => Promise<SemesterDto>;
  /** 종료 반기를 지운다. 종료 반기에 기록이 있으면 409 SEMESTER_HAS_RECORDS이고 isForced로 다시 부른다. */
  remove: (semester: string, isForced?: boolean) => Promise<SemesterDto>;
}

const loadAll = (): Promise<SemesterDto[]> => fetchSemesters();

/** 반기 관리 화면의 반기 목록과 상태 변경. 쓰기가 성공하면 목록을 다시 읽는다(R7-6). */
export function useSemesters(): SemestersState {
  const { data, isLoading, error, reload } = useLoaded('all', loadAll);
  const thenReload =
    <A extends unknown[]>(write: (...args: A) => Promise<SemesterDto>) =>
    async (...args: A): Promise<SemesterDto> => {
      const result = await write(...args);
      reload();
      return result;
    };
  return {
    semesters: data,
    isLoading,
    error,
    reload,
    start: thenReload(startSemester),
    remove: thenReload(deleteSemester),
  };
}
