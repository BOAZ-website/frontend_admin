/**
 * 동아리원 관리 API. 동아리원 한 명은 임시 DB users 테이블의 한 행이며,
 * 추가·수정 시 그 기수·부문의 활동 명단(members) 행이 없으면 함께 만든다.
 * 새 기수는 보통 서류 평가의 합격자 승격으로 들어오고, 추가 API는 그 밖의 사람(예: 예전 수료 기수)을 넣을 때 쓴다.
 * 삭제(DELETE)는 행을 지우지 않고 탈퇴 처리(활동 상태 WITHDRAWN)다. 반기 명단·팀 소속·출결 기록은 그대로 남고,
 * 연결된 HOST 계정은 지운다(운영진은 운영진에서, 현재 반기 팀장은 팀장에서 먼저 빼야 하고, 이미 탈퇴한 사람은 다시 처리하지 않는다).
 * 탈퇴는 이 경로로만 한다. 정보 수정(PATCH)으로 활동 상태를 탈퇴로 바꾸면 400이다.
 */
import type { Database } from 'sql.js';

import {
  findClubMember,
  hasNameConflict,
  insertClubMember,
  isOperator,
  listClubMembers,
  listClubMembersByTerm,
  listClubMemberTerms,
  updateClubMember,
  currentLeaderTeamsOf,
  withdrawClubMember,
} from '@/entities/club-member/api/clubMemberRepository';
import {
  CLUB_MEMBER_PAGED_STATUSES,
  CLUB_MEMBER_ROLES,
  CLUB_MEMBER_STATUSES,
  CLUB_MEMBER_TRACKS,
  type ClubMember,
  type ClubMemberRole,
  type ClubMemberTermPage,
  type ClubMemberTermScope,
} from '@/entities/club-member/model/types';
import { ensureMemberProfile } from '@/entities/study-team/api/teamRepository';

import { notFound } from '../queries';
import { ApiError, type MockRoute } from '../router';
import {
  type Body,
  oneOf,
  optionalNumber,
  optionalString,
  parsePositiveInt,
  readBody,
  requiredString,
} from '../validate';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const badRequest = (message: string) => new ApiError(400, 'BAD_REQUEST', message);

function findMember(db: Database, memberId: string): ClubMember {
  const member = findClubMember(db, memberId);
  if (!member) throw notFound('동아리원을 찾을 수 없습니다.');
  return member;
}

/**
 * 수정 요청의 역할. 대표(PRESIDENT)는 따로 정하므로 그대로 받는다.
 * 운영진(OPERATOR)인지는 운영진 계정(admin 행)이 정하므로, 그 밖의 값은 admin 행과 맞을 때만 받는다(아니면 400).
 * 운영진으로 정하거나 빼는 것은 운영진 지정 API(PUT /admin/operators/:userId)로 한다.
 */
function roleOf(db: Database, base: ClubMember, body: Body): ClubMemberRole {
  const requested = oneOf(optionalString(body, 'role'), CLUB_MEMBER_ROLES, 'role');
  if (requested === undefined || requested === 'PRESIDENT') return requested ?? base.role;
  const derived: ClubMemberRole = isOperator(db, base.id) ? 'OPERATOR' : 'MEMBER';
  if (requested !== derived) {
    throw new ApiError(
      400,
      'ROLE_FOLLOWS_OPERATOR',
      '운영진 여부는 운영진 지정으로만 바꿀 수 있습니다.',
    );
  }
  return derived;
}

/**
 * 본문에 있는 값만 기존 동아리원 위에 덮어쓴다. 없는 키는 기존 값을 유지한다.
 * 탈퇴(WITHDRAWN)로 바꾸는 것은 탈퇴 처리(DELETE)로만 한다. 운영진 확인·HOST 계정 정지를 그 경로가 맡기 때문이다.
 */
