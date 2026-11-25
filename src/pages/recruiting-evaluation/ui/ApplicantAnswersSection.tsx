import { ApiError } from '@/shared/api/apiError';
import { useLoaded } from '@/shared/lib/useLoaded';

import type { ApplicantAnswerDto } from '../model/types';
import { ApplicantAnswerList } from './ApplicantAnswerList';

interface ApplicantAnswersSectionProps {
  applicantId: number;
  fetchAnswers: (applicantIdKey: string) => Promise<ApplicantAnswerDto[]>;
  /** 지원서가 없어졌을 때(404) 누르는 버튼의 문구와 동작. 화면마다 후속 동작이 다르다(§3.6, §4.6). */
  missingAction: { label: string; onClick: () => void };
  /** 권한이 없을 때(403) 누르는 버튼. 없으면 다시 시도 버튼만 둔다. */
  deniedAction?: { label: string; onClick: () => void };
}

/** 지원서 답변(REC-ADMIN-20)을 읽어 보여 준다. 불러오는 중·없음·권한 없음·실패를 구분한다. */
export function ApplicantAnswersSection({
  applicantId,
  fetchAnswers,
  missingAction,
  deniedAction,
}: ApplicantAnswersSectionProps) {
  const answers = useLoaded(String(applicantId), fetchAnswers);
  const errorCode = answers.error instanceof ApiError ? answers.error.code : null;

  if (answers.error) {
    const action =
      errorCode === 'APPLICATION_NOT_FOUND'
        ? missingAction
        : errorCode === 'ACCESS_DENIED' && deniedAction
          ? deniedAction
          : { label: '다시 시도', onClick: answers.reload };
    return (
      <div role="alert" className="flex flex-col items-start gap-3 py-6">
        <p className="text-sm font-semibold">
          {errorCode === 'APPLICATION_NOT_FOUND'
            ? '지원서를 찾을 수 없습니다.'
            : errorCode === 'ACCESS_DENIED'
              ? '해당 지원서를 열람할 권한이 없습니다.'
              : '지원서를 불러오지 못했습니다.'}
        </p>
        <button type="button" onClick={action.onClick} className="px-3">
          {action.label}
        </button>
      </div>
    );
  }
  if (!answers.data || answers.isLoading) {
    return <p className="review-answer py-6">지원서를 불러오는 중입니다.</p>;
  }
  return <ApplicantAnswerList answers={answers.data} />;
}
