/**
 * 출결 점수 규칙 탭의 표 구성. 「관리자 시스템 관련 현행 운영 방식」 문서의 절(출결 및 기본 감점, 스터디,
 * 행사 출결, 컨퍼런스 가점)과 같은 순서로 보여 준다.
 * 운영진이 직접 반영하는 가점(공동세션 발표·수상 등)은 출결에 반영되지 않아 두지 않는다.
 * 숫자 배점은 모두 점수 규칙(DB, API 응답)의 값을 쓰고, 문서에 숫자가 없는 처리(제명, 선발 취소 등)만 글자로 둔다.
 */
import type { ScoreRule } from '@/entities/score-rule/model/types';

/** 점수 규칙의 숫자 배점 항목. */
export type ScoreField =
  | 'baseScore'
  | 'presentScore'
  | 'latePenalty'
  | 'earlyLeavePenalty'
  | 'absentPenalty'
  | 'unexcusedLatePenalty'
  | 'unexcusedAbsentPenalty'
  | 'studyPerfectBonus'
  | 'studyPassBonus'
  | 'studyPassMaxAbsences'
  | 'studyFailPenalty'
  | 'studyNoneCompletedPenalty'
  | 'studyLeaderBonus'
  | 'newcomerExcusedAbsentPenalty'
  | 'newcomerLatePenalty'
  | 'newcomerExcusedLatePenalty'
  | 'conferenceFirstBonus'
  | 'conferenceSecondBonus'
  | 'excusedAbsentScore'
  | 'unexcusedLatesPerAbsence'
  | 'expelUnexcusedAbsences';

/** 규칙 생성 창의 배점 입력 칸. default는 문서의 배점이며, 규칙에 값이 없을 때만 쓴다. */
export const SCORE_FIELDS: readonly {
  key: ScoreField;
  category: string;
  label: string;
  default: number;
}[] = [
  { key: 'baseScore', category: '기본', label: '기본 활동점수', default: 10 },
  { key: 'presentScore', category: '출결', label: '출석', default: 0 },
  { key: 'latePenalty', category: '출결', label: '지각', default: -1 },
  { key: 'earlyLeavePenalty', category: '출결', label: '조퇴', default: -1 },
  { key: 'absentPenalty', category: '출결', label: '일반 결석', default: -3 },
  { key: 'excusedAbsentScore', category: '출결', label: '인정결석', default: 0 },
  {
    key: 'unexcusedLatesPerAbsence',
    category: '출결',
    label: '무단결석 환산 무단지각 횟수',
    default: 3,
  },
  { key: 'expelUnexcusedAbsences', category: '출결', label: '제명 무단결석 횟수', default: 3 },
  {
    key: 'unexcusedLatePenalty',
    category: '출결',
    label: '무단지각 3회(무단결석 환산)',
    default: -4,
  },
  { key: 'unexcusedAbsentPenalty', category: '출결', label: '무단결석', default: -4 },
  { key: 'studyPerfectBonus', category: '스터디', label: '모두 출석', default: 3 },
  { key: 'studyPassBonus', category: '스터디', label: '결석이 최대 결석 횟수 이하', default: 1 },
  { key: 'studyPassMaxAbsences', category: '스터디', label: '최대 결석 횟수(회)', default: 2 },
  { key: 'studyFailPenalty', category: '스터디', label: '결석이 최대 결석 횟수 초과', default: -5 },
  {
    key: 'studyNoneCompletedPenalty',
    category: '스터디',
    label: '스터디 하나도 이수 X',
    default: -5,
  },
  { key: 'studyLeaderBonus', category: '스터디', label: '스터디 팀장', default: 1 },
  {
    key: 'newcomerExcusedAbsentPenalty',
    category: '신입 특칙',
    label: '인정 사유 결석',
    default: -10,
  },
  { key: 'newcomerLatePenalty', category: '신입 특칙', label: '지각 또는 조퇴', default: -15 },
  {
    key: 'newcomerExcusedLatePenalty',
    category: '신입 특칙',
    label: '인정 사유 지각·조퇴',
    default: -5,
  },
  { key: 'conferenceFirstBonus', category: '가점', label: '컨퍼런스 1차 출석', default: 1 },
  { key: 'conferenceSecondBonus', category: '가점', label: '컨퍼런스 2차 출석', default: 1 },
];

