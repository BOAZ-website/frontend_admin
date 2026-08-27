import { useState } from "react";
import { ChevronDown, ChevronUp, Edit3, Eye, EyeOff, Plus, Search, Trash2, X } from "lucide-react";

export type FaqCategory = "RECRUITMENT" | "ACTIVITY" | "ETC";

export interface FaqItem {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  orderNum: number;
  visible: boolean;
  updatedAt: string;
}

const INITIAL_FAQ_DATA: FaqItem[] = [
  {
    id: "f1",
    category: "RECRUITMENT",
    question: "비전공자도 지원 가능한가요?",
    answer:
      "네, 전공과 무관하게 데이터에 대한 열정과 기초적인 학습 의지가 있다면 누구나 지원 가능합니다. 각 트랙별 기초 지식(Python, 기초 통계 등)에 대한 이해도가 있다면 서류 및 면접에서 좋은 평가를 받을 수 있습니다.",
    orderNum: 1,
    visible: true,
    updatedAt: "2026-07-20",
  },
  {
    id: "f2",
    category: "RECRUITMENT",
    question: "서류 평가 기준과 면접 진행 방식이 궁금합니다.",
    answer:
      "서류 평가는 지원 동기, 문제 해결 경험, 트랙 적합성을 종합적으로 검토합니다. 면접은 지원서 기반의 개별 인터뷰로 진행되며 실무적인 지식뿐만 아니라 협업 태도와 성장 잠재력을 중점적으로 평가합니다.",
    orderNum: 2,
    visible: true,
    updatedAt: "2026-07-20",
  },
  {
    id: "f3",
    category: "ACTIVITY",
    question: "정규 세션 일정 및 활동 시간은 어떻게 되나요?",
    answer:
      "정규 세션은 매주 토요일 오후 2시부터 6시까지 진행됩니다. 방학 중에는 온/오프라인 병행 스터디가 추가로 진행될 수 있습니다.",
    orderNum: 1,
    visible: true,
    updatedAt: "2026-06-15",
  },
  {
    id: "f4",
    category: "ACTIVITY",
    question: "출석 인정 기준과 점수 제도는 어떻게 운영되나요?",
    answer:
      "출석 시 +1점, 지각 시 +0.5점, 결석 시 0점이 부여됩니다. 스터디장이 매주 출결을 입력하고 운영지원팀에서 승인하며, 총 활동 점수가 수료 기준에 반영됩니다.",
    orderNum: 2,
    visible: true,
    updatedAt: "2026-06-15",
  },
  {
    id: "f5",
    category: "ETC",
    question: "활동 증명서 및 수료증 발급 기준은 무엇인가요?",
    answer:
      "정규 활동 기간(2학기) 동안 출석률 80% 이상 및 최종 프로젝트 컨퍼런스 발표를 완료한 부원에게 정식 수료증이 발급됩니다.",
    orderNum: 1,
    visible: true,
    updatedAt: "2026-05-10",
  },
];

const CATEGORY_LABELS: Record<FaqCategory, string> = {
  RECRUITMENT: "리크루팅",
  ACTIVITY: "활동 안내",
  ETC: "기타",
};

const CATEGORY_STYLES: Record<FaqCategory, string> = {
  RECRUITMENT: "bg-blue-50 text-blue-700 border-blue-200/80",
  ACTIVITY: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
  ETC: "bg-slate-100 text-slate-700 border-slate-200",
};

