export interface HostAccount {
  id: string;
  username: string;
  initialPassword?: string;
  hostName?: string;
  team: string;
  createdAt: string;
  active: boolean;
  lastLogin?: string;
}
