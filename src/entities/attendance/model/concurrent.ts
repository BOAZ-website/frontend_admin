import type { Member, StudyTeamInfo } from '@/entities/study-team/model/types';

/** 같은 기수의 BASE와 ADV/스터디에 속한 원본 사용자 ID로 병행 여부를 판정한다. */
export function isConcurrentBaseMember(
  memberId: string,
  memberTeamId: string,
  cohort: number,
  baseTeams: readonly StudyTeamInfo[],
  otherTeams: readonly StudyTeamInfo[],
  membersMap: Readonly<Record<string, readonly Member[]>>,
): boolean {
  const userId = memberId.startsWith(`${memberTeamId}_`)
    ? memberId.slice(memberTeamId.length + 1)
    : memberId;
  const includesUser = (team: StudyTeamInfo) =>
    team.cohort === cohort &&
    (membersMap[team.id] ?? []).some(
      (member) => member.id === `${team.id}_${userId}` || member.id === userId,
    );
  return baseTeams.some(includesUser) && otherTeams.some(includesUser);
}
