/**
 * 동아리원 관리 API. 동아리원 한 명은 임시 DB users 테이블의 한 행이며,
 * 등록·수정 시 그 기수·부문의 활동 명단(members) 행도 없으면 함께 만든다.
 */
import type { Database } from 'sql.js';

import {
  findClubMember,
  hasNameConflict,
  insertClubMember,
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
import { type Body, oneOf, optionalNumber, optionalString, readBody } from '../validate';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
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
    joinedAt: text('joinedAt') ?? base.joinedAt,
    term: optionalNumber(body, 'term') ?? base.term,
    track: oneOf(text('track'), CLUB_MEMBER_TRACKS, 'track') ?? base.track,
    status: oneOf(text('status'), CLUB_MEMBER_STATUSES, 'status') ?? base.status,
    role: oneOf(text('role'), CLUB_MEMBER_ROLES, 'role') ?? base.role,
  };
}

/** 저장 전에 화면의 필수 항목과 같은 기준으로 확인한다. */
function validateMember(db: Database, member: ClubMember): void {
  if (!member.name) throw badRequest('name 값이 필요합니다.');
  if (!member.email || !EMAIL_PATTERN.test(member.email)) {
    throw badRequest('email 값은 이메일 형식이어야 합니다.');
  }
  if (!member.phone) throw badRequest('phone 값이 필요합니다.');
  if (!DATE_PATTERN.test(member.joinedAt)) {
    throw badRequest('joinedAt 값은 YYYY-MM-DD 형식이어야 합니다.');
  }
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
    summary: '동아리원 등록(이름·기수·부문·역할·활동 상태·가입일·이메일·연락처·대학교·전공)',
    handler: ({ db, body }) => {
      const input = readBody(body);
      if (optionalNumber(input, 'term') === undefined) throw badRequest('term 값이 필요합니다.');
      if (!('track' in input)) throw badRequest('track 값이 필요합니다.');
      const draft: ClubMember = {
        id: `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        email: '',
        phone: '',
        university: '',
        major: '',
        term: 0,
        track: CLUB_MEMBER_TRACKS[0],
        status: 'ACTIVE',
        role: 'MEMBER',
        joinedAt: '',
      };
      const member = applyMemberBody(draft, input);
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
];
