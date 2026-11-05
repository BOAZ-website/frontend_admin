import assert from 'node:assert/strict';
import test from 'node:test';

import type { RosterEntryDto, SemesterScheduleDto } from '../src/entities/cohort/model/dto';
import { effectiveRoster, rosterCounts } from '../src/pages/system-semesters/model/roster';
import {
  emptyScheduleForm,
  formFromSchedule,
  invalidKey,
  requestFromForm,
  scheduleErrors,
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

test('일정 입력 오류: 비운 기간, 뒤바뀐 날짜, 방학·학기 겹침, 기간 밖 시작일을 알린다', () => {
  assert.deepEqual(scheduleErrors(VALID), []);
  assert.deepEqual(scheduleErrors(emptyScheduleForm()), [
    '방학 시작일과 종료일을 입력하세요.',
    '학기 시작일과 종료일을 입력하세요.',
  ]);
  assert.deepEqual(
    scheduleErrors({ ...VALID, term: { startDate: '2027-06-30', endDate: '2027-03-02' } }),
    ['학기 시작일이 종료일보다 늦습니다.'],
  );
  assert.deepEqual(
    scheduleErrors({ ...VALID, vacation: { startDate: '2027-01-01', endDate: '2027-03-02' } }),
    ['학기 시작일은 방학 종료일보다 늦어야 합니다.'],
  );
  assert.deepEqual(scheduleErrors({ ...VALID, starts: { ...VALID.starts, ADV: '2026-12-31' } }), [
    'ADV 1주차 시작일이 반기 기간 밖입니다.',
  ]);
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

test('저장하면 남을 명단은 뺀 사람을 빼고 더한 사람을 더하며, 인원은 큰 기수부터 기수·구분별로 센다', () => {
  const saved = [entry('a', 27, 'BASE'), entry('b', 27, 'BASE'), entry('c', 26, 'ADV')];

  const members = effectiveRoster(saved, new Set(['b']), [entry('d', 25, 'EXTRA')]);

  assert.deepEqual(
    members.map((m) => m.userId),
    ['a', 'c', 'd'],
  );
  assert.deepEqual(rosterCounts(members), [
    { term: 27, kind: 'BASE', count: 1 },
    { term: 26, kind: 'ADV', count: 1 },
    { term: 25, kind: 'EXTRA', count: 1 },
  ]);
});

test('휴강 체크를 켜면 사유가 빈 문자열로 들어가고, 끄면 빠진다', () => {
  const key = invalidKey('BASE', 5);

  const checked = withInvalidWeek(VALID, key, true);

  assert.equal(checked.invalid[key], '');
  assert.ok(!(key in withInvalidWeek(checked, key, false).invalid));
  assert.equal(weekDatesByActivity(VALID).BASE[2], '2027-01-12');
});
