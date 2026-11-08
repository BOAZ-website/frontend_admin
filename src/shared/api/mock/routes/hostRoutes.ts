/**
 * 그룹 계정 관리(HOST 계정) API. 백엔드 HOST 계정·그룹 리더 설계문서(2026-11-06판) 2·3절의 동작을 따른다.
 *   · 계정은 회원에 묶인다. 계정이 있는 회원은 팀장으로 지정되는 순간 그 팀 권한이 생기므로 "권한 추가" 단계가 없다.
 *   · 계정이 없는 팀장에게만 HOST 계정을 발급한다. 운영진이 팀장이면 운영진 계정을 그대로 쓴다.
 *   · 계정 삭제 API는 없다. 팀장 변경·팀 삭제·반기 전환 때 서버가 정리한다(hostCleanup.ts).
 *   · 비밀번호 초기화는 운영진 계정과 같은 PATCH /api/v1/admin/accounts/:accountId/password를 쓴다.
 */
import type { Database } from 'sql.js';

import { insertAdmin, hasAdminAccount } from '@/entities/admin-account/api/adminAccountRepository';
import { isWithdrawn } from '@/entities/club-member/api/clubMemberRepository';
import { listGroupLeaderAccounts } from '@/entities/host-account/api/hostRepository';
import type { HostIssueResponse } from '@/entities/host-account/model/dto';
import { queryAll } from '@/shared/db/createDatabase';

import { groupStates } from '../groupState';
import { notFound } from '../queries';
import { ApiError, type MockRoute } from '../router';
import { readBody, requiredString } from '../validate';
import { requireAny } from './adminAccountRoutes';
import { requireUnusedLoginUsername } from './authRoutes';

/** HOST 계정의 기본 권한 세트를 정하는 운영진 자리 이름(설계 3.2: role = HOST, team_name = 그룹리더). */
const HOST_TEAM_NAME = '그룹리더';
/** 아이디 형식: 4~20자, 영문 소문자·숫자·밑줄(설계 3.2 발급 검증, 운영진 계정과 같은 규칙). */
const USERNAME_PATTERN = /^[a-z0-9_]{4,20}$/;

const conflict = (code: string, message: string) => new ApiError(409, code, message);

/** 진행 중인 그룹(ADV 팀·스터디) id. 그룹 계정 관리 표와 발급 대상이 이 그룹만 다룬다(설계 2.1·3.2). */
function inProgressTeamIds(db: Database): Set<string> {
  return new Set(
    [...groupStates(db).entries()]
      .filter(([, state]) => state === 'IN_PROGRESS')
      .map(([teamId]) => teamId),
  );
}

/** 발급 대상 팀의 현재 팀장. 진행 중인 그룹이 아니거나 팀장이 없으면 409다. */
function leaderOfIssuableTeam(db: Database, teamId: string): string {
  const team = queryAll<{ leader_id: string | null }>(
    db,
    "SELECT leader_id FROM teams WHERE id = ? AND group_type IN ('ADV', 'STUDY')",
    [teamId],
  )[0];
  if (!team) throw notFound('팀을 찾을 수 없습니다.');
  if (!inProgressTeamIds(db).has(teamId)) {
    throw conflict(
      'GROUP_NOT_IN_PROGRESS',
      '진행 중인 그룹의 팀장에게만 계정을 발급할 수 있습니다.',
    );
  }
  if (!team.leader_id) {
    throw conflict('LEADER_NOT_ASSIGNED', '출결 관리에서 팀장을 먼저 지정해 주세요.');
  }
  return team.leader_id;
}

export const hostRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/hosts',
    summary:
      '그룹 계정 관리 표. 현재 반기의 진행 중인 그룹마다 현재 팀장과 그 계정(운영진 계정 포함, 없으면 account: null = 발급 필요)',
    handler: ({ db }) => {
      requireAny(db, 'HOST_ACCOUNT_READ', 'HOST_ACCOUNT_WRITE');
      return listGroupLeaderAccounts(db, inProgressTeamIds(db));
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/hosts',
    summary:
      'HOST 계정 발급 { teamId, username, password }. 계정 주인은 그 팀의 현재 팀장이다. 아이디 형식 400, 진행 중이 아닌 그룹·팀장 없음·아이디 중복·탈퇴 회원·이미 계정이 있는 회원 409',
    handler: ({ db, body }): HostIssueResponse => {
      const actor = requireAny(db, 'HOST_ACCOUNT_WRITE');
      const input = readBody(body);
      const userId = leaderOfIssuableTeam(db, requiredString(input, 'teamId'));
      const username = requiredString(input, 'username').trim();
      const password = requiredString(input, 'password');
      if (!USERNAME_PATTERN.test(username)) {
        throw new ApiError(
          400,
          'INVALID_INPUT_VALUE',
          '아이디는 4~20자의 영문 소문자, 숫자, 밑줄(_)만 쓸 수 있습니다.',
        );
      }
      if (!password.trim()) {
        throw new ApiError(400, 'INVALID_INPUT_VALUE', '초기 비밀번호를 입력해 주세요.');
      }
      requireUnusedLoginUsername(db, username);
      if (isWithdrawn(db, userId)) {
        throw conflict('MEMBER_WITHDRAWN', '탈퇴한 동아리원에게는 계정을 발급할 수 없습니다.');
      }
      if (hasAdminAccount(db, userId)) {
        throw conflict('DUPLICATE_MEMBER_ACCOUNT', '이 팀장은 이미 계정이 있습니다.');
      }
      // 계정이 생기면 트리거가 이 회원이 팀장인 현재 반기 팀을 맡은 그룹으로 붙인다.
      const id = insertAdmin(db, {
        user_id: userId,
        username,
        password,
        role: 'HOST',
        team_name: HOST_TEAM_NAME,
        created_by: actor.id,
      });
      return { id, userId, username };
    },
  },
];
