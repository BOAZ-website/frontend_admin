/**
 * [PoC 목 데이터] 서류 평가 화면이 쓰는 지원자·답변·평가·면접 질문과, 그 데이터를 바꾸는 계산 함수.
 * 실제 API 연동 때 이 파일 전체를 entities의 API 함수(REC-ADMIN-13~20, 승격 API)로 교체한다.
 * 화면은 이 파일을 직접 부르지 않고 useEvaluationData Hook만 쓴다(R7-1).
 */
import { ApiError } from '@/shared/api/apiError';

import { aggregateEvaluations } from './evaluationStatus';

import type {
  ApplicantAnswerDto,
  ApplicantEvaluationDto,
  EvaluationDecision,
  EvaluatorDetailItem,
  InterviewQuestionItem,
  MyEvaluationDto,
  MyEvaluationInput,
  PromotionResult,
  TrackType,
} from './types';

/** 화면이 들고 있는 서류 평가 데이터 전체. 실제 API에서는 응답별로 따로 받는다. */
export interface EvaluationData {
  applicants: ApplicantEvaluationDto[];
  answersMap: Record<number, ApplicantAnswerDto[]>;
  evaluatorsMap: Record<number, EvaluatorDetailItem[]>;
  interviewQuestionsMap: Record<number, InterviewQuestionItem[]>;
}

/** PoC의 현재 평가자. 실제 연동 때 로그인 계정(/me) 정보로 바꾼다. */
export const CURRENT_EVALUATOR = { admin_id: 1, name: '문혁준 (나)' } as const;

// Mock Evaluators Pool
const INITIAL_EVALUATOR_POOL: { admin_id: number; name: string; track: TrackType | 'COMMON' }[] = [
  { admin_id: 1, name: '문혁준 (나)', track: 'ENGINEERING' },
  { admin_id: 2, name: '강민석', track: 'ENGINEERING' },
  { admin_id: 3, name: '김대현', track: 'ENGINEERING' },
  { admin_id: 4, name: '남민서', track: 'ENGINEERING' },
  { admin_id: 5, name: '손채민', track: 'ENGINEERING' },
  { admin_id: 6, name: '신재원', track: 'ENGINEERING' },
  { admin_id: 7, name: '이욱성', track: 'ENGINEERING' },
  { admin_id: 8, name: '이주영', track: 'ENGINEERING' },
  { admin_id: 9, name: '장민주', track: 'ENGINEERING' },
  { admin_id: 10, name: '최재은', track: 'ENGINEERING' },
];

