/**
 * 명단 파일을 올릴 때 회원 DB에 있는 사람인지 백엔드 API(GET /api/v1/users/verify)로 확인한다.
 * 이름과 기수가 모두 같은 회원이 있으면 그 회원으로 연결하고(이름·기수·부문 수정 불가),
 * 없거나 기수를 모르면 연결하지 않는다(행사 화면에서 자유롭게 고칠 수 있다).
 */
import { verifyUserName } from '@/entities/user/api/usersApi';
import type { UserProfile } from '@/entities/user/model/types';

export interface MemberMatch {
  userId: string;
  name: string;
  term: number;
  track: string | null;
}

/** 후보 회원 중 이름과 기수가 모두 같은 한 명. 기수를 모르거나 맞는 회원이 없으면 undefined다. */
export function matchMember(
  person: { name: string; term?: number },
  candidates: readonly Pick<UserProfile, 'id' | 'name' | 'term' | 'track'>[],
): MemberMatch | undefined {
  if (person.term === undefined) {
    return undefined;
  }
  const found = candidates.find(
    (candidate) => candidate.name === person.name && candidate.term === person.term,
  );
  return found
    ? { userId: found.id, name: found.name, term: found.term, track: found.track ?? null }
    : undefined;
}

/**
 * 명단의 사람들을 회원 DB에서 찾는다(이름마다 한 번씩 확인). 결과는 명단과 같은 순서다.
 * API를 부르지 못하면 오류를 던진다(부르는 쪽에서 연결 없이 올리고 알린다).
 */
export async function lookupMembers(
  people: readonly { name: string; term?: number; isExternal: boolean }[],
): Promise<(MemberMatch | undefined)[]> {
  const names = [
    ...new Set(
      people
        .filter((person) => !person.isExternal && person.term !== undefined)
        .map((person) => person.name),
    ),
  ];
  const results = await Promise.all(names.map((name) => verifyUserName(name)));
  const candidatesByName = new Map(results.map((result) => [result.name, result.matches]));
  return people.map((person) =>
    person.isExternal ? undefined : matchMember(person, candidatesByName.get(person.name) ?? []),
  );
}

/**
 * 회원 DB 확인 결과.
 * - member: 회원 DB에 있는 사람(연결, 이름·기수·부문 수정 불가)
 * - pastNotInDb: 현재 활동 기수가 아니고 회원 DB에 없는 사람(이전에 수료한 기수 등). 정상이며 직접 고칠 수 있다.
 * - currentNotInDb: 현재 활동 기수인데 회원 DB에 없는 사람. 보통은 있어야 하므로 이름·기수 오타일 수 있다.
 * - unchecked: 외부 참가자이거나 기수를 몰라 확인하지 않은 사람
 */
export type MemberCheck = 'member' | 'pastNotInDb' | 'currentNotInDb' | 'unchecked';

/**
 * 확인 결과를 나눈다. activeTerms는 지금 반기의 활동 기수(반기 API)이며,
 * 모르면(undefined) 현재 기수인지 가릴 수 없어 회원 DB에 없는 사람을 모두 pastNotInDb로 본다.
 */
export function memberCheckOf(
  person: { term?: number; isExternal: boolean },
  match: MemberMatch | undefined,
  activeTerms: readonly number[] | undefined,
): MemberCheck {
  if (match) return 'member';
  if (person.isExternal || person.term === undefined) return 'unchecked';
  return activeTerms?.includes(person.term) ? 'currentNotInDb' : 'pastNotInDb';
}
