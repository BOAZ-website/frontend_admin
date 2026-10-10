import { useEffect, useState } from 'react';

import { fetchAttendanceMeta } from '../api/attendanceApi';
import type { AttendanceMetaResponse } from './dto';

export interface AttendanceMetaState {
  meta: AttendanceMetaResponse | null;
  error: Error | null;
  reload: () => void;
}

/**
 * 출결 화면 기준 데이터(반기·주차 상태와 날짜·기본 주차)를 API에서 읽는다.
 * semester를 생략하면 현재 반기 기준이다. 읽는 중에는 meta와 error가 모두 null이다.
 */
export function useAttendanceMeta(semester?: string): AttendanceMetaState {
  const [state, setState] = useState<Pick<AttendanceMetaState, 'meta' | 'error'>>({
    meta: null,
    error: null,
  });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    fetchAttendanceMeta({ semester })
      .then((meta) => {
        if (!isCancelled) setState({ meta, error: null });
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState({
            meta: null,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [semester, reloadKey]);

  return { ...state, reload: () => setReloadKey((key) => key + 1) };
}
