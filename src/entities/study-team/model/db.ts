/**
 * 스터디 출결 입력·관리가 공유하는 "하나의 DB"에 대한 순수 함수 모음.
 * 저장소는 스터디(StudyTeamInfo[]) · 부원(Record<팀명, Member[]>) · 출결(AttendanceState) 세 덩어리이며,
 * 두 화면은 각자 복사본을 만들지 않고 이 저장소를 읽고(조회) 이 함수로만 변경한다(입력).
 * 백엔드가 붙으면 이 함수들이 API 호출로 대체된다.
 */
import { ALL_8_WEEKS, sessionKey } from '@/entities/attendance/model/lib';
import { DEFAULT_CURRENT_COHORT } from '@/entities/cohort/model/lib';
import type { AttendanceState, AttendanceStatus } from '@/entities/attendance/model/types';
import type { UserProfile } from '@/entities/user/model/types';

import type { Member, StudyTeamInfo } from './types';

export const MENTORING_TYPE_LABELS = ['멘멘', '친바'] as const;
export type MentoringTypeLabel = (typeof MENTORING_TYPE_LABELS)[number];

export interface CreateStudyInput {
  id: string;
  name: string;
  studyKind: 'MENTORING' | 'GENERAL';
  /** 부문(분석·시각화·엔지니어링). 이름은 같은 부문 안에서만 겹칠 수 없다. */
  track: string;
  isVacation: boolean;
  /** 활동 기수. 없으면 기본(현재) 기수. */
  cohort?: number;
  leaderName: string | null;
  members: readonly UserProfile[];
}

/** 출결 셀 하나의 변경. memberKey는 일반 스터디는 멤버ID, 멘멘 스터디는 "멤버ID:멘멘" / "멤버ID:친바". */
export interface AttendanceChange {
  /** 팀 id (팀 이름은 부문이 다르면 겹칠 수 있다) */
  teamId: string;
  weekNum: number;
  memberKey: string;
  status?: AttendanceStatus;
  memo?: string;
}

/**
 * 스터디 생성 저장이 DB에서 거부됐을 때 사용자에게 보여줄 문구. 이름을 화면에서 검사하는 것이 아니라
 * DB(백엔드)가 돌려준 거부 사유를 알아보기 쉽게 옮기는 것이다. 모르는 사유는 원문을 덧붙인다.
 */
export function describeStudyCreateError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/UNIQUE constraint failed: teams\.cohort, teams\.track, teams\.team_name/.test(message)) {
    return '같은 기수·부문에 이미 사용 중인 스터디 이름입니다. 다른 이름을 쓰거나 다른 부문으로 만들어 주세요.';
  }
  return `스터디를 만들지 못했습니다. (${message})`;
}

export function memberKeysOf(memberId: string, isMentoring: boolean): string[] {
  return isMentoring
    ? [memberId, ...MENTORING_TYPE_LABELS.map((label) => `${memberId}:${label}`)]
    : [memberId];
}

/** 새 스터디의 팀·부원·1~8주차 미정 출결 레코드를 만든다(스터디는 방학·학기 모두 1~8주차 표). 팀 이름은 입력값 그대로다. */
export function createStudyRecords(
  input: CreateStudyInput,
  today: string = new Date().toISOString().slice(0, 10),
): { team: StudyTeamInfo; members: Member[]; attendance: AttendanceState } {
  const teamName = input.name; // 입력한 이름 그대로 쓴다
  const isMentoring = input.studyKind === 'MENTORING';

  const team: StudyTeamInfo = {
    id: input.id,
    teamName,
    studyName: input.name,
    category: input.track,
    leaderName: input.leaderName ?? '팀장 미정',
    schedule: '미정',
    studyType: input.isVacation ? '방학 스터디' : '학기 스터디',
    studyKind: input.studyKind,
    track: input.track,
    description: '',
    createdAt: today,
    cohort: input.cohort ?? DEFAULT_CURRENT_COHORT,
  };
  const members: Member[] = input.members.map((user) => ({
    id: `${input.id}_${user.id}`,
    name: user.name,
    year: String(user.term),
    track: user.track,
  }));

  const attendance: AttendanceState = {};
  const keys = members.flatMap((m) => memberKeysOf(m.id, isMentoring));
  ALL_8_WEEKS.forEach((week) => {
    attendance[sessionKey(week.id, 'study', input.id)] = {
      statuses: Object.fromEntries(keys.map((key) => [key, 'unmarked' as AttendanceStatus])),
      memos: {},
      photo: null,
      photoUrl: null,
      submitted: false,
      submittedAt: null,
    };
  });
  return { team, members, attendance };
}

