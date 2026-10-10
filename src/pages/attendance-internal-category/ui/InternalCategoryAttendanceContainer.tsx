import type { ComponentProps } from 'react';

import type { SemesterDto } from '@/entities/cohort/model/dto';

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
      <p
        role="status"
        className={`rounded-md border px-4 py-3 text-xs ${
          data.status === 'error'
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-slate-200 bg-white text-slate-500'
        }`}
      >
        {data.status === 'error'
          ? `출결 정보를 불러오지 못했습니다. (${data.error?.message ?? '알 수 없는 오류'})`
          : '출결 정보를 불러오는 중입니다.'}
      </p>
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
