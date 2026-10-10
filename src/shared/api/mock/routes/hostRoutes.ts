/**
 * HOST 계정·권한 API. 계정 생성과 수정은 같은 본문 형식을 쓰며, 담당 팀·STUDY/ADV 권한·팀장 연결·활성화를
 * 한 요청에서 함께 바꿀 수 있다(HOST 관리 화면이 저장 버튼 하나로 이 값들을 함께 보낸다).
 */
import type { Database } from 'sql.js';

import { loadHosts, persistHosts } from '@/entities/host-account/api/hostRepository';
import type { AssignedGroup, HostAccount } from '@/entities/host-account/model/types';
import { execute } from '@/shared/db/createDatabase';

import { managedTeamIds, teamIdsOfSemester } from '../hostCleanup';
import { findTeam, notFound, resolveSemester } from '../queries';
import { ApiError, type MockRoute } from '../router';
import {
  type Body,
  oneOf,
  optionalBoolean,
  optionalString,
  readBody,
  requiredString,
  stringArray,
} from '../validate';

type Permission = 'ADV' | 'STUDY';
const PERMISSIONS: readonly Permission[] = ['ADV', 'STUDY'];

function findHost(db: Database, hostId: string): HostAccount {
  const host = loadHosts(db).find((item) => item.id === hostId);
  if (!host) throw notFound('HOST 계정을 찾을 수 없습니다.');
  return host;
}

const groupTypeOf = (group: string) => (group === 'ADV' ? 'ADV' : '스터디');

/** 본문에 있는 값만 기존 계정 위에 덮어쓴 새 계정을 만든다. 없는 키는 기존 값을 유지한다. */
function applyHostBody(db: Database, base: HostAccount, body: Body): HostAccount {
  const permissions = 'permissions' in body ? stringArray(body, 'permissions') : undefined;
  permissions?.forEach((permission) => oneOf(permission, PERMISSIONS, 'permissions'));

  const teamId = 'teamId' in body ? optionalString(body, 'teamId') || null : undefined;
  const team = teamId ? findTeam(db, teamId) : null;
  if (team && team.group === 'BASE') {
    throw new ApiError(400, 'INVALID_TEAM', 'HOST 계정은 스터디·ADV 팀만 담당할 수 있습니다.');
  }

  const assignedGroups =
    'assignedTeamIds' in body
      ? stringArray(body, 'assignedTeamIds').map((id): AssignedGroup => {
          const assigned = findTeam(db, id);
          return {
            type: groupTypeOf(assigned.group),
            teamName: assigned.teamName,
            teamId: assigned.id,
          };
        })
      : undefined;

  const pick = (key: string) => (key in body ? optionalString(body, key) : undefined);
  return {
    ...base,
    ...(pick('username') !== undefined ? { username: pick('username') as string } : {}),
    ...(pick('initialPassword') !== undefined ? { initialPassword: pick('initialPassword') } : {}),
    ...(pick('userId') !== undefined ? { userId: pick('userId') || undefined } : {}),
    ...(pick('hostName') !== undefined ? { hostName: pick('hostName') } : {}),
    ...(pick('generation') !== undefined ? { generation: pick('generation') } : {}),
    ...(pick('track') !== undefined ? { track: pick('track') } : {}),
    ...(pick('role') !== undefined ? { role: pick('role') } : {}),
    ...('accountType' in body
      ? { accountType: oneOf(optionalString(body, 'accountType'), PERMISSIONS, 'accountType') }
      : {}),
    ...(teamId !== undefined
      ? {
          teamId: team?.id,
          team: team?.teamName ?? '',
          groupType: team ? groupTypeOf(team.group) : undefined,
        }
      : {}),
    ...(permissions ? { permissions: permissions as Permission[] } : {}),
    ...(assignedGroups ? { assignedGroups } : {}),
    ...('concurrentRoles' in body ? { concurrentRoles: stringArray(body, 'concurrentRoles') } : {}),
    ...(optionalBoolean(body, 'active') !== undefined
      ? { active: optionalBoolean(body, 'active') as boolean }
      : {}),
  };
}

