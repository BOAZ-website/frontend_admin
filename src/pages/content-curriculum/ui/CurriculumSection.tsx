import { useState } from "react";
import { ArrowDown, ArrowUp, Info, Plus, Save, Trash2 } from "lucide-react";

export type CurriculumTrack = "ANALYSIS" | "ENGINEERING" | "VISUALIZATION";

export interface CurriculumStep {
  id: string;
  track: CurriculumTrack;
  stepNum: number;
  duration: string;
  title: string;
  description: string;
  topics: string[];
}

const INITIAL_CURRICULUM: CurriculumStep[] = [
  // Analysis
  {
    id: "c_a1",
    track: "ANALYSIS",
    stepNum: 1,
    duration: "1 ~ 3주차",
    title: "데이터 핸들링 & 탐색적 데이터 분석 (EDA)",
    description:
      "Pandas, NumPy를 활용한 대규모 정형 데이터 전처리 및 통계적 가설 검정과 데이터 분포 시각화 기초를 다룹니다.",
    topics: ["Python", "Pandas", "EDA", "통계학", "가설검정"],
  },
  {
    id: "c_a2",
    track: "ANALYSIS",
    stepNum: 2,
    duration: "4 ~ 7주차",
    title: "머신러닝 알고리즘 & 성능 최적화",
    description:
      "지도학습/비지도학습 핵심 모델(Scikit-learn, XGBoost, LightGBM) 학습 및 하이퍼파라미터 튜닝을 통한 모델 최적화 실습을 진행합니다.",
    topics: ["Scikit-learn", "XGBoost", "LightGBM", "교차검증", "앙상블"],
  },
  {
    id: "c_a3",
    track: "ANALYSIS",
    stepNum: 3,
    duration: "8 ~ 12주차",
    title: "딥러닝 & 도메인 프로젝트 (NLP / CV)",
    description:
      "PyTorch 기반의 신경망 모델링, HuggingFace Transformers를 활용한 자연어 처리 및 컴퓨터 비전 실무 프로젝트를 완수합니다.",
    topics: ["PyTorch", "HuggingFace", "LLM", "CNN/RNN", "프로젝트"],
  },

  // Engineering
  {
    id: "c_e1",
    track: "ENGINEERING",
    stepNum: 1,
    duration: "1 ~ 3주차",
    title: "데이터베이스 설계 & SQL 최적화",
    description:
      "RDBMS(PostgreSQL)와 NoSQL(MongoDB) 모델링, 인덱스 설계 및 대용량 쿼리 튜닝 기법을 실습합니다.",
    topics: ["PostgreSQL", "MongoDB", "SQL", "인덱싱", "DB설계"],
  },
  {
    id: "c_e2",
    track: "ENGINEERING",
    stepNum: 2,
    duration: "4 ~ 7주차",
    title: "분산 처리 & ETL 파이프라인 구축",
    description:
      "Apache Spark와 Kafka를 이용한 실시간/배치 스트리밍 데이터 파이프라인 설계 및 Airflow 워크플로우 오케스트레이션을 다룹니다.",
    topics: ["Apache Spark", "Kafka", "Airflow", "ETL", "스트리밍"],
  },
  {
    id: "c_e3",
    track: "ENGINEERING",
    stepNum: 3,
    duration: "8 ~ 12주차",
    title: "클라우드 인프라 & MLOps 아키텍처",
    description:
      "Docker, Kubernetes, AWS 기반의 확장성 높은 데이터 플랫폼 인프라 구축 및 ML 서빙 파이프라인을 완성합니다.",
    topics: ["Kubernetes", "Docker", "AWS", "MLOps", "CI/CD"],
  },

  // Visualization
  {
    id: "c_v1",
    track: "VISUALIZATION",
    stepNum: 1,
    duration: "1 ~ 3주차",
    title: "데이터 시각화 원리 & BI 대시보드",
    description:
      "정보 디자인 원칙과 인간 인지 과정을 고려한 차트 설계, Tableau와 PowerBI를 활용한 인터랙티브 대시보드 제작을 배웁니다.",
    topics: ["Tableau", "PowerBI", "정보시각화", "UI/UX"],
  },
  {
    id: "c_v2",
    track: "VISUALIZATION",
    stepNum: 2,
    duration: "4 ~ 7주차",
    title: "웹 기반 인터랙티브 시각화 (D3.js & React)",
    description:
      "D3.js, Chart.js, React 라이브러리를 결합하여 웹 브라우저 상에서 동적으로 반응하는 커스텀 시각화 컴포넌트를 구현합니다.",
    topics: ["D3.js", "React", "SVG/Canvas", "애니메이션"],
  },
  {
    id: "c_v3",
    track: "VISUALIZATION",
    stepNum: 3,
    duration: "8 ~ 12주차",
    title: "공간 데이터 시각화 & 최종 인터랙티브 쇼케이스",
    description:
      "GIS 공간 정보 시각화(Mapbox, Deck.gl) 및 대규모 사용자 인터랙션을 지원하는 최종 컨퍼런스 웹 시각화 결과물을 제작합니다.",
    topics: ["Deck.gl", "Mapbox", "GIS", "데이터저널리즘", "웹쇼케이스"],
  },
];

