import assert from 'node:assert/strict';
import test from 'node:test';

import type { ClubMember } from '../src/entities/club-member/model/types';
import { autoRosterOf, rosterTermsOf } from '../src/pages/system-semesters/model/roster';
import { emptyScheduleForm } from '../src/pages/system-semesters/model/scheduleForm';
import {
  parseSemesterDraft,
  type SemesterDraft,
} from '../src/pages/system-semesters/model/semesterDraft';

const DRAFT: SemesterDraft = {
  name: '27-1',
  baseTerm: 28,
  advTerm: 27,
  form: emptyScheduleForm(),
};

test('임시 저장한 새 반기는 같은 값으로 다시 읽힌다', () => {
  assert.deepEqual(parseSemesterDraft(JSON.stringify(DRAFT)), DRAFT);
});

test('임시 저장 값이 없거나 모양이 틀리면 null이다(깨진 값으로 화면을 열지 않는다)', () => {
  assert.equal(parseSemesterDraft(null), null);
  assert.equal(parseSemesterDraft('not json'), null);
  assert.equal(parseSemesterDraft(JSON.stringify({ ...DRAFT, baseTerm: '28' })), null);
  assert.equal(parseSemesterDraft(JSON.stringify({ ...DRAFT, form: { starts: {} } })), null);
});

test('명단 확인에 미리 넣을 기수: 1주차 시작일을 정한 BASE·ADV 기수만이다', () => {
  const form = emptyScheduleForm();

  assert.deepEqual(rosterTermsOf(form, 28, 27), []);
  assert.deepEqual(
    rosterTermsOf({ ...form, starts: { ...form.starts, BASE: '2027-01-05' } }, 28, 27),
    [28],
  );
  assert.deepEqual(
    rosterTermsOf(
      { ...form, starts: { ...form.starts, BASE: '2027-01-05', ADV: '2027-01-06' } },
      28,
      27,
    ),
    [28, 27],
  );
});

const member = (id: string, term: number, status: ClubMember['status']): ClubMember =>
  ({ id, name: id, term, track: '분석', status }) as ClubMember;

test('미리 넣는 명단은 그 기수의 활동 중 회원이고 구분은 기수로 정한다', () => {
  const members = [
    member('a', 28, 'ACTIVE'),
    member('b', 27, 'ACTIVE'),
    member('c', 28, 'WITHDRAWN'),
    member('d', 26, 'ACTIVE'),
  ];
  const kindOf = (term: number) => (term === 28 ? 'BASE' : term === 27 ? 'ADV' : 'EXTRA') as const;

  assert.deepEqual(
    autoRosterOf(members, [28, 27], kindOf).map((m) => [m.userId, m.kind]),
    [
      ['a', 'BASE'],
      ['b', 'ADV'],
    ],
  );
  assert.deepEqual(autoRosterOf(members, [], kindOf), []);
});
