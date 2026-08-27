import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BookmarkCheck,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  FileCheck2,
  FileText,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  User,
  UserCheck,
  X,
} from "lucide-react";

export type ApplicationStatus = "DRAFT" | "SUBMITTED";
export type EvaluationDecision = "PASS" | "HOLD" | "FAIL" | "PENDING";
export type TrackType = "ANALYSIS" | "ENGINEERING" | "VISUALIZATION";
export type MilitaryStatus = "COMPLETED" | "EXEMPTED" | "UNFULFILLED" | "NOT_APPLICABLE";

// 공통 ApiResponse Envelope
export interface ApiResponse<T> {
  status: number;
  data: T | null;
  error_code: string | null;
  message: string | null;
}

// 1. 지원자 요약 DTO (ApplicantSummaryResponse)
export interface ApplicantSummaryDto {
  id: number;
  user_id: number;
  status: ApplicationStatus;
  track: TrackType;
  name: string;
  email: string;
  phone: string;
  university: string;
  major: string;
  minor_double_major: string[];
  last_semester: number;
  military_status: MilitaryStatus;
  birth_date: string;
  graduation_date: string;
  grad_school_plan: boolean;
  submitted_at: string | null;
}

// 2. 평가 대시보드 DTO (ApplicantEvaluationResponse)
export interface ApplicantEvaluationDto extends ApplicantSummaryDto {
  pass_count: number;
  hold_count: number;
  fail_count: number;
  total_score: number;
  final_decision: EvaluationDecision;
  my_decision: EvaluationDecision | null;
  my_score: number | null;
  my_memo: string | null;
  my_interview_question: string | null;
  is_promoted_to_member?: boolean;
}

// 3. 평가자 현황 DTO (ApplicantEvaluatorsResponse)
export interface EvaluatorDetailItem {
  admin_id: number;
  name: string;
  track: TrackType | "COMMON";
  decision: EvaluationDecision | null;
  score: number | null;
  memo: string | null;
}

// 4. 면접 질문 DTO (ApplicantInterviewQuestionsResponse)
export interface InterviewQuestionItem {
  admin_id: number;
  name: string;
  track: TrackType | "COMMON";
  interview_question: string | null;
}

// 5. 지원서 답변 DTO (ApplicantAnswersResponse)
export interface ApplicantAnswerDto {
  question_id: number;
  label: string;
  category: string;
  type: "TEXT" | "TABLE";
  content: string;
  order_num: number;
  answer: string | any;
}

// Mock Evaluators Pool
const INITIAL_EVALUATOR_POOL: { admin_id: number; name: string; track: TrackType | "COMMON" }[] = [
  { admin_id: 1, name: "문혁준 (나)", track: "ENGINEERING" },
  { admin_id: 2, name: "강민석", track: "ENGINEERING" },
  { admin_id: 3, name: "김대현", track: "ENGINEERING" },
  { admin_id: 4, name: "남민서", track: "ENGINEERING" },
  { admin_id: 5, name: "손채민", track: "ENGINEERING" },
  { admin_id: 6, name: "신재원", track: "ENGINEERING" },
  { admin_id: 7, name: "이욱성", track: "ENGINEERING" },
  { admin_id: 8, name: "이주영", track: "ENGINEERING" },
  { admin_id: 9, name: "장민주", track: "ENGINEERING" },
  { admin_id: 10, name: "최재은", track: "ENGINEERING" },
];

