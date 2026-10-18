/**
 * 동아리원 관리 API. 동아리원 한 명은 임시 DB users 테이블의 한 행이며,
 * 추가·수정 시 그 기수·부문의 활동 명단(members) 행이 없으면 함께 만든다.
 * 새 기수는 보통 서류 평가의 합격자 승격으로 들어오고, 추가 API는 그 밖의 사람(예: 예전 수료 기수)을 넣을 때 쓴다.
 * 삭제하면 그 사람의 반기 명단·팀 소속·출결 기록도 함께 지워진다(운영진은 운영진에서 먼저 빼야 한다).
 */
import type { Database } from 'sql.js';

import {
  deleteClubMember,
  findClubMember,
  hasNameConflict,
  insertClubMember,
  isOperator,
  listClubMembers,
  updateClubMember,
} from '@/entities/club-member/api/clubMemberRepository';
import {
  CLUB_MEMBER_ROLES,
  CLUB_MEMBER_STATUSES,
  CLUB_MEMBER_TRACKS,
  type ClubMember,
} from '@/entities/club-member/model/types';
import { ensureMemberProfile } from '@/entities/study-team/api/teamRepository';

import { notFound } from '../queries';
import { ApiError, type MockRoute } from '../router';
import {
  type Body,
  oneOf,
  optionalNumber,
  optionalString,
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

export const clubMemberRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/club-members',
    summary: '동아리원 전체 목록(최신 기수 → 이름 순). 검색·필터는 화면에서 한다',
    handler: ({ db }) => listClubMembers(db),
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
      '동아리원 삭제. 반기 명단·팀 소속·출결 기록도 함께 지운다. 운영진이면 409(운영진에서 먼저 빼야 한다)',
    handler: ({ db, params }) => {
      const member = findMember(db, params.memberId);
      if (isOperator(db, member.id)) {
        throw new ApiError(
          409,
          'MEMBER_IS_OPERATOR',
          `${member.name}님은 운영진입니다. 운영진에서 먼저 뺀 뒤 삭제해 주세요.`,
        );
      }
      deleteClubMember(db, member.id);
      return null;
    },
  },
];