export const INITIAL_DATA: EvaluationData = {
  applicants: [
    {
      id: 101,
      user_id: 55,
      status: 'SUBMITTED',
      track: 'ENGINEERING',
      name: '이도현',
      email: 'dohyun@snu.ac.kr',
      phone: '010-3819-2910',
      university: '서울대학교',
      major: '컴퓨터공학과',
      minor_double_major: ['통계학 (복수전공)'],
      last_semester: 6,
      military_status: 'COMPLETED',
      birth_date: '2002-05-14',
      graduation_date: '2028-02',
      grad_school_plan: false,
      submitted_at: '2026-08-15T19:20:00',
      pass_count: 2,
      hold_count: 1,
      fail_count: 0,
      total_score: 23,
      final_decision: 'PASS',
      my_decision: 'HOLD',
      my_score: 8,
      my_memo:
        'AIOps 실시간 파이프라인 개발 경험이 매우 우수함. 면접 때 인프라 장애 대응 경험 질의 권장.',
      my_interview_question:
        'Kafka 파티션 분배 전략 및 트래픽 폭증 시 데이터 유실 방지 아키텍처는?',
      is_promoted_to_member: false,
    },
    {
      id: 102,
      user_id: 56,
      status: 'SUBMITTED',
      track: 'ENGINEERING',
      name: '박성훈',
      email: 'sunghoon.p@naver.com',
      phone: '010-9182-4122',
      university: '고려대학교',
      major: '컴퓨터학과',
      minor_double_major: [],
      last_semester: 7,
      military_status: 'COMPLETED',
      birth_date: '2001-08-20',
      graduation_date: '2027-08',
      grad_school_plan: true,
      submitted_at: '2026-08-16T10:15:00',
      pass_count: 1,
      hold_count: 0,
      fail_count: 0,
      total_score: 9,
      final_decision: 'PENDING',
      my_decision: null,
      my_score: null,
      my_memo: null,
      my_interview_question: null,
      is_promoted_to_member: false,
    },
    {
      id: 103,
      user_id: 57,
      status: 'SUBMITTED',
      track: 'ENGINEERING',
      name: '이지원',
      email: 'jiwon.lee@snu.ac.kr',
      phone: '010-3321-8890',
      university: '서울대학교',
      major: '전기정보공학부',
      minor_double_major: [],
      last_semester: 5,
      military_status: 'NOT_APPLICABLE',
      birth_date: '2003-02-11',
      graduation_date: '2028-02',
      grad_school_plan: false,
      submitted_at: '2026-08-16T11:30:00',
      pass_count: 0,
      hold_count: 1,
      fail_count: 0,
      total_score: 6,
      final_decision: 'PENDING',
      my_decision: null,
      my_score: null,
      my_memo: null,
      my_interview_question: null,
      is_promoted_to_member: false,
    },
    {
      id: 104,
      user_id: 58,
      status: 'SUBMITTED',
      track: 'ANALYSIS',
      name: '김서하',
      email: 'seoha.kim@yonsei.ac.kr',
      phone: '010-5519-8821',
      university: '연세대학교',
      major: '경영학과',
      minor_double_major: ['응용통계학'],
      last_semester: 6,
      military_status: 'NOT_APPLICABLE',
      birth_date: '2002-09-22',
      graduation_date: '2027-08',
      grad_school_plan: true,
      submitted_at: '2026-08-16T11:30:00',
      pass_count: 3,
      hold_count: 0,
      fail_count: 0,
      total_score: 27,
      final_decision: 'PASS',
      my_decision: 'PASS',
      my_score: 9,
      my_memo: '비즈니스 인사이트 및 그로스 실험 설계 역량이 탁월함',
      my_interview_question: 'A/B 테스트 시 p-value 해석과 표본 크기 산정 기준은?',
      is_promoted_to_member: false,
    },
    {
      id: 105,
      user_id: 59,
      status: 'SUBMITTED',
      track: 'VISUALIZATION',
      name: '최민혁',
      email: 'minhyuk.c@yonsei.ac.kr',
      phone: '010-5512-7019',
      university: '연세대학교',
      major: '산업공학과',
      minor_double_major: ['시각디자인'],
      last_semester: 8,
      military_status: 'COMPLETED',
      birth_date: '2001-11-03',
      graduation_date: '2027-02',
      grad_school_plan: false,
      submitted_at: '2026-08-16T14:00:00',
      pass_count: 1,
      hold_count: 1,
      fail_count: 0,
      total_score: 15,
      final_decision: 'PASS',
      my_decision: null,
      my_score: null,
      my_memo: null,
      my_interview_question: null,
      is_promoted_to_member: false,
    },
    {
      id: 106,
      user_id: 60,
      status: 'DRAFT',
      track: 'ENGINEERING',
      name: '한소희',
      email: 'sohee.han@korea.ac.kr',
      phone: '010-2219-9041',
      university: '고려대학교',
      major: null,
      minor_double_major: [],
      last_semester: null,
      military_status: 'NOT_APPLICABLE',
      birth_date: '2004-03-12',
      graduation_date: null,
      grad_school_plan: false,
      submitted_at: null,
      pass_count: 0,
      hold_count: 0,
      fail_count: 0,
      total_score: 0,
      final_decision: 'PENDING',
      my_decision: null,
      my_score: null,
      my_memo: null,
      my_interview_question: null,
      is_promoted_to_member: false,
    },
  ],
  answersMap: {
    101: [
      {
        question_id: 1,
        label: '공통0',
        category: 'COMMON',
        type: 'TEXT',
        content: '면접 가능 일정을 선택해 주세요.',
        order_num: 0,
        answer: '7월 4일(토) 13:00~15:00, 11:00~13:00 / 7월 5일(일) 13:00~15:00',
      },
      {
        question_id: 2,
        label: '공통1',
        category: 'COMMON',
        type: 'TEXT',
        content: '자기소개와 BOAZ에 지원한 동기를 서술해주세요.',
        order_num: 1,
        answer:
          '저는 시스템 인프라를 직접 구성하고 운영하며 동작 원리를 파고드는 것을 즐깁니다. AIOps 플랫폼을 개발하며 실시간 분산 파이프라인의 안정성이 서비스의 생명임을 배웠고, BOAZ에서 대규모 트래픽을 다루는 엔지니어들과 함께 성장하고 싶습니다.',
      },
      {
        question_id: 3,
        label: '엔지니어링1',
        category: 'ENGINEERING',
        type: 'TABLE',
        content: '엔지니어링 관련 주요 기술 스택 및 프로젝트 활용 경험',
        order_num: 2,
        answer: {
          Kafka: '3노드 클러스터 구축, 파티셔닝 최적화 (숙련도: 상)',
          'Spark / PySpark': '대규모 배치 데이터 집계 파이프라인 구축 (숙련도: 중)',
          'Docker / K8s': '컨테이너 오케스트레이션 및 모니터링 (숙련도: 중)',
        },
      },
      {
        question_id: 4,
        label: '엔지니어링2',
        category: 'ENGINEERING',
        type: 'TEXT',
        content:
          '[엔지니어링] RDBMS/NoSQL 모델링 또는 분산 데이터 파이프라인(Kafka, Spark 등) 구축 및 인프라 운용 경험을 작성해 주세요.',
        order_num: 3,
        answer:
          'Kafka 3노드 클러스터를 기반으로 분당 5만 건의 로그를 Elasticsearch로 색인하는 실시간 파이프라인을 구축했습니다. 지연율이 급증하던 병목을 Kafka Consumer 그룹 파티션 재분배 및 Batch Size 튜닝으로 해결했습니다.',
      },
    ],
    102: [
      {
        question_id: 2,
        label: '공통1',
        category: 'COMMON',
        type: 'TEXT',
        content: '자기소개와 BOAZ 지원 동기',
        order_num: 1,
        answer: '분산 스토리지 시스템 최적화 연구에 깊은 관심이 있습니다.',
      },
      {
        question_id: 4,
        label: '엔지니어링2',
        category: 'ENGINEERING',
        type: 'TEXT',
        content: '파이프라인 구축 경험',
        order_num: 2,
        answer: 'Spark 배치 집계 파이프라인 최적화 프로젝트를 완수했습니다.',
      },
    ],
    104: [
      {
        question_id: 2,
        label: '공통1',
        category: 'COMMON',
        type: 'TEXT',
        content: '자기소개와 BOAZ 지원 동기',
        order_num: 1,
        answer: '데이터 기반의 그로스 실험과 비즈니스 인사이트 도출을 전공했습니다.',
      },
      {
        question_id: 5,
        label: '분석1',
        category: 'ANALYSIS',
        type: 'TEXT',
        content: '[데이터 분석] 가설 검정 및 모델링 경험',
        order_num: 2,
        answer:
          '이커머스 결제 전환율 개선을 위한 A/B 테스트 및 LightGBM 고객 이탈 예측 모델링을 수행했습니다.',
      },
    ],
  },
  evaluatorsMap: {
    101: [
      {
        admin_id: 1,
        name: '문혁준 (나)',
        track: 'ENGINEERING',
        decision: 'HOLD',
        score: 8,
        memo: 'AIOps 실시간 파이프라인 경험 우수. 트래픽 장애 대응 확인 필요',
      },
      {
        admin_id: 2,
        name: '강민석',
        track: 'ENGINEERING',
        decision: 'PASS',
        score: 9,
        memo: '카프카 파티셔닝 이해도 매우 높음',
      },
      {
        admin_id: 3,
        name: '김대현',
        track: 'ENGINEERING',
        decision: 'PASS',
        score: 6,
        memo: '성실하게 서류 작성함',
      },
      {
        admin_id: 4,
        name: '남민서',
        track: 'ENGINEERING',
        decision: null,
        score: null,
        memo: null,
      },
      {
        admin_id: 5,
        name: '손채민',
        track: 'ENGINEERING',
        decision: null,
        score: null,
        memo: null,
      },
      {
        admin_id: 6,
        name: '신재원',
        track: 'ENGINEERING',
        decision: null,
        score: null,
        memo: null,
      },
      {
        admin_id: 7,
        name: '이욱성',
        track: 'ENGINEERING',
        decision: null,
        score: null,
        memo: null,
      },
    ],
    104: [
      {
        admin_id: 1,
        name: '문혁준 (나)',
        track: 'COMMON',
        decision: 'PASS',
        score: 9,
        memo: '비즈니스 인사이트 및 그로스 분석 경험 우수',
      },
      {
        admin_id: 11,
        name: '박서연',
        track: 'ANALYSIS',
        decision: 'PASS',
        score: 9,
        memo: '통계적 가설 검증과 모델링 기초 탄탄함',
      },
      {
        admin_id: 12,
        name: '윤지후',
        track: 'ANALYSIS',
        decision: 'PASS',
        score: 9,
        memo: '포트폴리오 완성도 최상',
      },
    ],
  },
  interviewQuestionsMap: {
    101: [
      {
        admin_id: 1,
        name: '문혁준 (나)',
        track: 'ENGINEERING',
        interview_question: 'Kafka 파티션 분배 전략 및 트래픽 폭증 시 데이터 유실 방지 아키텍처는?',
      },
      {
        admin_id: 2,
        name: '강민석',
        track: 'ENGINEERING',
        interview_question: 'Elasticsearch 인덱스 설계 시 샤드(Shard) 수 결정 기준은?',
      },
    ],
    104: [
      {
        admin_id: 1,
        name: '문혁준 (나)',
        track: 'COMMON',
        interview_question: 'A/B 테스트 시 p-value 해석과 표본 크기 산정 기준은?',
      },
    ],
  },
};

