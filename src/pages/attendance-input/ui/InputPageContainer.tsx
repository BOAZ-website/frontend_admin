import type { ComponentProps } from 'react';

import { PageLoadingState } from '@/widgets/page-loading/ui/PageLoadingState';

import { useInputPageData } from '../model/useInputPageData';
import { InputPage } from './InputPage';

type PageProps = ComponentProps<typeof InputPage>;

/** 화면이 API로 직접 읽는 값은 빼고, 로그인·주차·수정 요청 같은 설정만 위에서 받는다. */
type ContainerProps = Pick<
  PageProps,
  'pageTitle' | 'currentHostTeam' | 'currentRole' | 'weeks' | 'currentWeekNum' | 'currentPeriod'
> & {
  /** 제출·삭제한 뒤 아직 API로 옮기지 않은 다른 화면 데이터도 다시 읽게 한다. */
  onDataChanged?: () => void;
};

/**
 * 스터디·ADV 출결 입력 탭. 탭을 열면 팀·팀원·출결을 API로 읽어 표를 그리고,
 * 제출(출결·비고·사진·PDF)과 팀원 삭제를 API로 처리한다.
 */
export function InputPageContainer({ onDataChanged, ...pageProps }: ContainerProps) {
  const isAdv = pageProps.pageTitle?.includes('ADV') ?? false;
  const data = useInputPageData(isAdv, onDataChanged);

  if (data.status !== 'ready') {
    return (
      <PageLoadingState
        className="flex flex-col flex-1 h-full min-h-0 space-y-3 w-full"
        header={
          <div className="flex min-h-7.5 items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3 shrink-0">
            <h2 className="text-slate-950 font-black text-lg sm:text-xl tracking-tight">
              {pageProps.pageTitle || 'ADV Term 출결 입력'}
            </h2>
          </div>
        }
        error={data.status === 'error' ? data.error : null}
        loadingMessage="출결 정보를 불러오는 중입니다."
        errorMessage="출결 정보를 불러오지 못했습니다."
      />
    );
  }

  return (
    <InputPage
      {...pageProps}
      attendance={data.attendance}
      setAttendance={data.setAttendance}
      advTeams={isAdv ? data.teams : []}
      studyTeams={isAdv ? [] : data.teams}
      membersMap={data.membersMap}
      onSubmitWeek={data.submitWeek}
    />
  );
}
