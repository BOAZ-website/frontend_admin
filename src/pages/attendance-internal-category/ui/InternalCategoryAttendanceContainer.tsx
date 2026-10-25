import type { ComponentProps } from 'react';

import { PageLoadingState } from '@/widgets/page-loading/ui/PageLoadingState';

import type { SemesterDto } from '@/entities/cohort/model/dto';

import { CATEGORY_TITLES } from '../model/categoryTitles';
import { useCategoryAttendanceData } from '../model/useCategoryAttendanceData';
import { InternalCategoryAttendancePage } from './InternalCategoryAttendancePage';

type PageProps = ComponentProps<typeof InternalCategoryAttendancePage>;

/** 화면이 API로 직접 읽는 값은 빼고, 반기 기준 데이터와 화면 설정만 위에서 받는다. */
type ContainerProps = Pick<
  PageProps,
  | 'category'
  | 'weeks'
  | 'cohorts'
  | 'currentCohort'
  | 'canCreateNextSemester'
  | 'onAdvanceSemester'
  | 'cohortLabels'
  | 'tracks'
> & {
  /** 반기 목록(반기 API). 주차 날짜와 생성 요청의 반기 표기를 찾는 데 쓴다. */
  semesters: readonly SemesterDto[];
  /** 저장한 뒤 아직 API로 옮기지 않은 다른 화면 데이터도 다시 읽게 한다. */
  onDataChanged?: () => void;
};

/**
 * BASE·ADV·스터디 출결 관리 탭. 탭을 열면 팀·팀원·출결을 API로 읽어 표를 그리고,
 * 출결 변경·팀원 관리·팀 생성·제출도 API로 처리한다.
 */
export function InternalCategoryAttendanceContainer({
  semesters,
  onDataChanged,
  ...pageProps
}: ContainerProps) {
  const data = useCategoryAttendanceData(pageProps.category, semesters, onDataChanged);

  if (data.status !== 'ready') {
    return (
      <PageLoadingState
        className="flex flex-col flex-1 h-full min-h-0 space-y-3 w-full"
        header={
          <div className="flex min-h-7.5 items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3 shrink-0">
            <h2 className="text-slate-950 font-black text-lg sm:text-xl tracking-tight">
              {CATEGORY_TITLES[pageProps.category]}
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
    <InternalCategoryAttendancePage
      {...pageProps}
      attendance={data.attendance}
      studyTeams={data.teams}
      studyMembers={data.allMembers}
      users={data.users}
      membershipBaseTeams={data.membershipBaseTeams}
      membershipOtherTeams={data.membershipOtherTeams}
      weekDates={data.weekDates}
      weeksByCohort={data.weeksByCohort}
      semesterByCohort={data.semesterByCohort}
      onStudyAttendanceChange={data.changeAttendance}
      onSubmitWeek={data.reloadAfterSubmit}
      onRemoveStudyMember={data.removeMember}
      onDeleteTeam={data.removeTeam}
      onUpdateStudyTeam={data.updateTeamInfo}
      onAddStudyMember={data.addMember}
      onCreateStudy={data.createStudyTeam}
      onCreateAdvTeam={data.createAdv}
      onCreateBaseAttendance={data.createBase}
    />
  );
}