/** 지원서의 평가자 목록. 평가가 하나도 없으면 평가자 전원을 미평가(null)로 둔다(REC-ADMIN-15 규칙). */
const evaluatorsOf = (data: EvaluationData, applicantId: number): EvaluatorDetailItem[] =>
  data.evaluatorsMap[applicantId] ||
  INITIAL_EVALUATOR_POOL.map((ev) => ({ ...ev, decision: null, score: null, memo: null }));

/**
 * 지원자 행의 집계를 평가자별 기록(evaluatorsMap)으로 다시 계산한다. 원본 목 데이터의 집계 값은 쓰지 않는다.
 * 기록이 없는 지원자는 0건·0점(미평가)이다. 기록이나 점수를 새로 만들지 않는다.
 */
export function withRecordAggregates(data: EvaluationData): EvaluationData {
  return {
    ...data,
    applicants: data.applicants.map((a) => ({
      ...a,
      ...aggregateEvaluations(data.evaluatorsMap[a.id] ?? []),
    })),
  };
}

/**
 * 개인 평가 저장(REC-ADMIN-17)을 목 데이터에 반영한다. 평가자별 평가·면접 질문·집계를 함께 고친다.
 * 실제 서버로 바꾸면 집계는 서버가 계산하므로 이 계산을 화면에서 다시 하지 않는다.
 */
