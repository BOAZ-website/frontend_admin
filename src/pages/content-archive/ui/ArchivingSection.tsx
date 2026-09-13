import { useRef, useState } from 'react';
import { Code, FileJson, Plus, RefreshCw, Search, Trash2, Upload, X, ZoomIn } from 'lucide-react';

export type ArchiveType = 'project' | 'blog' | 'photo';
export type TrackType = 'ALL' | 'ANALYSIS' | 'ENGINEERING' | 'VISUALIZATION';

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
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80',
];

const INITIAL_ARCHIVE_DATA: ArchiveItem[] = [
  {
    id: 'p1',
    type: 'project',
    title: '배달앱 리뷰 텍스트로 매장 이탈 예측',
    teamName: '리뷰읽는사람들',
    term: 21,
    contentDate: '2026-07-28',
    track: 'ANALYSIS',
    imageUrl: SAMPLE_PROJECT_IMAGES[0],
    visible: true,
    links: {
      github: 'https://github.com/boaz-analysis/delivery-churn',
      slideshare: 'https://slideshare.net/boaz/delivery-churn',
    },
  },
  {
    id: 'p2',
    type: 'project',
    title: '서울시 따릉이 재배치 시뮬레이션',
    teamName: '따릉이연구소',
    term: 21,
    contentDate: '2026-07-28',
    track: 'ENGINEERING',
    imageUrl: SAMPLE_PROJECT_IMAGES[1],
    visible: true,
    links: { github: 'https://github.com/boaz-eng/ttareungi-sim' },
  },
  {
    id: 'p3',
    type: 'project',
    title: '공모전 수상작 다시 보기 대시보드',
    teamName: 'VizLab',
    term: 20,
    contentDate: '2026-01-20',
    track: 'VISUALIZATION',
    imageUrl: SAMPLE_PROJECT_IMAGES[2],
    visible: true,
    links: { slideshare: 'https://slideshare.net/boaz/viz-awards', web: 'https://vizlab.boaz.com' },
  },
  {
    id: 'p4',
    type: 'project',
    title: '중고거래 사기 탐지 모델',
    teamName: '중고나라조심',
    term: 20,
    contentDate: '2026-01-20',
    track: 'ANALYSIS',
    imageUrl: SAMPLE_PROJECT_IMAGES[3],
    visible: true,
    links: {
      github: 'https://github.com/boaz-analysis/fraud-detect',
      slideshare: 'https://slideshare.net/boaz/fraud-detect',
    },
  },
  {
    id: 'p5',
    type: 'project',
    title: '실시간 지하철 혼잡도 파이프라인',
    teamName: '8호선지옥철',
    term: 20,
    contentDate: '2026-01-20',
    track: 'ENGINEERING',
    imageUrl: SAMPLE_PROJECT_IMAGES[4],
    visible: false,
    links: { github: 'https://github.com/boaz-eng/subway-realtime' },
  },
  {
    id: 'p6',
    type: 'project',
    title: '뉴스 프레임 비교 시각화',
    teamName: '프레임워치',
    term: 19,
    contentDate: '2025-07-15',
    track: 'VISUALIZATION',
    imageUrl: SAMPLE_PROJECT_IMAGES[5],
    visible: true,
    links: { web: 'https://framewatch.boaz.com' },
  },
  {
    id: 'p7',
    type: 'project',
    title: '카드 소비 데이터 상권 분석',
    teamName: '골목상권팀',
    term: 19,
    contentDate: '2025-07-15',
    track: 'ANALYSIS',
    imageUrl: SAMPLE_PROJECT_IMAGES[0],
    visible: true,
    links: {
      github: 'https://github.com/boaz-analysis/card-consumption',
      slideshare: 'https://slideshare.net/boaz/card-consumption',
    },
  },
  {
    id: 'p8',
    type: 'project',
    title: '음식점 리뷰 요약 LLM 파이프라인',
    teamName: '요약해줘',
    term: 19,
    contentDate: '2025-07-15',
    track: 'ENGINEERING',
    imageUrl: SAMPLE_PROJECT_IMAGES[1],
    visible: true,
    links: { github: 'https://github.com/boaz-eng/review-llm' },
  },
  // Tech Blogs
  {
    id: 'b1',
    type: 'blog',
    title: 'Kubernetes와 Airflow를 활용한 대용량 배치 처리 아키텍처',
    teamName: '김도현',
    term: 21,
    contentDate: '2026-06-12',
    track: 'ENGINEERING',
    imageUrl: SAMPLE_PROJECT_IMAGES[4],
    visible: true,
    links: {
      medium: 'https://medium.com/boaz/k8s-airflow-batch',
      github: 'https://github.com/boaz-eng',
    },
  },
  {
    id: 'b2',
    type: 'blog',
    title: 'TabNet과 LightGBM 성능 비교 실험기',
    teamName: '박서연',
    term: 21,
    contentDate: '2026-05-30',
    track: 'ANALYSIS',
    imageUrl: SAMPLE_PROJECT_IMAGES[0],
    visible: true,
    links: { medium: 'https://medium.com/boaz/tabnet-vs-lightgbm' },
  },
  {
    id: 'b3',
    type: 'blog',
    title: 'D3.js로 인터랙티브 네트워크 그래프 만들기',
    teamName: '최지우',
    term: 20,
    contentDate: '2025-11-18',
    track: 'VISUALIZATION',
    imageUrl: SAMPLE_PROJECT_IMAGES[2],
    visible: true,
    links: { medium: 'https://medium.com/boaz/d3-network-graph', web: 'https://d3-demo.boaz.com' },
  },
  // Photos
  {
    id: 'ph1',
    type: 'photo',
    title: '제21기 BOAZ 컨퍼런스 & 홈커밍데이 현장',
    teamName: '서비스운영팀',
    term: 21,
    contentDate: '2026-07-28',
    track: 'ALL',
    imageUrl:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&auto=format&fit=crop&q=80',
    visible: true,
    links: { instagram: 'https://instagram.com/p/boaz_conf21' },
    half: '21-1',
  },
  {
    id: 'ph2',
    type: 'photo',
    title: '2026 여름 MT 및 네트워킹 나이트',
    teamName: '운영지원팀',
    term: 21,
    contentDate: '2026-08-05',
    track: 'ALL',
    imageUrl:
      'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=800&auto=format&fit=crop&q=80',
    visible: true,
    links: { instagram: 'https://instagram.com/p/boaz_summer26' },
    half: '21-1',
  },
];