/** linkLeader가 true면 계정 주인을 담당 팀의 팀장으로 연결한다. */
function linkLeaderIfRequested(db: Database, hostId: string, body: Body): HostAccount {
  const host = findHost(db, hostId);
  if (optionalBoolean(body, 'linkLeader') !== true) return host;
  if (!host.userId || !host.teamId) {
    throw new ApiError(
      400,
      'LEADER_LINK_UNAVAILABLE',
      '팀장으로 연결하려면 계정 주인과 담당 팀이 모두 있어야 합니다.',
    );
  }
  execute(db, 'UPDATE teams SET leader_id = ? WHERE id = ?', [host.userId, host.teamId]);
  return host;
}

export const hostRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/hosts',
    summary:
      'HOST 계정 목록. 반기의 팀을 맡은 계정과 팀 개설 대기 계정만(semester 생략 시 현재 반기, all이면 전체). active·permission·teamId로 거른다',
    handler: ({ db, query }) => {
      const active = query.get('active');
      const permission = oneOf(query.get('permission') ?? undefined, PERMISSIONS, 'permission');
      const teamId = query.get('teamId');
      const semesterParam = query.get('semester');
      const semesterTeams =
        semesterParam === 'all'
          ? null
          : teamIdsOfSemester(db, resolveSemester(db, semesterParam).cohort);
      return loadHosts(db).filter(
        (host) =>
          (semesterTeams === null ||
            managedTeamIds(host).length === 0 ||
            managedTeamIds(host).some((id) => semesterTeams.has(id))) &&
          (active === null || host.active === (active === 'true')) &&
          (!permission || (host.permissions ?? []).includes(permission)) &&
          (!teamId ||
            host.teamId === teamId ||
            (host.assignedGroups ?? []).some((group) => group.teamId === teamId)),
      );
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/hosts/:hostId',
    summary: 'HOST 계정 상세',
    handler: ({ db, params }) => findHost(db, params.hostId),
  },
  {
    method: 'GET',
    pattern: '/api/v1/hosts/:hostId/teams',
    summary: 'HOST가 출결을 입력할 수 있는 팀 목록(담당 팀 + 맡은 그룹, 권한별로 구분)',
    handler: ({ db, params }) => {
      const host = findHost(db, params.hostId);
      const teamIds = [
        host.teamId,
        ...(host.assignedGroups ?? []).map((group) => group.teamId),
      ].filter((id): id is string => Boolean(id));
      return [...new Set(teamIds)]
        .map((id) => findTeam(db, id))
        .filter((team) => (host.permissions ?? []).includes(team.group as Permission));
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/hosts',
    summary: 'HOST 계정 생성(담당 팀·권한·맡은 그룹·겸직·활성 여부, linkLeader로 팀장 연결)',
    handler: ({ db, body }) => {
      const input = readBody(body);
      const draft: HostAccount = {
        id: `h_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        username: requiredString(input, 'username'),
        team: '',
        createdAt: new Date().toISOString().slice(0, 10),
        active: true,
      };
      const host = applyHostBody(db, draft, input);
      persistHosts(db, [], [host]);
      return linkLeaderIfRequested(db, host.id, input);
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/hosts/:hostId',
    summary: 'HOST 계정 삭제(권한·맡은 그룹·겸직 기록도 함께 지워진다)',
    handler: ({ db, params }) => {
      const host = findHost(db, params.hostId);
      execute(db, 'DELETE FROM host_accounts WHERE id = ?', [host.id]);
      return { deleted: host.id };
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/hosts/:hostId',
    summary: 'HOST 계정 수정(보낸 값만 바뀐다). active로 활성화·비활성화, linkLeader로 팀장 연결',
    handler: ({ db, params, body }) => {
      const input = readBody(body);
      const current = findHost(db, params.hostId);
      const next = applyHostBody(db, current, input);
      if (!next.username) throw new ApiError(400, 'BAD_REQUEST', 'username 값이 필요합니다.');
      persistHosts(db, [current], [next]);
      return linkLeaderIfRequested(db, current.id, input);
    },
  },
];
