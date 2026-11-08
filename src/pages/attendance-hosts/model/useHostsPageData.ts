/**
 * 그룹 계정 관리 화면 데이터. 화면을 열 때 진행 중인 그룹의 팀장 계정·현재 반기의 ADV/스터디 팀·회원을 API로 읽고,
 * 계정 발급·비밀번호 초기화도 API로 한 뒤 다시 읽는다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { changeAdminPassword } from '@/entities/admin-account/api/adminAccountApi';
import { fetchGroupLeaderAccounts, issueHostAccount } from '@/entities/host-account/api/hostApi';
import type { HostIssueRequest } from '@/entities/host-account/model/dto';
import type { GroupLeaderAccount } from '@/entities/host-account/model/types';
import { fetchTeams } from '@/entities/study-team/api/teamApi';
import { splitTeamList } from '@/entities/study-team/model/adapters';
import type { TeamListItemDto } from '@/entities/study-team/model/dto';
import type { StudyTeamInfo } from '@/entities/study-team/model/types';
import { fetchUsers } from '@/entities/user/api/usersApi';
import type { UserProfile } from '@/entities/user/model/types';

interface HostsPageSource {
  leaders: GroupLeaderAccount[];
  advTeams: TeamListItemDto[];
  studyTeams: TeamListItemDto[];
  users: UserProfile[];
}

export interface HostsPageData {
  status: 'loading' | 'ready' | 'error';
  error: Error | null;
  /** 진행 중인 그룹마다 현재 팀장과 그 계정(표의 행). */
  leaders: GroupLeaderAccount[];
  advTeams: StudyTeamInfo[];
  studyTeams: StudyTeamInfo[];
  users: UserProfile[];
  /** 계정이 없는 팀장에게 HOST 계정을 발급한다. */
  issueAccount: (request: HostIssueRequest) => Promise<void>;
  /** 계정 비밀번호를 운영지원팀이 정한 값으로 초기화한다. */
  resetPassword: (accountId: number, password: string) => Promise<void>;
}

const EMPTY_SOURCE: HostsPageSource = { leaders: [], advTeams: [], studyTeams: [], users: [] };

/** @param onChanged 발급·초기화가 끝난 뒤 다른 화면 데이터도 다시 읽게 할 때 쓴다. */
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
      fetchGroupLeaderAccounts(),
      fetchTeams('ADV'),
      // 스터디 목록 API는 기간을 생략하면 지금 기간(방학·학기) 스터디만 준다.
      // 표에 어떤 팀을 보일지는 계정 API(진행 중인 그룹)가 정하므로 두 기간을 모두 읽어 둔다.
      fetchTeams('STUDY', { period: 'all' }),
      fetchUsers(),
    ])
      .then(([leaders, adv, study, users]) => {
        if (!isCancelled) {
          setState({
            source: { leaders, advTeams: adv.teams, studyTeams: study.teams, users },
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
  const view = useMemo(
    () => ({
      advTeams: splitTeamList(source.advTeams).teams,
      studyTeams: splitTeamList(source.studyTeams).teams,
    }),
    [source],
  );

  const issueAccount = useCallback(
    async (request: HostIssueRequest) => {
      await issueHostAccount(request);
      reload();
    },
    [reload],
  );

  const resetPassword = useCallback(
    async (accountId: number, password: string) => {
      await changeAdminPassword(accountId, { newPassword: password });
      reload();
    },
    [reload],
  );

  return {
    status: state.status,
    error: state.error,
    leaders: source.leaders,
    users: source.users,
    ...view,
    issueAccount,
    resetPassword,
  };
}
