/** 백엔드 회원 API(MEM-01) 호출. 응답 포장({ status, data })을 벗기고 화면 모양으로 바꾼다. */
import { TRACK_OF_VALUE } from '@/entities/cohort/model/season';
import type { ApiEnvelope, MemberStatusValue } from '@/entities/cohort/model/seasonDto';
import { api, withQuery } from '@/shared/api/client';

import type { MemberListItem } from '../model/memberDto';
import type { MemberSummary } from '../model/types';

/** 회원 목록(MEM-01). statuses 중 하나인 회원을 부문 → 이름 순으로 받는다. */
export async function fetchMembers(
  statuses: readonly MemberStatusValue[],
): Promise<MemberSummary[]> {
  const { data } = await api.get<ApiEnvelope<MemberListItem[]>>(
    withQuery('/api/v1/admin/members', { status: statuses.join(',') }),
  );
  return data.map((item) => ({
    id: item.member_id,
    name: item.display_name,
    term: item.term,
    track: TRACK_OF_VALUE[item.track],
    parallelTrack: item.parallel_track && TRACK_OF_VALUE[item.parallel_track],
    // 화면의 활동 상태에는 제명이 없어 탈동으로 보인다(ATT-18 명단과 같다).
    status: item.status === 'EXPELLED' ? 'WITHDRAWN' : item.status,
  }));
}
