import { useLoaded } from '@/shared/lib/useLoaded';

import {
  createQuestions,
  deleteQuestion,
  fetchQuestions,
  updateQuestion,
} from '../api/recruitmentApi';
import type { QuestionCreateItem, QuestionUpdateRequest } from './dto';
import type { Question } from './types';

/** 문항 하나에 보낼 수정 요청. */
export interface QuestionChange {
  questionId: number;
  request: QuestionUpdateRequest;
}

export interface QuestionsState {
  /** 순서 번호 순. 공고를 고르지 않았거나 읽는 중이면 null. */
  questions: Question[] | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /** 라벨이나 같은 분류의 순서 번호가 겹치면 409. */
  create: (item: QuestionCreateItem) => Promise<void>;
  /** 여러 문항을 차례로 고친 뒤 목록을 다시 읽는다. 중간에 실패하면 거기서 멈추고 오류를 던진다. */
  update: (changes: readonly QuestionChange[]) => Promise<void>;
  /** 답변이 있는 문항은 400 QUESTION_HAS_ANSWERS. */
  remove: (questionId: number) => Promise<void>;
}

const loadQuestions = (key: string): Promise<Question[]> => fetchQuestions(Number(key));

/** 한 공고의 지원서 문항과 추가·수정·삭제. recruitmentId가 null이면 읽지 않는다. */
export function useQuestions(recruitmentId: number | null): QuestionsState {
  const { data, isLoading, error, reload } = useLoaded(
    recruitmentId === null ? null : String(recruitmentId),
    loadQuestions,
  );
  return {
    questions: data,
    isLoading,
    error,
    reload,
    create: async (item) => {
      if (recruitmentId === null) return;
      await createQuestions(recruitmentId, [item]);
      reload();
    },
    update: async (changes) => {
      try {
        // 순서를 바꿀 때는 앞 요청이 끝나야 다음 번호가 비므로 차례로 보낸다.
        for (const { questionId, request } of changes) {
          await updateQuestion(questionId, request);
        }
      } finally {
        // 일부만 반영된 경우에도 화면을 서버와 맞춘다.
        reload();
      }
    },
    remove: async (questionId) => {
      await deleteQuestion(questionId);
      reload();
    },
  };
}