export function applyMyEvaluation(
  data: EvaluationData,
  applicant: ApplicantEvaluationDto,
  input: MyEvaluationInput,
): { data: EvaluationData; applicant: ApplicantEvaluationDto } {
  const me = CURRENT_EVALUATOR;
  const existingEvaluators = evaluatorsOf(data, applicant.id);

  const updatedEvaluators: EvaluatorDetailItem[] = existingEvaluators.some(
    (e) => e.admin_id === me.admin_id,
  )
    ? existingEvaluators.map((e) =>
        e.admin_id === me.admin_id
          ? { ...e, decision: input.decision, score: input.score, memo: input.memo || null }
          : e,
      )
    : [
        ...existingEvaluators,
        {
          admin_id: me.admin_id,
          name: me.name,
          track: applicant.track,
          decision: input.decision,
          score: input.score,
          memo: input.memo || null,
        },
      ];

  let interviewQuestionsMap = data.interviewQuestionsMap;
  if (input.interview_question.trim()) {
    const existingQuestions = data.interviewQuestionsMap[applicant.id] || [];
    const updatedQuestions = existingQuestions.some((q) => q.admin_id === me.admin_id)
      ? existingQuestions.map((q) =>
          q.admin_id === me.admin_id ? { ...q, interview_question: input.interview_question } : q,
        )
      : [
          ...existingQuestions,
          {
            admin_id: me.admin_id,
            name: me.name,
            track: applicant.track,
            interview_question: input.interview_question,
          },
        ];
    interviewQuestionsMap = { ...interviewQuestionsMap, [applicant.id]: updatedQuestions };
  }

  const updatedApplicant: ApplicantEvaluationDto = {
    ...applicant,
    my_decision: input.decision,
    my_score: input.score,
    my_memo: input.memo,
    my_interview_question: input.interview_question,
    ...aggregateEvaluations(updatedEvaluators),
  };

  return {
    data: {
      ...data,
      applicants: data.applicants.map((a) => (a.id === applicant.id ? updatedApplicant : a)),
      evaluatorsMap: { ...data.evaluatorsMap, [applicant.id]: updatedEvaluators },
      interviewQuestionsMap,
    },
    applicant: updatedApplicant,
  };
}

