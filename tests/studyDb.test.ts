import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyAttendanceChange,
  createStudyRecords,
  describeStudyCreateError,
  getStudyCell,
  studyDisplayName,
  studyLeaderLabel,
} from '../src/entities/study-team/model/db';
import type { StudyTeamInfo } from '../src/entities/study-team/model/types';
import type { UserProfile } from '../src/entities/user/model/types';

const users: UserProfile[] = [
  { id: 'u1', name: '남민서', term: 26, track: '분석' },
  { id: 'u2', name: '문지훈', term: 27, track: '시각화' },
];

const team = (teamName: string, extra: Partial<StudyTeamInfo> = {}): StudyTeamInfo => ({
  id: teamName,
  teamName,
  studyName: teamName,
  leaderName: '',
  category: '',
  schedule: '',
  studyType: '방학 스터디',
  createdAt: '2026-01-01',
  ...extra,
});

test('만든 스터디의 팀 이름은 입력한 그대로다', () => {
  const { team: created } = createStudyRecords({
    id: 's0',
    name: '  입력 그대로 스터디 (2)',
    studyKind: 'GENERAL',
    track: '분석',
    isVacation: true,
    leaderName: null,
    members: [],
  });
  assert.equal(created.teamName, '  입력 그대로 스터디 (2)');
  assert.equal(created.studyName, created.teamName);
  assert.equal(created.track, '분석');
});

test('출결 기록은 이름이 아니라 팀 id로 만든다(같은 이름도 부문이 다르면 따로 기록된다)', () => {
  const make = (id: string, track: string) =>
    createStudyRecords({
      id,
      name: '테라폼 스터디',
      studyKind: 'GENERAL',
      track,
      isVacation: true,
      leaderName: null,
      members: users,
    });
  const a = make('s_analysis', '분석');
  const b = make('s_engineering', '엔지니어링');
  assert.ok('w1|study|s_analysis' in a.attendance);
  assert.ok('w1|study|s_engineering' in b.attendance);
  assert.equal('w1|study|테라폼 스터디' in a.attendance, false);
});

test('멘멘 스터디는 멤버마다 멘멘/친바 키를 1~8주차에 미정으로 만든다', () => {
  const {
    team: created,
    members,
    attendance,
  } = createStudyRecords(
    {
      id: 's1',
      name: '논문',
      studyKind: 'MENTORING',
      track: '분석',
      isVacation: true,
      leaderName: '남민서',
      members: users,
    },
    '2026-08-01',
  );
  assert.equal(created.studyType, '방학 스터디');
  assert.equal(members.length, 2);
  assert.equal(Object.keys(attendance).length, 8);
  assert.equal(getStudyCell(attendance, 's1', 8, `${members[0].id}:친바`)?.status, 'unmarked');
  assert.equal('w9|study|s1' in attendance, false);
});

test('일반 스터디는 멤버 키만 만든다', () => {
  const { members, attendance } = createStudyRecords({
    id: 's2',
    name: '일반',
    studyKind: 'GENERAL',
    track: '시각화',
    isVacation: false,
    leaderName: null,
    members: users,
  });
  assert.equal(getStudyCell(attendance, 's2', 1, `${members[0].id}:멘멘`), undefined);
  assert.equal(getStudyCell(attendance, 's2', 1, members[0].id)?.status, 'unmarked');
});

test('출결 변경은 새 객체를 돌려주고 원본은 바꾸지 않는다', () => {
  const { members, attendance } = createStudyRecords({
    id: 's3',
    name: '스터디',
    studyKind: 'GENERAL',
    track: '분석',
    isVacation: true,
    leaderName: null,
    members: users,
  });
  const next = applyAttendanceChange(attendance, {
    teamId: 's3',
    weekNum: 2,
    memberKey: members[0].id,
    status: 'present',
    memo: '정상',
  });
  assert.equal(getStudyCell(next, 's3', 2, members[0].id)?.status, 'present');
  assert.equal(getStudyCell(next, 's3', 2, members[0].id)?.memo, '정상');
  assert.equal(getStudyCell(attendance, 's3', 2, members[0].id)?.status, 'unmarked');
});

test('없는 주차 레코드에 대한 변경은 무시한다', () => {
  const next = applyAttendanceChange(
    {},
    { teamId: 'X', weekNum: 1, memberKey: 'm', status: 'present' },
  );
  assert.deepEqual(next, {});
});

test('스터디장 라벨과 제목을 만든다', () => {
  const t = team('A팀', { leaderName: '남민서', studyName: '논문 리뷰' });
  assert.equal(
    studyLeaderLabel(t, [{ id: 'a1', name: '남민서', year: '26', track: '분석' }]),
    '26기 분석 남민서',
  );
  assert.equal(studyLeaderLabel(t, []), '남민서');
  assert.equal(studyDisplayName(t), 'A팀 (논문 리뷰)');
});

test('같은 부문 이름 중복으로 저장이 거부되면 알아보기 쉬운 문구로 바꾸고, 그 외 사유는 원문을 덧붙인다', () => {
  assert.equal(
    describeStudyCreateError(
      new Error('UNIQUE constraint failed: teams.cohort, teams.track, teams.team_name'),
    ),
    '같은 기수·부문에 이미 사용 중인 스터디 이름입니다. 다른 이름을 쓰거나 다른 부문으로 만들어 주세요.',
  );
  assert.equal(
    describeStudyCreateError(new Error('database is locked')),
    '스터디를 만들지 못했습니다. (database is locked)',
  );
});