const INITIAL_DATA: {
  applicants: ApplicantEvaluationDto[];
  answersMap: Record<number, ApplicantAnswerDto[]>;
  evaluatorsMap: Record<number, EvaluatorDetailItem[]>;
  interviewQuestionsMap: Record<number, InterviewQuestionItem[]>;
} = {
  applicants: [
    {
      id: 101,
      user_id: 55,
      status: "SUBMITTED",
      track: "ENGINEERING",
      name: "이도현",
      email: "dohyun@snu.ac.kr",
      phone: "010-3819-2910",
      university: "서울대학교",
      major: "컴퓨터공학과",
      minor_double_major: ["통계학 (복수전공)"],
      last_semester: 6,
      military_status: "COMPLETED",
      birth_date: "2002-05-14",
      graduation_date: "2028-02",
      grad_school_plan: false,
      submitted_at: "2026-08-15T19:20:00",
      pass_count: 2,
      hold_count: 1,
      fail_count: 0,
      total_score: 23,
      final_decision: "PASS",
      my_decision: "HOLD",
      my_score: 8,
      my_memo:
        "AIOps 실시간 파이프라인 개발 경험이 매우 우수함. 면접 때 인프라 장애 대응 경험 질의 권장.",
      my_interview_question:
        "Kafka 파티션 분배 전략 및 트래픽 폭증 시 데이터 유실 방지 아키텍처는?",
      is_promoted_to_member: false,
    },
    {
      id: 102,
      user_id: 56,
      status: "SUBMITTED",
      track: "ENGINEERING",
      name: "박성훈",
      email: "sunghoon.p@naver.com",
      phone: "010-9182-4122",
      university: "고려대학교",
      major: "컴퓨터학과",
      minor_double_major: [],
      last_semester: 7,
      military_status: "COMPLETED",
      birth_date: "2001-08-20",
      graduation_date: "2027-08",
      grad_school_plan: true,
      submitted_at: "2026-08-16T10:15:00",
      pass_count: 1,
      hold_count: 0,
      fail_count: 0,
      total_score: 9,
      final_decision: "PENDING",
      my_decision: null,
      my_score: null,
      my_memo: null,
      my_interview_question: null,
      is_promoted_to_member: false,
    },
    {
      id: 103,
      user_id: 57,
      status: "SUBMITTED",
      track: "ENGINEERING",
      name: "이지원",
      email: "jiwon.lee@snu.ac.kr",
      phone: "010-3321-8890",
      university: "서울대학교",
      major: "전기정보공학부",
      minor_double_major: [],
      last_semester: 5,
      military_status: "NOT_APPLICABLE",
      birth_date: "2003-02-11",
      graduation_date: "2028-02",
      grad_school_plan: false,
      submitted_at: "2026-08-16T11:30:00",
      pass_count: 0,
      hold_count: 1,
      fail_count: 0,
      total_score: 6,
      final_decision: "PENDING",
      my_decision: null,
      my_score: null,
      my_memo: null,
      my_interview_question: null,
      is_promoted_to_member: false,
    },
    {
      id: 104,
      user_id: 58,
      status: "SUBMITTED",
      track: "ANALYSIS",
      name: "김서하",
      email: "seoha.kim@yonsei.ac.kr",
      phone: "010-5519-8821",
      university: "연세대학교",
      major: "경영학과",
      minor_double_major: ["응용통계학"],
      last_semester: 6,
      military_status: "NOT_APPLICABLE",
      birth_date: "2002-09-22",
      graduation_date: "2027-08",
      grad_school_plan: true,
      submitted_at: "2026-08-16T11:30:00",
      pass_count: 3,
      hold_count: 0,
      fail_count: 0,
      total_score: 27,
      final_decision: "PASS",
      my_decision: "PASS",
      my_score: 9,
      my_memo: "비즈니스 인사이트 및 그로스 실험 설계 역량이 탁월함",
      my_interview_question: "A/B 테스트 시 p-value 해석과 표본 크기 산정 기준은?",
      is_promoted_to_member: false,
    },
    {
      id: 105,
      user_id: 59,
      status: "SUBMITTED",
      track: "VISUALIZATION",
      name: "최민혁",
      email: "minhyuk.c@yonsei.ac.kr",
      phone: "010-5512-7019",
      university: "연세대학교",
      major: "산업공학과",
      minor_double_major: ["시각디자인"],
      last_semester: 8,
      military_status: "COMPLETED",
      birth_date: "2001-11-03",
      graduation_date: "2027-02",
      grad_school_plan: false,
      submitted_at: "2026-08-16T14:00:00",
      pass_count: 1,
      hold_count: 1,
      fail_count: 0,
      total_score: 15,
      final_decision: "PASS",
      my_decision: null,
      my_score: null,
      my_memo: null,
      my_interview_question: null,
      is_promoted_to_member: false,
    },
    {
      id: 106,
      user_id: 60,
      status: "DRAFT",
      track: "ENGINEERING",
      name: "한소희",
      email: "sohee.han@korea.ac.kr",
      phone: "010-2219-9041",
      university: "고려대학교",
      major: "컴퓨터학과",
      minor_double_major: [],
      last_semester: 4,
      military_status: "NOT_APPLICABLE",
      birth_date: "2004-03-12",
      graduation_date: "2029-02",
      grad_school_plan: false,
      submitted_at: null,
      pass_count: 0,
      hold_count: 0,
      fail_count: 0,
      total_score: 0,
      final_decision: "PENDING",
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
        label: "공통0",
        category: "COMMON",
        type: "TEXT",
        content: "면접 가능 일정을 선택해 주세요.",
        order_num: 0,
        answer: "7월 4일(토) 13:00~15:00, 11:00~13:00 / 7월 5일(일) 13:00~15:00",
      },
      {
        question_id: 2,
        label: "공통1",
        category: "COMMON",
        type: "TEXT",
        content: "자기소개와 BOAZ에 지원한 동기를 서술해주세요.",
        order_num: 1,
        answer:
          "저는 시스템 인프라를 직접 구성하고 운영하며 동작 원리를 파고드는 것을 즐깁니다. AIOps 플랫폼을 개발하며 실시간 분산 파이프라인의 안정성이 서비스의 생명임을 배웠고, BOAZ에서 대규모 트래픽을 다루는 엔지니어들과 함께 성장하고 싶습니다.",
      },
      {
        question_id: 3,
        label: "엔지니어링1",
        category: "ENGINEERING",
        type: "TABLE",
        content: "엔지니어링 관련 주요 기술 스택 및 프로젝트 활용 경험",
        order_num: 2,
        answer: {
          Kafka: "3노드 클러스터 구축, 파티셔닝 최적화 (숙련도: 상)",
          "Spark / PySpark": "대규모 배치 데이터 집계 파이프라인 구축 (숙련도: 중)",
          "Docker / K8s": "컨테이너 오케스트레이션 및 모니터링 (숙련도: 중)",
        },
      },
      {
        question_id: 4,
        label: "엔지니어링2",
        category: "ENGINEERING",
        type: "TEXT",
        content:
          "[엔지니어링] RDBMS/NoSQL 모델링 또는 분산 데이터 파이프라인(Kafka, Spark 등) 구축 및 인프라 운용 경험을 작성해 주세요.",
        order_num: 3,
        answer:
          "Kafka 3노드 클러스터를 기반으로 분당 5만 건의 로그를 Elasticsearch로 색인하는 실시간 파이프라인을 구축했습니다. 지연율이 급증하던 병목을 Kafka Consumer 그룹 파티션 재분배 및 Batch Size 튜닝으로 해결했습니다.",
      },
    ],
    102: [
      {
        question_id: 2,
        label: "공통1",
        category: "COMMON",
        type: "TEXT",
        content: "자기소개와 BOAZ 지원 동기",
        order_num: 1,
        answer: "분산 스토리지 시스템 최적화 연구에 깊은 관심이 있습니다.",
      },
      {
        question_id: 4,
        label: "엔지니어링2",
        category: "ENGINEERING",
        type: "TEXT",
        content: "파이프라인 구축 경험",
        order_num: 2,
        answer: "Spark 배치 집계 파이프라인 최적화 프로젝트를 완수했습니다.",
      },
    ],
    104: [
      {
        question_id: 2,
        label: "공통1",
        category: "COMMON",
        type: "TEXT",
        content: "자기소개와 BOAZ 지원 동기",
        order_num: 1,
        answer: "데이터 기반의 그로스 실험과 비즈니스 인사이트 도출을 전공했습니다.",
      },
      {
        question_id: 5,
        label: "분석1",
        category: "ANALYSIS",
        type: "TEXT",
        content: "[데이터 분석] 가설 검정 및 모델링 경험",
        order_num: 2,
        answer:
          "이커머스 결제 전환율 개선을 위한 A/B 테스트 및 LightGBM 고객 이탈 예측 모델링을 수행했습니다.",
      },
    ],
  },
  evaluatorsMap: {
    101: [
      {
        admin_id: 1,
        name: "문혁준 (나)",
        track: "ENGINEERING",
        decision: "HOLD",
        score: 8,
        memo: "AIOps 실시간 파이프라인 경험 우수. 트래픽 장애 대응 확인 필요",
      },
      {
        admin_id: 2,
        name: "강민석",
        track: "ENGINEERING",
        decision: "PASS",
        score: 9,
        memo: "카프카 파티셔닝 이해도 매우 높음",
      },
      {
        admin_id: 3,
        name: "김대현",
        track: "ENGINEERING",
        decision: "PASS",
        score: 6,
        memo: "성실하게 서류 작성함",
      },
      {
        admin_id: 4,
        name: "남민서",
        track: "ENGINEERING",
        decision: null,
        score: null,
        memo: null,
      },
      {
        admin_id: 5,
        name: "손채민",
        track: "ENGINEERING",
        decision: null,
        score: null,
        memo: null,
      },
      {
        admin_id: 6,
        name: "신재원",
        track: "ENGINEERING",
        decision: null,
        score: null,
        memo: null,
      },
      {
        admin_id: 7,
        name: "이욱성",
        track: "ENGINEERING",
        decision: null,
        score: null,
        memo: null,
      },
    ],
    104: [
      {
        admin_id: 1,
        name: "문혁준 (나)",
        track: "COMMON",
        decision: "PASS",
        score: 9,
        memo: "비즈니스 인사이트 및 그로스 분석 경험 우수",
      },
      {
        admin_id: 11,
        name: "박서연",
        track: "ANALYSIS",
        decision: "PASS",
        score: 9,
        memo: "통계적 가설 검증과 모델링 기초 탄탄함",
      },
      {
        admin_id: 12,
        name: "윤지후",
        track: "ANALYSIS",
        decision: "PASS",
        score: 9,
        memo: "포트폴리오 완성도 최상",
      },
    ],
  },
  interviewQuestionsMap: {
    101: [
      {
        admin_id: 1,
        name: "문혁준 (나)",
        track: "ENGINEERING",
        interview_question: "Kafka 파티션 분배 전략 및 트래픽 폭증 시 데이터 유실 방지 아키텍처는?",
      },
      {
        admin_id: 2,
        name: "강민석",
        track: "ENGINEERING",
        interview_question: "Elasticsearch 인덱스 설계 시 샤드(Shard) 수 결정 기준은?",
      },
    ],
    104: [
      {
        admin_id: 1,
        name: "문혁준 (나)",
        track: "COMMON",
        interview_question: "A/B 테스트 시 p-value 해석과 표본 크기 산정 기준은?",
      },
    ],
  },
};

