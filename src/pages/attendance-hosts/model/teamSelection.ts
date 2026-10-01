import type { GroupType } from '@/entities/host-account/model/types';

export interface ConfiguredTeam {
  id: string;
  leaderId?: string;
  teamName: string;
  defaultLeader: string;
  track?: string;
}

export function resolveConfiguredTeam(
  groupType: GroupType,
  selectedTeamId: string,
  advTeams: readonly ConfiguredTeam[],
  studyTeams: readonly ConfiguredTeam[],
): ConfiguredTeam | null {
  if (!selectedTeamId) return null;

  const teams = groupType === 'ADV' ? advTeams : studyTeams;
  return teams.find((team) => team.id === selectedTeamId) ?? null;
}

export function replaceTeamLeader<T extends { id: string; leaderName: string }>(
  teams: T[],
  teamId: string,
  leaderName: string,
  leaderId?: string,
): T[] {
  if (!teams.some((team) => team.id === teamId)) return teams;
  return teams.map((team) =>
    team.id === teamId ? { ...team, leaderName, ...(leaderId ? { leaderId } : {}) } : team,
  );
}
