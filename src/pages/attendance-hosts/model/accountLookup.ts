import type { AssignedGroup, HostAccount } from '@/entities/host-account/model/types';

export type HostPermission = 'ADV' | 'STUDY';

export interface HostIdentityQuery {
  name: string;
  generation: string;
  track: string;
}

const normalizeHostName = (value: string | undefined) =>
  (value || '').replace(/\s*\(.*\)/, '').trim();

export const findHostAccountByIdentity = (
  accounts: HostAccount[],
  query: HostIdentityQuery,
): HostAccount | null => {
  const normalizedName = normalizeHostName(query.name);
  const generation = query.generation.trim();
  const track = query.track.trim();

  if (!normalizedName || !generation || !track) return null;

  return (
    accounts.find(
      (account) =>
        normalizeHostName(account.hostName) === normalizedName &&
        (account.generation || '').trim() === generation &&
        (account.track || '').trim() === track,
    ) || null
  );
};

export const getHostPermissions = (account: HostAccount): HostPermission[] => {
  if (account.permissions?.length) return account.permissions;
  if (account.accountType) return [account.accountType];
  return account.groupType === 'ADV' ? ['ADV'] : ['STUDY'];
};

export const addPermissionToHost = (
  account: HostAccount,
  permission: HostPermission,
  assignedGroup?: AssignedGroup,
): HostAccount => {
  const permissions = Array.from(new Set([...getHostPermissions(account), permission]));
  const assignedGroups = account.assignedGroups?.length
    ? [...account.assignedGroups]
    : account.team
      ? [
          {
            type: account.groupType || (account.accountType === 'ADV' ? 'ADV' : '스터디'),
            teamName: account.team,
          },
        ]
      : [];

  if (
    assignedGroup &&
    !assignedGroups.some(
      (group) => group.type === assignedGroup.type && group.teamName === assignedGroup.teamName,
    )
  ) {
    assignedGroups.push(assignedGroup);
  }

  return {
    ...account,
    permissions,
    assignedGroups,
  };
};