export function FaqSection() {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [faqs, setFaqs] = useState<FaqItem[]>(INITIAL_FAQ_DATA);
  const [expandedId, setExpandedId] = useState<string | null>("f1");

  // Edit / Add modal
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [isNew, setIsNew] = useState(false);

  const filteredFaqs = faqs
    .filter((f) => {
      if (selectedCategory !== "ALL" && f.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => a.orderNum - b.orderNum);

  function handleAddNew() {
    setIsNew(true);
    setEditingFaq({
      id: "f_" + Date.now(),
      category: selectedCategory === "ALL" ? "RECRUITMENT" : (selectedCategory as FaqCategory),
      question: "",
      answer: "",
      orderNum: faqs.length + 1,
      visible: true,
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  }

  function handleEdit(faq: FaqItem) {
    setIsNew(false);
    setEditingFaq({ ...faq });
  }

  function handleSave() {
    if (!editingFaq) {
      return;
    }
    if (!editingFaq.question.trim() || !editingFaq.answer.trim()) {
      alert("질문과 답변을 모두 입력해 주세요.");
      return;
    }
    if (isNew) {
      setFaqs((prev) => [...prev, editingFaq]);
    } else {
      setFaqs((prev) => prev.map((f) => (f.id === editingFaq.id ? editingFaq : f)));
    }
    setEditingFaq(null);
  }

  function handleDelete(id: string) {
    if (confirm("정말 이 FAQ 항목을 삭제하시겠습니까?")) {
      setFaqs((prev) => prev.filter((f) => f.id !== id));
      if (editingFaq?.id === id) {
        setEditingFaq(null);
      }
    }
  }

  function toggleVisibility(id: string) {
    setFaqs((prev) => prev.map((f) => (f.id === id ? { ...f, visible: !f.visible } : f)));
  }

  return (
    <div
      className="space-y-4"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}
    >
      {/* ─── Top Filter Bar ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-1 min-w-[320px]">
          {/* Category Filter */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {["ALL", "RECRUITMENT", "ACTIVITY", "ETC"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer"
                style={
                  selectedCategory === cat
                    ? { background: "#ef4444", color: "#fff" }
                    : { color: "#64748b" }
                }
              >
                {cat === "ALL" ? "전체 카테고리" : CATEGORY_LABELS[cat as FaqCategory]}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="질문·답변 검색"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/60"
            />
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>

          <span className="text-xs text-muted-foreground font-mono">{filteredFaqs.length}건</span>
        </div>

        {/* Add Button */}
        <button
          onClick={handleAddNew}
          className="px-4 py-1.5 rounded-md text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
          style={{ background: "#ef4444" }}
        >
          <Plus size={13} /> 새 FAQ 등록
        </button>
      </div>

      {/* ─── FAQ Accordion List ─── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-white/5">
        {filteredFaqs.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            등록된 FAQ가 없습니다.
          </div>
        ) : (
          filteredFaqs.map((faq) => {
            const isExpanded = expandedId === faq.id;
            return (
              <div key={faq.id} className="transition-colors hover:bg-white/[0.01]">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                    <span
                      className={`w-[68px] h-[23px] rounded-md text-[11px] font-bold border shrink-0 inline-flex items-center justify-center ${CATEGORY_STYLES[faq.category]}`}
                    >
                      {CATEGORY_LABELS[faq.category]}
                    </span>
                    <span className="w-6 text-xs font-mono text-slate-400 font-semibold shrink-0">
                      #{faq.orderNum}
                    </span>
                    <p className="text-xs font-bold text-foreground truncate">{faq.question}</p>
                    {!faq.visible && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                        숨김
                      </span>
                    )}
                  </div>

                  <div
                    className="flex items-center gap-2 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => toggleVisibility(faq.id)}
                      className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground hover:text-foreground cursor-pointer"
                      title={faq.visible ? "숨기기" : "노출하기"}
                    >
                      {faq.visible ? (
                        <Eye size={13} />
                      ) : (
                        <EyeOff size={13} className="text-red-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(faq)}
                      className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="수정"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(faq.id)}
                      className="p-1.5 rounded hover:bg-slate-100 text-muted-foreground hover:text-red-400 cursor-pointer"
                      title="삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                    <div className="w-px h-3.5 bg-slate-100 mx-0.5" />
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : faq.id)}
                      className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 pb-4.5 pt-1 text-xs text-muted-foreground leading-relaxed bg-white/[0.015] border-t border-slate-100">
                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 whitespace-pre-wrap text-foreground/90">
                      {faq.answer}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground/60">
                      <span>최종 수정일: {faq.updatedAt}</span>
                      <span className="font-mono">우선순위: {faq.orderNum}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ─── Modal: FAQ Edit / Add ─── */}
      {editingFaq && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-foreground">
                {isNew ? "새 FAQ 등록" : "FAQ 항목 수정"}
              </h3>
              <button
                onClick={() => setEditingFaq(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1">카테고리</label>
                  <select
                    value={editingFaq.category}
                    onChange={(e) =>
                      setEditingFaq((prev) =>
                        prev ? { ...prev, category: e.target.value as FaqCategory } : null
                      )
                    }
                    className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground cursor-pointer"
                  >
                    <option value="RECRUITMENT" className="bg-white">
                      리크루팅 (RECRUITMENT)
                    </option>
                    <option value="ACTIVITY" className="bg-white">
                      활동 안내 (ACTIVITY)
                    </option>
                    <option value="ETC" className="bg-white">
                      기타 (ETC)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">정렬 순서</label>
                  <input
                    type="number"
                    value={editingFaq.orderNum}
                    onChange={(e) =>
                      setEditingFaq((prev) =>
                        prev ? { ...prev, orderNum: Number(e.target.value) } : null
                      )
                    }
                    className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">질문 (Question)</label>
                <input
                  value={editingFaq.question}
                  onChange={(e) =>
                    setEditingFaq((prev) => (prev ? { ...prev, question: e.target.value } : null))
                  }
                  placeholder="예: 비전공자도 지원 가능한가요?"
                  className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground font-semibold"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">답변 (Answer)</label>
                <textarea
                  value={editingFaq.answer}
                  onChange={(e) =>
                    setEditingFaq((prev) => (prev ? { ...prev, answer: e.target.value } : null))
                  }
                  placeholder="자세한 답변 내용을 작성하세요."
                  rows={5}
                  className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingFaq.visible}
                    onChange={(e) =>
                      setEditingFaq((prev) =>
                        prev ? { ...prev, visible: e.target.checked } : null
                      )
                    }
                    className="rounded accent-red-500 cursor-pointer w-4 h-4"
                  />
                  <span className="text-xs text-foreground font-medium">사이트에 노출</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setEditingFaq(null)}
                className="px-4 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-100 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-md text-xs font-bold text-white cursor-pointer hover:opacity-90"
                style={{ background: "#ef4444" }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
