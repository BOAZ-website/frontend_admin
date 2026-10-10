/**
 * 동아리 회원(users에 있는 내부 참가자)의 이름·기수·부문은 회원 DB가 기준이다.
 * 행사 출결 화면과 저장 API에서는 바꿀 수 없고, 항상 회원 DB 값으로 보여 주고 저장한다.
 */
import type { AttendeeRecord } from './types';

/** 행사 명단 열 중 회원 DB에서 가져오는 열. */
export const MEMBER_TERM_LABEL = '기수';
export const MEMBER_TRACK_LABEL = '부문';
export const MEMBER_IDENTITY_LABELS: readonly string[] = [MEMBER_TERM_LABEL, MEMBER_TRACK_LABEL];

export interface MemberIdentity {
  name: string;
  term: number;
  track: string | null;
}

/** 회원 DB에 연결된 내부 참가자인지. 외부 참가자와 회원 연결이 없는 참가자는 자유롭게 고칠 수 있다. */
export function isLinkedMember(attendee: Pick<AttendeeRecord, 'isExternal' | 'userId'>): boolean {
  return !attendee.isExternal && attendee.userId !== undefined;
}

/** 참가자의 이름·기수·부문을 회원 DB 값으로 맞춘 새 참가자. */
export function withMemberIdentity(
  attendee: AttendeeRecord,
  member: MemberIdentity,
): AttendeeRecord {
  const answers = attendee.customAnswers ?? {};
  return {
    ...attendee,
    name: member.name,
    term: member.term,
    customAnswers: {
      ...answers,
      [MEMBER_TERM_LABEL]: `${member.term}기`,
      ...(member.track ? { [MEMBER_TRACK_LABEL]: member.track } : {}),
    },
  };
}