/** 출결 셀 변경을 반영한 새 상태를 돌려준다. 해당 주차 레코드가 없으면 그대로 돌려준다. */
export function applyAttendanceChange(
  attendance: AttendanceState,
  change: AttendanceChange,
): AttendanceState {
  const key = sessionKey(`w${change.weekNum}`, 'study', change.teamId);
  const record = attendance[key];
  if (!record) return attendance;
  return {
    ...attendance,
    [key]: {
      ...record,
      statuses: change.status
        ? { ...record.statuses, [change.memberKey]: change.status }
        : record.statuses,
      memos:
        change.memo !== undefined
          ? { ...(record.memos ?? {}), [change.memberKey]: change.memo }
          : record.memos,
    },
  };
}

export function getStudyCell(
  attendance: AttendanceState,
  teamId: string,
  weekNum: number,
  memberKey: string,
): { status: AttendanceStatus; memo?: string } | undefined {
  const record = attendance[sessionKey(`w${weekNum}`, 'study', teamId)];
  const status = record?.statuses?.[memberKey];
  return status ? { status, memo: record?.memos?.[memberKey] } : undefined;
}

/** 스터디장 표시 라벨. 예: "26기 분석 남민서" (부원 정보가 없으면 이름만). */
export function studyLeaderLabel(team: StudyTeamInfo, members: readonly Member[]): string {
  const leader = members.find((m) => m.name === team.leaderName);
  if (!leader) return team.leaderName;
  return [leader.year && `${leader.year}기`, leader.track, leader.name].filter(Boolean).join(' ');
}

/** 스터디 카드 제목. 팀명과 스터디명이 다르면 "팀명 (스터디명)". */
export function studyDisplayName(team: StudyTeamInfo): string {
  return team.studyName && team.studyName !== team.teamName
    ? `${team.teamName} (${team.studyName})`
    : team.teamName;
}

const BASE_TRACK_KEYS: Record<string, string> = {
  분석: 'analysis',
  시각화: 'vis',
  엔지니어링: 'eng',
};

/** BASE 트랙 팀 id. 기수와 트랙으로 정해진다(예: base_27_analysis). */
export function baseTeamId(cohort: number, track: string): string {
  return `base_${cohort}_${BASE_TRACK_KEYS[track] ?? track}`;
}

export interface CreateBaseAttendanceInput {
  cohort: number;
  /** 출결을 만들 BASE 트랙(분석·시각화·엔지니어링). */
  track: string;
  members: readonly UserProfile[];
  /** 이 기수의 주차 날짜 매핑(주차 번호 → YYYY-MM-DD). 입력한 주차만 담는다. */
  weekDates?: Readonly<Record<number, string>>;
  /**
   * 출결 세션을 만들 주차 번호. 서버가 내려준 주차 목록(현재 방학/학기 탭에 보이는 주차)이며,
   * 건너뛰는 주차가 있으면 그 주차는 들어 있지 않다. 없으면 방학 1~8주차.
   */
  weekNums?: readonly number[];
}

export interface CreateBaseAttendanceResult {
  team: StudyTeamInfo;
  isNewTeam: boolean;
  /** 이번에 새로 들어간 트랙원(이미 있던 사람은 제외). */
  addedMembers: Member[];
  /** 트랙의 1~8주차 세션에 새 트랙원을 미정으로 채워 넣은 출결 기록(바뀐 세션만). */
  attendance: AttendanceState;
}

/**
 * BASE 출결 생성. 그 기수·트랙의 팀이 없으면 새로 만들고, 고른 회원을 트랙원으로 넣은 뒤
 * 주어진 주차(기본 1~8주차)의 모든 세션에 미정 출결을 만든다. 이미 트랙원인 회원은 건너뛰고 기존 기록은 그대로 둔다.
 */
