/**
 * [PoC] 지원서 답변(REC-ADMIN-20) 목 데이터. 문항(application_question)과 지원자별 답변(applicant_answer)을 따로 두고,
 * 조회할 때 서버처럼 합친다. 실제 API 연동 때 이 파일은 지운다.
 * 서버 규칙(명세 REC-ADMIN-20): 공통 문항과 지원서 부문 문항만, 답한 문항만, order_num 오름차순, content의 {Track}은 부문 한글 이름.
 */
import type { ApplicantAnswerDto, QuestionCategory, TrackType } from './types';
import { TRACK_LABELS } from './types';

type QuestionMock = Omit<ApplicantAnswerDto, 'answer'>;

const question = (
  question_id: number,
  label: string | null,
  category: QuestionCategory,
  type: ApplicantAnswerDto['type'],
  order_num: number,
  content: string,
): QuestionMock => ({ question_id, label, category, type, content, order_num });

/** 모집 공고의 문항. 공통 문항은 order_num 0~2, 부문 문항은 10부터다. */
export const QUESTIONS_MOCK: readonly QuestionMock[] = [
  question(1, '공통0', 'COMMON', 'TEXT', 0, '면접 가능 일정을 선택해 주세요.'),
  question(2, '공통1', 'COMMON', 'TEXT', 1, '자기소개와 BOAZ에 지원한 동기를 서술해주세요.'),
  question(
    3,
    '공통2',
    'COMMON',
    'TEXT',
    2,
    'BOAZ {Track} 부문에서 활동하며 이루고 싶은 목표와, 그 목표를 위해 한 학기 동안 투자할 수 있는 시간을 구체적으로 작성해 주세요.',
  ),
  question(10, '분석1', 'ANALYSIS', 'TABLE', 10, '데이터 분석 관련 주요 기술 스택과 활용 경험'),
  question(
    11,
    '분석2',
    'ANALYSIS',
    'TEXT',
    11,
    '[데이터 분석] 가설을 세우고 통계적 검정 또는 모델링으로 검증한 경험을 작성해 주세요.',
  ),
  question(20, '시각화1', 'VISUALIZATION', 'TABLE', 20, '데이터 시각화 관련 도구와 활용 경험'),
  question(
    21,
    '시각화2',
    'VISUALIZATION',
    'TEXT',
    21,
    '[데이터 시각화] 대시보드나 시각화 결과물로 의사결정을 도운 경험을 작성해 주세요.',
  ),
  question(
    30,
    '엔지니어링1',
    'ENGINEERING',
    'TABLE',
    30,
    '엔지니어링 관련 주요 기술 스택 및 프로젝트 활용 경험',
  ),
  question(
    31,
    '엔지니어링2',
    'ENGINEERING',
    'TEXT',
    31,
    '[엔지니어링] RDBMS/NoSQL 모델링 또는 분산 데이터 파이프라인(Kafka, Spark 등) 구축 및 인프라 운용 경험을 작성해 주세요.',
  ),
];