/** 규칙의 배점. 값이 없으면 문서의 배점을 쓴다. */
export function scoreOf(rule: ScoreRule, key: ScoreField): number {
  return rule[key] ?? SCORE_FIELDS.find((field) => field.key === key)?.default ?? 0;
}

/** 배점 글자. 양수는 +를 붙인다(예: +1점, -0.5점, 0점). */
export function formatScore(score: number, suffix = ''): string {
  return `${score > 0 ? '+' : ''}${score}점${suffix}`;
}

/** 표 한 줄. score가 숫자면 배점(색을 입힌다), 글자면 처리 방식이다. */
export interface RuleRow {
  item: string;
  condition: string;
  score: number | string;
  /** 점수 칸이 이 배점 항목의 값이면 그 항목. 규칙 생성 창에서는 이 칸이 입력칸이 된다. */
  field?: ScoreField;
  /**
   * 항목 이름 안의 횟수를 규칙 값으로 쓰는 줄(예: '결석 1~2회'). 규칙 생성 창에서 offset이 0인 줄만
   * before와 after 사이에 횟수 입력칸을 둔다(offset이 있는 줄은 그 값으로 계산해 보여 준다).
   */
  itemCount?: { field: ScoreField; before: string; after: string; offset: number };
}

export interface RuleSection {
  title: string;
  /** 절 제목 옆에 붙이는 범위 설명(예: 정규 활동(BASE, ADV)). */
  scope?: string;
  /** 표 위에 두는 기준 설명. */
  notes?: readonly string[];
  rows: readonly RuleRow[];
  /** 표 아래 두는 덧붙임. */
  footnotes?: readonly string[];
}

