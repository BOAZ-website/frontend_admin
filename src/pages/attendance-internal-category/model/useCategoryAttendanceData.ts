/**
 * BASE·ADV·스터디 출결 관리 화면 데이터. 화면을 열 때 API로 읽는다.
 *   · 이 구분의 팀(모든 반기) + 팀원 + 주차별 출결 기록
 *   · 병행 판정용 다른 구분의 팀과 팀원
 *   · 회원 목록, 반기별 주차(진행 상태·날짜)
 * 저장(출결 변경·팀원 관리·팀 생성·제출)은 API로 한 뒤 다시 읽는다. 출결 칸 변경은 화면에 먼저 반영하고 저장한다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { saveWeekAttendance } from '@/entities/attendance/api/attendanceApi';
import type { AttendanceState, AttendanceStatus } from '@/entities/attendance/model/types';
import type { WeekInfo } from '@/entities/attendance/model/week';
import { fetchSemesterWeeks } from '@/entities/cohort/api/semesterApi';
import type { SemesterDto } from '@/entities/cohort/model/dto';
import {
  addTeamMembers,
  createAdvTeam,
  createBaseTrack,
  createStudy,
  deleteTeam,
  fetchTeams,
  removeTeamMember,
  updateTeam,
} from '@/entities/study-team/api/teamApi';
import { attendanceOfTeams, splitTeamList } from '@/entities/study-team/model/adapters';
import {
  applyAttendanceChange,
  type AttendanceChange,
  type CreateAdvTeamInput,
  type CreateBaseAttendanceInput,
  type CreateStudyInput,
} from '@/entities/study-team/model/db';
import type { TeamGroup, TeamListItemDto } from '@/entities/study-team/model/dto';
import type { Member, StudyTeamInfo } from '@/entities/study-team/model/types';
import { fetchUsers } from '@/entities/user/api/usersApi';
import type { UserProfile } from '@/entities/user/model/types';
import { alertApiError } from '@/shared/lib/alertApiError';

import type {
  CreateTeamResult,
  InternalCategory,
  TeamInfoChanges,
} from '../ui/InternalCategoryAttendancePage';

const GROUP_OF: Record<InternalCategory, TeamGroup> = {
  SESSION: 'BASE',
  ADV: 'ADV',
  STUDY: 'STUDY',
};

interface Source {
  own: TeamListItemDto[];
  base: TeamListItemDto[];
  others: TeamListItemDto[];
  users: UserProfile[];
  weekDates: Record<number, Record<number, string>>;
  weeksByCohort: Record<number, WeekInfo[]>;
  semesterByCohort: Record<number, SemesterDto>;
}

export interface CategoryAttendanceData {
  status: 'loading' | 'ready' | 'error';
  error: Error | null;
  teams: StudyTeamInfo[];
  members: Record<string, Member[]>;
  attendance: AttendanceState;
  membershipBaseTeams: StudyTeamInfo[];
  membershipOtherTeams: StudyTeamInfo[];
  /** 병행 판정에 쓰는 모든 구분의 팀원(팀 id → 팀원). */
  allMembers: Record<string, Member[]>;
  users: UserProfile[];
  /** 기수(ADV는 ADV 기수) → 주차 번호 → 날짜 */
  weekDates: Record<number, Record<number, string>>;
  /** 기수(ADV는 ADV 기수) → 그 반기의 주차와 진행 상태 */
  weeksByCohort: Record<number, WeekInfo[]>;
  /** 기수(ADV는 ADV 기수) → 반기(지금 주차·기간 포함) */
  semesterByCohort: Record<number, SemesterDto>;
  changeAttendance: (change: AttendanceChange) => void;
  reloadAfterSubmit: () => void;
  removeMember: (teamId: string, memberId: string) => Promise<void>;
  /** 팀 삭제. 성공하면 true, 실패하면 사유를 알리고 false. */
  removeTeam: (teamId: string) => Promise<boolean>;
  /** 팀명·팀장 변경. 팀장은 팀원의 users.id이며 null이면 팀장 해제. */
  /** 팀명·팀장 변경을 바로 API로 저장한다. 성공하면 true, 실패하면 사유를 알리고 false. */
  updateTeamInfo: (teamId: string, changes: TeamInfoChanges) => Promise<boolean>;
  addMember: (teamId: string, userId: string) => Promise<void>;
  createStudyTeam: (input: CreateStudyInput) => Promise<CreateTeamResult>;
  createAdv: (input: CreateAdvTeamInput) => Promise<CreateTeamResult>;
  createBase: (input: CreateBaseAttendanceInput) => Promise<CreateTeamResult>;
}

