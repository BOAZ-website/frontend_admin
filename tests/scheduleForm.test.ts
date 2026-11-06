import assert from 'node:assert/strict';
import test from 'node:test';

import type { ClubMember } from '../src/entities/club-member/model/types';
import type { RosterEntryDto, SemesterScheduleDto } from '../src/entities/cohort/model/dto';
import {
  rosterCandidates,
  rosterFilterCounts,
  rosterFilterOf,
} from '../src/pages/system-semesters/model/roster';
import {
  emptyScheduleForm,
  formFromSchedule,
  invalidKey,
  requestFromForm,
  firstErrorField,
  scheduleFieldErrors,
  semesterNameError,
  shownFieldErrors,
  type ScheduleForm,
  weekDatesByActivity,
  withInvalidWeek,
} from '../src/pages/system-semesters/model/scheduleForm';
import { monthDayOf } from '../src/shared/lib/date';

const VALID: ScheduleForm = {
  vacation: { startDate: '2027-01-01', endDate: '2027-02-28' },
  term: { startDate: '2027-03-02', endDate: '2027-06-30' },
  starts: { BASE: '2027-01-05', ADV: '', STUDY_VACATION: '', STUDY_TERM: '2027-03-09' },
  invalid: { [invalidKey('BASE', 3)]: '설 연휴', [invalidKey('ADV', 2)]: '' },
};

test('입력한 일정을 저장 요청으로 바꾸면 비운 시작일은 null, 사유 없는 휴강은 reason을 뺀다', () => {
  const request = requestFromForm(VALID);

  assert.deepEqual(request.activityStarts, {
    BASE: '2027-01-05',
    ADV: null,
    STUDY_VACATION: null,
    STUDY_TERM: '2027-03-09',
  });
  assert.deepEqual(request.invalidWeeks, [
    { activity: 'BASE', weekNum: 3, reason: '설 연휴' },
    { activity: 'ADV', weekNum: 2 },
  ]);
});

test('휴강 키의 활동이 정해진 활동이 아니면 저장 요청에서 뺀다', () => {
  const request = requestFromForm({ ...VALID, invalid: { 'UNKNOWN:1': '' } });

  assert.deepEqual(request.invalidWeeks, []);
});

test('서버 일정을 입력 상태로 바꾼 뒤 다시 요청으로 바꾸면 같은 값이다', () => {
  const schedule: SemesterScheduleDto = {
    vacation: VALID.vacation,
    term: VALID.term,
    activityStarts: { BASE: '2027-01-05', ADV: null, STUDY_VACATION: null, STUDY_TERM: null },
    invalidWeeks: [{ activity: 'BASE', weekNum: 3, reason: '설 연휴' }],
    weeks: { BASE: [], ADV: [], STUDY_VACATION: [], STUDY_TERM: [] },
  };

  const form = formFromSchedule(schedule);

  assert.equal(form.starts.ADV, '');
  assert.deepEqual(requestFromForm(form).invalidWeeks, schedule.invalidWeeks);
});

test('일정 입력 오류는 칸별로 나온다: 비운 기간, 뒤바뀐 날짜, 방학·학기 겹침(학기 칸), 기간 밖 시작일(그 활동 칸)', () => {
  assert.deepEqual(scheduleFieldErrors(VALID), {});
  assert.deepEqual(scheduleFieldErrors(emptyScheduleForm()), {
    vacation: '시작일과 종료일을 입력하세요',
    term: '시작일과 종료일을 입력하세요',
  });
  assert.deepEqual(
    scheduleFieldErrors({ ...VALID, term: { startDate: '2027-06-30', endDate: '2027-03-02' } }),
    { term: '종료일을 시작일 뒤로 정하세요' },
  );
  assert.deepEqual(
    scheduleFieldErrors({
      ...VALID,
      vacation: { startDate: '2027-01-01', endDate: '2027-03-02' },
    }),
    { term: '학기 시작일을 방학 종료일 뒤로 정하세요' },
  );
  assert.deepEqual(
    scheduleFieldErrors({ ...VALID, starts: { ...VALID.starts, ADV: '2026-12-31' } }),
    { ADV: '방학 시작일 ~ 학기 종료일 안의 날짜를 고르세요' },
  );
});

