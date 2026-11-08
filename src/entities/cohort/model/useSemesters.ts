import {
  activateSemester,
  deleteSemester,
  fetchSemesters,
  prepareSemester,
} from '../api/semesterApi';
import type { PrepareSemesterRequest, SemesterDto } from './dto';
import { useLoaded } from './useLoaded';

/** 반기 관리 목록 Hook이 돌려주는 값. */
export interface SemestersState {
  /** 진행 예정·진행·종료 반기 전체(큰 기수부터). 읽는 중이면 null. */
  semesters: SemesterDto[] | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /** 진행 예정 반기를 만든다. 성공하면 목록을 다시 읽는다. 실패하면 오류를 던진다. */
  prepare: (request: PrepareSemesterRequest) => Promise<SemesterDto>;
  /** 진행 예정 반기를 진행 반기로 만든다(이전 진행 반기는 종료). 이전 반기에 진행 중인 주차가 있으면 409. */
  activate: (semester: string) => Promise<SemesterDto>;
  /** 진행 예정 반기를 지운다. 진행 중·종료 반기는 409 SEMESTER_LOCKED. */
  remove: (semester: string) => Promise<SemesterDto>;
}

const loadAll = (): Promise<SemesterDto[]> => fetchSemesters(true);

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
    prepare: thenReload(prepareSemester),
    activate: thenReload(activateSemester),
    remove: thenReload(deleteSemester),
  };
}
