import { useLoaded } from '@/shared/lib/useLoaded';

import {
  createRecruitment,
  deleteRecruitment,
  fetchRecruitments,
  updateRecruitment,
} from '../api/recruitmentApi';
import type { RecruitmentCreateRequest, RecruitmentUpdateRequest } from './dto';
import type { Recruitment } from './types';

export interface RecruitmentsState {
  /** 기수가 큰 순서. 읽는 중이면 null. */
  recruitments: Recruitment[] | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /** 같은 기수의 공고가 있으면 409 DUPLICATE_TERM. */
  create: (request: RecruitmentCreateRequest) => Promise<void>;
  update: (recruitmentId: number, request: RecruitmentUpdateRequest) => Promise<void>;
  /** 문항이나 지원자가 있는 공고는 400 RECRUITMENT_HAS_REFERENCES. */
  remove: (recruitmentId: number) => Promise<void>;
}

const loadAll = (): Promise<Recruitment[]> => fetchRecruitments();

/** 모집 공고 목록과 등록·수정·삭제. 쓰기가 성공하면 목록을 다시 읽는다(R7-6). 실패하면 오류를 던진다. */
export function useRecruitments(): RecruitmentsState {
  const { data, isLoading, error, reload } = useLoaded('all', loadAll);
  return {
    recruitments: data,
    isLoading,
    error,
    reload,
    create: async (request) => {
      await createRecruitment(request);
      reload();
    },
    update: async (recruitmentId, request) => {
      await updateRecruitment(recruitmentId, request);
      reload();
    },
    remove: async (recruitmentId) => {
      await deleteRecruitment(recruitmentId);
      reload();
    },
  };
}
