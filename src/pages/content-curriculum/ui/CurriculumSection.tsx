import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Info, Plus, Save, Trash2 } from 'lucide-react';

export type CurriculumTrack = 'ANALYSIS' | 'ENGINEERING' | 'VISUALIZATION';

const TRACK_THEME: Record<
  CurriculumTrack,
  { color: string; shadow: string; label: string; shortLabel: string }
> = {
  ANALYSIS: {
    color: '#16a34a',
    shadow: 'rgba(22, 163, 74, 0.3)',
    label: '데이터 분석 (Analysis)',
    shortLabel: '데이터 분석',
  },
  ENGINEERING: {
    color: '#2563eb',
    shadow: 'rgba(37, 99, 235, 0.3)',
    label: '데이터 엔지니어링 (Engineering)',
    shortLabel: '데이터 엔지니어링',
  },
  VISUALIZATION: {
    color: '#ec4899',
    shadow: 'rgba(236, 72, 153, 0.3)',
    label: '데이터 시각화 (Visualization)',
    shortLabel: '데이터 시각화',
  },
};

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
    id: 'c_a1',
    track: 'ANALYSIS',
    stepNum: 1,
    duration: '1주차',
    title: '데이터 핸들링 & 탐색적 데이터 분석 (EDA)',
    description:
      'Pandas, NumPy를 활용한 대규모 정형 데이터 전처리 및 통계적 가설 검정과 데이터 분포 시각화 기초를 다룹니다.',
    topics: ['Python', 'Pandas', 'EDA', '통계학', '가설검정'],
  },
  {
    id: 'c_a2',
    track: 'ANALYSIS',
    stepNum: 2,
    duration: '2주차',
    title: '머신러닝 알고리즘 & 성능 최적화',
    description:
      '지도학습/비지도학습 핵심 모델(Scikit-learn, XGBoost, LightGBM) 학습 및 하이퍼파라미터 튜닝을 통한 모델 최적화 실습을 진행합니다.',
    topics: ['Scikit-learn', 'XGBoost', 'LightGBM', '교차검증', '앙상블'],
  },
  {
    id: 'c_a3',
    track: 'ANALYSIS',
    stepNum: 3,
    duration: '3주차',
    title: '딥러닝 & 도메인 프로젝트 (NLP / CV)',
    description:
      'PyTorch 기반의 신경망 모델링, HuggingFace Transformers를 활용한 자연어 처리 및 컴퓨터 비전 실무 프로젝트를 완수합니다.',
    topics: ['PyTorch', 'HuggingFace', 'LLM', 'CNN/RNN', '프로젝트'],
  },

  // Engineering
  {
    id: 'c_e1',
    track: 'ENGINEERING',
    stepNum: 1,
    duration: '1주차',
    title: '데이터베이스 설계 & SQL 최적화',
    description:
      'RDBMS(PostgreSQL)와 NoSQL(MongoDB) 모델링, 인덱스 설계 및 대용량 쿼리 튜닝 기법을 실습합니다.',
    topics: ['PostgreSQL', 'MongoDB', 'SQL', '인덱싱', 'DB설계'],
  },
  {
    id: 'c_e2',
    track: 'ENGINEERING',
    stepNum: 2,
    duration: '2주차',
    title: '분산 처리 & ETL 파이프라인 구축',
    description:
      'Apache Spark와 Kafka를 이용한 실시간/배치 스트리밍 데이터 파이프라인 설계 및 Airflow 워크플로우 오케스트레이션을 다룹니다.',
    topics: ['Apache Spark', 'Kafka', 'Airflow', 'ETL', '스트리밍'],
  },
  {
    id: 'c_e3',
    track: 'ENGINEERING',
    stepNum: 3,
    duration: '3주차',
    title: '클라우드 인프라 & MLOps 아키텍처',
    description:
      'Docker, Kubernetes, AWS 기반의 확장성 높은 데이터 플랫폼 인프라 구축 및 ML 서빙 파이프라인을 완성합니다.',
    topics: ['Kubernetes', 'Docker', 'AWS', 'MLOps', 'CI/CD'],
  },

  // Visualization
  {
    id: 'c_v1',
    track: 'VISUALIZATION',
    stepNum: 1,
    duration: '1주차',
    title: '데이터 시각화 원리 & BI 대시보드',
    description:
      '정보 디자인 원칙과 인간 인지 과정을 고려한 차트 설계, Tableau와 PowerBI를 활용한 인터랙티브 대시보드 제작을 배웁니다.',
    topics: ['Tableau', 'PowerBI', '정보시각화', 'UI/UX'],
  },
  {
    id: 'c_v2',
    track: 'VISUALIZATION',
    stepNum: 2,
    duration: '2주차',
    title: '웹 기반 인터랙티브 시각화 (D3.js & React)',
    description:
      'D3.js, Chart.js, React 라이브러리를 결합하여 웹 브라우저 상에서 동적으로 반응하는 커스텀 시각화 컴포넌트를 구현합니다.',
    topics: ['D3.js', 'React', 'SVG/Canvas', '애니메이션'],
  },
  {
    id: 'c_v3',
    track: 'VISUALIZATION',
    stepNum: 3,
    duration: '3주차',
    title: '공간 데이터 시각화 & 최종 인터랙티브 쇼케이스',
    description:
      'GIS 공간 정보 시각화(Mapbox, Deck.gl) 및 대규모 사용자 인터랙션을 지원하는 최종 컨퍼런스 웹 시각화 결과물을 제작합니다.',
    topics: ['Deck.gl', 'Mapbox', 'GIS', '데이터저널리즘', '웹쇼케이스'],
  },
];

