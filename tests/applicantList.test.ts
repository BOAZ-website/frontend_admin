import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_APPLICANT_QUERY,
  displayValue,
  filterApplicants,
  filterByMyEvaluation,
  isFilteredQuery,
  summarizeApplicants,
  visibleTracksOf,
} from '../src/pages/recruiting-evaluation/model/applicantList';
import { INITIAL_DATA } from '../src/pages/recruiting-evaluation/model/evaluationMock';
import { dateTimeTextOf } from '../src/shared/lib/date';

const applicants = INITIAL_DATA.applicants;

test('기본 조건은 DRAFT를 포함한 전체를 제출일 최신순으로 두고 DRAFT는 맨 뒤에 둔다', () => {
  const rows = filterApplicants(applicants, DEFAULT_APPLICANT_QUERY);

  assert.equal(rows.length, applicants.length);
  const submittedAts = rows.map((row) => row.submitted_at);
  const firstNull = submittedAts.indexOf(null);
  assert.ok(firstNull === -1 || submittedAts.slice(firstNull).every((value) => value === null));
  const dated = submittedAts.filter((value): value is string => value !== null);
  assert.deepEqual(dated, [...dated].sort().reverse());
});

test('오래된순으로 바꿔도 제출일이 없는 DRAFT는 뒤에 남는다', () => {
  const rows = filterApplicants(applicants, { ...DEFAULT_APPLICANT_QUERY, sort: 'SUBMITTED_ASC' });

  const dated = rows.map((row) => row.submitted_at).filter((value) => value !== null);
  assert.deepEqual(dated, [...dated].sort());
  assert.equal(rows.at(-1)?.status, 'DRAFT');
});

test('제출 상태·트랙·검색어를 함께 거른다', () => {
  const drafts = filterApplicants(applicants, { ...DEFAULT_APPLICANT_QUERY, status: 'DRAFT' });
  assert.ok(drafts.length > 0 && drafts.every((row) => row.status === 'DRAFT'));

  const target = applicants.find((row) => row.status === 'SUBMITTED');
  assert.ok(target);
  const searched = filterApplicants(applicants, {
    ...DEFAULT_APPLICANT_QUERY,
    track: target.track,
    search: target.email.toUpperCase(),
  });
  assert.deepEqual(
    searched.map((row) => row.id),
    [target.id],
  );
});

test('통계는 지원 현황은 전체를, 평가 현황은 제출 완료만 센다', () => {
  const summary = summarizeApplicants(applicants);
  const submitted = applicants.filter((row) => row.status === 'SUBMITTED');

  assert.equal(summary.total, applicants.length);
  assert.equal(summary.submitted + summary.draft, summary.total);
  assert.equal(
    summary.finalPass + summary.finalHold + summary.finalFail + summary.finalPending,
    submitted.length,
  );
  assert.equal(summary.myEvaluated, submitted.filter((row) => row.my_decision !== null).length);
});

test('필터를 하나라도 바꾸면 필터 초기화 대상이고 정렬만 바꾸면 아니다', () => {
  assert.equal(isFilteredQuery(DEFAULT_APPLICANT_QUERY), false);
  assert.equal(isFilteredQuery({ ...DEFAULT_APPLICANT_QUERY, sort: 'NAME' }), false);
  assert.equal(isFilteredQuery({ ...DEFAULT_APPLICANT_QUERY, search: ' 가 ' }), true);
});

test('비어 있는 값은 -로, 목록은 쉼표로, 참거짓은 있음·없음으로 보여 준다', () => {
  assert.equal(displayValue(null), '-');
  assert.equal(displayValue(''), '-');
  assert.equal(displayValue([]), '-');
  assert.equal(displayValue(['통계학', '경영학']), '통계학, 경영학');
  assert.equal(displayValue(false), '없음');
  assert.equal(displayValue(7), '7');
});

test('서버 일시는 분까지 공백으로 이어 보여 준다', () => {
  assert.equal(dateTimeTextOf('2026-08-15T19:20:00'), '2026-08-15 19:20');
});

test('평가 상태 필터는 my_decision이 null이면 미평가, PENDING을 포함해 값이 있으면 저장됨으로 나눈다', () => {
  const pending = { ...applicants[0], my_decision: 'PENDING' as const };
  const none = { ...applicants[0], id: -1, my_decision: null };
  const list = [pending, none];

  assert.deepEqual(filterByMyEvaluation(list, 'SAVED'), [pending]);
  assert.deepEqual(filterByMyEvaluation(list, 'UNEVALUATED'), [none]);
  assert.equal(filterByMyEvaluation(list, 'ALL').length, 2);
});

test('부문 지표는 대표진·차기대표진·다른 부문 평가 권한이면 세 부문, 그 밖에는 자기 부문만 보여 준다', () => {
  const account = (teamName: string, track: string, effectivePermissions: string[] = []) => ({
    teamName,
    track,
    effectivePermissions,
  });
  const all = ['ANALYSIS', 'VISUALIZATION', 'ENGINEERING'];
  assert.deepEqual(visibleTracksOf(account('대표진', '분석')), all);
  assert.deepEqual(visibleTracksOf(account('차기대표진', '시각화')), all);
  assert.deepEqual(visibleTracksOf(account('기획팀', '분석', ['EVALUATION_ALL_TRACK_WRITE'])), all);
  assert.deepEqual(visibleTracksOf(account('기획팀', '분석')), ['ANALYSIS']);
  assert.deepEqual(visibleTracksOf(account('기획팀', '엔지니어링')), ['ENGINEERING']);
  assert.deepEqual(visibleTracksOf(account('기획팀', '')), []);
  assert.deepEqual(visibleTracksOf(null), []);
});
