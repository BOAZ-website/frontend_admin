import assert from 'node:assert/strict';
import test from 'node:test';

import type { Question } from '../src/entities/recruitment/model/types';
import {
  changedPeriod,
  fillMessageTemplate,
  moveQuestionChanges,
  nextOrderNum,
  recruitmentStatusOf,
  scheduleStepsOf,
  toDateTime,
} from '../src/pages/recruiting-manage/model/recruitmentView';
import { kstDateTime } from '../src/shared/lib/date';

const period = { start_date: '2026-12-01T00:00:00', end_date: '2026-12-20T23:59:59' };

test('공고 상태는 접수 기간과 지금 시각으로 정해지고, 시작·마감 시각 자체는 진행 중이다', () => {
  assert.equal(recruitmentStatusOf(period, '2026-11-30T23:59:59'), 'UPCOMING');
  assert.equal(recruitmentStatusOf(period, '2026-12-01T00:00:00'), 'ACTIVE');
  assert.equal(recruitmentStatusOf(period, '2026-12-20T23:59:59'), 'ACTIVE');
  assert.equal(recruitmentStatusOf(period, '2026-12-21T00:00:00'), 'CLOSED');
});

test('날짜에 시작은 0시, 마감은 23시 59분 59초를 붙인다', () => {
  assert.equal(toDateTime('2026-12-01', 'start'), '2026-12-01T00:00:00');
  assert.equal(toDateTime('2026-12-20', 'end'), '2026-12-20T23:59:59');
});

test('전형 일정은 단계 이름과 두 날짜가 모두 문자열인 항목만 쓴다', () => {
  const steps = scheduleStepsOf([
    { step: '서류 접수', startDate: '2026-12-01', endDate: '2026-12-20' },
    { step: '면접', startDate: '2026-12-27' },
    'text',
    null,
  ]);

  assert.deepEqual(steps, [{ step: '서류 접수', startDate: '2026-12-01', endDate: '2026-12-20' }]);
});

const text = (
  question_id: number,
  category: Question['category'],
  order_num: number,
): Question => ({
  question_id,
  label: `문항${question_id}`,
  category,
  content: '질문',
  order_num,
  is_required: true,
  type: 'TEXT',
  limit_length: 500,
});

const questions = [
  text(1, 'COMMON', 1),
  text(2, 'COMMON', 2),
  text(3, 'COMMON', 5),
  text(4, 'ANALYSIS', 1),
];

test('새 문항의 순서 번호는 같은 분류에서 가장 큰 번호 다음이다', () => {
  assert.equal(nextOrderNum(questions, 'COMMON'), 6);
  assert.equal(nextOrderNum(questions, 'VISUALIZATION'), 1);
});

test('문항을 옮기면 빈 번호를 거쳐 이웃 문항과 순서 번호를 바꾼다', () => {
  assert.deepEqual(moveQuestionChanges(questions, 2, 'DOWN'), [
    { questionId: 2, request: { order_num: 6 } },
    { questionId: 3, request: { order_num: 2 } },
    { questionId: 2, request: { order_num: 5 } },
  ]);
  assert.deepEqual(moveQuestionChanges(questions, 2, 'UP'), [
    { questionId: 2, request: { order_num: 6 } },
    { questionId: 1, request: { order_num: 2 } },
    { questionId: 2, request: { order_num: 1 } },
  ]);
});

test('분류의 맨 앞·맨 뒤 문항은 더 옮길 수 없고, 다른 분류 문항과는 바꾸지 않는다', () => {
  assert.deepEqual(moveQuestionChanges(questions, 1, 'UP'), []);
  assert.deepEqual(moveQuestionChanges(questions, 3, 'DOWN'), []);
  assert.deepEqual(moveQuestionChanges(questions, 4, 'UP'), []);
});

test('메시지 양식의 치환 변수는 모두 바뀌고, 값이 없는 변수는 그대로 남는다', () => {
  const message = fillMessageTemplate('{term}기 {term}기, {start_date}~{end_date} {name}', {
    term: '29',
    start_date: '2026-12-01',
    end_date: '2026-12-20',
  });

  assert.equal(message, '29기 29기, 2026-12-01~2026-12-20 {name}');
});

test('지금 시각은 실행 환경의 시간대와 관계없이 한국 시각으로 쓴다', () => {
  assert.equal(kstDateTime(new Date('2026-11-30T15:00:00Z')), '2026-12-01T00:00:00');
  assert.equal(kstDateTime(new Date('2026-12-01T14:59:59Z')), '2026-12-01T23:59:59');
});

test('공고 수정은 날짜를 바꾼 쪽의 일시만 보내, 그대로 둔 접수 시각을 덮어쓰지 않는다', () => {
  const original = { start_date: '2026-12-01T10:00:00', end_date: '2026-12-20T18:00:00' };

  assert.deepEqual(changedPeriod(original, '2026-12-01', '2026-12-20'), {});
  assert.deepEqual(changedPeriod(original, '2026-12-01', '2026-12-22'), {
    end_date: '2026-12-22T23:59:59',
  });
  assert.deepEqual(changedPeriod(original, '2026-12-02', '2026-12-20'), {
    start_date: '2026-12-02T00:00:00',
  });
});