test('반기 이름 오류: 형식이 틀리면 형식 안내, 이미 있으면 중복 안내, 맞으면 없다', () => {
  assert.equal(semesterNameError('', []), '26-2처럼 입력하세요');
  assert.equal(semesterNameError('26-3', []), '26-2처럼 입력하세요');
  assert.equal(semesterNameError('26-2', ['26-2']), '이미 있는 반기 이름입니다');
  assert.equal(semesterNameError('27-1', ['26-2']), undefined);
});

test('칸 오류는 손댄 칸만 보이고, 버튼을 누른 뒤에는 모두 보인다', () => {
  const errors = { name: '26-2처럼 입력하세요', vacation: '시작일과 종료일을 입력하세요' };

  assert.deepEqual(shownFieldErrors(errors, new Set(), false), {});
  assert.deepEqual(shownFieldErrors(errors, new Set(['vacation']), false), {
    vacation: '시작일과 종료일을 입력하세요',
  });
  assert.deepEqual(shownFieldErrors(errors, new Set(), true), errors);
});

test('첫 오류 칸은 화면 순서로 찾고, 오류가 없으면 null이다', () => {
  const order = ['name', 'vacation', 'term', 'BASE'] as const;

  assert.equal(firstErrorField({ term: 'x', name: 'y' }, order), 'name');
  assert.equal(firstErrorField({ BASE: 'x', term: 'y' }, order), 'term');
  assert.equal(firstErrorField({}, order), null);
});

test('주차 버튼 날짜는 MM-DD이고, 날짜 형식이 아니면 빈 문자열이다', () => {
  assert.equal(monthDayOf('2026-07-07'), '07-07');
  assert.equal(monthDayOf('2026/07/07'), '');
});

const entry = (userId: string, term: number, kind: RosterEntryDto['kind']): RosterEntryDto => ({
  userId,
  name: userId,
  term,
  track: '분석',
  kind,
});

test('명단 필터 인원: 뺀 사람은 제외로만 세고, 전체는 표의 모든 행이다', () => {
  const rows = [
    entry('a', 27, 'BASE'),
    entry('b', 27, 'BASE'),
    entry('c', 26, 'ADV'),
    entry('d', 25, 'EXTRA'),
  ];
  const excluded = new Set(['b']);

  assert.equal(rosterFilterOf(rows[1], excluded), 'EXCLUDED');
  assert.equal(rosterFilterOf(rows[0], excluded), 'BASE');
  assert.deepEqual(rosterFilterCounts(rows, excluded), {
    ALL: 4,
    BASE: 1,
    ADV: 1,
    EXTRA: 1,
    EXCLUDED: 1,
  });
});

test('휴강 체크를 켜면 사유가 빈 문자열로 들어가고, 끄면 빠진다', () => {
  const key = invalidKey('BASE', 5);

  const checked = withInvalidWeek(VALID, key, true);

  assert.equal(checked.invalid[key], '');
  assert.ok(!(key in withInvalidWeek(checked, key, false).invalid));
  assert.equal(weekDatesByActivity(VALID).BASE[2], '2027-01-12');
});

const member = (id: string, term: number, status: ClubMember['status'], name = id): ClubMember =>
  ({ id, name, term, track: '분석', status }) as ClubMember;

test('명단에 더할 후보: 탈퇴·이미 명단에 있는 사람은 빼고, 기수와 이름으로 거르며 큰 기수부터 이름순이다', () => {
  const members = [
    member('a', 25, 'ACTIVE', '나'),
    member('b', 27, 'ACTIVE', '가'),
    member('c', 25, 'WITHDRAWN', '다'),
    member('d', 25, 'ACTIVE', '가'),
    member('e', 27, 'ACTIVE', '라'),
  ];
  const ids = (list: ClubMember[]) => list.map((m) => m.id);

  assert.deepEqual(ids(rosterCandidates(members, new Set(['e']), { term: 'ALL', query: '' })), [
    'b',
    'd',
    'a',
  ]);
  assert.deepEqual(ids(rosterCandidates(members, new Set(), { term: 25, query: '' })), ['d', 'a']);
  assert.deepEqual(ids(rosterCandidates(members, new Set(), { term: 'ALL', query: ' 가 ' })), [
    'b',
    'd',
  ]);
});
