import type { ComponentProps } from 'react';

import { PageLoadingState } from '@/widgets/page-loading/ui/PageLoadingState';

import { useEventPageData } from '../model/useEventPageData';
import { EventAttendanceManagePage } from './EventAttendanceManagePage';

type PageProps = ComponentProps<typeof EventAttendanceManagePage>;
type ContainerProps = Pick<
  PageProps,
  | 'cohorts'
  | 'currentCohort'
  | 'cohortLabels'
  | 'canCreateNextSemester'
  | 'onAdvanceSemester'
  | 'listRequest'
>;

/**
 * 행사 출결 탭. 탭을 열면 행사·참가자를 API로 읽어 표를 그리고,
 * 화면이 바꾼 항목을 API로 저장한다.
 */
export function EventAttendanceContainer(props: ContainerProps) {
  const data = useEventPageData();

  if (data.status !== 'ready') {
    return (
      <PageLoadingState
        className="space-y-6 w-full"
        header={
          // 다 읽은 뒤 '행사 전체 목록' 제목 줄과 같은 높이(제목 + 행사 추가 버튼 h-9 + 아래 여백).
          <div className="flex min-h-11 items-center pb-2 border-b border-slate-200/80">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">행사 전체 목록</h1>
          </div>
        }
        error={data.status === 'error' ? data.error : null}
        loadingMessage="행사 정보를 불러오는 중입니다."
        errorMessage="행사 정보를 불러오지 못했습니다."
      />
    );
  }

  return (
    <EventAttendanceManagePage
      {...props}
      events={data.events}
      setEvents={data.setEvents}
      attendees={data.attendees}
      setAttendees={data.setAttendees}
      loadEventTerms={data.loadEventTerms}
      loadEvent={data.loadEvent}
      patchAttendee={data.patchAttendee}
      createAttendee={data.createAttendee}
    />
  );
}