const EMPTY: Source = {
  own: [],
  base: [],
  others: [],
  users: [],
  weekDates: {},
  weeksByCohort: {},
  semesterByCohort: {},
};

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** 반기별 주차(진행 상태·날짜)를 화면이 쓰는 키(활동 기수, ADV는 ADV 기수)로 모은다. */
async function loadSemesterWeeks(
  semesters: readonly SemesterDto[],
  group: TeamGroup,
): Promise<Pick<Source, 'weekDates' | 'weeksByCohort' | 'semesterByCohort'>> {
  const entries = await Promise.all(
    semesters.map(async (semester) => {
      const key = group === 'ADV' ? semester.advTerm : semester.cohort;
      if (key === null) return null;
      return { key, semester, weeks: await fetchSemesterWeeks(semester.semester) };
    }),
  );
  const loaded = entries.filter((entry) => entry !== null);
  return {
    semesterByCohort: Object.fromEntries(loaded.map(({ key, semester }) => [key, semester])),
    weekDates: Object.fromEntries(
      loaded.map(({ key, weeks }) => [
        key,
        Object.fromEntries(weeks.flatMap((week) => (week.date ? [[week.weekNum, week.date]] : []))),
      ]),
    ),
    weeksByCohort: Object.fromEntries(
      loaded.map(({ key, weeks }) => [
        key,
        weeks.map(({ weekNum, label, period, status }) => ({
          id: `w${weekNum}`,
          weekNum,
          label,
          period,
          status,
        })),
      ]),
    ),
  };
}

/**
 * @param semesters 반기 목록(반기 API). 주차 날짜와 생성 요청의 반기 표기를 찾는 데 쓴다.
 * @param onChanged 저장한 뒤 아직 API로 옮기지 않은 다른 화면 데이터도 다시 읽게 할 때 쓴다.
 */
