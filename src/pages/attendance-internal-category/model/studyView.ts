import { studyDisplayName, studyLeaderLabel } from '@/entities/study-team/model/db';
import type { Member, StudyTeamInfo } from '@/entities/study-team/model/types';

import type { InternalAttendee, TeamMeta } from '../ui/InternalCategoryAttendancePage';

export interface StudyView {
  teams: TeamMeta[];
  attendees: InternalAttendee[];
}

/**
 * 공용 스터디 저장소(팀·부원)를 스터디 출결 관리 화면이 쓰는 형태(TeamMeta·InternalAttendee)로 바꾼다.
 * 이 화면은 스터디 데이터를 따로 들고 있지 않고 항상 저장소에서 파생해서 조회한다.
 * 출결 상태는 여기서 채우지 않고(기본 미정) 저장소의 출결 기록에서 직접 읽는다.
 */
export function buildStudyView(
  teams: readonly StudyTeamInfo[],
  membersMap: Readonly<Record<string, readonly Member[]>>,
  eventId: string,
): StudyView {
  const metaTeams = teams.map<TeamMeta>((team) => {
    const members = membersMap[team.id] ?? [];
    return {
      id: team.id,
      name: studyDisplayName(team),
      leader: team.leaderName,
      leaderLabel: studyLeaderLabel(team, members),
      description: team.description ?? '',
      memberCount: members.length,
      studyKind: team.studyKind ?? 'GENERAL',
      track: team.track,
      termPeriod: team.studyType === '방학 스터디' ? 'VACATION' : 'SEMESTER',
    };
  });

  const attendees = teams.flatMap<InternalAttendee>((team) =>
    (membersMap[team.id] ?? []).map((member) => ({
      id: member.id,
      eventId,
      teamId: team.id,
      teamName: studyDisplayName(team),
      name: member.name,
      term: Number(member.year) || 0,
      track: member.track ?? '',
      status: 'unmarked',
      checkedInAt: '-',
    })),
  );

  return { teams: metaTeams, attendees };
}