export function createBaseAttendanceRecords(
  input: CreateBaseAttendanceInput,
  baseTeams: readonly StudyTeamInfo[],
  membersMap: Readonly<Record<string, readonly Member[]>>,
  attendance: AttendanceState,
  today: string = new Date().toISOString().slice(0, 10),
): CreateBaseAttendanceResult {
  const id = baseTeamId(input.cohort, input.track);
  const existing = baseTeams.find((team) => team.id === id);
  const team: StudyTeamInfo = existing ?? {
    id,
    teamName: input.track,
    studyName: input.track,
    leaderName: '',
    category: input.track,
    schedule: '미정',
    studyType: '방학 스터디',
    studyKind: 'GENERAL',
    track: input.track,
    description: '',
    createdAt: today,
    cohort: input.cohort,
  };

  const currentIds = new Set((membersMap[id] ?? []).map((member) => member.id));
  const addedMembers: Member[] = input.members
    .map((user) => ({
      id: `${id}_${user.id}`,
      name: user.name,
      year: String(user.term),
      track: user.track,
    }))
    .filter((member) => !currentIds.has(member.id));

  const patch: AttendanceState = {};
  if (addedMembers.length > 0) {
    const weekNums = input.weekNums ?? ALL_8_WEEKS.map((week) => week.weekNum);
    weekNums.forEach((weekNum) => {
      const key = sessionKey(`w${weekNum}`, 'study', id);
      const base = attendance[key] ?? {
        statuses: {},
        memos: {},
        photo: null,
        submitted: false,
        submittedAt: null,
      };
      patch[key] = {
        ...base,
        statuses: {
          ...base.statuses,
          ...Object.fromEntries(
            addedMembers.map((member) => [member.id, 'unmarked' as AttendanceStatus]),
          ),
        },
      };
    });
  }

  return { team, isNewTeam: !existing, addedMembers, attendance: patch };
}

/** 한 팀의 한 주차를 제출 완료로 표시한다(상태값은 그대로). 세션이 없으면 그대로 돌려준다. */
export function markWeekSubmitted(
  attendance: AttendanceState,
  teamId: string,
  weekNum: number,
  submittedAt: string,
): AttendanceState {
  const key = sessionKey(`w${weekNum}`, 'study', teamId);
  const record = attendance[key];
  if (!record) return attendance;
  return { ...attendance, [key]: { ...record, submitted: true, submittedAt } };
}

export interface CreateAdvTeamInput {
  cohort: number;
  track: string;
  members: readonly UserProfile[];
  /** 이 기수의 주차 날짜 매핑(주차 번호 → YYYY-MM-DD). 입력한 주차만 담는다. */
  weekDates?: Readonly<Record<number, string>>;
  /** 출결 세션을 만들 주차 번호(서버가 내려준 주차 목록). 없으면 방학 1~8주차. */
  weekNums?: readonly number[];
}

export interface CreateAdvTeamResult {
  team: StudyTeamInfo;
  members: Member[];
  /** 팀의 각 주차 세션에 팀원을 미정으로 채운 출결 기록. */
  attendance: AttendanceState;
}

/**
 * ADV 팀 개설. 그 기수·부문의 다음 번호 팀(예: 분석 3팀)을 만들고, 고른 회원을 팀원으로 넣어
 * 주어진 주차(기본 1~8주차)의 모든 세션에 미정 출결을 만든다.
 */
export function createAdvTeamRecords(
  input: CreateAdvTeamInput,
  advTeams: readonly StudyTeamInfo[],
  today: string = new Date().toISOString().slice(0, 10),
): CreateAdvTeamResult {
  const sameTrack = advTeams.filter(
    (team) =>
      (team.cohort ?? DEFAULT_CURRENT_COHORT) === input.cohort && team.track === input.track,
  );
  const number = sameTrack.length + 1;
  const trackKey = BASE_TRACK_KEYS[input.track] ?? input.track;
  const id = `adv_${input.cohort}_${trackKey}_${number}`;
  const name = `${input.track} ${number}팀`;

  const team: StudyTeamInfo = {
    id,
    teamName: name,
    studyName: name,
    leaderName: '',
    category: input.track,
    schedule: '미정',
    studyType: '방학 스터디',
    studyKind: 'GENERAL',
    track: input.track,
    description: '',
    createdAt: today,
    cohort: input.cohort,
  };
  const members: Member[] = input.members.map((user) => ({
    id: `${id}_${user.id}`,
    name: user.name,
    year: String(user.term),
    track: user.track,
  }));

  const weekNums = input.weekNums ?? ALL_8_WEEKS.map((week) => week.weekNum);
  const attendance: AttendanceState = {};
  weekNums.forEach((weekNum) => {
    attendance[sessionKey(`w${weekNum}`, 'study', id)] = {
      statuses: Object.fromEntries(
        members.map((member) => [member.id, 'unmarked' as AttendanceStatus]),
      ),
      memos: {},
      photo: null,
      submitted: false,
      submittedAt: null,
    };
  });
  return { team, members, attendance };
}
