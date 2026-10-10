/**
 * 팀 API 응답(TeamDto·MemberDto)을 화면이 쓰는 모양(StudyTeamInfo·Member)으로 바꾼다.
 * 백엔드 명세가 바뀌면 이 변환만 고치고 화면은 그대로 둔다.
 */
import type { SessionDto } from '@/entities/attendance/model/dto';
import { sessionKey } from '@/entities/attendance/model/lib';
import type {
  AttendanceState,
  AttendanceStatus,
  SessionRecord,
} from '@/entities/attendance/model/types';

import type { MemberDto, TeamDto, TeamListItemDto } from './dto';
import type { Member, StudyTeamInfo } from './types';

export function toStudyTeamInfo(team: TeamDto): StudyTeamInfo {
  return {
    id: team.id,
    ...(team.leaderId ? { leaderId: team.leaderId } : {}),
    teamName: team.teamName,
    studyName: team.studyName,
    leaderName: team.leaderName ?? '',
    category: team.track,
    schedule: team.schedule,
    studyType: team.period === '학기' ? '학기 스터디' : '방학 스터디',
    studyKind: team.kind,
    track: team.track,
    description: team.description,
    createdAt: team.createdAt,
    cohort: team.cohort,
  };
}

export function toMember(member: MemberDto): Member {
  return {
    id: member.id,
    userId: member.userId,
    name: member.name,
    year: String(member.term),
    track: member.track,
  };
}

/** 팀 목록 응답을 팀 목록과 팀 id → 팀원 대응표로 나눈다. */
export function splitTeamList(teams: readonly TeamListItemDto[]): {
  teams: StudyTeamInfo[];
  members: Record<string, Member[]>;
} {
  return {
    teams: teams.map(toStudyTeamInfo),
    members: Object.fromEntries(teams.map((team) => [team.id, team.members.map(toMember)])),
  };
}

/** 출결 기록 키. 멘멘 스터디는 "팀원id:멘멘" / "팀원id:친바", 그 외에는 팀원 id. */
export function memberKeyOf(memberId: string, subType: string): string {
  return subType ? `${memberId}:${subType}` : memberId;
}

/** 팀 하나의 주차별 출결 응답을 화면의 출결 상태(sessionKey → 기록)로 바꾼다. */
export function toAttendanceState(
  teamId: string,
  sessions: readonly SessionDto[],
): AttendanceState {
  return Object.fromEntries(
    sessions.map((session) => {
      const statuses: Record<string, AttendanceStatus> = {};
      const memos: Record<string, string> = {};
      session.records.forEach((record) => {
        const key = memberKeyOf(record.memberId, record.subType);
        statuses[key] = record.status;
        if (record.memo) memos[key] = record.memo;
      });
      const record: SessionRecord = {
        statuses,
        memos,
        photo: session.photo ? (session.photo.name ?? session.photo.url) : null,
        photoUrl: session.photo?.url ?? null,
        photoName: session.photo?.name ?? null,
        photoSize: session.photo?.size ?? null,
        pdfUrl: session.pdf?.url ?? null,
        pdfName: session.pdf?.name ?? null,
        pdfSize: session.pdf?.size ?? null,
        submitted: session.submitted,
        submittedAt: session.submittedAt,
      };
      return [sessionKey(`w${session.weekNum}`, 'study', teamId), record];
    }),
  );
}

/** include=sessions로 받은 팀 목록 전체의 출결 상태. */
export function attendanceOfTeams(teams: readonly TeamListItemDto[]): AttendanceState {
  return Object.assign({}, ...teams.map((team) => toAttendanceState(team.id, team.sessions ?? [])));
}
