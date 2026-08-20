import { useState } from "react";
import {
  Search, Plus, Quote, Trash2, Edit3, Check, X,
  User, Sparkles, ExternalLink, RefreshCw
} from "lucide-react";

export type ReviewTrack = "ANALYSIS" | "VISUALIZATION" | "ENGINEERING";

export interface ReviewItem {
  id: string;
  name: string;
  track: ReviewTrack;
  term: number;
  content: string;
  imageUrl?: string;
  createdAt: string;
}

const SAMPLE_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80",
];

const INITIAL_REVIEWS: ReviewItem[] = [
  {
    id: "rev1",
    name: "김민지",
    track: "ANALYSIS",
    term: 20,
    content: "BOAZ 활동을 통해 단순한 데이터 분석을 넘어 비즈니스 임팩트를 내는 머신러닝 파이프라인을 구축해 볼 수 있었습니다. 현업 멘토님들의 피드백과 동료들과의 밤샘 프로젝트가 큰 성장의 밑거름이 되었습니다.",
    imageUrl: SAMPLE_AVATARS[0],
    createdAt: "2026-02-15",
  },
  {
    id: "rev2",
    name: "이준혁",
    track: "ENGINEERING",
    term: 20,
    content: "대용량 스트리밍 데이터를 다루는 Kafka & Spark 파이프라인을 직접 구축하고 Kubernetes 상에 배포하는 실무 경험을 쌓았습니다. 데이터 엔지니어로서의 기초를 단단히 다질 수 있었던 최고의 동아리입니다.",
    imageUrl: SAMPLE_AVATARS[1],
    createdAt: "2026-02-18",
  },
  {
    id: "rev3",
    name: "박수진",
    track: "VISUALIZATION",
    term: 19,
    content: "D3.js와 인터랙티브 웹 시각화 프로젝트를 진행하며 데이터 저널리즘과 정보 디자인에 대한 깊은 인사이트를 얻었습니다. 컨퍼런스에서 많은 사람들에게 시각화 결과물을 선보인 경험은 잊지 못할 것입니다.",
    imageUrl: SAMPLE_AVATARS[2],
    createdAt: "2025-08-20",
  },
];

const TRACK_LABELS: Record<ReviewTrack, string> = {
  ANALYSIS: "데이터 분석",
  VISUALIZATION: "데이터 시각화",
  ENGINEERING: "데이터 엔지니어링",
};

