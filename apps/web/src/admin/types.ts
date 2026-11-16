export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'scorer';
  active: boolean;
  mustChangePassword: boolean;
  version: number;
}
export interface Season {
  id: string;
  name: string;
  timezone: string;
  active: boolean;
  archived: boolean;
  version: number;
}
export interface Team {
  id: string;
  name: string;
  archived: boolean;
  version: number;
}
export interface Competition {
  id: string;
  seasonId: string;
  name: string;
  slug: string;
  format: string;
  groupCount: number;
  duration: number;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  groupCapacity: number;
  qualifiers: number;
  rulesConfirmed: boolean;
  published: boolean;
  archived: boolean;
  version: number;
  groups: { id: string; name: string }[];
}
export interface Entry {
  id: string;
  teamId: string;
  competitionId: string;
  name: string;
}
