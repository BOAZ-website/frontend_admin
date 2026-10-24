/**
 * 회원(users) API. 반기 출결 명단 기준의 회원 검색·이름 검증(팀원·팀장 선택)과
 * users 테이블의 기수 목록(동아리원 명단의 기수 필터)을 내려준다.
 */
import { listSemesterUsers, listUserTerms } from '@/entities/user/api/usersRepository';

import { resolveSemester } from '../queries';
import type { MockRoute } from '../router';
import { parsePositiveInt } from '../validate';

export const userRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/users',
    summary: '회원 목록·검색(팀장·팀원·트랙원 선택). name은 정확히, keyword는 이름 일부로 찾는다',
    handler: ({ db, query }) => {
      const semester = resolveSemester(db, query.get('semester'));
      const name = query.get('name')?.trim();
      const keyword = query.get('keyword')?.trim();
      const term = parsePositiveInt(query.get('term'), 'term');
      const track = query.get('track')?.trim();
      return listSemesterUsers(db, semester.cohort).filter(
        (user) =>
          (!name || user.name === name) &&
          (!keyword || user.name.includes(keyword)) &&
          (term === undefined || user.term === term) &&
          (!track || user.track === track),
      );
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/users/verify',
    summary: '등록된 회원인지 이름으로 검증(동명이인이면 후보를 모두 돌려준다)',
    handler: ({ db, query }) => {
      const semester = resolveSemester(db, query.get('semester'));
      const name = query.get('name')?.trim() ?? '';
      const matches = name
        ? listSemesterUsers(db, semester.cohort).filter((user) => user.name === name)
        : [];
      return { name, registered: matches.length > 0, matches };
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/users/terms',
    summary:
      '회원(users)에 있는 기수 목록(중복 없이 큰 기수부터). 동아리원 명단의 기수 필터 선택지로 쓴다',
    handler: ({ db }) => listUserTerms(db),
  },
];
