import assert from 'node:assert/strict';
import test from 'node:test';

import type { ClubMember } from '../src/entities/club-member/model/types';
import type { SemesterScheduleDto } from '../src/entities/cohort/model/dto';
import { rosterCandidates, withCheckedRange } from '../src/pages/system-semesters/model/roster';
import {
  calendarMarksOf,
  activityRowsOf,
  initialCalendarMonth,
} from '../src/pages/system-semesters/model/calendarMarks';
import {
  commonWeeksOfForm,
  emptyScheduleForm,
  formFromSchedule,
  requestFromForm,
  firstErrorField,
  scheduleFieldErrors,
  semesterNameError,
  shownFieldErrors,
  type ScheduleForm,
  weekDatesByActivity,
  displayWeekNoOf,
  voidWeekOptionsOf,
  weekRangeText,
  withVoidWeek,
} from '../src/pages/system-semesters/model/scheduleForm';
import { commonWeeksOf } from '../src/entities/cohort/model/schedule';
import { monthDayOf } from '../src/shared/lib/date';

const VALID: ScheduleForm = {
  vacation: { startDate: '2027-01-01', endDate: '2027-02-28' },
  term: { startDate: '2027-03-02', endDate: '2027-06-30' },
  starts: {
    BASE: '2027-01-05',
    ADV: '',
    STUDY_VACATION: '',
    STUDY_TERM: '2027-03-09',
  },
  // 공통 4주차(2027-01-18~01-24). 방학 1주차는 2027-01-01이 든 주(2026-12-28~)다.
  voidWeekNos: [4],
};

test('입력한 일정을 기간·시작일 저장 요청으로 바꾸면 비운 시작일은 null이고 휴강은 담지 않는다', () => {
  const request = requestFromForm(VALID);

  assert.deepEqual(request.activityStarts, {
    BASE: '2027-01-05',
    ADV: null,
    STUDY_VACATION: null,
    STUDY_TERM: '2027-03-09',
  });
  assert.deepEqual(Object.keys(request).sort(), ['activityStarts', 'term', 'vacation']);
});

test('공통 주차는 방학·학기 기간을 월~일 주로 나눠 이어 세고, 기간 사이 빈 주는 주차가 아니다', () => {
  // 백엔드 명세 예시: 방학 7주 + 학기 15주 = 22주, 08-24~08-30은 주차가 없다.
  const weeks = commonWeeksOf(
    { startDate: '2026-07-06', endDate: '2026-08-23' },
    { startDate: '2026-08-31', endDate: '2026-12-13' },
  );

  assert.equal(weeks.length, 22);
  assert.deepEqual(weeks[0], {
    weekNo: 1,
    periodType: 'VACATION',
    startDate: '2026-07-06',
    endDate: '2026-07-12',
  });
  assert.deepEqual(weeks[7], {
    weekNo: 8,
    periodType: 'SEMESTER',
    startDate: '2026-08-31',
    endDate: '2026-09-06',
  });
  // 기간 시작일이 주 중간이면 그 주 월요일부터 센다(2027-01-01 금 → 2026-12-28 월).
  assert.equal(commonWeeksOfForm(VALID)[0].startDate, '2026-12-28');
  assert.deepEqual(
    commonWeeksOfForm(VALID)
      .filter((week) => week.isVoid)
      .map((week) => week.weekNo),
    [4],
  );
});

test('기간을 다 정하지 않았으면 공통 주차가 없다', () => {
  assert.deepEqual(commonWeeksOfForm(emptyScheduleForm()), []);
});

test('서버 일정을 입력 상태로 바꾸면 휴강 공통 주차 번호를 담는다', () => {
  const schedule: SemesterScheduleDto = {
    vacation: VALID.vacation,
    term: VALID.term,
    activityStarts: {
      BASE: '2027-01-05',
      ADV: null,
      STUDY_VACATION: null,
      STUDY_TERM: null,
    },
    weeks: commonWeeksOf(VALID.vacation, VALID.term).map((week) => ({
      ...week,
      isVoid: week.weekNo === 2 || week.weekNo === 12,
    })),
  };

  const form = formFromSchedule(schedule);

  assert.equal(form.starts.ADV, '');
  assert.deepEqual(form.voidWeekNos, [2, 12]);
});

/** 저장할 수 있는 일정: 기간은 월요일 시작·일요일 끝이고 4개 활동의 1주차 시작일이 모두 있다(백엔드 ATT-03). */
const VALID_INPUT: ScheduleForm = {
  vacation: { startDate: '2026-12-28', endDate: '2027-02-28' },
  term: { startDate: '2027-03-01', endDate: '2027-06-27' },
  starts: {
    BASE: '2027-01-04',
    ADV: '2027-01-04',
    STUDY_VACATION: '2027-01-04',
    STUDY_TERM: '2027-03-01',
  },
  voidWeekNos: [],
};