interface EvaluationManagePageProps {
  initialTab?: "evaluations" | "applicants" | "promotions";
}

export function EvaluationManagePage({ initialTab = "evaluations" }: EvaluationManagePageProps) {
  // Main Subtabs: "evaluations" (서류 심사) | "applicants" (지원자 현황) | "promotions" (합격자 승격 전용 탭)
  const [mainTab, setMainTab] = useState<"evaluations" | "applicants" | "promotions">(initialTab);

  const [applicants, setApplicants] = useState<ApplicantEvaluationDto[]>(INITIAL_DATA.applicants);
  const [answersMap] = useState<Record<number, ApplicantAnswerDto[]>>(INITIAL_DATA.answersMap);
  const [evaluatorsMap, setEvaluatorsMap] = useState<Record<number, EvaluatorDetailItem[]>>(
    INITIAL_DATA.evaluatorsMap
  );
  const [interviewQuestionsMap, setInterviewQuestionsMap] = useState<
    Record<number, InterviewQuestionItem[]>
  >(INITIAL_DATA.interviewQuestionsMap);

  // Filters
  const [selectedTrack, setSelectedTrack] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<"ALL" | EvaluationDecision>("ALL");

  // Detail Modal State (for evaluations / applicants)
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantEvaluationDto | null>(null);
  const [modalTab, setModalTab] = useState<"review" | "status" | "interview">("review");

  // Form State (PUT /api/v1/admin/recruitment/applicants/{id}/evaluations/me)
  const [editDecision, setEditDecision] = useState<EvaluationDecision>("PENDING");
  const [editScore, setEditScore] = useState<number>(8);
  const [editMemo, setEditMemo] = useState<string>("");
  const [editInterviewQuestion, setEditInterviewQuestion] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Promotions Tab Selection State (UserAdminController: PATCH /api/v1/admin/users/promote)
  const [selectedPromoteUserIds, setSelectedPromoteUserIds] = useState<number[]>([]);
  const [showPromoteConfirmModal, setShowPromoteConfirmModal] = useState(false);
  const [promoteCheck1, setPromoteCheck1] = useState(false);
  const [promoteCheck2, setPromoteCheck2] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [, setPromoteResult] = useState<{
    successCount: number;
    failedList: { user_id: number; error_code: string }[];
  } | null>(null);

  useEffect(() => {
    if (initialTab) {
      setMainTab(initialTab);
    }
  }, [initialTab]);

  // Overall Statistics
  const stats = useMemo(() => {
    const submitted = applicants.filter((a) => a.status === "SUBMITTED");
    const totalCount = submitted.length;
    const evaluatedCount = submitted.filter((a) => a.my_decision !== null).length;
    const passCount = submitted.filter((a) => a.final_decision === "PASS").length;
    const holdCount = submitted.filter((a) => a.final_decision === "HOLD").length;
    const failCount = submitted.filter((a) => a.final_decision === "FAIL").length;
    const pendingCount = submitted.filter((a) => a.final_decision === "PENDING").length;
    const promotedCount = applicants.filter((a) => a.is_promoted_to_member).length;

    return {
      totalCount,
      evaluatedCount,
      passCount,
      holdCount,
      failCount,
      pendingCount,
      promotedCount,
    };
  }, [applicants]);

  // Filtered & Sorted Applicant List (for evaluation/applicants tab)
  const displayedApplicants = useMemo(() => {
    return applicants
      .filter((app) => {
        if (mainTab === "evaluations" && app.status !== "SUBMITTED") {
          return false;
        }
        if (selectedTrack !== "ALL" && app.track !== selectedTrack) {
          return false;
        }
        if (decisionFilter !== "ALL" && app.final_decision !== decisionFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            app.name.toLowerCase().includes(q) ||
            app.email.toLowerCase().includes(q) ||
            app.university.toLowerCase().includes(q) ||
            app.major.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (b.pass_count !== a.pass_count) {
          return b.pass_count - a.pass_count;
        }
        return b.total_score - a.total_score;
      });
  }, [applicants, mainTab, selectedTrack, decisionFilter, searchQuery]);

  // List of Passed Candidates for Promotion Tab (UserAdminController)
  const passedCandidates = useMemo(() => {
    return applicants.filter((a) => a.final_decision === "PASS");
  }, [applicants]);

  const unpromotedPassedCandidates = useMemo(() => {
    return passedCandidates.filter((a) => !a.is_promoted_to_member);
  }, [passedCandidates]);

  // Open Detailed Modal
  function handleOpenModal(
    app: ApplicantEvaluationDto,
    tab: "review" | "status" | "interview" = "review"
  ) {
    setSelectedApplicant(app);
    setModalTab(tab);
    setEditDecision(app.my_decision || "PENDING");
    setEditScore(app.my_score !== null ? app.my_score : 8);
    setEditMemo(app.my_memo || "");
    setEditInterviewQuestion(app.my_interview_question || "");
  }

  // Prev / Next Navigation in Modal
  function handleNavigateModal(direction: "PREV" | "NEXT") {
    if (!selectedApplicant) {
      return;
    }
    const curIdx = displayedApplicants.findIndex((a) => a.id === selectedApplicant.id);
    if (curIdx === -1) {
      return;
    }

    const nextIdx =
      direction === "PREV"
        ? curIdx > 0
          ? curIdx - 1
          : displayedApplicants.length - 1
        : curIdx < displayedApplicants.length - 1
          ? curIdx + 1
          : 0;

    const nextApp = displayedApplicants[nextIdx];
    handleOpenModal(nextApp, modalTab);
  }

  // 7. 개인 평가 저장 (upsert) — PUT /api/v1/admin/recruitment/applicants/{id}/evaluations/me
  function handleSaveMyEvaluation() {
    if (!selectedApplicant) {
      return;
    }
    setIsSaving(true);

    const currentAdminId = 1;
    const currentAdminName = "문혁준 (나)";

    setTimeout(() => {
      const existingEvaluators =
        evaluatorsMap[selectedApplicant.id] ||
        INITIAL_EVALUATOR_POOL.map((ev) => ({
          ...ev,
          decision: null,
          score: null,
          memo: null,
        }));

      const updatedEvaluators: EvaluatorDetailItem[] = existingEvaluators.some(
        (e) => e.admin_id === currentAdminId
      )
        ? existingEvaluators.map((e) =>
            e.admin_id === currentAdminId
              ? {
                  ...e,
                  decision: editDecision,
                  score: editScore,
                  memo: editMemo || null,
                }
              : e
          )
        : [
            ...existingEvaluators,
            {
              admin_id: currentAdminId,
              name: currentAdminName,
              track: selectedApplicant.track,
              decision: editDecision,
              score: editScore,
              memo: editMemo || null,
            },
          ];

      setEvaluatorsMap((prev) => ({ ...prev, [selectedApplicant.id]: updatedEvaluators }));

      if (editInterviewQuestion.trim()) {
        const existingQuestions = interviewQuestionsMap[selectedApplicant.id] || [];
        const updatedQuestions = existingQuestions.some((q) => q.admin_id === currentAdminId)
          ? existingQuestions.map((q) =>
              q.admin_id === currentAdminId
                ? { ...q, interview_question: editInterviewQuestion }
                : q
            )
          : [
              ...existingQuestions,
              {
                admin_id: currentAdminId,
                name: currentAdminName,
                track: selectedApplicant.track,
                interview_question: editInterviewQuestion,
              },
            ];
        setInterviewQuestionsMap((prev) => ({ ...prev, [selectedApplicant.id]: updatedQuestions }));
      }

      const pass_count = updatedEvaluators.filter((e) => e.decision === "PASS").length;
      const hold_count = updatedEvaluators.filter((e) => e.decision === "HOLD").length;
      const fail_count = updatedEvaluators.filter((e) => e.decision === "FAIL").length;
      const total_score = updatedEvaluators.reduce((acc, e) => acc + (e.score || 0), 0);

      const updatedApplicant: ApplicantEvaluationDto = {
        ...selectedApplicant,
        my_decision: editDecision,
        my_score: editScore,
        my_memo: editMemo,
        my_interview_question: editInterviewQuestion,
        pass_count,
        hold_count,
        fail_count,
        total_score,
      };

      setApplicants((prev) =>
        prev.map((a) => (a.id === selectedApplicant.id ? updatedApplicant : a))
      );
      setSelectedApplicant(updatedApplicant);
      setIsSaving(false);
      alert("개인 평가가 정상적으로 저장되었습니다.");
    }, 300);
  }

  // 8. 최종 평가 수정 — PATCH /api/v1/admin/recruitment/applicants/{id}/final-decision
  function handleUpdateFinalDecision(applicantId: number, decision: EvaluationDecision) {
    setApplicants((prev) =>
      prev.map((a) => (a.id === applicantId ? { ...a, final_decision: decision } : a))
    );
    if (selectedApplicant && selectedApplicant.id === applicantId) {
      setSelectedApplicant((prev) => (prev ? { ...prev, final_decision: decision } : null));
    }
  }

  // Promotion Selection Handlers (PATCH /api/v1/admin/users/promote)
  function handleTogglePromoteSelect(userId: number) {
    setSelectedPromoteUserIds((prev) =>
      prev.includes(userId) ? prev.filter((item) => item !== userId) : [...prev, userId]
    );
  }

  function handleSelectAllPromote() {
    if (selectedPromoteUserIds.length === unpromotedPassedCandidates.length) {
      setSelectedPromoteUserIds([]);
    } else {
      setSelectedPromoteUserIds(unpromotedPassedCandidates.map((c) => c.user_id));
    }
  }

  function handleOpenPromoteModal() {
    if (selectedPromoteUserIds.length === 0) {
      alert("승격할 합격자를 최소 1명 이상 선택해 주세요.");
      return;
    }
    setPromoteCheck1(false);
    setPromoteCheck2(false);
    setPromoteResult(null);
    setShowPromoteConfirmModal(true);
  }

  // PATCH /api/v1/admin/users/promote 실행
  function handleExecutePromotion() {
    if (!promoteCheck1 || !promoteCheck2) {
      return;
    }
    setIsPromoting(true);

    setTimeout(() => {
      // 서버 부분 성공 시뮬레이션: failed_user_ids가 없으면 전체 성공
      const failed_user_ids: { user_id: number; error_code: string }[] = [];

      const successUserIds = selectedPromoteUserIds.filter(
        (uid) => !failed_user_ids.some((f) => f.user_id === uid)
      );

      // 성공한 user_id에 해당하는 지원서 is_promoted_to_member 업데이트
      setApplicants((prev) =>
        prev.map((a) =>
          successUserIds.includes(a.user_id) ? { ...a, is_promoted_to_member: true } : a
        )
      );

      setIsPromoting(false);
      setShowPromoteConfirmModal(false);
      setSelectedPromoteUserIds([]);

      alert(
        `정회원 승격 처리가 완료되었습니다.\n` +
          `• 승격 완료: ${successUserIds.length}명\n` +
          `• 실패 건수: ${failed_user_ids.length}건`
      );
    }, 700);
  }

  return (
    <div
      className="space-y-4"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}
    >
      {/* ─── Top Main Header Bar ─── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3b82f6] text-white flex items-center justify-center shadow-md">
              <FileText size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">서류 평가 & 정회원 승격 콘솔</h1>
              <p className="text-[11px] font-mono text-muted-foreground">
                28기 신입 지원서 서류 심사 및 정회원 승격 관리
              </p>
            </div>
          </div>

          {/* 3-Tab Segmented Control */}
          <div className="flex p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              onClick={() => setMainTab("evaluations")}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              style={
                mainTab === "evaluations"
                  ? {
                      background: "#ffffff",
                      color: "#1d4ed8",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                    }
                  : { color: "#64748b" }
              }
            >
              <FileCheck2 size={13} />
              <span>1. 서류 심사 대시보드</span>
            </button>

            <button
              onClick={() => setMainTab("applicants")}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
              style={
                mainTab === "applicants"
                  ? {
                      background: "#ffffff",
                      color: "#1d4ed8",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                    }
                  : { color: "#64748b" }
              }
            >
              2. 전체 지원자 현황
            </button>

            <button
              onClick={() => setMainTab("promotions")}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              style={
                mainTab === "promotions"
                  ? {
                      background: "linear-gradient(135deg, #059669 0%, #0d9488 100%)",
                      color: "#ffffff",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    }
                  : { color: "#64748b" }
              }
            >
              <UserCheck size={13} />
              <span>3. 합격자 정회원 승격 관리 ({unpromotedPassedCandidates.length}명)</span>
            </button>
          </div>
        </div>

        {/* Right Info: Track Filter & Logged-In User Badge */}
        <div className="flex items-center gap-3">
          {mainTab !== "promotions" && (
            <select
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-foreground text-xs font-medium cursor-pointer outline-none"
            >
              <option value="ALL" className="bg-white">
                전체 트랙
              </option>
              <option value="ENGINEERING" className="bg-white">
                데이터 엔지니어링 (ENGINEERING)
              </option>
              <option value="ANALYSIS" className="bg-white">
                데이터 분석 (ANALYSIS)
              </option>
              <option value="VISUALIZATION" className="bg-white">
                데이터 시각화 (VISUALIZATION)
              </option>
            </select>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-emerald-400">문혁준 로그인됨</span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {mainTab === "promotions" ? "(서비스운영팀 팀장 권한)" : "(엔지니어링 평가자)"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── TAB 1 & 2: 서류 심사 대시보드 / 지원자 현황 ─── */}
      {(mainTab === "evaluations" || mainTab === "applicants") && (
        <div className="space-y-4">
          {/* Top Stats Summary Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: "제출 지원서",
                val: `${stats.totalCount}건`,
                sub: "SUBMITTED 대상",
                color: "#3b82f6",
              },
              {
                label: "내 심사 완료",
                val: `${stats.evaluatedCount} / ${stats.totalCount}`,
                sub: `진행률 ${Math.round((stats.evaluatedCount / Math.max(stats.totalCount, 1)) * 100)}%`,
                color: "#8b5cf6",
              },
              {
                label: "최종 합격 (PASS)",
                val: `${stats.passCount}명`,
                sub: "대표진 확정",
                color: "#34d399",
              },
              {
                label: "최종 보류 (HOLD)",
                val: `${stats.holdCount}명`,
                sub: "심층 면접 고려",
                color: "#fbbf24",
              },
              {
                label: "최종 불합격 (FAIL)",
                val: `${stats.failCount}명`,
                sub: "기준 미달",
                color: "#f87171",
              },
              {
                label: "판정 미결 (PENDING)",
                val: `${stats.pendingCount}명`,
                sub: "심사 진행중",
                color: "#9094a8",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1"
              >
                <p className="text-[11px] text-muted-foreground font-medium">{card.label}</p>
                <p className="text-lg font-bold font-mono" style={{ color: card.color }}>
                  {card.val}
                </p>
                <p className="text-[10px] text-muted-foreground/80">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Main Table Container */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xl">
            {/* Table Toolbar */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3 bg-white/[0.01]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-foreground">
                  {mainTab === "evaluations"
                    ? "서류 심사 대시보드 (합격 수 내림차순 정렬)"
                    : "전체 지원서 목록 (DRAFT / SUBMITTED)"}
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-[#8ba5ff]">
                  총 {displayedApplicants.length}명
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground text-[11px]">최종 판정:</span>
                  <select
                    value={decisionFilter}
                    onChange={(e) => setDecisionFilter(e.target.value as any)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-foreground text-xs outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-white">
                      전체 보기
                    </option>
                    <option value="PASS" className="bg-white">
                      PASS (합격)
                    </option>
                    <option value="HOLD" className="bg-white">
                      HOLD (보류)
                    </option>
                    <option value="FAIL" className="bg-white">
                      FAIL (불합격)
                    </option>
                    <option value="PENDING" className="bg-white">
                      PENDING (미결)
                    </option>
                  </select>
                </div>

                <div className="relative">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="지원자명, 대학교, 전공 검색..."
                    className="pl-8 pr-3 py-1 text-xs rounded-xl bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/60 outline-none w-52 font-mono"
                  />
                  <Search
                    size={12}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            {/* Table Body */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[960px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap">
                    <th className="text-left px-5 py-3.5">지원자 성명 (NAME)</th>
                    <th className="text-left px-4 py-3.5">부문 (TRACK)</th>
                    <th className="text-left px-4 py-3.5">대학교 / 본전공</th>
                    <th className="text-center px-3 py-3.5">졸업 예정</th>
                    <th className="text-center px-3 py-3.5 text-emerald-600">합격 (PASS)</th>
                    <th className="text-center px-3 py-3.5 text-amber-600">보류 (HOLD)</th>
                    <th className="text-center px-3 py-3.5 text-rose-600">불합 (FAIL)</th>
                    <th className="text-center px-3 py-3.5 text-slate-700">총점 (SCORE)</th>
                    <th className="text-center px-4 py-3.5 text-blue-600">내 평가 (MY)</th>
                    <th className="text-center px-4 py-3.5">최종 평가 (대표진)</th>
                    <th className="text-right px-5 py-3.5">서류 심사</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {displayedApplicants.map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => handleOpenModal(app, "review")}
                      className="hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      {/* Name */}
                      <td className="px-5 py-3.5 font-sans font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="group-hover:text-[#3b82f6] transition-colors">
                            {app.name}
                          </span>
                          {app.status === "DRAFT" && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 font-mono">
                              DRAFT
                            </span>
                          )}
                          {app.is_promoted_to_member && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-400 font-sans font-bold">
                              정회원
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Track */}
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200 text-[#8ba5ff]">
                          {app.track}
                        </span>
                      </td>

                      {/* Univ / Major */}
                      <td className="px-4 py-3.5 font-sans text-muted-foreground">
                        <p className="text-foreground">{app.university}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {app.major}{" "}
                          {app.minor_double_major.length > 0 &&
                            `(${app.minor_double_major.join(", ")})`}
                        </p>
                      </td>

                      {/* Graduation Date */}
                      <td className="px-3 py-3.5 text-center text-muted-foreground">
                        {app.graduation_date || "—"}
                      </td>

                      {/* Pass Count (초록) */}
                      <td className="px-3 py-3.5 text-center">
                        <span className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-400 font-bold inline-flex items-center justify-center border border-emerald-500/30">
                          {app.pass_count}
                        </span>
                      </td>

                      {/* Hold Count (노랑) */}
                      <td className="px-3 py-3.5 text-center">
                        <span className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-400 font-bold inline-flex items-center justify-center border border-amber-500/30">
                          {app.hold_count}
                        </span>
                      </td>

                      {/* Fail Count (빨강) */}
                      <td className="px-3 py-3.5 text-center">
                        <span className="w-6 h-6 rounded-md bg-red-500/15 text-red-400 font-bold inline-flex items-center justify-center border border-red-500/30">
                          {app.fail_count}
                        </span>
                      </td>

                      {/* Total Score */}
                      <td className="px-3 py-3.5 text-center text-foreground font-bold text-sm">
                        {app.total_score}
                      </td>

                      {/* My Decision Badge */}
                      <td className="px-4 py-3.5 text-center font-sans">
                        <span
                          className="px-2.5 py-1 rounded-lg text-xs font-bold inline-block"
                          style={
                            app.my_decision === "PASS"
                              ? {
                                  background: "rgba(52,211,153,0.15)",
                                  color: "#34d399",
                                  border: "1px solid rgba(52,211,153,0.3)",
                                }
                              : app.my_decision === "HOLD"
                                ? {
                                    background: "rgba(251,191,36,0.15)",
                                    color: "#fbbf24",
                                    border: "1px solid rgba(251,191,36,0.3)",
                                  }
                                : app.my_decision === "FAIL"
                                  ? {
                                      background: "rgba(248,113,113,0.15)",
                                      color: "#f87171",
                                      border: "1px solid rgba(248,113,113,0.3)",
                                    }
                                  : {
                                      background: "rgba(0,0,0,0.06)",
                                      color: "#9094a8",
                                      border: "1px solid rgba(0,0,0,0.08)",
                                    }
                          }
                        >
                          {app.my_decision === "PASS"
                            ? "합격"
                            : app.my_decision === "HOLD"
                              ? "보류"
                              : app.my_decision === "FAIL"
                                ? "불합격"
                                : "미결"}
                        </span>
                      </td>

                      {/* Final Decision */}
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={app.final_decision}
                          onChange={(e) =>
                            handleUpdateFinalDecision(app.id, e.target.value as EvaluationDecision)
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-foreground text-xs font-sans font-semibold cursor-pointer outline-none"
                        >
                          <option value="PENDING" className="bg-white">
                            미결 ↕
                          </option>
                          <option value="PASS" className="bg-white">
                            합격 (PASS) ↕
                          </option>
                          <option value="HOLD" className="bg-white">
                            보류 (HOLD) ↕
                          </option>
                          <option value="FAIL" className="bg-white">
                            불합격 (FAIL) ↕
                          </option>
                        </select>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right font-sans">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenModal(app, "review");
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                        >
                          평가하기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: 합격자 정회원 승격 전용 탭 (UserAdminController: PATCH /api/v1/admin/users/promote) ─── */}
      {mainTab === "promotions" && (
        <div className="space-y-4">
          {/* Promotion Header Banner */}
          <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <UserCheck size={18} className="text-emerald-400" />
                  <span>최종 합격자 정회원(MEMBER) 승격 관리</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  프론트엔드에서 합격자(PASS)를 선택하여{" "}
                  <code className="text-foreground font-mono">user_ids</code> 목록을 전송하면,
                  서버가 각 유저의 최신 SUBMITTED 지원서에서{" "}
                  <strong>이름/전화번호/대학교/전공</strong>을 User 엔티티로 복사하고{" "}
                  <code className="text-[#34d399] font-mono">memberType=MEMBER</code>로 일괄
                  승격합니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllPromote}
                  disabled={unpromotedPassedCandidates.length === 0}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-100 text-foreground border border-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <CheckSquare size={13} />
                  <span>
                    {selectedPromoteUserIds.length === unpromotedPassedCandidates.length &&
                    unpromotedPassedCandidates.length > 0
                      ? "선택 해제"
                      : "승격 대상 전체 선택"}
                  </span>
                </button>

                <button
                  onClick={handleOpenPromoteModal}
                  disabled={selectedPromoteUserIds.length === 0}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  <Award size={14} />
                  <span>선택한 {selectedPromoteUserIds.length}명 정회원 승격 실행 (PATCH)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-muted-foreground text-[11px]">최종 합격자 (PASS)</p>
                <p className="text-foreground font-bold font-mono text-base">
                  {passedCandidates.length}명
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-muted-foreground text-[11px]">승격 대기 인원</p>
                <p className="text-amber-400 font-bold font-mono text-base">
                  {unpromotedPassedCandidates.length}명
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-muted-foreground text-[11px]">정회원 승격 완료 (MEMBER)</p>
                <p className="text-emerald-400 font-bold font-mono text-base">
                  {passedCandidates.filter((c) => c.is_promoted_to_member).length}명
                </p>
              </div>
            </div>
          </div>

          {/* Members Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <Shield size={13} className="text-[#34d399]" />
                <span>PATCH /api/v1/admin/users/promote (개별 트랜잭션 부분 성공 허용)</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                평가 점수는 노출되지 않으며 회원 정보만 안전하게 조회됩니다.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-muted-foreground font-semibold whitespace-nowrap">
                    <th className="text-center px-4 py-3.5 w-12">선택</th>
                    <th className="text-left px-4 py-3.5 w-20">User ID</th>
                    <th className="text-left px-5 py-3.5">지원자 성명</th>
                    <th className="text-left px-4 py-3.5">합격 부문</th>
                    <th className="text-left px-4 py-3.5">이메일 주소 (계정 ID)</th>
                    <th className="text-left px-4 py-3.5">연락처</th>
                    <th className="text-left px-4 py-3.5">대학교 / 본전공</th>
                    <th className="text-center px-4 py-3.5">계정 상태 & 권한</th>
                    <th className="text-right px-5 py-3.5">승격 상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {passedCandidates.map((candidate) => {
                    const isSelected = selectedPromoteUserIds.includes(candidate.user_id);
                    const isPromoted = candidate.is_promoted_to_member;

                    return (
                      <tr
                        key={candidate.id}
                        onClick={() => !isPromoted && handleTogglePromoteSelect(candidate.user_id)}
                        className={`transition-colors ${isPromoted ? "opacity-60 bg-white/[0.01]" : "hover:bg-slate-50 cursor-pointer"}`}
                      >
                        {/* Checkbox */}
                        <td
                          className="text-center px-4 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected || !!isPromoted}
                            disabled={!!isPromoted}
                            onChange={() => handleTogglePromoteSelect(candidate.user_id)}
                            className="rounded accent-emerald-500 w-4 h-4 cursor-pointer disabled:opacity-40"
                          />
                        </td>

                        {/* User ID */}
                        <td className="px-4 py-3.5 font-bold text-[#8ba5ff]">
                          #{candidate.user_id}
                        </td>

                        {/* Name */}
                        <td className="px-5 py-3.5 font-sans font-bold text-foreground">
                          {candidate.name}
                        </td>

                        {/* Track */}
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {candidate.track}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3.5 text-muted-foreground font-sans">
                          {candidate.email}
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3.5 text-muted-foreground">{candidate.phone}</td>

                        {/* Univ / Major */}
                        <td className="px-4 py-3.5 font-sans text-muted-foreground">
                          <p className="text-foreground">{candidate.university}</p>
                          <p className="text-[11px] text-muted-foreground">{candidate.major}</p>
                        </td>

                        {/* Role Status */}
                        <td className="px-4 py-3.5 text-center font-sans">
                          {isPromoted ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-[11px] border border-emerald-500/30 flex items-center justify-center gap-1">
                              <Shield size={11} />
                              <span>정회원 (MEMBER)</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-muted-foreground text-[11px] border border-slate-200 flex items-center justify-center gap-1">
                              <User size={11} />
                              <span>지원자 (APPLICANT)</span>
                            </span>
                          )}
                        </td>

                        {/* Promotion Action */}
                        <td className="px-5 py-3.5 text-right font-sans">
                          {isPromoted ? (
                            <span className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-1">
                              <CheckCircle2 size={13} /> 승격 완료됨
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-400 flex items-center justify-end gap-1">
                              <Clock size={13} /> 승격 대기중
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Detailed Evaluation Modal (for evaluations / applicants) ─── */}
      {selectedApplicant && (
        <div className="fixed inset-0 bg-black/85 z-70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl overflow-hidden flex flex-col bg-white border border-slate-200 shadow-2xl">
            {/* Modal Header */}
            <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30">
                  {selectedApplicant.track === "ENGINEERING"
                    ? "엔지니어링"
                    : selectedApplicant.track === "ANALYSIS"
                      ? "데이터 분석"
                      : "데이터 시각화"}
                </span>
                <span className="text-sm font-bold text-foreground">{selectedApplicant.name}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  ({selectedApplicant.university} · {selectedApplicant.major})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert("지원서 데이터를 새로고침했습니다.")}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-100 text-foreground text-xs font-medium flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  <span>새로고침</span>
                </button>
                <button
                  onClick={() => setSelectedApplicant(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Subtabs + Prev/Next Controls */}
            <div className="px-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-6">
                {[
                  { id: "review", label: "지원서 원문 & 개인 평가" },
                  { id: "status", label: "동료 평가 현황" },
                  { id: "interview", label: "면접 추천 질문" },
                ].map((tab) => {
                  const isActive = modalTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setModalTab(tab.id as any)}
                      className="py-3 text-xs font-bold relative transition-colors cursor-pointer"
                      style={{ color: isActive ? "#2563eb" : "#64748b" }}
                    >
                      <span>{tab.label}</span>
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3b82f6] rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5 py-2">
                <button
                  onClick={() => handleNavigateModal("PREV")}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-100 text-foreground text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={13} /> 이전
                </button>
                <button
                  onClick={() => handleNavigateModal("NEXT")}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-100 text-foreground text-xs font-semibold flex items-center gap-1 cursor-pointer"
                >
                  다음 <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* ─── TAB 1: 지원서 원문 & 개인 평가 ─── */}
              {modalTab === "review" && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: 지원서 원문 (7 cols) */}
                  <div className="lg:col-span-7 space-y-5">
                    {/* Basic Info Box */}
                    <div className="p-4.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs">
                      <p className="font-bold text-xs text-[#8ba5ff] flex items-center gap-1.5">
                        <User size={13} /> 지원자 인적사항 명세 (ApplicantSummaryResponse)
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground text-[11px] font-mono">
                        <p>
                          • 성명:{" "}
                          <strong className="text-white font-sans">{selectedApplicant.name}</strong>
                        </p>
                        <p>
                          • 학년/학기:{" "}
                          <strong className="text-white font-sans">
                            {selectedApplicant.last_semester}학기 이수
                          </strong>
                        </p>
                        <p>
                          • 대학교:{" "}
                          <strong className="text-white font-sans">
                            {selectedApplicant.university}
                          </strong>
                        </p>
                        <p>
                          • 본전공:{" "}
                          <strong className="text-white font-sans">
                            {selectedApplicant.major}
                          </strong>
                        </p>
                        <p>
                          • 복수/부전공:{" "}
                          <strong className="text-white font-sans">
                            {selectedApplicant.minor_double_major.join(", ") || "없음"}
                          </strong>
                        </p>
                        <p>
                          • 병역 여부:{" "}
                          <strong className="text-white font-sans">
                            {selectedApplicant.military_status}
                          </strong>
                        </p>
                        <p>
                          • 졸업 예정:{" "}
                          <strong className="text-white font-sans">
                            {selectedApplicant.graduation_date}
                          </strong>
                        </p>
                        <p>
                          • 대학원 진학:{" "}
                          <strong className="text-white font-sans">
                            {selectedApplicant.grad_school_plan ? "진학 예정" : "취업/미정"}
                          </strong>
                        </p>
                        <p>
                          • 연락처:{" "}
                          <strong className="text-white">{selectedApplicant.phone}</strong>
                        </p>
                        <p>
                          • 이메일:{" "}
                          <strong className="text-white">{selectedApplicant.email}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Answers List */}
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <FileText size={14} className="text-[#3b82f6]" />
                        <span>지원서 작성 답변 (ApplicantAnswersResponse)</span>
                      </p>

                      {(answersMap[selectedApplicant.id] || []).map((ans, idx) => (
                        <div
                          key={idx}
                          className="p-4.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2.5 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#3b82f6]/15 text-[#60a5fa] border border-[#3b82f6]/30">
                              {ans.label}
                            </span>
                            <span className="font-bold text-foreground">{ans.content}</span>
                          </div>

                          {ans.type === "TABLE" && typeof ans.answer === "object" ? (
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-mono text-xs">
                              {Object.entries(ans.answer).map(([k, v]) => (
                                <p key={k} className="text-muted-foreground">
                                  • <strong className="text-[#8ba5ff]">{k}:</strong> {String(v)}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap pt-1 font-sans text-xs">
                              {ans.answer}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: 내 개인 평가 작성 (5 cols) */}
                  <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4 shadow-xl">
                    <div className="border-b border-slate-200 pb-3">
                      <h3 className="text-xs font-bold text-foreground">
                        개인 평가 작성 & 저장 (upsert)
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                        PUT /api/v1/admin/recruitment/applicants/{selectedApplicant.id}
                        /evaluations/me
                      </p>
                    </div>

                    <div className="space-y-4 text-xs">
                      {/* Decision */}
                      <div>
                        <label className="text-muted-foreground block mb-2 font-semibold">
                          개인 결정 (decision) <span className="text-red-400 font-bold">*</span>
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            {
                              id: "PASS",
                              label: "합격",
                              color: "#34d399",
                              bg: "rgba(52,211,153,0.15)",
                            },
                            {
                              id: "HOLD",
                              label: "보류",
                              color: "#fbbf24",
                              bg: "rgba(251,191,36,0.18)",
                            },
                            {
                              id: "FAIL",
                              label: "불합격",
                              color: "#f87171",
                              bg: "rgba(248,113,113,0.15)",
                            },
                            {
                              id: "PENDING",
                              label: "미결",
                              color: "#9094a8",
                              bg: "rgba(0,0,0,0.06)",
                            },
                          ].map((btn) => {
                            const isSelected = editDecision === btn.id;
                            return (
                              <button
                                key={btn.id}
                                type="button"
                                onClick={() => setEditDecision(btn.id as EvaluationDecision)}
                                className="py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center"
                                style={
                                  isSelected
                                    ? {
                                        background: btn.bg,
                                        borderColor: btn.color,
                                        color: btn.color,
                                        boxShadow: `0 0 10px ${btn.color}30`,
                                      }
                                    : {
                                        background: "rgba(255,255,255,0.02)",
                                        borderColor: "rgba(255,255,255,0.08)",
                                        color: "#64748b",
                                      }
                                }
                              >
                                {btn.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Score */}
                      <div>
                        <label className="text-muted-foreground block mb-2 font-semibold">
                          개인 점수 (score: 1~10점)
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={1}
                            max={10}
                            value={editScore}
                            onChange={(e) => setEditScore(Number(e.target.value))}
                            className="flex-1 accent-blue-500 cursor-pointer"
                          />
                          <span className="w-14 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-foreground font-mono font-bold text-center text-sm">
                            {editScore}점
                          </span>
                        </div>
                      </div>

                      {/* Memo */}
                      <div>
                        <label className="text-muted-foreground block mb-2 font-semibold">
                          평가 메모 (memo)
                        </label>
                        <textarea
                          rows={4}
                          value={editMemo}
                          onChange={(e) => setEditMemo(e.target.value)}
                          placeholder="지원서 내용에 대한 강점, 보완점, 의문점을 상세히 작성해 주세요."
                          className="w-full p-3 rounded-xl bg-slate-100 border border-slate-200 text-foreground resize-none leading-relaxed text-xs outline-none"
                        />
                      </div>

                      {/* Interview Question */}
                      <div>
                        <label className="text-muted-foreground block mb-1 font-semibold">
                          면접 추천 질문 (interview_question)
                        </label>
                        <input
                          value={editInterviewQuestion}
                          onChange={(e) => setEditInterviewQuestion(e.target.value)}
                          placeholder="면접 때 심층 검증할 질문을 입력하세요."
                          className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground text-xs outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSaveMyEvaluation}
                      disabled={isSaving}
                      className="w-full py-3 rounded-xl text-xs font-bold text-white bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 transition-all shadow-lg shadow-blue-950/50 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isSaving ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <BookmarkCheck size={14} />
                      )}
                      <span>개인 평가 저장하기 (PUT)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ─── TAB 2: 동료 평가 현황 ─── */}
              {modalTab === "status" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      {
                        label: "합격 (PASS)",
                        val: selectedApplicant.pass_count,
                        color: "#34d399",
                        bg: "rgba(52,211,153,0.15)",
                        border: "rgba(52,211,153,0.3)",
                      },
                      {
                        label: "보류 (HOLD)",
                        val: selectedApplicant.hold_count,
                        color: "#fbbf24",
                        bg: "rgba(251,191,36,0.15)",
                        border: "rgba(251,191,36,0.3)",
                      },
                      {
                        label: "불합 (FAIL)",
                        val: selectedApplicant.fail_count,
                        color: "#f87171",
                        bg: "rgba(248,113,113,0.15)",
                        border: "rgba(248,113,113,0.3)",
                      },
                      {
                        label: "합산 총점",
                        val: selectedApplicant.total_score,
                        color: "#0f172a",
                        bg: "#f1f5f9",
                        border: "rgba(0,0,0,0.08)",
                      },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className="p-4 rounded-2xl border space-y-1"
                        style={{ background: card.bg, borderColor: card.border }}
                      >
                        <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
                        <p className="text-xl font-bold font-mono" style={{ color: card.color }}>
                          {card.val}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-xl">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-muted-foreground font-semibold">
                          <th className="text-left px-5 py-3.5 w-36">평가자</th>
                          <th className="text-center px-4 py-3.5 w-24">판정</th>
                          <th className="text-center px-4 py-3.5 w-20">점수</th>
                          <th className="text-left px-5 py-3.5">평가 메모 (memo)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {(evaluatorsMap[selectedApplicant.id] || []).map((ev) => (
                          <tr key={ev.admin_id} className="hover:bg-white/[0.015]">
                            <td className="px-5 py-3 font-sans font-bold text-foreground">
                              {ev.name}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className="px-2.5 py-0.5 rounded-md text-xs font-bold font-sans inline-block"
                                style={
                                  ev.decision === "PASS"
                                    ? { background: "rgba(52,211,153,0.15)", color: "#34d399" }
                                    : ev.decision === "HOLD"
                                      ? { background: "rgba(251,191,36,0.15)", color: "#fbbf24" }
                                      : ev.decision === "FAIL"
                                        ? { background: "rgba(248,113,113,0.15)", color: "#f87171" }
                                        : { background: "rgba(0,0,0,0.06)", color: "#9094a8" }
                                }
                              >
                                {ev.decision === "PASS"
                                  ? "합격"
                                  : ev.decision === "HOLD"
                                    ? "보류"
                                    : ev.decision === "FAIL"
                                      ? "불합격"
                                      : "미결"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-bold">
                              {ev.score !== null ? `${ev.score}점` : "-"}
                            </td>
                            <td className="px-5 py-3 text-muted-foreground font-sans text-xs break-all">
                              {ev.memo || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─── TAB 3: 면접 추천 질문 ─── */}
              {modalTab === "interview" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground">
                      평가자별 면접 추천 질문 (ApplicantInterviewQuestionsResponse)
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    {(interviewQuestionsMap[selectedApplicant.id] || []).length === 0 ? (
                      <div className="p-12 text-center text-xs text-muted-foreground">
                        작성된 면접 질문이 없습니다. [지원서 원문 & 개인 평가] 탭에서 면접 질문을
                        등록해 보세요.
                      </div>
                    ) : (
                      (interviewQuestionsMap[selectedApplicant.id] || []).map((q) => (
                        <div
                          key={q.admin_id}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#8ba5ff]">{q.name}:</span>
                            <button
                              onClick={() => {
                                if (q.interview_question) {
                                  navigator.clipboard.writeText(q.interview_question);
                                  alert("질문이 복사되었습니다.");
                                }
                              }}
                              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                            >
                              <Copy size={11} /> 복사
                            </button>
                          </div>
                          <p className="text-foreground leading-relaxed pl-1">
                            {q.interview_question}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 합격자 정회원 승격 최종 확인 모달 (PATCH /api/v1/admin/users/promote) ─── */}
      {showPromoteConfirmModal && (
        <div className="fixed inset-0 bg-black/85 z-80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <UserCheck size={18} />
                <h3 className="text-base font-bold text-foreground">
                  정회원(MEMBER) 승격 최종 확인
                </h3>
              </div>
              <button
                onClick={() => setShowPromoteConfirmModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-foreground flex items-center justify-between">
                <span>승격 실행 대상 user_ids 목록 ({selectedPromoteUserIds.length}명)</span>
                <span className="text-[#34d399] font-mono font-bold">PATCH /users/promote</span>
              </p>

              <div className="max-h-40 overflow-y-auto rounded-xl bg-slate-100 border border-slate-200 p-3 space-y-2 divide-y divide-white/5">
                {passedCandidates
                  .filter((c) => selectedPromoteUserIds.includes(c.user_id))
                  .map((app) => (
                    <div
                      key={app.id}
                      className="pt-2 first:pt-0 flex items-center justify-between font-mono text-[11px]"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-foreground font-sans">
                          <span className="text-[#8ba5ff] mr-1.5">User #{app.user_id}</span>
                          {app.name} ({app.university} · {app.major})
                        </p>
                        <p className="text-muted-foreground">{app.email}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        {app.track}
                      </span>
                    </div>
                  ))}
              </div>

              {/* JSON Request Body Preview */}
              <div className="p-2.5 rounded-xl bg-black/50 border border-slate-100 font-mono text-[11px]">
                <span className="text-muted-foreground">Request Body: </span>
                <code className="text-[#34d399] font-bold">
                  {JSON.stringify({ user_ids: selectedPromoteUserIds })}
                </code>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoteCheck1}
                  onChange={(e) => setPromoteCheck1(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-foreground leading-relaxed">
                  대표진 면접 및 최종 선발 회의를 거쳐{" "}
                  <strong>합격(PASS)이 최종 확정된 명단</strong>임을 확인했습니다.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoteCheck2}
                  onChange={(e) => setPromoteCheck2(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-foreground leading-relaxed">
                  승격 시 서버가 각 유저의 최신 SUBMITTED 지원서에서 이름/전화번호/대학/전공을 User
                  엔티티로 복사하고 <strong>memberType=MEMBER로 변경</strong>합니다. (개별 트랜잭션
                  부분 성공 허용)
                </span>
              </label>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <span className="text-[11px] font-mono text-muted-foreground">
                PATCH /api/v1/admin/users/promote
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPromoteConfirmModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-100 cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={handleExecutePromotion}
                  disabled={!promoteCheck1 || !promoteCheck2 || isPromoting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  {isPromoting ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>정회원 일괄 승격 실행</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
