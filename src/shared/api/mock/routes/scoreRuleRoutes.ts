/**
 * 출결 점수 규칙 API. 점수 기준이 바뀔 때 버전을 만들며, 전체에서 ACTIVE 규칙은 하나뿐이다.
 * 응답은 화면이 쓰는 ScoreRule 형태이며, 예전 필드(present·late·absent)도 같은 값으로 채운다.
 */
import type { Database } from 'sql.js';

import type { ScoreRuleUpsertRequest } from '@/entities/score-rule/model/dto';
import { getActiveRule } from '@/entities/score-rule/model/lib';
import type { ScoreRule, ScoreRuleStatus } from '@/entities/score-rule/model/types';
import { execute, queryAll } from '@/shared/db/createDatabase';

import { notFound, resolveSemester } from '../queries';
import { nowStamp } from './teamAttendanceRoutes';
import { ApiError, type MockRoute } from '../router';
import {
  type Body,
  oneOf,
  optionalNumber,
  optionalString,
  parsePositiveInt,
  readBody,
  requiredString,
} from '../validate';

interface ScoreRuleRow extends Record<string, unknown> {
  id: string;
  version: number;
  term: number;
  name: string;
  start_date: string;
  end_date: string | null;
  status: ScoreRuleStatus;
  activated_at: string | null;
  created_by: string;
  description: string;
  present_score: number;
  absent_penalty: number;
  unexcused_absent_penalty: number;
  late_penalty: number;
  early_leave_penalty: number;
  unexcused_late_penalty: number;
  study_fail_penalty: number;
  study_perfect_bonus: number;
  study_pass_bonus: number;
  study_leader_bonus: number;
  study_pass_max_absences: number;
  study_none_completed_penalty: number;
  base_score: number;
  newcomer_excused_absent_penalty: number;
  newcomer_late_penalty: number;
  newcomer_excused_late_penalty: number;
  conference_first_bonus: number;
  conference_second_bonus: number;
  excused_absent_score: number;
  unexcused_lates_per_absence: number;
  expel_unexcused_absences: number;
}

/** 요청 필드 → 컬럼. 점수 항목은 숫자, 나머지는 문자열이다. */
const SCORE_COLUMNS = {
  presentScore: 'present_score',
  absentPenalty: 'absent_penalty',
  unexcusedAbsentPenalty: 'unexcused_absent_penalty',
  latePenalty: 'late_penalty',
  earlyLeavePenalty: 'early_leave_penalty',
  unexcusedLatePenalty: 'unexcused_late_penalty',
  studyFailPenalty: 'study_fail_penalty',
  studyPerfectBonus: 'study_perfect_bonus',
  studyPassBonus: 'study_pass_bonus',
  studyLeaderBonus: 'study_leader_bonus',
  studyPassMaxAbsences: 'study_pass_max_absences',
  studyNoneCompletedPenalty: 'study_none_completed_penalty',
  baseScore: 'base_score',
  newcomerExcusedAbsentPenalty: 'newcomer_excused_absent_penalty',
  newcomerLatePenalty: 'newcomer_late_penalty',
  newcomerExcusedLatePenalty: 'newcomer_excused_late_penalty',
  conferenceFirstBonus: 'conference_first_bonus',
  conferenceSecondBonus: 'conference_second_bonus',
  excusedAbsentScore: 'excused_absent_score',
  unexcusedLatesPerAbsence: 'unexcused_lates_per_absence',
  expelUnexcusedAbsences: 'expel_unexcused_absences',
} as const satisfies Partial<Record<keyof ScoreRuleUpsertRequest, string>>;

const EDITABLE_STATUSES: readonly Exclude<ScoreRuleStatus, 'ACTIVE'>[] = [
  'INACTIVE',
  'DRAFT',
  'SCHEDULED',
];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toScoreRule(row: ScoreRuleRow): ScoreRule {
  return {
    id: row.id,
    version: row.version,
    term: row.term,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    activatedAt: row.activated_at,
    createdBy: row.created_by,
    description: row.description,
    present: row.present_score,
    late: row.late_penalty,
    absent: row.absent_penalty,
    presentScore: row.present_score,
    absentPenalty: row.absent_penalty,
    unexcusedAbsentPenalty: row.unexcused_absent_penalty,
    latePenalty: row.late_penalty,
    earlyLeavePenalty: row.early_leave_penalty,
    unexcusedLatePenalty: row.unexcused_late_penalty,
    studyFailPenalty: row.study_fail_penalty,
    studyPerfectBonus: row.study_perfect_bonus,
    studyPassBonus: row.study_pass_bonus,
    studyLeaderBonus: row.study_leader_bonus,
    studyPassMaxAbsences: row.study_pass_max_absences,
    studyNoneCompletedPenalty: row.study_none_completed_penalty,
    baseScore: row.base_score,
    newcomerExcusedAbsentPenalty: row.newcomer_excused_absent_penalty,
    newcomerLatePenalty: row.newcomer_late_penalty,
    newcomerExcusedLatePenalty: row.newcomer_excused_late_penalty,
    conferenceFirstBonus: row.conference_first_bonus,
    conferenceSecondBonus: row.conference_second_bonus,
    excusedAbsentScore: row.excused_absent_score,
    unexcusedLatesPerAbsence: row.unexcused_lates_per_absence,
    expelUnexcusedAbsences: row.expel_unexcused_absences,
  };
}