/** 최종 판정 변경(REC-ADMIN-18)을 목 데이터에 반영한다. 개인 평가 집계는 바꾸지 않는다. */
export function applyFinalDecision(
  data: EvaluationData,
  applicantId: number,
  decision: EvaluationDecision,
): EvaluationData {
  return {
    ...data,
    applicants: data.applicants.map((a) =>
      a.id === applicantId ? { ...a, final_decision: decision } : a,
    ),
  };
}

/**
 * 정회원 승격(PATCH /api/v1/admin/users/promote)을 목 데이터에 반영한다.
 * is_promoted_to_member는 PoC 화면 표시용 값이며 실제 서버 응답 필드가 아니다.
 */
export function applyPromotion(
  data: EvaluationData,
  userIds: readonly number[],
): { data: EvaluationData; result: PromotionResult } {
  // shortcut: 목 데이터는 실패를 만들지 않는다, 부분 실패 표시를 구현할 때 실패 규칙을 더한다
  const failedList: PromotionResult['failedList'] = [];
  const successUserIds = userIds.filter((id) => !failedList.some((f) => f.user_id === id));
  return {
    data: {
      ...data,
      applicants: data.applicants.map((a) =>
        successUserIds.includes(a.user_id) ? { ...a, is_promoted_to_member: true } : a,
      ),
    },
    result: { successUserIds, failedList },
  };
}

/**
 * 조회 실패·빈 목록을 재현하는 목 시나리오. 개발 서버 주소에 `?mockScenario=<값>`을 붙이면 적용된다.
 * 화면에 시험용 버튼을 두지 않으려고 주소로만 켠다.
 */
export type MockScenario =
  | 'applicants-error'
  | 'applicants-empty'
  | 'answers-error'
  | 'answers-not-found'
  | 'my-evaluation-error'
  | 'save-error'
  | 'save-denied'
  | 'save-not-found'
  | 'evaluations-error'
  | 'questions-error'
  | 'final-decision-error'
  | 'final-decision-denied'
  | 'final-decision-not-found';

const MOCK_SCENARIOS: readonly MockScenario[] = [
  'applicants-error',
  'applicants-empty',
  'answers-error',
  'answers-not-found',
  'my-evaluation-error',
  'save-error',
  'save-denied',
  'save-not-found',
  'evaluations-error',
  'questions-error',
  'final-decision-error',
  'final-decision-denied',
  'final-decision-not-found',
];

/** 주소의 쿼리 문자열에서 목 시나리오를 읽는다. 모르는 값이면 null. */
export function readMockScenario(search: string): MockScenario | null {
  const value = new URLSearchParams(search).get('mockScenario');
  return MOCK_SCENARIOS.find((scenario) => scenario === value) ?? null;
}

const networkError = () =>
  new ApiError(0, 'NETWORK_ERROR', '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');

/** [REC-ADMIN-13·14 대체] 지원자 목록을 돌려준다. 시나리오에 따라 실패하거나 빈 목록을 준다. */
export function listApplicantsMock(
  data: EvaluationData,
  scenario: MockScenario | null,
): ApplicantEvaluationDto[] {
  if (scenario === 'applicants-error') throw networkError();
  if (scenario === 'applicants-empty') return [];
  return data.applicants;
}

/** [REC-ADMIN-20 대체] 지원서 답변을 돌려준다. 없는 지원서는 404 APPLICATION_NOT_FOUND다. */
export function listAnswersMock(
  data: EvaluationData,
  applicantId: number,
  scenario: MockScenario | null,
): ApplicantAnswerDto[] {
  if (scenario === 'answers-error') throw networkError();
  if (scenario === 'answers-not-found' || !data.applicants.some((a) => a.id === applicantId)) {
    throw new ApiError(404, 'APPLICATION_NOT_FOUND', '지원서를 찾을 수 없습니다.');
  }
  return data.answersMap[applicantId] ?? [];
}

const applicationNotFound = () =>
  new ApiError(404, 'APPLICATION_NOT_FOUND', '지원서를 찾을 수 없습니다.');