/** 문서 순서대로 만든 절 목록. */
export function ruleSectionsOf(rule: ScoreRule): RuleSection[] {
  const score = (key: ScoreField) => scoreOf(rule, key);
  return [
    {
      title: '출결 및 기본 감점',
      scope: '정규 활동(BASE, ADV)',
      rows: [
        {
          item: '기본 활동점수',
          condition: '최초 가입 시 1회',
          score: score('baseScore'),
          field: 'baseScore',
        },
        {
          item: '정규활동 지각',
          condition: '시작 후 15분 이내 입실',
          score: score('latePenalty'),
          field: 'latePenalty',
        },
        {
          item: '정규활동 조퇴',
          condition: '시작 1시간 이후부터 종료 전 퇴실',
          score: score('earlyLeavePenalty'),
          field: 'earlyLeavePenalty',
        },
        {
          item: '일반 결석',
          condition: '사전 연락 O, 인정결석 아님',
          score: score('absentPenalty'),
          field: 'absentPenalty',
        },
        {
          item: '인정결석',
          condition: '증빙 제출 및 인정 사유 충족',
          score: score('excusedAbsentScore'),
          field: 'excusedAbsentScore',
        },
        { item: '무단지각', condition: '사전 연락 X', score: '지각으로 처리 + 무단지각 횟수 누적' },
        {
          item: `무단지각 ${score('unexcusedLatesPerAbsence')}회`,
          condition: '누적되면 무단결석 1회로 환산',
          score: score('unexcusedLatePenalty'),
          field: 'unexcusedLatePenalty',
          itemCount: {
            field: 'unexcusedLatesPerAbsence',
            before: '무단지각',
            after: '회',
            offset: 0,
          },
        },
        {
          item: '무단결석',
          condition: '사전 연락 X',
          score: score('unexcusedAbsentPenalty'),
          field: 'unexcusedAbsentPenalty',
        },
        {
          item: `무단결석 ${score('expelUnexcusedAbsences')}회`,
          condition: '누적',
          score: '제명',
          itemCount: {
            field: 'expelUnexcusedAbsences',
            before: '무단결석',
            after: '회',
            offset: 0,
          },
        },
      ],
    },
    {
      title: '스터디',
      rows: [
        {
          item: '모두 출석',
          condition: '스터디 하나 이상 이수, 진행한 회차 모두 출석',
          score: score('studyPerfectBonus'),
          field: 'studyPerfectBonus',
        },
        {
          item: `결석 1~${score('studyPassMaxAbsences')}회`,
          condition: '스터디 하나 이상 이수',
          score: score('studyPassBonus'),
          field: 'studyPassBonus',
          itemCount: { field: 'studyPassMaxAbsences', before: '결석 1~', after: '회', offset: 0 },
        },
        {
          item: `결석 ${score('studyPassMaxAbsences') + 1}회 이상`,
          condition: '스터디 하나 이상 이수',
          score: score('studyFailPenalty'),
          field: 'studyFailPenalty',
          itemCount: {
            field: 'studyPassMaxAbsences',
            before: '결석 ',
            after: '회 이상',
            offset: 1,
          },
        },
        {
          item: '하나도 이수 X',
          condition: '스터디를 하나도 이수하지 않음',
          score: score('studyNoneCompletedPenalty'),
          field: 'studyNoneCompletedPenalty',
        },
        {
          item: '스터디 팀장',
          condition: '스터디 이수와 상관없이',
          score: score('studyLeaderBonus'),
          field: 'studyLeaderBonus',
        },
      ],
    },
    {
      title: '신입 특칙형 행사 출결',
      scope: '신입 OT, 컨퍼런스',
      rows: [
        { item: '결석', condition: '원칙', score: '선발 취소' },
        {
          item: '인정 사유 결석',
          condition: '운영진이 인정한 사유',
          score: score('newcomerExcusedAbsentPenalty'),
          field: 'newcomerExcusedAbsentPenalty',
        },
        {
          item: '지각 또는 조퇴',
          condition: '',
          score: score('newcomerLatePenalty'),
          field: 'newcomerLatePenalty',
        },
        {
          item: '인정 사유 지각·조퇴',
          condition: '인정 사유가 있는 지각 또는 조퇴',
          score: score('newcomerExcusedLatePenalty'),
          field: 'newcomerExcusedLatePenalty',
        },
        { item: '불가항력', condition: '운영진 논의 후', score: '감점 없이 인정 가능' },
      ],
    },
    {
      title: '일반 행사형 출결 코드',
      scope: 'MT, 해커톤, 컨퍼톡, 홈커밍데이',
      rows: [
        // 2·3·4·5·X는 위 정규 활동 배점과 같은 값이다. 어느 표에서 고쳐도 두 표가 함께 바뀐다.
        { item: '1', condition: '출석', score: score('presentScore'), field: 'presentScore' },
        { item: '2', condition: '지각', score: score('latePenalty'), field: 'latePenalty' },
        {
          item: '3',
          condition: '조퇴',
          score: score('earlyLeavePenalty'),
          field: 'earlyLeavePenalty',
        },
        {
          item: '4',
          condition: '사전 연락한 일반 결석',
          score: score('absentPenalty'),
          field: 'absentPenalty',
        },
        {
          item: '5',
          condition: '인정결석',
          score: score('excusedAbsentScore'),
          field: 'excusedAbsentScore',
        },
        { item: '0', condition: '무단지각', score: '지각으로 처리 + 무단지각 횟수 누적' },
        {
          item: 'X',
          condition: '무단결석',
          score: score('unexcusedAbsentPenalty'),
          field: 'unexcusedAbsentPenalty',
        },
      ],
    },
    {
      title: '컨퍼런스 가점',
      rows: [
        {
          item: '컨퍼런스 1차 출석',
          condition: '신입기수를 제외한 활동기수',
          score: score('conferenceFirstBonus'),
          field: 'conferenceFirstBonus',
        },
        {
          item: '컨퍼런스 2차 출석',
          condition: '신입기수를 제외한 활동기수',
          score: score('conferenceSecondBonus'),
          field: 'conferenceSecondBonus',
        },
      ],
    },
  ];
}