function applyMemberBody(db: Database, base: ClubMember, body: Body): ClubMember {
  const text = (key: string) => optionalString(body, key);
  const status = oneOf(text('status'), CLUB_MEMBER_STATUSES, 'status') ?? base.status;
  if (status === 'WITHDRAWN' && base.status !== 'WITHDRAWN') {
    throw new ApiError(
      400,
      'WITHDRAW_BY_DELETE',
      '탈퇴는 정보 수정이 아니라 탈퇴 처리로만 할 수 있습니다.',
    );
  }
  return {
    ...base,
    name: text('name') ?? base.name,
    email: text('email') ?? base.email,
    phone: text('phone') ?? base.phone,
    university: text('university') ?? base.university,
    major: text('major') ?? base.major,
    term: optionalNumber(body, 'term') ?? base.term,
    track: oneOf(text('track'), CLUB_MEMBER_TRACKS, 'track') ?? base.track,
    status,
    role: roleOf(db, base, body),
  };
}

/** 추가 요청을 동아리원 한 명으로 만든다. 활동 상태를 보내지 않으면 활동(ACTIVE)이다. */
/** 추가할 때의 활동 상태. 없으면 활동기수다. 처음부터 탈퇴로 만들 수는 없다(탈퇴는 탈퇴 처리로만). */
function newMemberStatusOf(body: Body): ClubMember['status'] {
  const status = oneOf(optionalString(body, 'status'), CLUB_MEMBER_STATUSES, 'status') ?? 'ACTIVE';
  if (status === 'WITHDRAWN') {
    throw new ApiError(
      400,
      'WITHDRAW_BY_DELETE',
      '탈퇴는 동아리원 추가가 아니라 탈퇴 처리로만 할 수 있습니다.',
    );
  }
  return status;
}

