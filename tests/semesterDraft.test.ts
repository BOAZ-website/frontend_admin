import assert from 'node:assert/strict';
import test from 'node:test';

import {
  emptyScheduleForm,
  semesterHalfError,
} from '../src/pages/system-semesters/model/scheduleForm';
import {
  parseSemesterDraft,
  type SemesterDraft,
} from '../src/pages/system-semesters/model/semesterDraft';

const DRAFT: SemesterDraft = {
  name: '27-1',
  half: 'H1',
  scoreRuleSetId: 1,
  baseTerm: 28,
  advTerm: 27,
  form: emptyScheduleForm(),
};

test('임시 저장한 새 반기는 같은 값으로 다시 읽힌다', () => {
  assert.deepEqual(parseSemesterDraft(JSON.stringify(DRAFT)), DRAFT);
});

test('상반기·하반기를 넣기 전에 저장한 입력은 고르지 않은 상태로 읽힌다', () => {
  const oldDraft = Object.fromEntries(Object.entries(DRAFT).filter(([key]) => key !== 'half'));

  assert.deepEqual(parseSemesterDraft(JSON.stringify(oldDraft)), { ...DRAFT, half: '' });
  assert.deepEqual(parseSemesterDraft(JSON.stringify({ ...DRAFT, half: 'H3' })), {
    ...DRAFT,
    half: '',
  });
});

test('상반기·하반기는 골라야 하고 반기 이름의 N과 맞아야 한다(1=H1, 2=H2)', () => {
  assert.equal(semesterHalfError('', '27-1'), '상반기·하반기를 고르세요');
  assert.equal(semesterHalfError('H1', '27-1'), undefined);
  assert.equal(semesterHalfError('H2', '27-2'), undefined);
  assert.equal(semesterHalfError('H2', '27-1'), '27-1 반기는 상반기입니다');
  assert.equal(semesterHalfError('H1', '27-2'), '27-2 반기는 하반기입니다');
  // 이름 형식이 틀리면 이름 칸이 오류를 보이므로 여기서는 맞춰 보지 않는다.
  assert.equal(semesterHalfError('H1', '27'), undefined);
});

test('임시 저장 값이 없거나 모양이 틀리면 null이다(깨진 값으로 화면을 열지 않는다)', () => {
  assert.equal(parseSemesterDraft(null), null);
  assert.equal(parseSemesterDraft('not json'), null);
  assert.equal(parseSemesterDraft(JSON.stringify({ ...DRAFT, baseTerm: '28' })), null);
  assert.equal(parseSemesterDraft(JSON.stringify({ ...DRAFT, form: { starts: {} } })), null);
});
