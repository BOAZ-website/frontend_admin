import { useEffect, useRef, useState } from "react";
import {
  Code,
  ExternalLink,
  FileJson,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from "lucide-react";

export type ArchiveType = "project" | "blog" | "photo";
export type TrackType = "ALL" | "ANALYSIS" | "ENGINEERING" | "VISUALIZATION";

// 백엔드 ArchiveCreateRequest / ArchiveUpdateRequest 스펙 완벽 일치
export interface ArchiveItem {
  id: string;
  type: ArchiveType;
  title: string;
  teamName?: string; // 백엔드 DTO: teamName (선택)
  term: number; // 백엔드 DTO: term (필수)
  track: TrackType; // 백엔드 DTO: track (필수)
  contentDate: string; // 백엔드 DTO: contentDate (LocalDate yyyy-MM-dd, 필수)
  half?: string; // 백엔드 DTO: half (선택)
  links: Record<string, string>; // 백엔드 DTO: links (JSON String, 필수)
  imageUrl?: string; // 서버 S3 업로드 URL
  imageFile?: File | null; // multipart/form-data 전송용 파일 객체
  visible: boolean;
}

const SAMPLE_PROJECT_IMAGES = [
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
];

const INITIAL_ARCHIVE_DATA: ArchiveItem[] = [
  {
    id: "p1",
    type: "project",
    title: "배달앱 리뷰 텍스트로 매장 이탈 예측",
    teamName: "리뷰읽는사람들",
    term: 21,
    contentDate: "2026-07-28",
    track: "ANALYSIS",
    imageUrl: SAMPLE_PROJECT_IMAGES[0],
    visible: true,
    links: {
      github: "https://github.com/boaz-analysis/delivery-churn",
      slideshare: "https://slideshare.net/boaz/delivery-churn",
    },
  },
  {
    id: "p2",
    type: "project",
    title: "서울시 따릉이 재배치 시뮬레이션",
    teamName: "따릉이연구소",
    term: 21,
    contentDate: "2026-07-28",
    track: "ENGINEERING",
    imageUrl: SAMPLE_PROJECT_IMAGES[1],
    visible: true,
    links: { github: "https://github.com/boaz-eng/ttareungi-sim" },
  },
  {
    id: "p3",
    type: "project",
    title: "공모전 수상작 다시 보기 대시보드",
    teamName: "VizLab",
    term: 20,
    contentDate: "2026-01-20",
    track: "VISUALIZATION",
    imageUrl: SAMPLE_PROJECT_IMAGES[2],
    visible: true,
    links: {
      slideshare: "https://slideshare.net/boaz/viz-awards",
      web: "https://vizlab.boaz.com",
    },
  },
  {
    id: "p4",
    type: "project",
    title: "중고거래 사기 탐지 모델",
    teamName: "중고나라조심",
    term: 20,
    contentDate: "2026-01-20",
    track: "ANALYSIS",
    imageUrl: SAMPLE_PROJECT_IMAGES[3],
    visible: true,
    links: {
      github: "https://github.com/boaz-analysis/fraud-detect",
      slideshare: "https://slideshare.net/boaz/fraud-detect",
    },
  },
  {
    id: "p5",
    type: "project",
    title: "실시간 지하철 혼잡도 파이프라인",
    teamName: "8호선지옥철",
    term: 20,
    contentDate: "2026-01-20",
    track: "ENGINEERING",
    imageUrl: SAMPLE_PROJECT_IMAGES[4],
    visible: false,
    links: { github: "https://github.com/boaz-eng/subway-realtime" },
  },
  {
    id: "p6",
    type: "project",
    title: "뉴스 프레임 비교 시각화",
    teamName: "프레임워치",
    term: 19,
    contentDate: "2025-07-15",
    track: "VISUALIZATION",
    imageUrl: SAMPLE_PROJECT_IMAGES[5],
    visible: true,
    links: { web: "https://framewatch.boaz.com" },
  },
  {
    id: "p7",
    type: "project",
    title: "카드 소비 데이터 상권 분석",
    teamName: "골목상권팀",
    term: 19,
    contentDate: "2025-07-15",
    track: "ANALYSIS",
    imageUrl: SAMPLE_PROJECT_IMAGES[0],
    visible: true,
    links: {
      github: "https://github.com/boaz-analysis/card-consumption",
      slideshare: "https://slideshare.net/boaz/card-consumption",
    },
  },
  {
    id: "p8",
    type: "project",
    title: "음식점 리뷰 요약 LLM 파이프라인",
    teamName: "요약해줘",
    term: 19,
    contentDate: "2025-07-15",
    track: "ENGINEERING",
    imageUrl: SAMPLE_PROJECT_IMAGES[1],
    visible: true,
    links: { github: "https://github.com/boaz-eng/review-llm" },
  },
  // Tech Blogs
  {
    id: "b1",
    type: "blog",
    title: "Kubernetes와 Airflow를 활용한 대용량 배치 처리 아키텍처",
    teamName: "김도현",
    term: 21,
    contentDate: "2026-06-12",
    track: "ENGINEERING",
    imageUrl: SAMPLE_PROJECT_IMAGES[4],
    visible: true,
    links: {
      medium: "https://medium.com/boaz/k8s-airflow-batch",
      github: "https://github.com/boaz-eng",
    },
  },
  {
    id: "b2",
    type: "blog",
    title: "TabNet과 LightGBM 성능 비교 실험기",
    teamName: "박서연",
    term: 21,
    contentDate: "2026-05-30",
    track: "ANALYSIS",
    imageUrl: SAMPLE_PROJECT_IMAGES[0],
    visible: true,
    links: { medium: "https://medium.com/boaz/tabnet-vs-lightgbm" },
  },
  {
    id: "b3",
    type: "blog",
    title: "D3.js로 인터랙티브 네트워크 그래프 만들기",
    teamName: "최지우",
    term: 20,
    contentDate: "2025-11-18",
    track: "VISUALIZATION",
    imageUrl: SAMPLE_PROJECT_IMAGES[2],
    visible: true,
    links: {
      medium: "https://medium.com/boaz/d3-network-graph",
      web: "https://d3-demo.boaz.com",
    },
  },
  // Photos
  {
    id: "ph1",
    type: "photo",
    title: "제21기 BOAZ 컨퍼런스 & 홈커밍데이 현장",
    teamName: "서비스운영팀",
    term: 21,
    contentDate: "2026-07-28",
    track: "ALL",
    imageUrl:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80",
    visible: true,
    links: { instagram: "https://instagram.com/p/boaz_conf21" },
    half: "21-1",
  },
  {
    id: "ph2",
    type: "photo",
    title: "2026 여름 MT 및 네트워킹 나이트",
    teamName: "운영지원팀",
    term: 21,
    contentDate: "2026-08-05",
    track: "ALL",
    imageUrl:
      "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&auto=format&fit=crop&q=80",
    visible: true,
    links: { instagram: "https://instagram.com/p/boaz_summer26" },
    half: "21-1",
  },
];

const TRACK_LABELS: Record<TrackType, string> = {
  ALL: "전체",
  ANALYSIS: "분석",
  ENGINEERING: "엔지니어링",
  VISUALIZATION: "시각화",
};

const LINK_LABELS: Record<string, string> = {
  github: "GitHub",
  slideshare: "발표 자료",
  web: "서비스",
  medium: "게시글",
  instagram: "Instagram",
};

export function ArchivingSection() {
  const [activeTab, setActiveTab] = useState<ArchiveType>("project");
  const [items, setItems] = useState<ArchiveItem[]>(INITIAL_ARCHIVE_DATA);
  const [selectedTrack, setSelectedTrack] = useState<string>("ALL");
  const [selectedTerm, setSelectedTerm] = useState<string>("ALL");
  const [selectedVisibility, setSelectedVisibility] = useState("ALL");
  const [selectedHalf, setSelectedHalf] = useState("ALL");
  const [selectedOwner, setSelectedOwner] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("p1");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showPayloadModal, setShowPayloadModal] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<ArchiveItem | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [toast, setToast] = useState<string | null>(null);
  const [visibilityUndo, setVisibilityUndo] = useState<{
    id: string;
    visible: boolean;
  } | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Edit form state
  const [editForm, setEditForm] = useState<ArchiveItem>(
    INITIAL_ARCHIVE_DATA[0],
  );
  const [initialForm, setInitialForm] = useState<ArchiveItem>(
    INITIAL_ARCHIVE_DATA[0],
  );
  const [isNew, setIsNew] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Endpoint mapping
  const endpointMap: Record<ArchiveType, string> = {
    project: "/api/v1/admin/archiving/projects",
    blog: "/api/v1/admin/archiving/blogs",
    photo: "/api/v1/admin/archiving/activities",
  };

  const filteredItems = items.filter((item) => {
    if (item.type !== activeTab) {
      return false;
    }
    if (selectedTrack !== "ALL" && item.track !== selectedTrack) {
      return false;
    }
    if (selectedTerm !== "ALL" && item.term.toString() !== selectedTerm) {
      return false;
    }
    if (
      selectedVisibility !== "ALL" &&
      item.visible !== (selectedVisibility === "VISIBLE")
    ) {
      return false;
    }
    if (
      activeTab === "photo" &&
      selectedHalf !== "ALL" &&
      item.half !== selectedHalf
    ) {
      return false;
    }
    if (
      activeTab === "blog" &&
      selectedOwner !== "ALL" &&
      item.teamName !== selectedOwner
    ) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        (item.teamName ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const paginatedItems = filteredItems.slice(pageStart, pageStart + pageSize);
  const isDirty = JSON.stringify(editForm) !== JSON.stringify(initialForm);

  function showToast(message: string) {
    setToast(message);
  }

  function handleOpenDetail(item: ArchiveItem) {
    setDetailItem(item);
  }

  function handleOpenEditor(item: ArchiveItem) {
    setDetailItem(null);
    setIsNew(false);
    setSelectedId(item.id);
    const form = { ...item, links: { ...item.links } };
    setEditForm(form);
    setInitialForm(form);
    setFormErrors({});
    setIsEditorOpen(true);
  }

  function handleNewItem() {
    setIsNew(true);
    setIsEditorOpen(true);
    const newItem: ArchiveItem = {
      id: "item_" + Date.now(),
      type: activeTab,
      title: "",
      teamName: "",
      term: 21,
      contentDate: new Date().toISOString().slice(0, 10),
      track: activeTab === "photo" ? "ALL" : "ANALYSIS",
      imageUrl: "",
      imageFile: null,
      visible: true,
      links: {},
      half: "21-1",
    };
    setEditForm(newItem);
    setInitialForm(newItem);
    setFormErrors({});
  }

  function handleCloseEditor() {
    if (isDirty && !confirm("변경사항을 저장하지 않고 닫을까요?")) {
      return;
    }
    if (isNew) {
      const previouslySelected = items.find((item) => item.id === selectedId);
      const fallbackItem = items.find((item) => item.type === activeTab);
      const itemToRestore = previouslySelected ?? fallbackItem;

      if (itemToRestore) {
        setSelectedId(itemToRestore.id);
        setEditForm({ ...itemToRestore, links: { ...itemToRestore.links } });
      }
    }
    setIsNew(false);
    setIsEditorOpen(false);
    setFormErrors({});
  }

  function handleTabChange(tab: ArchiveType) {
    setActiveTab(tab);
    setIsEditorOpen(false);
    setDetailItem(null);
    setSelectedTrack("ALL");
    setSelectedTerm("ALL");
    setSelectedVisibility("ALL");
    setSelectedHalf("ALL");
    setSelectedOwner("ALL");
    setSearchQuery("");
    setPage(1);
    const firstOfTab = items.find((i) => i.type === tab);
    if (firstOfTab) {
      setIsNew(false);
      setSelectedId(firstOfTab.id);
      const form = { ...firstOfTab, links: { ...firstOfTab.links } };
      setEditForm(form);
      setInitialForm(form);
    } else {
      handleNewItem();
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const url = URL.createObjectURL(file);
    setEditForm((prev) => ({ ...prev, imageUrl: url, imageFile: file }));
  }

  // 백엔드 ArchiveCreateRequest JSON 페이로드 생성
  function buildBackendPayload() {
    const dataPart = {
      term: Number(editForm.term),
      title: editForm.title,
      teamName: editForm.teamName || null,
      track: editForm.track,
      links: JSON.stringify(editForm.links),
      contentDate: editForm.contentDate,
      ...(activeTab === "photo" ? { half: editForm.half || "21-1" } : {}),
    };
    return {
      endpoint: isNew
        ? `POST ${endpointMap[activeTab]}`
        : `PATCH ${endpointMap[activeTab]}/${editForm.id}`,
      contentType: "multipart/form-data",
      parts: {
        data: dataPart,
        image: editForm.imageFile
          ? `[File: ${editForm.imageFile.name}, size: ${editForm.imageFile.size} bytes]`
          : editForm.imageUrl
            ? `[Preserved URL: ${editForm.imageUrl}]`
            : "null (생략)",
      },
    };
  }

  function handleSave() {
    const errors: Record<string, string> = {};
    if (!editForm.title.trim()) {
      errors.title = `${currentFieldLabels.title}을 입력해 주세요.`;
    }
    if (!editForm.term || editForm.term <= 0) {
      errors.term = "기수는 1 이상의 숫자로 입력해 주세요.";
    }
    if (!editForm.contentDate) {
      errors.contentDate = `${currentFieldLabels.date}을 선택해 주세요.`;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (editForm.contentDate > today) {
      errors.contentDate = "오늘 또는 이전 날짜만 선택할 수 있습니다.";
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    if (isNew) {
      setItems((prev) => [editForm, ...prev]);
      setIsNew(false);
      setSelectedId(editForm.id);
    } else {
      setItems((prev) =>
        prev.map((i) => (i.id === editForm.id ? editForm : i)),
      );
    }
    setIsEditorOpen(false);
    setVisibilityUndo(null);
    showToast(`${tabLabels[activeTab]}가 저장되었습니다.`);
  }

  function handleDelete() {
    if (confirm(`정말 이 ${tabLabels[activeTab]}를 삭제하시겠습니까?`)) {
      setItems((prev) => prev.filter((i) => i.id !== editForm.id));
      const remaining = items.filter(
        (i) => i.id !== editForm.id && i.type === activeTab,
      );
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id);
        setEditForm({ ...remaining[0], links: { ...remaining[0].links } });
      } else {
        setSelectedId("");
      }
      setIsEditorOpen(false);
      setVisibilityUndo(null);
      showToast(`${tabLabels[activeTab]}가 삭제되었습니다.`);
    }
  }

  function handleToggleVisibility(item: ArchiveItem) {
    setItems((prev) =>
      prev.map((current) =>
        current.id === item.id
          ? { ...current, visible: !current.visible }
          : current,
      ),
    );
    setVisibilityUndo({ id: item.id, visible: item.visible });
    showToast(
      `${item.title}이(가) ${item.visible ? "숨김" : "노출"} 상태로 변경되었습니다.`,
    );
  }

  function handleUndoVisibility() {
    if (!visibilityUndo) {
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === visibilityUndo.id
          ? { ...item, visible: visibilityUndo.visible }
          : item,
      ),
    );
    setVisibilityUndo(null);
    showToast("노출 상태 변경을 되돌렸습니다.");
  }

  const tabLabels: Record<ArchiveType, string> = {
    project: "프로젝트",
    blog: "기술블로그",
    photo: "활동사진",
  };

  const fieldLabels: Record<
    ArchiveType,
    { title: string; owner: string; ownerPlaceholder: string; date: string }
  > = {
    project: {
      title: "프로젝트명",
      owner: "팀명",
      ownerPlaceholder: "예: 리뷰읽는사람들",
      date: "발표일",
    },
    blog: {
      title: "글 제목",
      owner: "작성자",
      ownerPlaceholder: "예: 홍길동",
      date: "게시일",
    },
    photo: {
      title: "행사명",
      owner: "담당 조직",
      ownerPlaceholder: "예: 서비스운영팀",
      date: "촬영일",
    },
  };

  const currentFieldLabels = fieldLabels[activeTab];

  useEffect(() => {
    if (!isEditorOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleCloseEditor();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isEditorOpen, isNew, selectedId, activeTab, items]);

  useEffect(() => {
    if (!detailItem) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDetailItem(null);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [detailItem]);

  useEffect(() => {
    setPage(1);
  }, [
    selectedTrack,
    selectedTerm,
    selectedVisibility,
    selectedHalf,
    selectedOwner,
    searchQuery,
  ]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToast(null);
      setVisibilityUndo(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const searchPlaceholder: Record<ArchiveType, string> = {
    project: "프로젝트명 또는 팀명 검색",
    blog: "글 제목 또는 작성자 검색",
    photo: "행사명 또는 담당 조직 검색",
  };

  return (
    <div
      className="space-y-4"
      style={{
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, sans-serif",
      }}
    >
      {/* ─── Top Tabs (프로젝트 | 기술블로그 | 활동사진) ─── */}
      <div className="flex items-center justify-between border-b border-slate-200 px-1">
        <div className="flex items-center gap-8">
          {(["project", "blog", "photo"] as ArchiveType[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className="pb-3 text-sm font-semibold relative transition-colors cursor-pointer"
                style={{
                  color: isActive ? "#0f172a" : "#64748b",
                }}
              >
                {tabLabels[tab]}
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: "#2563eb" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Backend API Debug Toggle */}
        {import.meta.env.DEV && (
          <button
            onClick={() => setShowPayloadModal(true)}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 pb-2 cursor-pointer font-mono"
          >
            <Code size={13} className="text-[#8ba5ff]" />
            <span>데이터 상세 보기</span>
          </button>
        )}
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-[320px]">
          {activeTab !== "photo" && (
            <select
              value={selectedTrack}
              onChange={(e) => setSelectedTrack(e.target.value)}
              aria-label="트랙 필터"
              className="px-3 py-1.5 text-xs rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground cursor-pointer"
            >
              <option value="ALL">전체 트랙</option>
              <option value="ANALYSIS">분석</option>
              <option value="ENGINEERING">엔지니어링</option>
              <option value="VISUALIZATION">시각화</option>
            </select>
          )}

          {/* Term Filter */}
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            aria-label="기수 필터"
            className="px-3 py-1.5 text-xs rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground cursor-pointer"
          >
            <option value="ALL" className="bg-white">
              전체 기수
            </option>
            <option value="21" className="bg-white">
              21기
            </option>
            <option value="20" className="bg-white">
              20기
            </option>
            <option value="19" className="bg-white">
              19기
            </option>
            <option value="18" className="bg-white">
              18기
            </option>
          </select>

          {activeTab === "blog" && (
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              aria-label="작성자 필터"
              className="px-3 py-1.5 text-xs rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground cursor-pointer"
            >
              <option value="ALL">전체 작성자</option>
              {Array.from(
                new Set(
                  items
                    .filter((item) => item.type === "blog" && item.teamName)
                    .map((item) => item.teamName as string),
                ),
              ).map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          )}

          {activeTab === "photo" && (
            <select
              value={selectedHalf}
              onChange={(e) => setSelectedHalf(e.target.value)}
              aria-label="활동 반기 필터"
              className="px-3 py-1.5 text-xs rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground cursor-pointer"
            >
              <option value="ALL">전체 반기</option>
              <option value="21-1">21-1</option>
              <option value="21-2">21-2</option>
            </select>
          )}

          <select
            value={selectedVisibility}
            onChange={(e) => setSelectedVisibility(e.target.value)}
            aria-label="노출 상태 필터"
            className="px-3 py-1.5 text-xs rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground cursor-pointer"
          >
            <option value="ALL">전체 상태</option>
            <option value="VISIBLE">노출 중</option>
            <option value="HIDDEN">숨김</option>
          </select>

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder[activeTab]}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/60"
            />
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>

          <span className="text-xs text-muted-foreground">
            총 {filteredItems.length}건
          </span>
        </div>

        {/* New Item Button */}
        <button
          onClick={handleNewItem}
          className="px-4 py-2 rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
        >
          <Plus size={14} /> 새 {tabLabels[activeTab]}
        </button>
      </div>

      {/* ─── Full-width archive list ─── */}
      <div className="grid grid-cols-12 gap-5 items-start">
        <div className="col-span-12 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="text-left px-5 py-3.5 font-semibold text-muted-foreground w-24">
                    이미지
                  </th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground">
                    {tabLabels[activeTab]} 정보
                  </th>
                  <th className="text-center px-4 py-3.5 font-semibold text-muted-foreground w-24">
                    기수
                  </th>
                  <th className="text-center px-4 py-3.5 font-semibold text-muted-foreground w-32">
                    트랙
                  </th>
                  <th className="text-left px-4 py-3.5 font-semibold text-muted-foreground w-64">
                    관련 링크
                  </th>
                  <th className="text-center px-5 py-3.5 font-semibold text-muted-foreground w-28">
                    노출 상태
                  </th>
                  <th className="w-24 min-w-24 px-4 py-3.5 text-center font-semibold text-muted-foreground">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-12 text-xs text-muted-foreground"
                    >
                      조건에 맞는 아카이빙 항목이 없습니다.
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const linksList = Object.keys(item.links).filter(
                      (k) => !!item.links[k],
                    );

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleOpenDetail(item)}
                        className="transition-colors cursor-pointer group relative hover:bg-blue-50/60"
                        style={{ borderLeft: "3px solid transparent" }}
                      >
                        {/* 16:9 Thumbnail */}
                        <td className="px-5 py-3.5">
                          <div className="w-16 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center relative">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-[9px] text-muted-foreground font-mono">
                                16:9
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Title & Team/Author */}
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-slate-900 transition-colors line-clamp-1">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-500 mt-1 font-normal">
                            {item.teamName || "—"}
                          </p>
                        </td>

                        {/* Term */}
                        <td className="px-4 py-3.5 text-center text-slate-700 font-semibold">
                          {item.term}기
                        </td>

                        {/* Track */}
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                            {TRACK_LABELS[item.track]}
                          </span>
                        </td>

                        {/* Links */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {linksList.length > 0 ? (
                              linksList.map((link) => (
                                <span
                                  key={link}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600"
                                >
                                  {LINK_LABELS[link] ?? link}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">
                                등록된 링크 없음
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Visibility */}
                        <td className="min-w-24 px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleToggleVisibility(item);
                            }}
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${item.visible ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                            aria-label={`${item.title} 노출 상태 변경`}
                          >
                            {item.visible ? "노출 중" : "숨김"}
                          </button>
                        </td>

                        <td className="min-w-24 px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenEditor(item);
                            }}
                            className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
                            aria-label={`${item.title} 수정`}
                          >
                            <Pencil size={12} /> 수정
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>
                총 {filteredItems.length}개 중{" "}
                {filteredItems.length === 0 ? 0 : pageStart + 1}–
                {Math.min(pageStart + pageSize, filteredItems.length)}개 표시
              </span>
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                aria-label="페이지당 표시 개수"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"
              >
                <option value="5">5개씩</option>
                <option value="10">10개씩</option>
                <option value="20">20개씩</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-foreground border border-slate-200 text-xs font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                이전
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (pageNumber) => (
                  <button
                    key={pageNumber}
                    onClick={() => setPage(pageNumber)}
                    aria-current={
                      currentPage === pageNumber ? "page" : undefined
                    }
                    className={`h-7 min-w-7 rounded border px-2 text-xs font-semibold cursor-pointer ${currentPage === pageNumber ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"}`}
                  >
                    {pageNumber}
                  </button>
                ),
              )}
              <button
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded bg-white hover:bg-slate-100 text-foreground border border-slate-200 text-xs font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                다음
              </button>
            </div>
          </div>
        </div>

        {/* Read-only item detail modal */}
        {detailItem && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-[3px]"
              onClick={() => setDetailItem(null)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${tabLabels[activeTab]} 세부정보`}
              className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-2xl max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                <div className="min-w-0 pr-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                      {tabLabels[detailItem.type]}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${detailItem.visible ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {detailItem.visible ? "노출 중" : "숨김"}
                    </span>
                  </div>
                  <h3 className="truncate text-lg font-bold text-slate-900">
                    {detailItem.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {detailItem.teamName ||
                      `${currentFieldLabels.owner} 정보 없음`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                  aria-label="세부정보 창 닫기"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-6 py-5">
                {detailItem.imageUrl ? (
                  <button
                    type="button"
                    onClick={() => setLightboxUrl(detailItem.imageUrl || null)}
                    className="group relative mb-6 block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 cursor-zoom-in"
                  >
                    <img
                      src={detailItem.imageUrl}
                      alt={`${detailItem.title} 대표 이미지`}
                      className="h-56 w-full object-cover"
                    />
                    <span className="absolute bottom-3 right-3 rounded-lg bg-slate-950/70 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      크게 보기
                    </span>
                  </button>
                ) : (
                  <div className="mb-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                    등록된 대표 이미지가 없습니다.
                  </div>
                )}

                <section>
                  <h4 className="mb-3 text-xs font-bold text-slate-900">
                    기본 정보
                  </h4>
                  <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 md:grid-cols-3">
                    <div className="border-b border-r border-slate-200 p-4 md:border-b-0">
                      <dt className="text-[11px] font-medium text-slate-400">
                        기수
                      </dt>
                      <dd className="mt-1.5 text-sm font-semibold text-slate-800">
                        {detailItem.term}기
                      </dd>
                    </div>
                    <div className="border-b border-slate-200 p-4 md:border-b-0 md:border-r">
                      <dt className="text-[11px] font-medium text-slate-400">
                        트랙
                      </dt>
                      <dd className="mt-1.5 text-sm font-semibold text-slate-800">
                        {TRACK_LABELS[detailItem.track]}
                      </dd>
                    </div>
                    <div className="col-span-2 p-4 md:col-span-1">
                      <dt className="text-[11px] font-medium text-slate-400">
                        {currentFieldLabels.date}
                      </dt>
                      <dd className="mt-1.5 text-sm font-semibold text-slate-800">
                        {new Date(
                          `${detailItem.contentDate}T00:00:00`,
                        ).toLocaleDateString("ko-KR")}
                      </dd>
                    </div>
                    {detailItem.type === "photo" && (
                      <div className="col-span-2 border-t border-slate-200 p-4 md:col-span-3">
                        <dt className="text-[11px] font-medium text-slate-400">
                          활동 반기
                        </dt>
                        <dd className="mt-1.5 text-sm font-semibold text-slate-800">
                          {detailItem.half || "—"}
                        </dd>
                      </div>
                    )}
                  </dl>
                </section>

                <section className="mt-6">
                  <h4 className="mb-3 text-xs font-bold text-slate-900">
                    관련 링크
                  </h4>
                  {Object.entries(detailItem.links).filter(([, url]) =>
                    Boolean(url),
                  ).length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(detailItem.links)
                        .filter(([, url]) => Boolean(url))
                        .map(([type, url]) => (
                          <a
                            key={type}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            {LINK_LABELS[type] ?? type}{" "}
                            <ExternalLink size={12} />
                          </a>
                        ))}
                    </div>
                  ) : (
                    <p className="rounded-xl bg-slate-50 px-4 py-5 text-center text-xs text-slate-400">
                      등록된 관련 링크가 없습니다.
                    </p>
                  )}
                </section>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenEditor(detailItem)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700 cursor-pointer"
                >
                  <Pencil size={13} /> 수정
                </button>
              </div>
            </div>
          </>
        )}

        {/* New and existing item editor modal */}
        {isEditorOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-[3px]"
              onClick={handleCloseEditor}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`${tabLabels[activeTab]} ${isNew ? "추가" : "수정"}`}
              className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-3xl max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {isNew
                      ? `새 ${tabLabels[activeTab]} 등록`
                      : `${tabLabels[activeTab]} 수정`}
                  </h3>
                  <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                    {isNew
                      ? `사이트에 게시할 ${tabLabels[activeTab]} 정보를 입력해 주세요.`
                      : editForm.title}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCloseEditor}
                    className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground cursor-pointer"
                    aria-label="편집 창 닫기"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="grid flex-1 grid-cols-1 items-start gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />

                {/* 16:9 Image Upload Area */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">
                      대표 이미지
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      권장 비율 16:9 · JPG, PNG
                    </span>
                  </div>
                  {editForm.imageUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                      <img
                        src={editForm.imageUrl}
                        alt="대표 이미지 미리보기"
                        className={`w-full object-cover ${isNew ? "h-52" : "h-36"}`}
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() =>
                            setLightboxUrl(editForm.imageUrl || null)
                          }
                          className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs"
                          title="확대 보기"
                        >
                          <ZoomIn size={14} />
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs"
                          title="사진 변경"
                        >
                          <RefreshCw size={14} />
                        </button>
                        <button
                          onClick={() =>
                            setEditForm((prev) => ({
                              ...prev,
                              imageUrl: "",
                              imageFile: null,
                            }))
                          }
                          className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white text-xs"
                          title="사진 삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-full rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${isNew ? "h-52" : "h-36"}`}
                    >
                      <Upload size={18} className="text-muted-foreground" />
                      <p className="text-xs font-medium text-foreground">
                        클릭하여 이미지 업로드
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        목록과 상세 화면의 대표 이미지로 사용됩니다.
                      </p>
                    </div>
                  )}
                </div>

                {/* Form Fields */}
                <div className="space-y-4 text-xs">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-foreground">
                      기본 정보
                    </h4>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                  {/* Title (필수) */}
                  <div>
                    <label className="text-muted-foreground block mb-1">
                      {currentFieldLabels.title}{" "}
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input
                      value={editForm.title}
                      onChange={(e) => (
                        setEditForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        })),
                        setFormErrors((prev) => ({ ...prev, title: "" }))
                      )}
                      placeholder={`${currentFieldLabels.title}을 입력해 주세요`}
                      className={`w-full px-3 py-2 rounded-md outline-none bg-slate-100 border text-foreground placeholder:text-muted-foreground/50 font-medium ${formErrors.title ? "border-red-400" : "border-slate-200"}`}
                    />
                    {formErrors.title && (
                      <p className="mt-1 text-[11px] text-red-600">
                        {formErrors.title}
                      </p>
                    )}
                  </div>

                  {/* Owner (선택) */}
                  <div>
                    <label className="text-muted-foreground block mb-1">
                      {currentFieldLabels.owner}
                    </label>
                    <input
                      value={editForm.teamName ?? ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          teamName: e.target.value,
                        }))
                      }
                      placeholder={currentFieldLabels.ownerPlaceholder}
                      className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50"
                    />
                  </div>

                  {/* Term & ContentDate */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-muted-foreground block mb-1">
                        기수 <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="number"
                        value={editForm.term}
                        onChange={(e) => (
                          setEditForm((prev) => ({
                            ...prev,
                            term: Number(e.target.value),
                          })),
                          setFormErrors((prev) => ({ ...prev, term: "" }))
                        )}
                        className={`w-full px-3 py-2 rounded-md outline-none bg-slate-100 border text-foreground font-mono ${formErrors.term ? "border-red-400" : "border-slate-200"}`}
                      />
                      {formErrors.term && (
                        <p className="mt-1 text-[11px] text-red-600">
                          {formErrors.term}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-muted-foreground block mb-1">
                        {currentFieldLabels.date}{" "}
                        <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        type="date"
                        value={editForm.contentDate}
                        onChange={(e) => (
                          setEditForm((prev) => ({
                            ...prev,
                            contentDate: e.target.value,
                          })),
                          setFormErrors((prev) => ({
                            ...prev,
                            contentDate: "",
                          }))
                        )}
                        max={new Date().toISOString().slice(0, 10)}
                        className={`w-full px-3 py-2 rounded-md outline-none bg-slate-100 border text-foreground font-mono ${formErrors.contentDate ? "border-red-400" : "border-slate-200"}`}
                      />
                      {formErrors.contentDate && (
                        <p className="mt-1 text-[11px] text-red-600">
                          {formErrors.contentDate}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Track */}
                  <div>
                    <label className="text-muted-foreground block mb-1">
                      트랙 <span className="text-red-500 font-bold">*</span>
                    </label>
                    <select
                      value={editForm.track}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          track: e.target.value as TrackType,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground cursor-pointer"
                    >
                      <option value="ANALYSIS" className="bg-white">
                        데이터 분석
                      </option>
                      <option value="ENGINEERING" className="bg-white">
                        데이터 엔지니어링
                      </option>
                      <option value="VISUALIZATION" className="bg-white">
                        데이터 시각화
                      </option>
                      <option value="ALL" className="bg-white">
                        공통 / 전 부문
                      </option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <h4 className="text-xs font-bold text-foreground">
                      관련 링크
                    </h4>
                    <span className="text-[11px] text-muted-foreground">
                      선택 입력
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>

                  {/* Links based on tab */}
                  {activeTab === "project" && (
                    <>
                      <div>
                        <label className="text-muted-foreground block mb-1">
                          GitHub 링크
                        </label>
                        <input
                          value={editForm.links.github ?? ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              links: { ...prev.links, github: e.target.value },
                            }))
                          }
                          placeholder="https://github.com/..."
                          className="w-full px-3 py-1.5 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50 font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-muted-foreground block mb-1">
                          발표 자료 링크
                        </label>
                        <input
                          value={editForm.links.slideshare ?? ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              links: {
                                ...prev.links,
                                slideshare: e.target.value,
                              },
                            }))
                          }
                          placeholder="https://slideshare.net/..."
                          className="w-full px-3 py-1.5 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50 font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-muted-foreground block mb-1">
                          서비스 링크
                        </label>
                        <input
                          value={editForm.links.web ?? ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              links: { ...prev.links, web: e.target.value },
                            }))
                          }
                          placeholder="https://..."
                          className="w-full px-3 py-1.5 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50 font-mono text-[11px]"
                        />
                      </div>
                    </>
                  )}

                  {activeTab === "blog" && (
                    <>
                      <div>
                        <label className="text-muted-foreground block mb-1">
                          게시글 링크
                        </label>
                        <input
                          value={editForm.links.medium ?? ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              links: { ...prev.links, medium: e.target.value },
                            }))
                          }
                          placeholder="https://medium.com/boaz/..."
                          className="w-full px-3 py-1.5 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50 font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-muted-foreground block mb-1">
                          GitHub 링크
                        </label>
                        <input
                          value={editForm.links.github ?? ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              links: { ...prev.links, github: e.target.value },
                            }))
                          }
                          placeholder="https://github.com/..."
                          className="w-full px-3 py-1.5 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50 font-mono text-[11px]"
                        />
                      </div>
                    </>
                  )}

                  {activeTab === "photo" && (
                    <>
                      <div>
                        <label className="text-muted-foreground block mb-1">
                          Instagram 링크
                        </label>
                        <input
                          value={editForm.links.instagram ?? ""}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              links: {
                                ...prev.links,
                                instagram: e.target.value,
                              },
                            }))
                          }
                          placeholder="https://instagram.com/p/..."
                          className="w-full px-3 py-1.5 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50 font-mono text-[11px]"
                        />
                      </div>
                      <div>
                        <label className="text-muted-foreground block mb-1">
                          활동 반기
                        </label>
                        <input
                          value={editForm.half ?? "21-1"}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              half: e.target.value,
                            }))
                          }
                          placeholder="예: 21-1, 21-2"
                          className="w-full px-3 py-1.5 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50 font-mono text-[11px]"
                        />
                      </div>
                    </>
                  )}

                  {/* Visibility Toggle */}
                  <div className="pt-1 flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editForm.visible}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            visible: e.target.checked,
                          }))
                        }
                        className="rounded accent-blue-600 cursor-pointer w-4 h-4"
                      />
                      <span className="text-xs text-foreground font-medium">
                        사이트에 노출
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
                {!isNew && (
                  <button
                    onClick={handleDelete}
                    className="mr-auto px-4 py-2.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-red-200 transition-all cursor-pointer"
                  >
                    삭제
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCloseEditor}
                  className="px-5 py-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-foreground bg-white border border-slate-300 transition-all cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  className="px-5 py-2.5 rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] cursor-pointer"
                >
                  {isNew ? `${tabLabels[activeTab]} 등록` : "변경사항 저장"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Payload Debug Modal */}
      {showPayloadModal && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setShowPayloadModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileJson size={16} className="text-[#8ba5ff]" />
                <h3 className="text-sm font-bold text-foreground">
                  Backend API Multipart Spec Preview
                </h3>
              </div>
              <button
                onClick={() => setShowPayloadModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-slate-100 border border-slate-200">
                <p className="text-[#34d399] font-bold mb-1">
                  {buildBackendPayload().endpoint}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Content-Type: multipart/form-data
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 overflow-x-auto">
                <p className="text-xs text-amber-400 font-bold mb-2">
                  {"// Part 1: data (JSON, ArchiveCreateRequest)"}
                </p>
                <pre className="text-[11px] text-foreground/90 whitespace-pre-wrap">
                  {JSON.stringify(buildBackendPayload().parts.data, null, 2)}
                </pre>
              </div>

              <div className="p-3 rounded-lg bg-slate-100 border border-slate-200">
                <p className="text-xs text-amber-400 font-bold mb-1">
                  {"// Part 2: image (MultipartFile)"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {buildBackendPayload().parts.image}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowPayloadModal(false)}
                className="px-4 py-2 rounded-md text-xs font-medium bg-slate-100 hover:bg-white/20 text-white"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-60 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxUrl}
              alt=""
              className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-slate-300"
            />
            <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-700">
              <span>아카이빙 이미지 원본</span>
              <button
                onClick={() => setLightboxUrl(null)}
                className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-medium cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed right-6 top-20 z-70 flex max-w-sm items-center gap-4 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl"
        >
          <span>{toast}</span>
          {visibilityUndo && (
            <button
              type="button"
              onClick={handleUndoVisibility}
              className="shrink-0 text-xs font-bold text-blue-300 hover:text-blue-200 cursor-pointer"
            >
              되돌리기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