export function ReviewsSection() {
  const [reviews, setReviews] = useState<ReviewItem[]>(INITIAL_REVIEWS);
  const [selectedTrack, setSelectedTrack] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [editingReview, setEditingReview] = useState<ReviewItem | null>(null);
  const [isNew, setIsNew] = useState(false);

  const filteredReviews = reviews.filter(r => {
    if (selectedTrack !== "ALL" && r.track !== selectedTrack) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.content.toLowerCase().includes(q);
    }
    return true;
  });

  function handleAddNew() {
    setIsNew(true);
    setEditingReview({
      id: "rev_" + Date.now(),
      name: "",
      track: "ANALYSIS",
      term: 21,
      content: "",
      imageUrl: SAMPLE_AVATARS[Math.floor(Math.random() * SAMPLE_AVATARS.length)],
      createdAt: new Date().toISOString().slice(0, 10),
    });
  }

  function handleEdit(review: ReviewItem) {
    setIsNew(false);
    setEditingReview({ ...review });
  }

  function handleSave() {
    if (!editingReview) return;
    if (!editingReview.name.trim() || !editingReview.content.trim()) {
      alert("작성자 이름과 후기 내용을 모두 입력해 주세요.");
      return;
    }
    if (isNew) {
      setReviews(prev => [editingReview, ...prev]);
    } else {
      setReviews(prev => prev.map(r => (r.id === editingReview.id ? editingReview : r)));
    }
    setEditingReview(null);
  }

  function handleDelete(id: string) {
    if (confirm("정말 이 수료자 후기를 삭제하시겠습니까?")) {
      setReviews(prev => prev.filter(r => r.id !== id));
      if (editingReview?.id === id) setEditingReview(null);
    }
  }

  return (
    <div className="space-y-4" style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}>
      {/* ─── Top Filter Bar ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-1 min-w-[320px]">
          {/* Track Filter */}
          <select
            value={selectedTrack}
            onChange={e => setSelectedTrack(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground cursor-pointer"
          >
            <option value="ALL" className="bg-white">전체 트랙</option>
            <option value="ANALYSIS" className="bg-white">데이터 분석</option>
            <option value="ENGINEERING" className="bg-white">데이터 엔지니어링</option>
            <option value="VISUALIZATION" className="bg-white">데이터 시각화</option>
          </select>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="작성자·후기 내용 검색"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/60"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>

          <span className="text-xs text-muted-foreground font-mono">
            {filteredReviews.length}건
          </span>
        </div>

        {/* Add Button */}
        <button
          onClick={handleAddNew}
          className="px-4 py-1.5 rounded-md text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
          style={{ background: "#ef4444" }}
        >
          <Plus size={13} /> 새 후기 등록
        </button>
      </div>

      {/* ─── Review Cards Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReviews.map(review => (
          <div
            key={review.id}
            className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img
                    src={review.imageUrl || SAMPLE_AVATARS[0]}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>{review.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono font-normal">
                        ({review.term}기)
                      </span>
                    </p>
                    <span className="text-[10px] text-[#8ba5ff] font-medium">
                      {TRACK_LABELS[review.track]}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(review)}
                    className="p-1 rounded hover:bg-slate-100 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="수정"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(review.id)}
                    className="p-1 rounded hover:bg-slate-100 text-muted-foreground hover:text-red-400 cursor-pointer"
                    title="삭제"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="relative pl-3 border-l-2 border-red-500/50">
                <p className="text-xs text-muted-foreground/90 leading-relaxed line-clamp-4">
                  "{review.content}"
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-muted-foreground/60 font-mono">
              <span>POST /api/v1/admin/reviews</span>
              <span>{review.createdAt}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Modal: Edit / Add Review ─── */}
      {editingReview && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-foreground">
                {isNew ? "새 수료자 후기 등록" : "수료자 후기 수정"}
              </h3>
              <button onClick={() => setEditingReview(null)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1">작성자 이름 (name) *</label>
                  <input
                    value={editingReview.name}
                    onChange={e => setEditingReview(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                    placeholder="예: 홍길동"
                    className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground font-semibold"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">수료 기수 (term) *</label>
                  <input
                    type="number"
                    value={editingReview.term}
                    onChange={e => setEditingReview(prev => prev ? ({ ...prev, term: Number(e.target.value) }) : null)}
                    className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">트랙 (track) *</label>
                <select
                  value={editingReview.track}
                  onChange={e => setEditingReview(prev => prev ? ({ ...prev, track: e.target.value as ReviewTrack }) : null)}
                  className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground cursor-pointer"
                >
                  <option value="ANALYSIS" className="bg-white">ANALYSIS (데이터 분석)</option>
                  <option value="ENGINEERING" className="bg-white">ENGINEERING (데이터 엔지니어링)</option>
                  <option value="VISUALIZATION" className="bg-white">VISUALIZATION (데이터 시각화)</option>
                </select>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">프로필 이미지 URL (imageUrl, 선택)</label>
                <div className="flex gap-2 items-center">
                  <input
                    value={editingReview.imageUrl ?? ""}
                    onChange={e => setEditingReview(prev => prev ? ({ ...prev, imageUrl: e.target.value }) : null)}
                    placeholder="https://..."
                    className="flex-1 px-3 py-1.5 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingReview(prev => prev ? ({ ...prev, imageUrl: SAMPLE_AVATARS[Math.floor(Math.random() * SAMPLE_AVATARS.length)] }) : null)}
                    className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-100 text-muted-foreground hover:text-foreground text-[11px] border border-slate-200 shrink-0 cursor-pointer"
                  >
                    샘플 이미지
                  </button>
                </div>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">후기 내용 (content) *</label>
                <textarea
                  value={editingReview.content}
                  onChange={e => setEditingReview(prev => prev ? ({ ...prev, content: e.target.value }) : null)}
                  placeholder="활동 소감 및 성장 경험을 작성하세요."
                  rows={4}
                  className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground resize-none leading-relaxed"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setEditingReview(null)}
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