const TRACK_LABELS: Record<TrackType, string> = {
  ALL: '전체',
  ANALYSIS: '분석',
  ENGINEERING: '엔지니어링',
  VISUALIZATION: '시각화',
};

export function ArchivingSection() {
  const [activeTab, setActiveTab] = useState<ArchiveType>('project');
  const [items, setItems] = useState<ArchiveItem[]>(INITIAL_ARCHIVE_DATA);
  const [selectedTrack, setSelectedTrack] = useState<string>('ALL');
  const [selectedTerm, setSelectedTerm] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('p1');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showPayloadModal, setShowPayloadModal] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState<ArchiveItem>(INITIAL_ARCHIVE_DATA[0]);
  const [isNew, setIsNew] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Endpoint mapping
  const endpointMap: Record<ArchiveType, string> = {
    project: '/api/v1/admin/archiving/projects',
    blog: '/api/v1/admin/archiving/blogs',
    photo: '/api/v1/admin/archiving/activities',
  };

  const filteredItems = items.filter((item) => {
    if (item.type !== activeTab) {
      return false;
    }
    if (selectedTrack !== 'ALL' && item.track !== selectedTrack) {
      return false;
    }
    if (selectedTerm !== 'ALL' && item.term.toString() !== selectedTerm) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) || (item.teamName ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  function handleSelectRow(item: ArchiveItem) {
    setIsNew(false);
    setSelectedId(item.id);
    setEditForm({ ...item, links: { ...item.links } });
  }

  function handleNewItem() {
    setIsNew(true);
    setSelectedId('');
    const newItem: ArchiveItem = {
      id: 'item_' + Date.now(),
      type: activeTab,
      title: '',
      teamName: '',
      term: 21,
      contentDate: new Date().toISOString().slice(0, 10),
      track: activeTab === 'photo' ? 'ALL' : 'ANALYSIS',
      imageUrl: '',
      imageFile: null,
      visible: true,
      links: {},
      half: '21-1',
    };
    setEditForm(newItem);
  }

  function handleTabChange(tab: ArchiveType) {
    setActiveTab(tab);
    const firstOfTab = items.find((i) => i.type === tab);
    if (firstOfTab) {
      setIsNew(false);
      setSelectedId(firstOfTab.id);
      setEditForm({ ...firstOfTab, links: { ...firstOfTab.links } });
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

  function handleAttachSampleImage() {
    const randomImg =
      SAMPLE_PROJECT_IMAGES[Math.floor(Math.random() * SAMPLE_PROJECT_IMAGES.length)];
    setEditForm((prev) => ({ ...prev, imageUrl: randomImg, imageFile: null }));
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
      ...(activeTab === 'photo' ? { half: editForm.half || '21-1' } : {}),
    };
    return {
      endpoint: isNew
        ? `POST ${endpointMap[activeTab]}`
        : `PATCH ${endpointMap[activeTab]}/${editForm.id}`,
      contentType: 'multipart/form-data',
      parts: {
        data: dataPart,
        image: editForm.imageFile
          ? `[File: ${editForm.imageFile.name}, size: ${editForm.imageFile.size} bytes]`
          : editForm.imageUrl
            ? `[Preserved URL: ${editForm.imageUrl}]`
            : 'null (생략)',
      },
    };
  }

  function handleSave() {
    // 필수 필드 검증 (백엔드 ArchiveCreateRequest 스펙)
    if (!editForm.title.trim()) {
      alert('제목(title)은 필수 입력값입니다.');
      return;
    }
    if (!editForm.term || editForm.term <= 0) {
      alert('기수(term)는 필수 입력값(양수)입니다.');
      return;
    }
    if (!editForm.contentDate) {
      alert('날짜(contentDate)는 필수 입력값입니다.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (editForm.contentDate > today) {
      alert('날짜(contentDate)는 미래 날짜를 지정할 수 없습니다 (과거/오늘 날짜만 허용).');
      return;
    }

    if (isNew) {
      setItems((prev) => [editForm, ...prev]);
      setIsNew(false);
      setSelectedId(editForm.id);
    } else {
      setItems((prev) => prev.map((i) => (i.id === editForm.id ? editForm : i)));
    }
    alert(`아카이빙 항목이 성공적으로 저장되었습니다.\n[엔드포인트: ${endpointMap[activeTab]}]`);
  }

  function handleDelete() {
    if (
      confirm(
        `정말 이 항목을 삭제하시겠습니까?\n(DELETE ${endpointMap[activeTab]}/${editForm.id} 호출)`,
      )
    ) {
      setItems((prev) => prev.filter((i) => i.id !== editForm.id));
      const remaining = items.filter((i) => i.id !== editForm.id && i.type === activeTab);
      if (remaining.length > 0) {
        setSelectedId(remaining[0].id);
        setEditForm({ ...remaining[0], links: { ...remaining[0].links } });
      } else {
        handleNewItem();
      }
    }
  }

  const tabLabels: Record<ArchiveType, string> = {
    project: '프로젝트',
    blog: '기술블로그',
    photo: '활동사진',
  };

  return (
    <div
      className="space-y-4"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}
    >
      {/* ─── Top Tabs (프로젝트 | 기술블로그 | 활동사진) ─── */}
      <div className="flex items-center justify-between border-b border-slate-200 px-1">
        <div className="flex items-center gap-8">
          {(['project', 'blog', 'photo'] as ArchiveType[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className="pb-3 text-sm font-semibold relative transition-colors cursor-pointer"
                style={{
                  color: isActive ? '#0f172a' : '#64748b',
                }}
              >
                {tabLabels[tab]}
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: '#ef4444' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Backend API Debug Toggle */}
        <button
          onClick={() => setShowPayloadModal(true)}
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5 pb-2 cursor-pointer font-mono"
        >
          <Code size={13} className="text-[#8ba5ff]" />
          <span>데이터 상세 보기</span>
        </button>
      </div>

      {/* ─── Filter Bar ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
        <div className="flex items-center gap-2.5 flex-1 min-w-[320px]">
          {/* Track Filter */}
          <select
            value={selectedTrack}
            onChange={(e) => setSelectedTrack(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground cursor-pointer"
          >
            <option value="ALL" className="bg-white">
              전체 트랙
            </option>
            <option value="ANALYSIS" className="bg-white">
              분석
            </option>
            <option value="ENGINEERING" className="bg-white">
              엔지니어링
            </option>
            <option value="VISUALIZATION" className="bg-white">
              시각화
            </option>
          </select>

          {/* Term Filter */}
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
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

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목·팀명 검색"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/60"
            />
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
          </div>

          <span className="text-xs text-muted-foreground font-mono">
            {filteredItems.length}건 표시 · 전체 {items.filter((i) => i.type === activeTab).length}
            건
          </span>
        </div>

        {/* New Item Button (Red) */}
        <button
          onClick={handleNewItem}
          className="px-4 py-1.5 rounded-md text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
          style={{ background: '#ef4444' }}
        >
          <Plus size={13} /> 새 항목
        </button>
      </div>

      {/* ─── Main 2-Column Split View (Table + Right Edit Panel) ─── */}
      <div className="grid grid-cols-12 gap-5 items-start">
        {/* Left Column: Table List (7 cols) */}
        <div className="col-span-12 lg:col-span-7 rounded-xl overflow-hidden border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-16">
                    이미지
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">
                    제목
                  </th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-14">
                    기수
                  </th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-20">
                    트랙
                  </th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-24">
                    링크
                  </th>
                  <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-14">
                    노출
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-xs text-muted-foreground">
                      조건에 맞는 아카이빙 항목이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isSelected = selectedId === item.id && !isNew;
                    const linksList = Object.keys(item.links).filter((k) => !!item.links[k]);

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleSelectRow(item)}
                        className="transition-colors cursor-pointer group relative"
                        style={{
                          background: isSelected ? 'rgba(239, 68, 68, 0.09)' : 'transparent',
                          borderLeft: isSelected ? '3px solid #ef4444' : '3px solid transparent',
                        }}
                      >
                        {/* 16:9 Thumbnail */}
                        <td className="px-4 py-2.5">
                          <div className="w-12 h-7 rounded bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center relative">
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
                        <td className="px-3 py-2.5">
                          <p className="font-bold text-foreground group-hover:text-white transition-colors line-clamp-1">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 font-normal">
                            {item.teamName || '—'}
                          </p>
                        </td>

                        {/* Term */}
                        <td className="px-3 py-2.5 text-center font-mono text-foreground font-medium">
                          {item.term}기
                        </td>

                        {/* Track */}
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-[11px] text-muted-foreground">
                            {TRACK_LABELS[item.track]}
                          </span>
                        </td>

                        {/* Links */}
                        <td className="px-3 py-2.5">
                          <span className="text-[10px] text-muted-foreground/80 italic truncate font-mono">
                            {linksList.length > 0 ? linksList.join(', ') : '—'}
                          </span>
                        </td>

                        {/* Visibility */}
                        <td className="px-3 py-2.5 text-center">
                          {item.visible ? (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              노출
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#ef4444] font-semibold">숨김</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer / Pagination */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 text-xs text-muted-foreground">
            <span>1/4 페이지</span>
            <div className="flex items-center gap-1.5">
              <button className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-100 text-foreground border border-slate-200 text-xs font-medium cursor-pointer">
                이전
              </button>
              <button className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-100 text-foreground border border-slate-200 text-xs font-medium cursor-pointer">
                다음
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Edit Panel (5 cols) */}
        <div className="col-span-12 lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h3 className="text-xs font-bold text-foreground">
              {isNew ? '새 항목 등록' : '항목 편집'}
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-muted-foreground font-mono">
              {tabLabels[activeTab]}
            </span>
          </div>

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
            {editForm.imageUrl ? (
              <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                <img src={editForm.imageUrl} alt="미리보기" className="w-full h-36 object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => setLightboxUrl(editForm.imageUrl || null)}
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
                      setEditForm((prev) => ({ ...prev, imageUrl: '', imageFile: null }))
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
                className="w-full h-36 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload size={18} className="text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  이미지 업로드 · 16:9 권장 (image Part)
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAttachSampleImage();
                  }}
                  className="mt-1 text-[10px] text-[#ef4444] hover:underline"
                >
                  샘플 이미지 자동 적용
                </button>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-3 text-xs">
            {/* Title (필수) */}
            <div>
              <label className="text-muted-foreground block mb-1">
                제목 (title) <span className="text-red-400 font-bold">*</span>
              </label>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="프로젝트 또는 글 제목"
                className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50 font-medium"
              />
            </div>

            {/* TeamName (선택) */}
            <div>
              <label className="text-muted-foreground block mb-1">
                팀명 (team_name / author, 선택)
              </label>
              <input
                value={editForm.teamName ?? ''}
                onChange={(e) => setEditForm((prev) => ({ ...prev, teamName: e.target.value }))}
                placeholder={activeTab === 'project' ? '예: 리뷰읽는사람들' : '예: 홍길동'}
                className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            {/* 2-Column: Term & ContentDate */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-muted-foreground block mb-1">
                  기수 (term) <span className="text-red-400 font-bold">*</span>
                </label>
                <input
                  type="number"
                  value={editForm.term}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, term: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground font-mono"
                />
              </div>
              <div>
                <label className="text-muted-foreground block mb-1">
                  날짜 (contentDate) <span className="text-red-400 font-bold">*</span>
                </label>
                <input
                  type="date"
                  value={editForm.contentDate}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, contentDate: e.target.value }))
                  }
                  max={new Date().toISOString().slice(0, 10)}
                  className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground font-mono"
                />
              </div>
            </div>

            {/* Track */}
            <div>
              <label className="text-muted-foreground block mb-1">
                트랙 (track) <span className="text-red-400 font-bold">*</span>
              </label>
              <select
                value={editForm.track}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, track: e.target.value as TrackType }))
                }
                className="w-full px-3 py-2 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground cursor-pointer"
              >
                <option value="ANALYSIS" className="bg-white">
                  ANALYSIS (데이터 분석)
                </option>
                <option value="ENGINEERING" className="bg-white">
                  ENGINEERING (데이터 엔지니어링)
                </option>
                <option value="VISUALIZATION" className="bg-white">
                  VISUALIZATION (데이터 시각화)
                </option>
                <option value="ALL" className="bg-white">
                  ALL (공통 / 전부문)
                </option>
              </select>
            </div>

            {/* Links based on tab */}
            {activeTab === 'project' && (
              <>
                <div>
                  <label className="text-muted-foreground block mb-1">links.github</label>
                  <input
                    value={editForm.links.github ?? ''}
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
                  <label className="text-muted-foreground block mb-1">links.slideshare</label>
                  <input
                    value={editForm.links.slideshare ?? ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        links: { ...prev.links, slideshare: e.target.value },
                      }))
                    }
                    placeholder="https://slideshare.net/..."
                    className="w-full px-3 py-1.5 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">links.web</label>
                  <input
                    value={editForm.links.web ?? ''}
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

            {activeTab === 'blog' && (
              <>
                <div>
                  <label className="text-muted-foreground block mb-1">links.medium</label>
                  <input
                    value={editForm.links.medium ?? ''}
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
                  <label className="text-muted-foreground block mb-1">links.github</label>
                  <input
                    value={editForm.links.github ?? ''}
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

            {activeTab === 'photo' && (
              <>
                <div>
                  <label className="text-muted-foreground block mb-1">links.instagram</label>
                  <input
                    value={editForm.links.instagram ?? ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        links: { ...prev.links, instagram: e.target.value },
                      }))
                    }
                    placeholder="https://instagram.com/p/..."
                    className="w-full px-3 py-1.5 rounded-md outline-none bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/50 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">반기 (half)</label>
                  <input
                    value={editForm.half ?? '21-1'}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, half: e.target.value }))}
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
                  onChange={(e) => setEditForm((prev) => ({ ...prev, visible: e.target.checked }))}
                  className="rounded accent-red-500 cursor-pointer w-4 h-4"
                />
                <span className="text-xs text-foreground font-medium">사이트에 노출</span>
              </label>
            </div>
          </div>

          {/* Action Buttons (Red Save & Delete) */}
          <div className="pt-2 flex items-center gap-2">
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-md text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
              style={{ background: '#ef4444' }}
            >
              저장
            </button>
            {!isNew && (
              <button
                onClick={handleDelete}
                className="px-4 py-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
              >
                삭제
              </button>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground/70 text-center">
            저장 즉시 사이트 아카이빙 목록에 반영됩니다.
          </p>
        </div>
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
                <p className="text-[#34d399] font-bold mb-1">{buildBackendPayload().endpoint}</p>
                <p className="text-muted-foreground text-[11px]">
                  Content-Type: multipart/form-data
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 overflow-x-auto">
                <p className="text-xs text-amber-400 font-bold mb-2">
                  {'// Part 1: data (JSON, ArchiveCreateRequest)'}
                </p>
                <pre className="text-[11px] text-foreground/90 whitespace-pre-wrap">
                  {JSON.stringify(buildBackendPayload().parts.data, null, 2)}
                </pre>
              </div>

              <div className="p-3 rounded-lg bg-slate-100 border border-slate-200">
                <p className="text-xs text-amber-400 font-bold mb-1">
                  {'// Part 2: image (MultipartFile)'}
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
    </div>
  );
}