/** 모든 점수 규칙(최신 버전부터). */
export function listScoreRules(db: Database): ScoreRule[] {
  return queryAll<ScoreRuleRow>(db, 'SELECT * FROM score_rules ORDER BY version DESC').map(
    toScoreRule,
  );
}

function findScoreRule(db: Database, ruleId: string): ScoreRule {
  const row = queryAll<ScoreRuleRow>(db, 'SELECT * FROM score_rules WHERE id = ?', [ruleId])[0];
  if (!row) throw notFound('점수 규칙을 찾을 수 없습니다.');
  return toScoreRule(row);
}

function dateOf(body: Body, key: string): string | undefined {
  const value = optionalString(body, key);
  if (value !== undefined && !DATE_PATTERN.test(value)) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 값은 YYYY-MM-DD 형식이어야 합니다.`);
  }
  return value;
}

function scoreOf(body: Body, key: string): number | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError(400, 'BAD_REQUEST', `${key} 값은 숫자여야 합니다.`);
  }
  return value;
}

function dayBefore(date: string): string {
  const value = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
    throw new ApiError(400, 'BAD_REQUEST', '올바른 적용 시작일을 입력해 주세요.');
  }
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

/** 본문에 있는 값만 컬럼 → 값 목록으로 만든다. */
function changedColumns(body: Body): [string, string | number | null][] {
  const columns: [string, string | number | null][] = [];
  const name = optionalString(body, 'name');
  if (name !== undefined) columns.push(['name', name]);
  const startDate = dateOf(body, 'startDate');
  if (startDate !== undefined) columns.push(['start_date', startDate]);
  if ('endDate' in body) columns.push(['end_date', dateOf(body, 'endDate') || null]);
  const status = oneOf(optionalString(body, 'status'), EDITABLE_STATUSES, 'status');
  if (status !== undefined) columns.push(['status', status]);
  const createdBy = optionalString(body, 'createdBy');
  if (createdBy !== undefined) columns.push(['created_by', createdBy]);
  const description = optionalString(body, 'description');
  if (description !== undefined) columns.push(['description', description]);
  Object.entries(SCORE_COLUMNS).forEach(([key, column]) => {
    const value = scoreOf(body, key);
    if (value !== undefined) columns.push([column, value]);
  });
  return columns;
}

export const scoreRuleRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/score-rules',
    summary: '출결 점수 규칙 목록(최신 버전부터). term 필터는 기존 API 호환용',
    handler: ({ db, query }) => {
      const term = parsePositiveInt(query.get('term'), 'term');
      return listScoreRules(db).filter((rule) => term === undefined || rule.term === term);
    },
  },
  {
    // '/:ruleId'보다 먼저 두어야 'applied'가 규칙 id로 해석되지 않는다.
    method: 'GET',
    pattern: '/api/v1/score-rules/applied',
    summary: '반기(생략하면 현재 반기)에 적용되는 출결 점수 규칙. 그 반기 기수의 규칙이 없으면 409',
    handler: ({ db, query }) => {
      const semester = resolveSemester(db, query.get('semester'));
      const rule = getActiveRule(listScoreRules(db));
      if (!rule) {
        throw new ApiError(
          409,
          'SCORE_RULE_NOT_FOUND',
          `${semester.semester} 반기에 적용할 점수 규칙이 없습니다.`,
        );
      }
      return rule;
    },
  },
  {
    method: 'GET',
    pattern: '/api/v1/score-rules/:ruleId',
    summary: '출결 점수 규칙 상세',
    handler: ({ db, params }) => findScoreRule(db, params.ruleId),
  },
  {
    method: 'POST',
    pattern: '/api/v1/score-rules',
    summary: '출결 점수 규칙 생성 및 적용. 이전 규칙은 새 시작일 전날 종료',
    handler: ({ db, body }) => {
      const input = readBody(body);
      const term = optionalNumber(input, 'term');
      if (!term) throw new ApiError(400, 'BAD_REQUEST', 'term 값이 필요합니다.');
      requiredString(input, 'name');
      const startDate = dateOf(input, 'startDate');
      if (!startDate) throw new ApiError(400, 'BAD_REQUEST', 'startDate 값이 필요합니다.');
      const version = queryAll<{ version: number }>(
        db,
        'SELECT COALESCE(MAX(version), 0) + 1 AS version FROM score_rules',
      )[0].version;
      const id = `rule-v${version}`;
      const previous = queryAll<{ id: string; start_date: string }>(
        db,
        "SELECT id, start_date FROM score_rules WHERE status = 'ACTIVE' LIMIT 1",
      )[0];
      if (previous && previous.start_date >= startDate) {
        throw new ApiError(
          400,
          'BAD_REQUEST',
          '새 버전은 이전 버전의 시작일 이후에 시작해야 합니다.',
        );
      }
      if (previous) {
        execute(db, "UPDATE score_rules SET status = 'INACTIVE', end_date = ? WHERE id = ?", [
          dayBefore(startDate),
          previous.id,
        ]);
      }
      // 기본값 뒤에 본문 값을 넣어, 같은 컬럼이면 본문 값이 남게 한다.
      const values = new Map<string, string | number | null>([
        ['id', id],
        ['version', version],
        ['term', term],
        ['created_by', `${term}기 대표진`],
        ...changedColumns(input),
        ['status', 'ACTIVE'],
        ['activated_at', nowStamp().slice(0, 10)],
      ]);
      execute(
        db,
        `INSERT INTO score_rules (${[...values.keys()].join(', ')})
         VALUES (${[...values.keys()].map(() => '?').join(', ')})`,
        [...values.values()],
      );
      return findScoreRule(db, id);
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/score-rules/:ruleId',
    summary: '출결 점수 규칙 수정(보낸 값만 바뀐다). 활성화는 activate API로 한다',
    handler: ({ db, params, body }) => {
      const rule = findScoreRule(db, params.ruleId);
      const input = readBody(body);
      if ('term' in input)
        throw new ApiError(400, 'BAD_REQUEST', '규칙의 기수는 바꿀 수 없습니다.');
      const columns = changedColumns(input);
      const nextStartDate = dateOf(input, 'startDate');
      if (rule.status === 'ACTIVE' && nextStartDate && nextStartDate !== rule.startDate) {
        const previous = queryAll<{ id: string; start_date: string }>(
          db,
          "SELECT id, start_date FROM score_rules WHERE status = 'INACTIVE' AND version < ? ORDER BY version DESC LIMIT 1",
          [rule.version],
        )[0];
        if (previous && previous.start_date >= nextStartDate) {
          throw new ApiError(400, 'BAD_REQUEST', '시작일은 이전 버전의 시작일 이후여야 합니다.');
        }
        if (previous) {
          execute(db, 'UPDATE score_rules SET end_date = ? WHERE id = ?', [
            dayBefore(nextStartDate),
            previous.id,
          ]);
        }
      }
      if (rule.status === 'ACTIVE' && columns.some(([column]) => column === 'status')) {
        throw new ApiError(
          409,
          'RULE_ACTIVE',
          '적용 중인 규칙은 다른 규칙을 활성화해야 상태가 바뀝니다.',
        );
      }
      if (columns.length > 0) {
        execute(
          db,
          `UPDATE score_rules SET ${columns.map(([column]) => `${column} = ?`).join(', ')} WHERE id = ?`,
          [...columns.map(([, value]) => value), rule.id as string],
        );
      }
      return findScoreRule(db, rule.id as string);
    },
  },
  {
    method: 'POST',
    pattern: '/api/v1/score-rules/:ruleId/activate',
    summary: '출결 점수 규칙 활성화. 기존 적용 중 규칙은 비활성으로 바뀐다',
    handler: ({ db, params }) => {
      const rule = findScoreRule(db, params.ruleId);
      const previous = queryAll<{ id: string; start_date: string }>(
        db,
        "SELECT id, start_date FROM score_rules WHERE status = 'ACTIVE' AND id <> ? LIMIT 1",
        [rule.id as string],
      )[0];
      if (previous) {
        const previousEnd = new Date(`${rule.startDate}T00:00:00Z`);
        if (previous.start_date >= rule.startDate) {
          throw new ApiError(
            400,
            'BAD_REQUEST',
            '새 버전은 이전 버전의 시작일 이후에 시작해야 합니다.',
          );
        }
        previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
        execute(db, 'UPDATE score_rules SET end_date = ? WHERE id = ?', [
          previousEnd.toISOString().slice(0, 10),
          previous.id,
        ]);
      }
      const today = nowStamp().slice(0, 10); // 로컬 날짜(YYYY-MM-DD). toISOString은 UTC라 오전에 하루 전 날짜가 된다.
      execute(
        db,
        "UPDATE score_rules SET status = 'INACTIVE' WHERE status = 'ACTIVE' AND id <> ?",
        [rule.id as string],
      );
      execute(db, "UPDATE score_rules SET status = 'ACTIVE', activated_at = ? WHERE id = ?", [
        today,
        rule.id as string,
      ]);
      return findScoreRule(db, rule.id as string);
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/score-rules/:ruleId',
    summary: '출결 점수 규칙 삭제. 적용 중인 규칙과 마지막 남은 규칙은 지울 수 없다',
    handler: ({ db, params }) => {
      const rule = findScoreRule(db, params.ruleId);
      if (rule.status === 'ACTIVE') {
        throw new ApiError(409, 'RULE_ACTIVE', '적용 중인 규칙은 삭제할 수 없습니다.');
      }
      if (listScoreRules(db).length <= 1) {
        throw new ApiError(409, 'LAST_RULE', '최소 하나의 점수 규칙은 유지되어야 합니다.');
      }
      execute(db, 'DELETE FROM score_rules WHERE id = ?', [rule.id as string]);
      return { deleted: rule.id };
    },
  },
];
