/**
 * 동아리원 관리 API. 동아리원 한 명은 임시 DB users 테이블의 한 행이며,
 * 추가·수정 시 그 기수·부문의 활동 명단(members) 행이 없으면 함께 만든다.
 * 새 기수는 보통 서류 평가의 합격자 승격으로 들어오고, 추가 API는 그 밖의 사람(예: 예전 수료 기수)을 넣을 때 쓴다.
 * 삭제(DELETE)는 행을 지우지 않고 탈퇴 처리(활동 상태 WITHDRAWN)다. 반기 명단·팀 소속·출결 기록은 그대로 남는다
 * (운영진은 운영진에서 먼저 빼야 하고, 이미 탈퇴한 사람은 다시 처리하지 않는다).
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
  withdrawClubMember,
} from '@/entities/club-member/api/clubMemberRepository';
import {
  CLUB_MEMBER_PAGED_STATUSES,
  CLUB_MEMBER_ROLES,
  CLUB_MEMBER_STATUSES,
  CLUB_MEMBER_TRACKS,
  type ClubMember,
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

/** 본문에 있는 값만 기존 동아리원 위에 덮어쓴다. 없는 키는 기존 값을 유지한다. */
function applyMemberBody(base: ClubMember, body: Body): ClubMember {
  const text = (key: string) => optionalString(body, key);
  return {
    ...base,
    name: text('name') ?? base.name,
    email: text('email') ?? base.email,
    phone: text('phone') ?? base.phone,
    university: text('university') ?? base.university,
    major: text('major') ?? base.major,
    term: optionalNumber(body, 'term') ?? base.term,
    track: oneOf(text('track'), CLUB_MEMBER_TRACKS, 'track') ?? base.track,
    status: oneOf(text('status'), CLUB_MEMBER_STATUSES, 'status') ?? base.status,
    role: oneOf(text('role'), CLUB_MEMBER_ROLES, 'role') ?? base.role,
  };
}

/** 추가 요청을 동아리원 한 명으로 만든다. 활동 상태를 보내지 않으면 활동(ACTIVE)이다. */
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
    status: oneOf(optionalString(body, 'status'), CLUB_MEMBER_STATUSES, 'status') ?? 'ACTIVE',
    role: 'MEMBER',
    operatorTeam: null,
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
    summary: '동아리원 정보 수정(보낸 값만 바뀐다)',
    handler: ({ db, params, body }) => {
      const current = findMember(db, params.memberId);
      const member = applyMemberBody(current, readBody(body));
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
      '동아리원 탈퇴 처리. 행은 지우지 않고 활동 상태를 탈퇴(WITHDRAWN)로 바꿔 바뀐 회원을 돌려준다. 반기 명단·팀 소속·출결 기록은 남는다. 운영진이거나 이미 탈퇴했으면 409',
    handler: ({ db, params }) => {
      const member = findMember(db, params.memberId);
      if (isOperator(db, member.id)) {
        throw new ApiError(
          409,
          'MEMBER_IS_OPERATOR',
          `${member.name}님은 운영진이라 명단에서 삭제할 수 없습니다.`,
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
