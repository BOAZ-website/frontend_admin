/**
 * 반기별 활동 회원 기수(반기 API GET /api/v1/semesters의 memberTerms).
 * 명단을 올릴 때 '현재 활동 기수인데 회원 DB에 없는 사람'을 가리는 데 쓴다.
 * 출석 표의 기수 필터 선택지는 이 값이 아니라 백엔드의 행사 기수 목록(GET /api/v1/events/:eventId/terms)이다.
 */
import { useEffect, useState } from 'react';

import { fetchSemesters } from '@/entities/cohort/api/semesterApi';

/** 반기(cohort) → 그 반기의 활동 회원 기수. 불러오지 못했으면 null이다. */
export function useSemesterMemberTerms(): ReadonlyMap<number, readonly number[]> | null {
  const [termsByCohort, setTermsByCohort] = useState<ReadonlyMap<number, readonly number[]> | null>(
    null,
  );

  useEffect(() => {
    let isCancelled = false;
    fetchSemesters()
      .then((semesters) => {
        if (isCancelled) return;
        setTermsByCohort(
          new Map(semesters.map((semester) => [semester.cohort, semester.memberTerms])),
        );
      })
      .catch(() => {
        // 반기 API를 쓸 수 없으면 현재 기수를 가리지 못한다(회원 DB에 없는 사람을 모두 이전 기수로 본다).
        if (!isCancelled) setTermsByCohort(null);
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  return termsByCohort;
}
