import type { ComponentProps } from 'react';

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
      <p
        role="status"
        className={`rounded-md border px-4 py-3 text-xs ${
          data.status === 'error'
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-slate-200 bg-white text-slate-500'
        }`}
      >
        {data.status === 'error'
          ? `행사 정보를 불러오지 못했습니다. (${data.error?.message ?? '알 수 없는 오류'})`
          : '행사 정보를 불러오는 중입니다.'}
      </p>
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