/** 지원자별 답변(question_id → answer). 없는 문항은 답하지 않은 것이다. 빈 객체면 답변 목록이 빈 배열이다. */
export const ANSWERS_MOCK: Record<number, Record<number, ApplicantAnswerDto['answer']>> = {
  // 이도현(엔지니어링): 모든 문항, 긴 답변과 문단 나눔.
  101: {
    1: '7월 4일(토) 13:00~15:00, 11:00~13:00 / 7월 5일(일) 13:00~15:00',
    2: '저는 시스템 인프라를 직접 구성하고 운영하며 동작 원리를 파고드는 것을 즐깁니다.\n\nAIOps 플랫폼을 개발하며 실시간 분산 파이프라인의 안정성이 서비스의 생명임을 배웠고, BOAZ에서 대규모 트래픽을 다루는 엔지니어들과 함께 성장하고 싶습니다.',
    3: '스트리밍 파이프라인을 처음부터 끝까지 설계해 보는 것이 목표입니다.\n학기 중에는 주 10시간, 방학에는 주 20시간을 투자할 수 있습니다.',
    30: {
      Kafka: '3노드 클러스터 구축, 파티셔닝 최적화 (숙련도: 상)',
      'Spark / PySpark': '대규모 배치 데이터 집계 파이프라인 구축 (숙련도: 중)',
      'Docker / Kubernetes': '컨테이너 오케스트레이션 및 모니터링 구성 (숙련도: 중)',
    },
    31: 'Kafka 3노드 클러스터를 기반으로 분당 5만 건의 로그를 Elasticsearch로 색인하는 실시간 파이프라인을 구축했습니다.\n\n처음에는 Consumer 지연이 피크 시간마다 10분 이상 쌓였습니다. 원인을 추적해 보니 파티션 수가 Consumer 수보다 적어 일부 Consumer가 놀고 있었고, Batch Size가 작아 네트워크 왕복이 지나치게 많았습니다.\n\n파티션을 12개로 늘려 Consumer 그룹을 재분배하고, Batch Size와 linger.ms를 조정해 지연을 30초 이내로 줄였습니다. 이후 Grafana 대시보드로 지연 지표를 상시 확인하도록 운영 절차를 바꿨습니다.',
  },
  // 박성훈(엔지니어링): 일부 문항만 답함.
  102: {
    2: '분산 스토리지 시스템 최적화 연구에 깊은 관심이 있습니다.',
    31: 'Spark 배치 집계 파이프라인의 셔플 단계를 줄여 실행 시간을 40% 단축한 프로젝트를 완수했습니다.',
  },
  // 이지원(엔지니어링): 답변 없음(빈 배열).
  103: {},
  // 김서하(분석): 표 답변 포함.
  104: {
    1: '7월 5일(일) 11:00~13:00',
    2: '데이터 기반의 그로스 실험과 비즈니스 인사이트 도출을 전공했습니다.',
    3: '분석 부문에서 실험 설계와 인과 추론을 깊이 공부하고 싶습니다. 주 12시간 정도 투자할 수 있습니다.',
    10: {
      Python: 'pandas, scikit-learn으로 전처리와 모델링 (숙련도: 상)',
      SQL: '윈도 함수와 CTE로 지표 집계 (숙련도: 중)',
      통계: '가설 검정, 회귀 분석 수업 수강',
    },
    11: '이커머스 결제 전환율 개선을 위해 결제 버튼 문구 A/B 테스트를 설계했습니다.\n표본 크기를 사전에 계산하고, 2주간 실험해 전환율이 1.8%p 오른 것을 확인했습니다.\n이어서 LightGBM으로 고객 이탈 예측 모델을 만들어 재방문 쿠폰 대상 선정에 활용했습니다.',
  },
  // 최민혁(시각화): 표 답변 포함, 공통2는 답하지 않음.
  105: {
    1: '7월 4일(토) 11:00~13:00',
    2: '복잡한 데이터를 한눈에 읽히는 화면으로 바꾸는 일에 보람을 느낍니다.',
    20: {
      Tableau: '매출 대시보드 제작 및 사내 배포 (숙련도: 상)',
      'D3.js': '인터랙티브 지도 시각화 (숙련도: 중)',
      Figma: '대시보드 화면 설계',
    },
    21: '학과 행정 데이터를 Tableau 대시보드로 정리해, 수강 신청 기간의 강의실 배정 문제를 한 화면에서 확인할 수 있게 했습니다.',
  },
  // 한소희(엔지니어링, 임시저장): 공통0만 답함.
  106: {
    1: '7월 4일(토) 13:00~15:00',
  },
};

/** 지원서 부문에 맞는 답변 목록을 서버처럼 만든다. 부문이 없으면 {Track}을 바꾸지 않는다. */
export function answersOf(applicantId: number, track: TrackType | null): ApplicantAnswerDto[] {
  const answers = ANSWERS_MOCK[applicantId] ?? {};
  return QUESTIONS_MOCK.filter(
    (item) =>
      item.question_id in answers && (item.category === 'COMMON' || item.category === track),
  )
    .map((item) => ({
      ...item,
      content: track ? item.content.replaceAll('{Track}', TRACK_LABELS[track]) : item.content,
      answer: answers[item.question_id],
    }))
    .sort((a, b) => a.order_num - b.order_num);
}