export function useCategoryAttendanceData(
  category: InternalCategory,
  semesters: readonly SemesterDto[],
  onChanged?: () => void,
): CategoryAttendanceData {
  const group = GROUP_OF[category];
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    source: Source;
    status: CategoryAttendanceData['status'];
    error: Error | null;
  }>({
    source: EMPTY,
    status: 'loading',
    error: null,
  });
  // 출결 칸 변경은 저장 응답을 기다리지 않고 화면에 먼저 반영한다.
  const [attendance, setAttendance] = useState<AttendanceState>({});

  useEffect(() => {
    let isCancelled = false;
    const listAll = (target: TeamGroup, withSessions: boolean) =>
      fetchTeams(target, {
        semester: 'all',
        ...(withSessions ? { include: 'sessions' as const } : {}),
      });
    const otherGroups = (['STUDY', 'ADV'] as const).filter((item) => item !== group);
    Promise.all([
      listAll(group, true),
      group === 'BASE' ? null : listAll('BASE', false),
      Promise.all(otherGroups.map((item) => listAll(item, false))),
      fetchUsers(),
      loadSemesterWeeks(semesters, group),
    ])
      .then(([own, base, others, users, semesterWeeks]) => {
        if (isCancelled) return;
        setState({
          source: {
            own: own.teams,
            base: base ? base.teams : own.teams,
            others: [
              ...(group === 'BASE' ? [] : own.teams),
              ...others.flatMap((list) => list.teams),
            ],
            users,
            ...semesterWeeks,
          },
          status: 'ready',
          error: null,
        });
        setAttendance(attendanceOfTeams(own.teams));
      })
      .catch((error: unknown) => {
        if (!isCancelled) setState((prev) => ({ ...prev, status: 'error', error: toError(error) }));
      });
    return () => {
      isCancelled = true;
    };
  }, [group, semesters, version]);

  const reload = useCallback(() => {
    setVersion((value) => value + 1);
    onChanged?.();
  }, [onChanged]);

  const { source } = state;
  const view = useMemo(() => {
    const own = splitTeamList(source.own);
    const base = splitTeamList(source.base);
    const others = splitTeamList(source.others);
    return {
      teams: own.teams,
      members: own.members,
      membershipBaseTeams: base.teams,
      membershipOtherTeams: others.teams,
      allMembers: { ...base.members, ...others.members, ...own.members },
    };
  }, [source]);

  const semesterLabelOf = useCallback(
    (cohort: number) => semesters.find((semester) => semester.cohort === cohort)?.semester,
    [semesters],
  );

  const changeAttendance = useCallback(
    (change: AttendanceChange) => {
      const [memberId, subType = ''] = change.memberKey.split(':');
      const current =
        attendance[`w${change.weekNum}|study|${change.teamId}`]?.statuses[change.memberKey];
      const status: AttendanceStatus = change.status ?? current ?? 'unmarked';
      setAttendance((prev) => applyAttendanceChange(prev, change));
      saveWeekAttendance(group, change.teamId, change.weekNum, {
        records: [
          { memberId, subType: subType as '' | '멘멘' | '친바', status, memo: change.memo },
        ],
      })
        .then(() => onChanged?.())
        .catch((error: unknown) => {
          alertApiError(error);
          reload();
        });
    },
    [attendance, group, onChanged, reload],
  );

  const runCreate = useCallback(
    async (create: () => Promise<{ team: { id: string } }>): Promise<CreateTeamResult> => {
      try {
        const created = await create();
        reload();
        return { teamId: created.team.id };
      } catch (error) {
        return { error: toError(error).message };
      }
    },
    [reload],
  );

  const leaderIdOf = (members: readonly UserProfile[], leaderName: string | null | undefined) =>
    leaderName ? members.find((user) => user.name === leaderName)?.id : undefined;

  return {
    status: state.status,
    error: state.error,
    ...view,
    attendance,
    users: source.users,
    weekDates: source.weekDates,
    weeksByCohort: source.weeksByCohort,
    semesterByCohort: source.semesterByCohort,
    changeAttendance,
    reloadAfterSubmit: reload,
    removeMember: (teamId, memberId) =>
      removeTeamMember(group, teamId, memberId).then(reload).catch(alertApiError),
    removeTeam: (teamId) =>
      deleteTeam(group, teamId)
        .then(() => {
          reload();
          return true;
        })
        .catch((error: unknown) => {
          alertApiError(error);
          return false;
        }),
    updateTeamInfo: (teamId, changes) =>
      updateTeam(group, teamId, changes)
        .then(() => {
          reload();
          return true;
        })
        .catch((error: unknown) => {
          alertApiError(error);
          return false;
        }),
    addMember: (teamId, userId) =>
      addTeamMembers(group, teamId, [userId]).then(reload).catch(alertApiError),
    createStudyTeam: (input) =>
      runCreate(() =>
        createStudy({
          name: input.name,
          studyKind: input.studyKind,
          track: input.track,
          period: input.isVacation ? '방학' : '학기',
          semester: semesterLabelOf(input.cohort),
          leaderId: leaderIdOf(input.members, input.leaderName),
          memberIds: input.members.map((user) => user.id),
          weekDates: input.weekDates ? { ...input.weekDates } : undefined,
        }),
      ),
    createAdv: (input) =>
      runCreate(() =>
        createAdvTeam({
          term: input.cohort,
          track: input.track,
          teamName: input.teamName ?? undefined,
          memberIds: input.members.map((user) => user.id),
          leaderId: leaderIdOf(input.members, input.leaderName),
          weekNums: input.weekNums ? [...input.weekNums] : undefined,
          weekDates: input.weekDates ? { ...input.weekDates } : undefined,
        }),
      ),
    createBase: (input) =>
      runCreate(() =>
        createBaseTrack({
          semester: semesterLabelOf(input.cohort),
          track: input.track,
          memberIds: input.members.map((user) => user.id),
          weekNums: input.weekNums ? [...input.weekNums] : undefined,
          weekDates: input.weekDates ? { ...input.weekDates } : undefined,
        }),
      ),
  };
}
