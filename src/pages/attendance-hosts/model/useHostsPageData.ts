/**
 * HOST 관리 화면 데이터. 화면을 열 때 HOST 계정·현재 반기의 ADV/스터디 팀·회원을 API로 읽고,
 * 저장·삭제도 API로 한 뒤 다시 읽는다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createHost, fetchHosts, updateHost } from '@/entities/host-account/api/hostApi';
import type { HostUpsertRequest } from '@/entities/host-account/model/dto';
import type { HostAccount } from '@/entities/host-account/model/types';
import { fetchTeams } from '@/entities/study-team/api/teamApi';
import { splitTeamList } from '@/entities/study-team/model/adapters';
import type { TeamListItemDto } from '@/entities/study-team/model/dto';
import type { Member, StudyTeamInfo } from '@/entities/study-team/model/types';
import { fetchUsers } from '@/entities/user/api/usersApi';
import type { UserProfile } from '@/entities/user/model/types';

interface HostsPageSource {
  hosts: HostAccount[];
  advTeams: TeamListItemDto[];
  studyTeams: TeamListItemDto[];
  users: UserProfile[];
}

export interface HostsPageData {
  status: 'loading' | 'ready' | 'error';
  error: Error | null;
  hosts: HostAccount[];
  advTeams: StudyTeamInfo[];
  studyTeams: StudyTeamInfo[];
  membersMap: Record<string, Member[]>;
  users: UserProfile[];
  /** 계정을 만들거나 고치고, 팀장 이름이 그 팀의 팀원이면 팀장으로 지정한다. */
  saveHost: (account: HostAccount) => Promise<void>;
  resetPassword: (hostId: string, password: string) => Promise<void>;
}

const EMPTY_SOURCE: HostsPageSource = { hosts: [], advTeams: [], studyTeams: [], users: [] };

/** 화면의 계정 모양을 생성·수정 API 본문으로 바꾼다. */
function toHostRequest(account: HostAccount): HostUpsertRequest {
  return {
    username: account.username,
    initialPassword: account.initialPassword,
    userId: account.userId,
    hostName: account.hostName,
    generation: account.generation,
    track: account.track,
    role: account.role,
    accountType: account.accountType,
    teamId: account.teamId ?? null,
    permissions: account.permissions,
    assignedTeamIds: (account.assignedGroups ?? [])
      .map((group) => group.teamId)
      .filter((teamId): teamId is string => Boolean(teamId)),
    concurrentRoles: account.concurrentRoles,
    active: account.active,
  };
}

/** @param onChanged 저장·삭제가 끝난 뒤 다른 화면 데이터도 다시 읽게 할 때 쓴다. */
export function useHostsPageData(onChanged?: () => void): HostsPageData {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    source: HostsPageSource;
    status: HostsPageData['status'];
    error: Error | null;
  }>({
    source: EMPTY_SOURCE,
    status: 'loading',
    error: null,
  });

  useEffect(() => {
    let isCancelled = false;
    Promise.all([
      fetchHosts({ active: true }),
      fetchTeams('ADV'),
      // 스터디 목록 API는 기간을 생략하면 지금 기간(방학·학기) 스터디만 준다.
      // 계정 관리는 반기 안의 모든 스터디 계정을 다뤄야 하므로 두 기간을 모두 읽는다.
      fetchTeams('STUDY', { period: 'all' }),
      fetchUsers(),
    ])
      .then(([hosts, adv, study, users]) => {
        if (!isCancelled) {
          setState({
            source: { hosts, advTeams: adv.teams, studyTeams: study.teams, users },
            status: 'ready',
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          }));
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => {
    setVersion((value) => value + 1);
    onChanged?.();
  }, [onChanged]);

  const { source } = state;
  const view = useMemo(() => {
    const adv = splitTeamList(source.advTeams);
    const study = splitTeamList(source.studyTeams);
    return {
      advTeams: adv.teams,
      studyTeams: study.teams,
      membersMap: { ...adv.members, ...study.members },
    };
  }, [source]);

  const saveHost = useCallback(
    async (account: HostAccount) => {
      const request = toHostRequest(account);
      if (source.hosts.some((host) => host.id === account.id)) {
        await updateHost(account.id, request);
      } else {
        await createHost({ ...request, username: account.username });
      }

      // 팀장은 그 팀의 팀원 중에서만 지정한다(같은 이름·기수·부문의 회원).
      reload();
    },
    [source, reload],
  );

  const resetPassword = useCallback(
    async (hostId: string, password: string) => {
      await updateHost(hostId, { initialPassword: password });
      reload();
    },
    [reload],
  );

  return {
    status: state.status,
    error: state.error,
    hosts: source.hosts,
    users: source.users,
    ...view,
    saveHost,
    resetPassword,
  };
}