export function CurriculumSection() {
  const [selectedTrack, setSelectedTrack] = useState<CurriculumTrack>("ANALYSIS");
  const [curriculums, setCurriculums] = useState<CurriculumStep[]>(INITIAL_CURRICULUM);
  const [, setSavedNotice] = useState(false);

  const currentSteps = curriculums
    .filter((c) => c.track === selectedTrack)
    .sort((a, b) => a.stepNum - b.stepNum);

  function handleUpdateStep(id: string, field: keyof CurriculumStep, value: any) {
    setCurriculums((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  }

  function handleAddStep() {
    const newStepNum = currentSteps.length + 1;
    const newStep: CurriculumStep = {
      id: `c_${selectedTrack.toLowerCase()}_${Date.now()}`,
      track: selectedTrack,
      stepNum: newStepNum,
      duration: `${(newStepNum - 1) * 4 + 1} ~ ${newStepNum * 4}주차`,
      title: "새 커리큘럼 단계",
      description: "해당 단계에서 학습할 주요 내용과 목표를 입력하세요.",
      topics: ["주제1", "주제2"],
    };
    setCurriculums((prev) => [...prev, newStep]);
  }

  function handleDeleteStep(id: string) {
    if (confirm("이 커리큘럼 단계를 삭제하시겠습니까?")) {
      setCurriculums((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        // re-index stepNum for current track
        let counter = 1;
        return filtered.map((c) => {
          if (c.track === selectedTrack) {
            return { ...c, stepNum: counter++ };
          }
          return c;
        });
      });
    }
  }

  function handleMoveStep(id: string, direction: "up" | "down") {
    const idx = currentSteps.findIndex((c) => c.id === id);
    if (idx < 0) {
      return;
    }
    if (direction === "up" && idx === 0) {
      return;
    }
    if (direction === "down" && idx === currentSteps.length - 1) {
      return;
    }

    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    const currentStep = currentSteps[idx];
    const targetStep = currentSteps[targetIdx];

    setCurriculums((prev) =>
      prev.map((c) => {
        if (c.id === currentStep.id) {
          return { ...c, stepNum: targetStep.stepNum };
        }
        if (c.id === targetStep.id) {
          return { ...c, stepNum: currentStep.stepNum };
        }
        return c;
      })
    );
  }

  function handleSaveAll() {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
    alert(`${selectedTrack} 트랙 커리큘럼 전체 내용이 일괄 저장 및 배포되었습니다.`);
  }

  return (
    <div
      className="space-y-5"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}
    >
      {/* ─── Top Track Selector & Save Button ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {(["ANALYSIS", "ENGINEERING", "VISUALIZATION"] as CurriculumTrack[]).map((t) => {
            const labels = {
              ANALYSIS: "데이터 분석 (Analysis)",
              ENGINEERING: "데이터 엔지니어링 (Engineering)",
              VISUALIZATION: "데이터 시각화 (Visualization)",
            };
            return (
              <button
                key={t}
                onClick={() => setSelectedTrack(t)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                style={
                  selectedTrack === t
                    ? {
                        background: "#ef4444",
                        color: "#fff",
                        boxShadow: "0 0 10px rgba(239,68,68,0.35)",
                      }
                    : { color: "#64748b" }
                }
              >
                {labels[t]}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddStep}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-foreground bg-slate-100 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={13} /> 단계 추가
          </button>
          <button
            onClick={handleSaveAll}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
            style={{ background: "#ef4444" }}
          >
            <Save size={13} /> 트랙 커리큘럼 일괄 저장
          </button>
        </div>
      </div>

      {/* Info notice banner */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-[#8ba5ff] shrink-0" />
          <span>
            커리큘럼은 트랙별 단계 전체를 편집 후 [일괄 저장] 시 공식 홈페이지에 즉시 반영됩니다.
          </span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground/70">
          총 {currentSteps.length}개 단계 구성됨
        </span>
      </div>

      {/* ─── Step Cards List ─── */}
      <div className="space-y-4">
        {currentSteps.map((step, index) => (
          <div
            key={step.id}
            className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 transition-all hover:border-slate-300"
          >
            {/* Header: Step Number, Duration & Controls */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-red-500/20 text-red-400 font-bold text-xs flex items-center justify-center font-mono">
                  {step.stepNum}
                </span>
                <span className="text-xs font-bold text-foreground">Step {step.stepNum} 단계</span>
                <input
                  value={step.duration}
                  onChange={(e) => handleUpdateStep(step.id, "duration", e.target.value)}
                  placeholder="예: 1~3주차"
                  className="px-2 py-0.5 text-xs rounded bg-slate-100 border border-slate-200 text-muted-foreground font-mono outline-none w-28"
                />
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleMoveStep(step.id, "up")}
                  disabled={index === 0}
                  className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="위로 이동"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  onClick={() => handleMoveStep(step.id, "down")}
                  disabled={index === currentSteps.length - 1}
                  className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  title="아래로 이동"
                >
                  <ArrowDown size={13} />
                </button>
                <button
                  onClick={() => handleDeleteStep(step.id)}
                  className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground hover:text-red-400 cursor-pointer ml-1"
                  title="단계 삭제"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Title & Description Input */}
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">단계 제목</label>
                <input
                  value={step.title}
                  onChange={(e) => handleUpdateStep(step.id, "title", e.target.value)}
                  className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground font-semibold text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">
                  학습 내용 및 목표
                </label>
                <textarea
                  value={step.description}
                  onChange={(e) => handleUpdateStep(step.id, "description", e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground resize-none leading-relaxed text-xs"
                />
              </div>

              {/* Topic Tags Input */}
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">
                  다루는 기술 스택 / 토픽 키워드 (쉼표로 구분)
                </label>
                <input
                  value={step.topics.join(", ")}
                  onChange={(e) => {
                    const parsed = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    handleUpdateStep(step.id, "topics", parsed);
                  }}
                  placeholder="예: Python, Pandas, EDA"
                  className="w-full px-3 py-1.5 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground font-mono text-[11px]"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {step.topics.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] text-muted-foreground font-mono"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