test('일정 입력 오류는 칸별로 나온다: 비운 기간, 뒤바뀐 날짜, 월~일이 아닌 기간, 겹침, 비운·기간 밖 시작일', () => {
  assert.deepEqual(scheduleFieldErrors(VALID_INPUT), {});
  assert.deepEqual(scheduleFieldErrors(emptyScheduleForm()), {
    vacation: '시작일과 종료일을 입력하세요',
    term: '시작일과 종료일을 입력하세요',
  });
  assert.deepEqual(
    scheduleFieldErrors({
      ...VALID_INPUT,
      term: { startDate: '2027-06-27', endDate: '2027-03-01' },
    }),
    { term: '종료일을 시작일 뒤로 정하세요' },
  );
  assert.deepEqual(
    scheduleFieldErrors({
      ...VALID_INPUT,
      vacation: { startDate: '2026-12-29', endDate: '2027-02-28' },
      term: { startDate: '2027-03-01', endDate: '2027-06-26' },
    }),
    { vacation: '시작일은 월요일로 정하세요', term: '종료일은 일요일로 정하세요' },
  );
  assert.deepEqual(
    scheduleFieldErrors({
      ...VALID_INPUT,
      vacation: { startDate: '2026-12-28', endDate: '2027-03-07' },
    }),
    { term: '학기 시작일을 방학 종료일 뒤로 정하세요' },
  );
  assert.deepEqual(
    scheduleFieldErrors({
      ...VALID_INPUT,
      starts: { ...VALID_INPUT.starts, ADV: '', STUDY_TERM: '2027-02-01' },
    }),
    { ADV: '1주차 시작일을 고르세요', STUDY_TERM: '학기 기간 안의 날짜를 고르세요' },
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

test('휴강 주차를 넣으면 번호순으로 들어가고 같은 주차를 다시 넣어도 하나이며, 빼면 빠진다', () => {
  const added = withVoidWeek(withVoidWeek(VALID, 2, true), 2, true);

  assert.deepEqual(added.voidWeekNos, [2, 4]);
  assert.deepEqual(withVoidWeek(added, 4, false).voidWeekNos, [2]);
  assert.equal(weekDatesByActivity(VALID).BASE[2], '2027-01-12');
});

const member = (id: string, term: number, status: ClubMember['status'], name = id): ClubMember =>
  ({ id, name, term, track: '분석', status }) as ClubMember;

test('명단에 더할 후보: 탈동·이미 명단에 있는 사람은 빼고, 기수와 이름으로 거르며 큰 기수부터 이름순이다', () => {
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

test('Shift로 고르면 마지막으로 누른 줄부터 지금 줄까지 지금 줄의 새 상태로 맞춘다', () => {
  const ids = ['a', 'b', 'c', 'd'];

  assert.deepEqual([...withCheckedRange(new Set(['a']), ids, 0, 2)].sort(), ['a', 'b', 'c']);
  assert.deepEqual([...withCheckedRange(new Set(['a', 'b', 'c']), ids, 2, 1)].sort(), ['a']);
  assert.deepEqual([...withCheckedRange(new Set(), ids, null, 3)], ['d']);
});

test('달력은 주차 시작일부터 7일 안에서 BASE·ADV는 트랙 세션 요일에, 스터디는 월요일에 찍고 휴강 공통 주차 안의 BASE·ADV 세션만 휴강으로 표시한다', () => {
  const form: ScheduleForm = {
    ...emptyScheduleForm(),
    vacation: { startDate: '2026-07-06', endDate: '2026-08-30' },
    term: { startDate: '2026-08-31', endDate: '2026-12-13' },
    // 2026-07-07은 화요일, 2026-07-08은 수요일이다.
    starts: {
      BASE: '2026-07-07',
      ADV: '2026-07-08',
      STUDY_VACATION: '2026-07-07',
      STUDY_TERM: '',
    },
    // 공통 3주차(7/20~7/26)를 휴강으로 둔다.
    voidWeekNos: [3],
  };

  const marks = calendarMarksOf(form);

  // BASE 1주차(7/7~7/13): 수 엔지니어링, 목 분석, 월 시각화. ADV 1주차(7/8~7/14)도 같은 날이다.
  assert.deepEqual(marks['2026-07-08'], [
    { activity: 'BASE', weekNum: 1, isInvalid: false, track: '엔지니어링' },
    { activity: 'ADV', weekNum: 1, isInvalid: false, track: '엔지니어링' },
  ]);
  assert.equal(marks['2026-07-09'][0].track, '분석');
  // 스터디 1주차(7/7~7/13)는 트랙 없이 월요일(7/13)에만 찍히고, 같은 날 BASE·ADV 시각화 뒤에 둔다.
  assert.deepEqual(marks['2026-07-13'], [
    { activity: 'BASE', weekNum: 1, isInvalid: false, track: '시각화' },
    { activity: 'ADV', weekNum: 1, isInvalid: false, track: '시각화' },
    { activity: 'STUDY_VACATION', weekNum: 1, isInvalid: false },
  ]);
  assert.equal(marks['2026-07-07'], undefined);
  // 휴강 공통 주차(7/20~7/26)에는 BASE·ADV를 하지 않는다. BASE 3주차는 그 주(7/21)를 건너뛰어 7/28부터다.
  // 다만 BASE 2주차(7/14~7/20)의 월요일 세션 7/20은 휴강 주 안이라 휴강으로 보인다.
  // 그 주에 무엇을 쉬는지 보이도록 쉬는 세션 자리를 주차 없이(weekNum 0) 흐리게 찍는다.
  assert.deepEqual(marks['2026-07-22'], [
    { activity: 'BASE', weekNum: 0, isInvalid: true, track: '엔지니어링', isBreak: true },
    { activity: 'ADV', weekNum: 0, isInvalid: true, track: '엔지니어링', isBreak: true },
  ]);
  assert.deepEqual(marks['2026-07-29'][0], {
    activity: 'BASE',
    weekNum: 3,
    isInvalid: false,
    track: '엔지니어링',
  });
  assert.deepEqual(marks['2026-07-20'][0], {
    activity: 'BASE',
    weekNum: 2,
    isInvalid: true,
    track: '시각화',
  });
  // 스터디 휴강은 스터디장이 출결 입력 탭에서 따로 정하므로, 같은 주의 스터디 세션(7/20)은 휴강으로 표시하지 않는다.
  assert.deepEqual(
    marks['2026-07-20'].find((mark) => mark.activity === 'STUDY_VACATION'),
    { activity: 'STUDY_VACATION', weekNum: 2, isInvalid: false },
  );
  // BASE는 방학·학기를 이어 16주차까지 가고, 휴강으로 한 주 밀린다. 9/2(수)는 8주차(9/1~9/7)이고,
  // 16주차(10/27~11/2)의 마지막 세션 11/2(월) 뒤로는 없다.
  assert.equal(marks['2026-09-02'][0].weekNum, 8);
  assert.equal(marks['2026-11-02'][0].weekNum, 16);
  assert.equal(marks['2026-11-04'], undefined);
});

test('달력은 오늘이 활동 범위 안이면 이번 달, 아니면 첫 활동 달에서 시작하고 활동이 없으면 null이다', () => {
  const marks = calendarMarksOf({
    ...emptyScheduleForm(),
    starts: {
      BASE: '2026-07-07',
      ADV: '',
      STUDY_VACATION: '',
      STUDY_TERM: '',
    },
  });

  assert.equal(initialCalendarMonth(marks, '2026-08-10'), '2026-08');
  assert.equal(initialCalendarMonth(marks, '2026-11-07'), '2026-07');
  assert.equal(initialCalendarMonth({}, '2026-11-07'), null);
});

test('요약 표 행: 활동마다 첫·마지막 세션과 주차 범위이고, 시작일이 없는 활동은 빠진다', () => {
  const marks = calendarMarksOf({
    ...emptyScheduleForm(),
    // 2026-07-07은 화요일이다.
    starts: {
      BASE: '2026-07-07',
      ADV: '',
      STUDY_VACATION: '2026-07-07',
      STUDY_TERM: '',
    },
  });

  // BASE 1주차 첫 세션은 수요일(7/8), 16주차(10/20~10/26) 마지막 세션은 월요일(10/26)이다.
  // 스터디는 주차마다 월요일: 7/13 ~ 8/31(8주차).
  assert.deepEqual(activityRowsOf(marks), [
    { activity: 'BASE', firstWeek: 1, lastWeek: 16, first: '2026-07-08', last: '2026-10-26' },
    {
      activity: 'STUDY_VACATION',
      firstWeek: 1,
      lastWeek: 8,
      first: '2026-07-13',
      last: '2026-08-31',
    },
  ]);
});

test('요약 표 행에 기간을 주면 그 기간 안의 세션만 보고, 그 기간에 세션이 없는 활동은 빠진다', () => {
  const marks = calendarMarksOf({
    ...emptyScheduleForm(),
    starts: { BASE: '2026-07-07', ADV: '', STUDY_VACATION: '2026-07-07', STUDY_TERM: '' },
  });

  const rows = activityRowsOf(marks, { startDate: '2026-09-01', endDate: '2026-12-31' });

  assert.deepEqual(
    rows.map(({ activity, first, last }) => ({ activity, first, last })),
    [{ activity: 'BASE', first: '2026-09-02', last: '2026-10-26' }],
  );
});

test('방학은 7주, 학기는 10주보다 짧게 정할 수 없다(정확히 7주·10주는 된다)', () => {
  // 2027-01-04(월) ~ 2027-02-21(일)은 7주, 2027-03-01(월) ~ 2027-05-09(일)은 10주.
  const exact: ScheduleForm = {
    ...VALID_INPUT,
    vacation: { startDate: '2027-01-04', endDate: '2027-02-21' },
    term: { startDate: '2027-03-01', endDate: '2027-05-09' },
  };
  assert.deepEqual(scheduleFieldErrors(exact), {});
  assert.deepEqual(
    scheduleFieldErrors({
      ...exact,
      vacation: { startDate: '2027-01-04', endDate: '2027-02-14' },
      term: { startDate: '2027-03-01', endDate: '2027-05-02' },
    }),
    { vacation: '방학은 7주 이상으로 정하세요', term: '학기는 10주 이상으로 정하세요' },
  );
});

test('BASE·ADV는 시작일 하나로 1~16주차, 스터디는 1~8주차의 날짜가 나온다', () => {
  const dates = weekDatesByActivity({
    ...VALID,
    starts: { ...VALID.starts, STUDY_VACATION: '2027-01-05' },
    voidWeekNos: [],
  });
  assert.equal(Object.keys(dates.BASE).length, 16);
  assert.equal(dates.BASE[16], '2027-04-20');
  assert.equal(Object.keys(dates.STUDY_VACATION).length, 8);
});

test('휴강 공통 주차에는 BASE·ADV를 하지 않아 그 주를 건너뛰고, 주차 수는 그대로 16주차다. 스터디는 건너뛰지 않는다', () => {
  // 공통 4주차(2027-01-18~01-24)가 휴강이다. BASE 3주차였던 01-19는 그 주라 건너뛴다.
  const dates = weekDatesByActivity({
    ...VALID,
    starts: { ...VALID.starts, STUDY_VACATION: '2027-01-05' },
  });

  assert.equal(dates.BASE[2], '2027-01-12');
  assert.equal(dates.BASE[3], '2027-01-26');
  assert.equal(Object.keys(dates.BASE).length, 16);
  assert.equal(dates.BASE[16], '2027-04-27');
  // 스터디 휴강은 스터디장이 따로 정하므로 공통 휴강 주에도 그대로 이어진다.
  assert.equal(dates.STUDY_VACATION[3], '2027-01-19');
  assert.equal(Object.keys(dates.STUDY_VACATION).length, 8);
});

test('휴강 주차 번호는 BASE·ADV 가운데 먼저 시작하는 활동의 1주차가 든 주를 1주차로 센다', () => {
  // 방학 07-01(수) 시작이라 공통 1주차는 06-29 주다. BASE 07-07은 공통 2주차라 그 주가 1주차가 된다.
  const form: ScheduleForm = {
    ...emptyScheduleForm(),
    vacation: { startDate: '2026-07-01', endDate: '2026-08-31' },
    term: { startDate: '2026-09-01', endDate: '2026-12-31' },
    starts: { BASE: '2026-07-07', ADV: '2026-07-08', STUDY_VACATION: '', STUDY_TERM: '' },
  };

  assert.equal(displayWeekNoOf(form, 2), 1);
  assert.equal(displayWeekNoOf(form, 13), 12);
  // BASE·ADV 1주차보다 앞선 공통 1주차는 휴강 목록에 나오지 않는다.
  assert.equal(displayWeekNoOf(form, 1), null);
  const options = voidWeekOptionsOf(form);
  assert.deepEqual(
    options
      .slice(0, 2)
      .map(({ weekNo, displayNo, startDate }) => ({ weekNo, displayNo, startDate })),
    [
      { weekNo: 2, displayNo: 1, startDate: '2026-07-06' },
      { weekNo: 3, displayNo: 2, startDate: '2026-07-13' },
    ],
  );
  // BASE·ADV 시작일이 없으면 공통 주차 번호를 그대로 쓴다.
  assert.equal(displayWeekNoOf({ ...form, starts: { ...form.starts, BASE: '', ADV: '' } }, 13), 13);
});

test('고른 휴강 주차는 이어진 주를 물결표로 묶고, 떨어진 주는 쉼표로 나눠 짧게 쓴다', () => {
  assert.equal(weekRangeText([]), '없음');
  assert.equal(weekRangeText([3]), '3주차');
  assert.equal(weekRangeText([4, 3]), '3, 4주차');
  assert.equal(weekRangeText([3, 7]), '3, 7주차');
  assert.equal(weekRangeText([3, 4, 5, 9]), '3, 4, 5, 9주차');
});