/** [REC-ADMIN-15 대체] 평가자별 평가를 돌려준다. DRAFT 지원서도 조회할 수 있다. */
export function listEvaluationsMock(
  data: EvaluationData,
  applicantId: number,
  scenario: MockScenario | null,
): EvaluatorDetailItem[] {
  if (scenario === 'evaluations-error') throw networkError();
  if (!data.applicants.some((a) => a.id === applicantId)) throw applicationNotFound();
  return evaluatorsOf(data, applicantId);
}

/** [REC-ADMIN-19 대체] 평가자별 면접 질문을 돌려준다. 목 데이터는 질문을 남긴 평가자만 담고 있다. */
export function listInterviewQuestionsMock(
  data: EvaluationData,
  applicantId: number,
  scenario: MockScenario | null,
): InterviewQuestionItem[] {
  if (scenario === 'questions-error') throw networkError();
  if (!data.applicants.some((a) => a.id === applicantId)) throw applicationNotFound();
  return data.interviewQuestionsMap[applicantId] ?? [];
}

/**
 * [REC-ADMIN-16 대체] 내 평가를 돌려준다. 아직 평가하지 않았으면 null이다(서버의 data:null과 같음).
 * PoC 지원자 행의 my_* 값에서 만든다. evaluation_id는 목 데이터에 없어 지원서 id를 쓴다.
 */
export function findMyEvaluationMock(
  data: EvaluationData,
  applicantId: number,
  scenario: MockScenario | null,
): MyEvaluationDto | null {
  if (scenario === 'my-evaluation-error') throw networkError();
  const applicant = data.applicants.find((a) => a.id === applicantId);
  if (!applicant) throw new ApiError(404, 'APPLICATION_NOT_FOUND', '지원서를 찾을 수 없습니다.');
  if (applicant.my_decision === null) return null;
  return {
    evaluation_id: applicant.id,
    applicant_id: applicant.id,
    decision: applicant.my_decision,
    score: applicant.my_score,
    memo: applicant.my_memo,
    interview_question: applicant.my_interview_question,
  };
}

const invalidInput = () => new ApiError(400, 'INVALID_INPUT_VALUE', '입력값이 올바르지 않습니다.');

/**
 * [REC-ADMIN-17 대체] 개인 평가 저장 전에 백엔드가 하는 검사를 흉내 낸다. 통과하면 아무것도 돌려주지 않는다.
 * DRAFT 지원서·판정 누락·점수 범위(1~10) 위반은 400 INVALID_INPUT_VALUE다.
 */
export function checkMyEvaluationSaveMock(
  data: EvaluationData,
  applicantId: number,
  input: MyEvaluationInput,
  scenario: MockScenario | null,
): void {
  if (scenario === 'save-error') throw networkError();
  if (scenario === 'save-denied') {
    throw new ApiError(403, 'ACCESS_DENIED', '해당 리소스에 접근할 권한이 없습니다.');
  }
  const applicant = data.applicants.find((a) => a.id === applicantId);
  if (scenario === 'save-not-found' || !applicant) {
    throw new ApiError(404, 'APPLICATION_NOT_FOUND', '지원서를 찾을 수 없습니다.');
  }
  if (applicant.status === 'DRAFT') throw invalidInput();
  if (
    input.score !== null &&
    !(Number.isInteger(input.score) && input.score >= 1 && input.score <= 10)
  ) {
    throw invalidInput();
  }
}

const FINAL_DECISIONS: readonly EvaluationDecision[] = ['PENDING', 'PASS', 'HOLD', 'FAIL'];

/**
 * [REC-ADMIN-18 대체] 최종 판정 변경 전에 백엔드가 하는 검사를 흉내 낸다. 통과하면 아무것도 돌려주지 않는다.
 * 검사 순서는 명세와 같다: 값 오류(400) → 지원서 없음(404) → SUBMITTED가 아님(400). 권한 없음은 403이다.
 */
export function checkFinalDecisionMock(
  data: EvaluationData,
  applicantId: number,
  decision: string,
  scenario: MockScenario | null,
): void {
  if (scenario === 'final-decision-error') throw networkError();
  if (scenario === 'final-decision-denied') {
    throw new ApiError(403, 'ACCESS_DENIED', '해당 리소스에 접근할 권한이 없습니다.');
  }
  if (!FINAL_DECISIONS.some((value) => value === decision)) throw invalidInput();
  const applicant = data.applicants.find((a) => a.id === applicantId);
  if (scenario === 'final-decision-not-found' || !applicant) throw applicationNotFound();
  if (applicant.status !== 'SUBMITTED') throw invalidInput();
}