function newMemberOf(body: Body): ClubMember {
  const term = optionalNumber(body, 'term');
  if (term === undefined || !Number.isInteger(term) || term <= 0) {
    throw badRequest('term 값은 1 이상의 정수여야 합니다.');
  }
  const track = oneOf(requiredString(body, 'track'), CLUB_MEMBER_TRACKS, 'track');
  if (!track) throw badRequest('track 값이 필요합니다.');
  return {
    id: `u_${term}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: (optionalString(body, 'name') ?? '').trim(),
    email: (optionalString(body, 'email') ?? '').trim(),
    phone: (optionalString(body, 'phone') ?? '').trim(),
    university: (optionalString(body, 'university') ?? '').trim(),
    major: (optionalString(body, 'major') ?? '').trim(),
    term,
    track,
    status: newMemberStatusOf(body),
    role: 'MEMBER',
    operatorTeam: null,
    leaderTeams: null,
  };
}

/** 저장 전에 화면의 필수 항목과 같은 기준으로 확인한다. */
function validateMember(db: Database, member: ClubMember): void {
  if (!member.name) throw badRequest('name 값이 필요합니다.');
  if (!member.email || !EMAIL_PATTERN.test(member.email)) {
    throw badRequest('email 값은 이메일 형식이어야 합니다.');
  }
  if (!member.phone) throw badRequest('phone 값이 필요합니다.');
  if (hasNameConflict(db, member.name, member.term, member.id)) {
    throw new ApiError(
      409,
      'DUPLICATE_MEMBER',
      `${member.term}기에 같은 이름(${member.name})의 동아리원이 이미 있습니다.`,
    );
  }
}

/**
 * 활동기수·수료기수 목록과 부문 명단의 한 페이지(한 기수). status·track 중 하나는 있어야 한다.
 * status가 없으면 활동·수료인 사람(탈퇴 제외)이다. term이 없으면 조건에 맞는 가장 최근 기수를 준다.
 * 보낸 기수에 조건에 맞는 사람이 없어도 오류가 아니라 빈 페이지다(탈퇴 처리 직후 빈 페이지가 될 수 있다).
 */
function termPageOf(db: Database, query: URLSearchParams): ClubMemberTermPage {
  const status = oneOf(query.get('status') ?? undefined, CLUB_MEMBER_PAGED_STATUSES, 'status');
  const track = oneOf(query.get('track') ?? undefined, CLUB_MEMBER_TRACKS, 'track');
  if (!status && !track) throw badRequest('status 또는 track 값이 필요합니다.');
  const requestedTerm = parsePositiveInt(query.get('term'), 'term');
  const scope: ClubMemberTermScope = { status, track };
  const terms = listClubMemberTerms(db, scope);
  const term = requestedTerm ?? terms[0] ?? null;
  const members = term === null ? [] : listClubMembersByTerm(db, scope, term);
  return { status: status ?? null, track: track ?? null, term, terms, members };
}

export const clubMemberRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/club-members',
    summary:
      '동아리원 전체 목록(활동 상태 → 부문 → 이름 순, 탈퇴는 최신 기수부터). 검색·필터는 화면에서 하고, 화면은 정렬하지 않는다',
    handler: ({ db }) => listClubMembers(db),
  },
  {
    method: 'GET',
    pattern: '/api/v1/club-members/by-term',
    summary:
      '활동기수·수료기수 목록과 부문 명단을 기수 하나씩 읽는다(status·track 중 하나 필수, status 없으면 활동·수료, term 없으면 가장 최근 기수). 활동 상태 → 부문 → 이름 순',
    handler: ({ db, query }) => termPageOf(db, query),
  },
  {
    method: 'POST',
    pattern: '/api/v1/club-members',
    summary:
      '동아리원 추가(합격자 승격을 거치지 않은 사람, 예: 예전 수료 기수). 역할은 일반 회원으로 시작한다',
    handler: ({ db, body }) => {
      const member = newMemberOf(readBody(body));
      validateMember(db, member);
      insertClubMember(db, member);
      ensureMemberProfile(db, member.id, member.term, member.track, member.name);
      return findMember(db, member.id);
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/club-members/:memberId',
    summary:
      '동아리원 정보 수정(보낸 값만 바뀐다). 탈퇴로 바꾸면 400 WITHDRAW_BY_DELETE(탈퇴는 DELETE로만), role은 PRESIDENT이거나 운영진 계정 여부와 맞을 때만 받는다(아니면 400 ROLE_FOLLOWS_OPERATOR)',
    handler: ({ db, params, body }) => {
      const current = findMember(db, params.memberId);
      const member = applyMemberBody(db, current, readBody(body));
      validateMember(db, member);
      updateClubMember(db, member);
      ensureMemberProfile(db, member.id, member.term, member.track, member.name);
      return findMember(db, member.id);
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/club-members/:memberId',
    summary:
      '동아리원 탈퇴 처리. 행은 지우지 않고 활동 상태를 탈퇴(WITHDRAWN)로 바꿔 바뀐 회원을 돌려준다. 반기 명단·팀 소속·출결 기록은 남고, 연결된 HOST 계정은 지운다. 운영진(MEMBER_IS_OPERATOR)·현재 반기 팀장(MEMBER_IS_TEAM_LEADER)·이미 탈퇴(ALREADY_WITHDRAWN)면 409',
    handler: ({ db, params }) => {
      const member = findMember(db, params.memberId);
      if (isOperator(db, member.id)) {
        throw new ApiError(
          409,
          'MEMBER_IS_OPERATOR',
          `${member.name}님은 운영진이라 명단에서 삭제할 수 없습니다.`,
        );
      }
      const leaderTeams = currentLeaderTeamsOf(db, member.id);
      if (leaderTeams.length > 0) {
        throw new ApiError(
          409,
          'MEMBER_IS_TEAM_LEADER',
          `${member.name}님은 현재 반기 ${leaderTeams.join(', ')}의 팀장이라 탈퇴 처리할 수 없습니다. 출결 화면에서 팀장을 바꾼 뒤 탈퇴 처리해 주세요.`,
        );
      }
      if (member.status === 'WITHDRAWN') {
        throw new ApiError(
          409,
          'ALREADY_WITHDRAWN',
          `${member.name}님은 이미 탈퇴한 동아리원입니다.`,
        );
      }
      withdrawClubMember(db, member.id);
      return findMember(db, member.id);
    },
  },
];
