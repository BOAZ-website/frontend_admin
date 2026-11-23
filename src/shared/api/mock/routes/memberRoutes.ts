/**
 * 회원 임시 API. 경로·필드·응답 포장·오류 코드는 백엔드 명세 그대로다(MEM-01 확정, 2026-11-21 기준).
 * 성공 응답은 { status, data }로 감싼다. member_id는 임시 DB의 users.id다.
 * 동아리원 관리 탭이 쓰는 /api/v1/club-members는 clubMemberRoutes.ts에 그대로 있다.
 */
import type { MemberListItem } from '@/entities/club-member/model/memberDto';
import { VALUE_OF_TRACK } from '@/entities/cohort/model/season';
import type { MemberStatusValue, TrackValue } from '@/entities/cohort/model/seasonDto';
import type { UserTrack } from '@/entities/user/model/types';
import { queryAll } from '@/shared/db/createDatabase';

import { ApiError, type MockRoute } from '../router';

const STATUSES: readonly MemberStatusValue[] = [
  'ACTIVE',
  'COMPLETED',
  'NOT_COMPLETED',
  'WITHDRAWN',
  'EXPELLED',
];
const TRACKS = Object.values(VALUE_OF_TRACK);
// 명세 정렬: 부문 enum 선언 순서(ANALYSIS, VISUALIZATION, ENGINEERING) → 이름.
const TRACK_RANK: Record<TrackValue, number> = { ANALYSIS: 0, VISUALIZATION: 1, ENGINEERING: 2 };

const badType = (message: string) => new ApiError(400, 'INVALID_PARAMETER_TYPE', message);

/** status는 반복(status=A&status=B)과 쉼표(status=A,B)를 모두 받는다. */
function statusesOf(query: URLSearchParams): MemberStatusValue[] {
  const values = query
    .getAll('status')
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.length === 0) throw new ApiError(400, 'MISSING_PARAMETER', 'status 값이 필요합니다.');
  const unknown = values.find((value) => !STATUSES.includes(value as MemberStatusValue));
  if (unknown) throw badType(`status 값이 올바르지 않습니다: ${unknown}`);
  return [...new Set(values as MemberStatusValue[])];
}

function termOf(query: URLSearchParams): number | null {
  const raw = query.get('term');
  if (raw === null) return null;
  const term = Number(raw);
  if (!Number.isInteger(term) || term < 1) throw badType('term 값은 양의 정수여야 합니다.');
  return term;
}

function trackOf(query: URLSearchParams): TrackValue | null {
  const raw = query.get('track');
  if (raw === null) return null;
  if (!TRACKS.includes(raw as TrackValue)) throw badType(`track 값이 올바르지 않습니다: ${raw}`);
  return raw as TrackValue;
}

type MemberRow = {
  id: string;
  name: string;
  term: number;
  track: UserTrack;
  status: MemberStatusValue;
  parallel_track: UserTrack | null;
  phone: string;
  email: string;
  birth_date: string | null;
  university: string;
  major: string;
  team_name: string | null;
};

const emptyToNull = (value: string) => (value === '' ? null : value);

export const memberRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/admin/members',
    summary:
      'MEM-01 동아리원 목록(status 필수·여러 값, term·track 선택). 부문 → 이름 순 전체 배열. 반기 명단에 더할 회원을 고를 때도 쓴다',
    handler: ({ db, query }) => {
      const statuses = statusesOf(query);
      const term = termOf(query);
      const track = trackOf(query);
      // parallel_track은 현재 반기 등록의 병행 부문이다(명세). team_name은 HOST가 아닌 운영진 계정의 팀이다.
      const rows = queryAll<MemberRow>(
        db,
        `SELECT u.id, u.name, u.term, u.track, u.club_status AS status,
                (SELECT e.parallel_track FROM member_enrollment e
                   JOIN cohorts c ON c.cohort = e.activity_season_id
                  WHERE e.member_id = u.id AND e.deleted_at IS NULL
                    AND c.is_current = 1 AND c.deleted_at IS NULL) AS parallel_track,
                u.phone, u.email, u.birth_date, u.university, u.major,
                (SELECT a.team_name FROM admin a WHERE a.user_id = u.id AND a.role <> 'HOST') AS team_name
           FROM users u
          WHERE u.deleted_at IS NULL
            AND u.club_status IN (${statuses.map(() => '?').join(', ')})
            AND (? IS NULL OR u.term = ?)`,
        [...statuses, term, term],
      );
      const data: MemberListItem[] = rows
        .map((row) => ({
          member_id: row.id,
          // shortcut: 임시 DB에 회원 version·이름 접미사·팀장 여부가 없어 0·null·false로 둔다. 회원 수정 API를 명세로 옮길 때 채운다.
          version: 0,
          name: row.name,
          name_suffix: null,
          display_name: row.name,
          term: row.term,
          track: VALUE_OF_TRACK[row.track],
          status: row.status,
          parallel_track: row.parallel_track && VALUE_OF_TRACK[row.parallel_track],
          phone: emptyToNull(row.phone),
          email: emptyToNull(row.email),
          birth_date: row.birth_date,
          university: emptyToNull(row.university),
          major: emptyToNull(row.major),
          team_name: row.team_name,
          is_leader: row.team_name === null ? null : false,
        }))
        .filter((member) => track === null || member.track === track)
        .sort(
          (a, b) => TRACK_RANK[a.track] - TRACK_RANK[b.track] || a.name.localeCompare(b.name, 'ko'),
        );
      return { status: 200, data };
    },
  },
];
