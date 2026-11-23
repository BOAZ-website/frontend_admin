/** 백엔드 회원 API(MEM-01) 응답 모양. 필드 이름은 명세 그대로 snake_case다. */
import type { MemberStatusValue, TrackValue } from '@/entities/cohort/model/seasonDto';

/** MEM-01 동아리원 목록의 한 줄. member_id는 임시 DB의 users.id(문자열)다. */
export interface MemberListItem {
  member_id: string;
  version: number;
  name: string;
  name_suffix: string | null;
  display_name: string;
  term: number;
  track: TrackValue;
  status: MemberStatusValue;
  parallel_track: TrackValue | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  university: string | null;
  major: string | null;
  team_name: string | null;
  is_leader: boolean | null;
}