export function CurriculumSection() {
  const [selectedTrack, setSelectedTrack] = useState<CurriculumTrack>('ANALYSIS');
  const [curriculums, setCurriculums] = useState<CurriculumStep[]>(INITIAL_CURRICULUM);
  const [topicDrafts, setTopicDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(INITIAL_CURRICULUM.map((step) => [step.id, step.topics.join(', ')])),
  );
  const [, setSavedNotice] = useState(false);
  const [targetStepCount, setTargetStepCount] = useState(18);
  const [addedStep, setAddedStep] = useState<{
    ids: string[];
    startStepNum: number;
    endStepNum: number;
  } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(['c_a1', 'c_e1', 'c_v1']),
  );
  const [dirtyTracks, setDirtyTracks] = useState<Set<CurriculumTrack>>(() => new Set());
  const [formErrors, setFormErrors] = useState<
    Record<string, { title?: string; description?: string }>
  >({});
  const [toast, setToast] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Partial<Record<CurriculumTrack, string>>>({});
  const noticeTimerRef = useRef<number | null>(null);

  const activeTheme = TRACK_THEME[selectedTrack];

  const currentSteps = curriculums
    .filter((c) => c.track === selectedTrack)
    .sort((a, b) => a.stepNum - b.stepNum);

  function markTrackDirty(track: CurriculumTrack = selectedTrack) {
    setDirtyTracks((prev) => new Set(prev).add(track));
  }

  function handleUpdateStep(id: string, field: keyof CurriculumStep, value: any) {
    setCurriculums((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
    markTrackDirty();
    if (field === 'title' || field === 'description') {
      setFormErrors((prev) => ({
        ...prev,
        [id]: { ...prev[id], [field]: undefined },
      }));
    }
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleAddStep() {
    const newStepNum = currentSteps.length + 1;
    const newStep: CurriculumStep = {
      id: `c_${selectedTrack.toLowerCase()}_${Date.now()}`,
      track: selectedTrack,
      stepNum: newStepNum,
      duration: `${newStepNum}주차`,
      title: '새 커리큘럼 주제',
      description: '',
      topics: [],
    };
    setCurriculums((prev) => [...prev, newStep]);
    setTopicDrafts((prev) => ({ ...prev, [newStep.id]: newStep.topics.join(', ') }));
    setExpandedIds((prev) => new Set(prev).add(newStep.id));
    markTrackDirty();
    setAddedStep({ ids: [newStep.id], startStepNum: newStepNum, endStepNum: newStepNum });

    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => setAddedStep(null), 4000);

    window.setTimeout(() => {
      document
        .getElementById(`curriculum-step-${newStep.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  function handleGenerateSteps() {
    const currentCount = currentSteps.length;
    if (targetStepCount <= currentCount) {
      return;
    }

    const timestamp = Date.now();
    const newSteps: CurriculumStep[] = Array.from(
      { length: targetStepCount - currentCount },
      (_, index) => {
        const stepNum = currentCount + index + 1;
        return {
          id: `c_${selectedTrack.toLowerCase()}_${timestamp}_${stepNum}`,
          track: selectedTrack,
          stepNum,
          duration: `${stepNum}주차`,
          title: '새 커리큘럼 주제',
          description: '',
          topics: [],
        };
      },
    );

    setCurriculums((prev) => [...prev, ...newSteps]);
    setTopicDrafts((prev) => ({
      ...prev,
      ...Object.fromEntries(newSteps.map((step) => [step.id, ''])),
    }));
    setAddedStep({
      ids: newSteps.map((step) => step.id),
      startStepNum: currentCount + 1,
      endStepNum: targetStepCount,
    });
    setExpandedIds((prev) => new Set(prev).add(newSteps[newSteps.length - 1].id));
    markTrackDirty();

    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => setAddedStep(null), 4000);

    window.setTimeout(() => {
      document
        .getElementById(`curriculum-step-${newSteps[newSteps.length - 1].id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  useEffect(
    () => () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    },
    [],
  );

  function handleInsertWeekAfter(stepNum: number) {
    const newId = `c_${selectedTrack.toLowerCase()}_${Date.now()}_insert`;
    const newStep: CurriculumStep = {
      id: newId,
      track: selectedTrack,
      stepNum: stepNum + 1,
      duration: `${stepNum + 1}주차`,
      title: '새 커리큘럼 주제',
      description: '',
      topics: [],
    };

    setCurriculums((prev) => [
      ...prev.map((step) =>
        step.track === selectedTrack && step.stepNum > stepNum
          ? { ...step, stepNum: step.stepNum + 1, duration: `${step.stepNum + 1}주차` }
          : step,
      ),
      newStep,
    ]);
    setTopicDrafts((prev) => ({ ...prev, [newId]: '' }));
    setExpandedIds((prev) => new Set(prev).add(newId));
    setAddedStep({ ids: [newId], startStepNum: stepNum + 1, endStepNum: stepNum + 1 });
    markTrackDirty();

    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => setAddedStep(null), 4000);

    window.setTimeout(() => {
      document
        .getElementById(`curriculum-step-${newId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  }

  function handleDeleteStep(id: string) {
    if (confirm('이 주차를 삭제하시겠습니까? 이후 주차 번호는 자동으로 당겨집니다.')) {
      setTopicDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setCurriculums((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        // re-index stepNum for current track
        let counter = 1;
        return filtered.map((c) => {
          if (c.track === selectedTrack) {
            const stepNum = counter++;
            return { ...c, stepNum, duration: `${stepNum}주차` };
          }
          return c;
        });
      });
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      markTrackDirty();
    }
  }

  function handleSaveAll() {
    const errors: Record<string, { title?: string; description?: string }> = {};
    currentSteps.forEach((step) => {
      if (!step.title.trim()) {
        errors[step.id] = { ...errors[step.id], title: '주차 제목을 입력해 주세요.' };
      }
      if (!step.description.trim()) {
        errors[step.id] = {
          ...errors[step.id],
          description: '학습 내용 및 목표를 입력해 주세요.',
        };
      }
    });

    setFormErrors(errors);
    const firstInvalidId = Object.keys(errors)[0];
    if (firstInvalidId) {
      setExpandedIds((prev) => new Set(prev).add(firstInvalidId));
      setToast('필수 입력 항목을 확인해 주세요.');
      window.setTimeout(() => {
        document
          .getElementById(`curriculum-step-${firstInvalidId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
      return;
    }

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
    setDirtyTracks((prev) => {
      const next = new Set(prev);
      next.delete(selectedTrack);
      return next;
    });
    setLastSavedAt((prev) => ({
      ...prev,
      [selectedTrack]: new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    }));
    setToast(`${activeTheme.shortLabel} 커리큘럼이 저장되었습니다.`);
  }

  function handleTrackChange(track: CurriculumTrack) {
    if (
      track !== selectedTrack &&
      dirtyTracks.has(selectedTrack) &&
      !confirm('현재 트랙에 저장되지 않은 변경사항이 있습니다. 다른 트랙으로 이동할까요?')
    ) {
      return;
    }
    setSelectedTrack(track);
    setAddedStep(null);
  }

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (dirtyTracks.size > 0) {
        event.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyTracks]);

  return (
    <div
      className="space-y-5"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}
    >
      {/* ─── Top Track Selector & Save Button ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {(['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'] as CurriculumTrack[]).map((t) => {
            const theme = TRACK_THEME[t];
            return (
              <button
                key={t}
                onClick={() => handleTrackChange(t)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                style={
                  selectedTrack === t
                    ? {
                        background: theme.color,
                        color: '#fff',
                        boxShadow: `0 0 10px ${theme.shadow}`,
                      }
                    : { color: '#64748b' }
                }
              >
                {theme.label}
                {dirtyTracks.has(t) && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${selectedTrack === t ? 'bg-white' : 'bg-amber-500'}`}
                    title="저장되지 않은 변경사항"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddStep}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-foreground bg-slate-100 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus size={13} /> 주차 추가
          </button>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1">
            <label
              htmlFor="target-step-count"
              className="pl-2 text-[11px] font-medium text-slate-500"
            >
              총 주차 수
            </label>
            <select
              id="target-step-count"
              value={targetStepCount}
              onChange={(event) => setTargetStepCount(Number(event.target.value))}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              {Array.from({ length: 24 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {count}주차
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleGenerateSteps}
              disabled={targetStepCount <= currentSteps.length}
              className="rounded-md px-3 py-1.5 text-[11px] font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              style={{ background: activeTheme.color }}
            >
              {targetStepCount}주차까지 생성
            </button>
          </div>
          <button
            onClick={handleSaveAll}
            className="px-5 py-2 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
            style={{ background: activeTheme.color }}
          >
            <Save size={13} /> 트랙 커리큘럼 일괄 저장
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <p>
          현재 {currentSteps.length}주차 구성
          {targetStepCount > currentSteps.length && (
            <>
              {' · '}
              <strong className="font-semibold text-slate-700">
                {currentSteps.length + 1}~{targetStepCount}주차가 새로 생성됩니다.
              </strong>{' '}
              기존 주차 내용은 유지됩니다.
            </>
          )}
        </p>
        <div className="flex items-center gap-3">
          {dirtyTracks.has(selectedTrack) ? (
            <span className="font-semibold text-amber-600">● 저장되지 않음</span>
          ) : lastSavedAt[selectedTrack] ? (
            <span>마지막 저장 {lastSavedAt[selectedTrack]}</span>
          ) : (
            <span>변경사항 없음</span>
          )}
          <button
            type="button"
            onClick={() =>
              setExpandedIds((prev) => {
                const next = new Set(prev);
                const allExpanded = currentSteps.every((step) => next.has(step.id));
                currentSteps.forEach((step) =>
                  allExpanded ? next.delete(step.id) : next.add(step.id),
                );
                return next;
              })
            }
            className="font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {currentSteps.every((step) => expandedIds.has(step.id)) ? '전체 접기' : '전체 펼치기'}
          </button>
        </div>
      </div>

      {/* Info notice banner */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-[#8ba5ff] shrink-0" />
          <span>
            커리큘럼은 트랙별 주차 전체를 편집 후 [일괄 저장] 시 공식 홈페이지에 즉시 반영됩니다.
          </span>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground/70">
          총 {currentSteps.length}주차 구성
        </span>
      </div>

      {/* ─── Step Cards List ─── */}
      <div className="space-y-4">
        {currentSteps.map((step) => (
          <div
            key={step.id}
            id={`curriculum-step-${step.id}`}
            className="rounded-xl border border-slate-200 bg-white px-5 transition-all hover:border-slate-300"
            style={
              addedStep?.ids.includes(step.id)
                ? {
                    borderColor: activeTheme.color,
                    boxShadow: `0 0 0 3px ${activeTheme.shadow}`,
                  }
                : undefined
            }
          >
            {/* Header: Week Number, Title & Controls */}
            <div
              className={`flex items-center justify-between py-4 ${expandedIds.has(step.id) ? 'border-b border-slate-100' : ''}`}
            >
              <button
                type="button"
                onClick={() => toggleExpanded(step.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left cursor-pointer"
                aria-expanded={expandedIds.has(step.id)}
              >
                {expandedIds.has(step.id) ? (
                  <ChevronDown size={16} className="shrink-0 text-slate-400" />
                ) : (
                  <ChevronRight size={16} className="shrink-0 text-slate-400" />
                )}
                <span
                  className="w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center font-mono"
                  style={{
                    color: activeTheme.color,
                    background: `${activeTheme.color}1f`,
                  }}
                >
                  {step.stepNum}
                </span>
                <span className="shrink-0 text-sm font-bold text-foreground">
                  {step.stepNum}주차
                </span>
                <span className="truncate text-xs text-slate-500">{step.title}</span>
                {addedStep?.ids.includes(step.id) && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                    style={{ background: activeTheme.color }}
                  >
                    새로 추가됨
                  </span>
                )}
                {formErrors[step.id] && (
                  <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                    입력 확인 필요
                  </span>
                )}
              </button>

              <div className="ml-3 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleInsertWeekAfter(step.stepNum)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                  title="이 주차 다음에 새 주차 삽입"
                >
                  <Plus size={12} /> 아래에 주차 삽입
                </button>
                <button
                  onClick={() => handleDeleteStep(step.id)}
                  className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground hover:text-red-400 cursor-pointer ml-1"
                  title="주차 삭제"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Title & Description Input */}
            {expandedIds.has(step.id) && (
              <div className="space-y-2.5 py-4 text-xs">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">주차 제목</label>
                  <input
                    value={step.title}
                    onChange={(e) => handleUpdateStep(step.id, 'title', e.target.value)}
                    className={`w-full px-3 py-2 rounded-md outline-none bg-slate-100 border text-foreground font-semibold text-xs ${formErrors[step.id]?.title ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {formErrors[step.id]?.title && (
                    <p className="mt-1 text-[11px] text-red-600">{formErrors[step.id].title}</p>
                  )}
                </div>

                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    학습 내용 및 목표
                  </label>
                  <textarea
                    value={step.description}
                    onChange={(e) => handleUpdateStep(step.id, 'description', e.target.value)}
                    rows={2}
                    className={`w-full px-3 py-2 rounded-md outline-none bg-slate-100 border text-foreground resize-none leading-relaxed text-xs ${formErrors[step.id]?.description ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {formErrors[step.id]?.description && (
                    <p className="mt-1 text-[11px] text-red-600">
                      {formErrors[step.id].description}
                    </p>
                  )}
                </div>

                {/* Topic Tags Input */}
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">
                    다루는 기술 스택 / 토픽 키워드 (쉼표로 구분)
                  </label>
                  <input
                    value={topicDrafts[step.id] ?? step.topics.join(', ')}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTopicDrafts((prev) => ({ ...prev, [step.id]: value }));
                      const parsed = Array.from(
                        new Set(
                          value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        ),
                      );
                      handleUpdateStep(step.id, 'topics', parsed);
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
            )}
          </div>
        ))}
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-6 top-20 z-60 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl"
        >
          {toast}
        </div>
      )}

      {addedStep && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-6 z-50 flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-xl ${toast ? 'top-36' : 'top-20'}`}
          style={{ borderColor: activeTheme.color }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-white"
            style={{ background: activeTheme.color }}
          >
            <Plus size={14} />
          </span>
          <div>
            <p className="text-xs font-bold text-slate-900">
              {addedStep.startStepNum === addedStep.endStepNum
                ? `${addedStep.endStepNum}주차가 추가되었습니다.`
                : `${addedStep.startStepNum}~${addedStep.endStepNum}주차가 한 번에 추가되었습니다.`}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">{activeTheme.shortLabel} 커리큘럼</p>
          </div>
        </div>
      )}
    </div>
  );
}
