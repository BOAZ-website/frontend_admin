import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

export type FaqCategory = 'RECRUITMENT' | 'ACTIVITY' | 'ETC';
type CategoryFilter = 'ALL' | FaqCategory;
type VisibilityFilter = 'ALL' | 'VISIBLE' | 'HIDDEN';

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
    id: 'f1',
    category: 'RECRUITMENT',
    question: '비전공자도 지원 가능한가요?',
    answer:
      '네, 전공과 무관하게 데이터에 대한 열정과 기초적인 학습 의지가 있다면 누구나 지원 가능합니다. 각 트랙별 기초 지식(Python, 기초 통계 등)에 대한 이해도가 있다면 서류 및 면접에서 좋은 평가를 받을 수 있습니다.',
    orderNum: 1,
    visible: true,
    updatedAt: '2026-07-20',
  },
  {
    id: 'f2',
    category: 'RECRUITMENT',
    question: '서류 평가 기준과 면접 진행 방식이 궁금합니다.',
    answer:
      '서류 평가는 지원 동기, 문제 해결 경험, 트랙 적합성을 종합적으로 검토합니다. 면접은 지원서 기반의 개별 인터뷰로 진행되며 실무적인 지식뿐만 아니라 협업 태도와 성장 잠재력을 중점적으로 평가합니다.',
    orderNum: 2,
    visible: true,
    updatedAt: '2026-07-20',
  },
  {
    id: 'f3',
    category: 'ACTIVITY',
    question: '정규 세션 일정 및 활동 시간은 어떻게 되나요?',
    answer:
      '정규 세션은 매주 토요일 오후 2시부터 6시까지 진행됩니다. 방학 중에는 온/오프라인 병행 스터디가 추가로 진행될 수 있습니다.',
    orderNum: 1,
    visible: true,
    updatedAt: '2026-06-15',
  },
  {
    id: 'f4',
    category: 'ACTIVITY',
    question: '출석 인정 기준과 점수 제도는 어떻게 운영되나요?',
    answer:
      '출석 시 +1점, 지각 시 +0.5점, 결석 시 0점이 부여됩니다. 스터디장이 매주 출결을 입력하고 운영지원팀에서 승인하며, 총 활동 점수가 수료 기준에 반영됩니다.',
    orderNum: 2,
    visible: true,
    updatedAt: '2026-06-15',
  },
  {
    id: 'f5',
    category: 'ETC',
    question: '활동 증명서 및 수료증 발급 기준은 무엇인가요?',
    answer:
      '정규 활동 기간(2학기) 동안 출석률 80% 이상 및 최종 프로젝트 컨퍼런스 발표를 완료한 부원에게 정식 수료증이 발급됩니다.',
    orderNum: 1,
    visible: true,
    updatedAt: '2026-05-10',
  },
];

const CATEGORIES: FaqCategory[] = ['RECRUITMENT', 'ACTIVITY', 'ETC'];
const CATEGORY_LABELS: Record<FaqCategory, string> = {
  RECRUITMENT: '리크루팅',
  ACTIVITY: '활동 안내',
  ETC: '기타',
};
const CATEGORY_STYLES: Record<FaqCategory, string> = {
  RECRUITMENT: 'bg-blue-50 text-blue-700 border-blue-200',
  ACTIVITY: 'bg-violet-50 text-violet-700 border-violet-200',
  ETC: 'bg-slate-100 text-slate-700 border-slate-200',
};
const getToday = () => new Date().toISOString().slice(0, 10);

function renumber(items: FaqItem[], category: FaqCategory) {
  const ids = items
    .filter((item) => item.category === category)
    .sort((a, b) => a.orderNum - b.orderNum)
    .map((item) => item.id);
  return items.map((item) => {
    const index = ids.indexOf(item.id);
    return index < 0 ? item : { ...item, orderNum: index + 1 };
  });
}

export function FaqSection() {
  const [faqs, setFaqs] = useState(INITIAL_FAQ_DATA);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>('f1');
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [initialFaq, setInitialFaq] = useState<FaqItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [deletingFaq, setDeletingFaq] = useState<FaqItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      total: faqs.length,
      visible: faqs.filter((faq) => faq.visible).length,
      hidden: faqs.filter((faq) => !faq.visible).length,
    }),
    [faqs],
  );
  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return faqs
      .filter((faq) => selectedCategory === 'ALL' || faq.category === selectedCategory)
      .filter(
        (faq) =>
          visibilityFilter === 'ALL' ||
          (visibilityFilter === 'VISIBLE' ? faq.visible : !faq.visible),
      )
      .filter(
        (faq) =>
          !query ||
          faq.question.toLowerCase().includes(query) ||
          faq.answer.toLowerCase().includes(query),
      )
      .sort(
        (a, b) =>
          CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) ||
          a.orderNum - b.orderNum,
      );
  }, [faqs, searchQuery, selectedCategory, visibilityFilter]);

  const hasFilters =
    selectedCategory !== 'ALL' || visibilityFilter !== 'ALL' || Boolean(searchQuery.trim());
  const isDirty = Boolean(
    editingFaq && initialFaq && JSON.stringify(editingFaq) !== JSON.stringify(initialFaq),
  );
  const canSave = Boolean(editingFaq?.question.trim() && editingFaq?.answer.trim());

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (showDiscard) setShowDiscard(false);
      else if (deletingFaq) setDeletingFaq(null);
      else if (editingFaq) requestCloseEditor();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function resetFilters() {
    setSelectedCategory('ALL');
    setVisibilityFilter('ALL');
    setSearchQuery('');
  }

  function openEditor(faq: FaqItem, newItem = false) {
    setIsNew(newItem);
    setEditingFaq({ ...faq });
    setInitialFaq({ ...faq });
  }

  function addFaq() {
    const category = selectedCategory === 'ALL' ? 'RECRUITMENT' : selectedCategory;
    const nextOrder =
      Math.max(0, ...faqs.filter((faq) => faq.category === category).map((faq) => faq.orderNum)) +
      1;
    openEditor(
      {
        id: `faq_${Date.now()}`,
        category,
        question: '',
        answer: '',
        orderNum: nextOrder,
        visible: true,
        updatedAt: getToday(),
      },
      true,
    );
  }

  function closeEditor() {
    setEditingFaq(null);
    setInitialFaq(null);
    setShowDiscard(false);
  }

  function requestCloseEditor() {
    if (isDirty) setShowDiscard(true);
    else closeEditor();
  }

  function saveFaq() {
    if (!editingFaq || !canSave) return;
    const saved = { ...editingFaq, updatedAt: getToday() };
    setFaqs((previous) => {
      if (isNew) return renumber([...previous, saved], saved.category);
      const original = previous.find((faq) => faq.id === saved.id);
      let next = previous.map((faq) => (faq.id === saved.id ? saved : faq));
      if (original && original.category !== saved.category) {
        const last = Math.max(
          0,
          ...next
            .filter((faq) => faq.category === saved.category && faq.id !== saved.id)
            .map((faq) => faq.orderNum),
        );
        next = next.map((faq) => (faq.id === saved.id ? { ...faq, orderNum: last + 1 } : faq));
        next = renumber(next, original.category);
      }
      return renumber(next, saved.category);
    });
    closeEditor();
    setToast(isNew ? '새 FAQ가 등록되었습니다.' : 'FAQ가 수정되었습니다.');
  }

  function deleteFaq() {
    if (!deletingFaq) return;
    setFaqs((previous) =>
      renumber(
        previous.filter((faq) => faq.id !== deletingFaq.id),
        deletingFaq.category,
      ),
    );
    if (expandedId === deletingFaq.id) setExpandedId(null);
    setDeletingFaq(null);
    setToast('FAQ가 삭제되었습니다.');
  }

  function toggleVisibility(faq: FaqItem) {
    setFaqs((previous) =>
      previous.map((item) =>
        item.id === faq.id ? { ...item, visible: !item.visible, updatedAt: getToday() } : item,
      ),
    );
    setToast(`FAQ가 ${faq.visible ? '숨김' : '노출'} 상태로 변경되었습니다.`);
  }

  function categoryItems(faq: FaqItem) {
    return faqs
      .filter((item) => item.category === faq.category)
      .sort((a, b) => a.orderNum - b.orderNum);
  }

  function moveFaq(faq: FaqItem, direction: 'up' | 'down') {
    const items = categoryItems(faq);
    const index = items.findIndex((item) => item.id === faq.id);
    const target = items[direction === 'up' ? index - 1 : index + 1];
    if (!target) return;
    setFaqs((previous) =>
      previous.map((item) => {
        if (item.id === faq.id)
          return { ...item, orderNum: target.orderNum, updatedAt: getToday() };
        if (item.id === target.id)
          return { ...item, orderNum: faq.orderNum, updatedAt: getToday() };
        return item;
      }),
    );
    setToast('FAQ 노출 순서가 변경되었습니다.');
  }

  function moveDisabled(faq: FaqItem, direction: 'up' | 'down') {
    const items = categoryItems(faq);
    const index = items.findIndex((item) => item.id === faq.id);
    return direction === 'up' ? index === 0 : index === items.length - 1;
  }

  return (
    <div
      className="space-y-5"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}
    >
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">FAQ 관리</h2>
            <p className="mt-1 text-xs text-slate-500">
              사이트에 노출되는 질문과 답변, 순서를 관리합니다.
            </p>
          </div>
          <button
            onClick={addFaq}
            className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600 cursor-pointer"
          >
            <Plus size={14} /> 새 FAQ 등록
          </button>
        </div>
        <div className="mt-4 grid max-w-md grid-cols-3 gap-2">
          <Stat label="전체" value={counts.total} className="bg-slate-50 text-slate-900" />
          <Stat label="노출 중" value={counts.visible} className="bg-emerald-50 text-emerald-800" />
          <Stat label="숨김" value={counts.hidden} className="bg-slate-100 text-slate-700" />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {(['ALL', ...CATEGORIES] as CategoryFilter[]).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold cursor-pointer ${selectedCategory === category ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {category === 'ALL' ? '전체 카테고리' : CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
          <select
            aria-label="노출 상태 필터"
            value={visibilityFilter}
            onChange={(event) => setVisibilityFilter(event.target.value as VisibilityFilter)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none"
          >
            <option value="ALL">전체 상태</option>
            <option value="VISIBLE">노출 중</option>
            <option value="HIDDEN">숨김</option>
          </select>
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="질문 또는 답변 검색"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-9 text-xs outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="검색어 지우기"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <span className="text-xs font-medium text-slate-500">
            검색 결과 {filteredFaqs.length}건
          </span>
          {hasFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <RotateCcw size={13} /> 초기화
            </button>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[96px_52px_minmax(220px,1fr)_90px_100px_220px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-bold text-slate-500 lg:grid">
            <span>카테고리</span>
            <span>순서</span>
            <span>질문</span>
            <span>노출 상태</span>
            <span>수정일</span>
            <span className="text-center">관리</span>
          </div>
          {filteredFaqs.length === 0 ? (
            <EmptyState reset={resetFilters} showReset={hasFilters} />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredFaqs.map((faq) => {
                const expanded = expandedId === faq.id;
                return (
                  <article key={faq.id} className={faq.visible ? 'bg-white' : 'bg-slate-50/80'}>
                    <div
                      onClick={() => setExpandedId(expanded ? null : faq.id)}
                      className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 hover:bg-slate-50 lg:grid-cols-[96px_52px_minmax(220px,1fr)_90px_100px_220px]"
                    >
                      <span
                        className={`hidden w-fit rounded-md border px-2 py-1 text-[11px] font-bold lg:inline-flex ${CATEGORY_STYLES[faq.category]}`}
                      >
                        {CATEGORY_LABELS[faq.category]}
                      </span>
                      <span className="hidden text-xs font-bold text-slate-500 lg:block">
                        {faq.orderNum}
                      </span>
                      <div className="min-w-0">
                        <div className="mb-1 flex gap-2 lg:hidden">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${CATEGORY_STYLES[faq.category]}`}
                          >
                            {CATEGORY_LABELS[faq.category]}
                          </span>
                          <span className="text-[11px] text-slate-400">순서 {faq.orderNum}</span>
                        </div>
                        <p
                          className={`truncate text-sm font-semibold ${faq.visible ? 'text-slate-900' : 'text-slate-500'}`}
                        >
                          {faq.question}
                        </p>
                      </div>
                      <span
                        className={`hidden w-fit items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold lg:flex ${faq.visible ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${faq.visible ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        />
                        {faq.visible ? '노출 중' : '숨김'}
                      </span>
                      <span className="hidden text-xs text-slate-500 lg:block">
                        {faq.updatedAt}
                      </span>
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <IconButton
                          label={`${faq.question} 위로 이동`}
                          title="위로 이동"
                          disabled={moveDisabled(faq, 'up')}
                          onClick={() => moveFaq(faq, 'up')}
                        >
                          <ArrowUp size={14} />
                        </IconButton>
                        <IconButton
                          label={`${faq.question} 아래로 이동`}
                          title="아래로 이동"
                          disabled={moveDisabled(faq, 'down')}
                          onClick={() => moveFaq(faq, 'down')}
                        >
                          <ArrowDown size={14} />
                        </IconButton>
                        <IconButton
                          label={`${faq.question} ${faq.visible ? '숨기기' : '노출하기'}`}
                          title={faq.visible ? '사이트에서 숨기기' : '사이트에 노출하기'}
                          onClick={() => toggleVisibility(faq)}
                        >
                          {faq.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                        </IconButton>
                        <button
                          onClick={() => openEditor(faq)}
                          className="flex min-w-[58px] shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          <Edit3 size={13} /> 수정
                        </button>
                        <IconButton
                          label={`${faq.question} 삭제`}
                          title="삭제"
                          danger
                          onClick={() => setDeletingFaq(faq)}
                        >
                          <Trash2 size={14} />
                        </IconButton>
                        <IconButton
                          label={expanded ? '답변 접기' : '답변 펼치기'}
                          onClick={() => setExpandedId(expanded ? null : faq.id)}
                        >
                          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </IconButton>
                      </div>
                    </div>
                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-4 lg:pl-[176px] lg:pr-8">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <p className="mb-2 text-[11px] font-bold text-slate-400">답변</p>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                            {faq.answer}
                          </p>
                        </div>
                        <div className="mt-2 flex justify-between text-[11px] text-slate-400 lg:hidden">
                          <span>{faq.visible ? '사이트 노출 중' : '사이트 숨김'}</span>
                          <span>최종 수정 {faq.updatedAt}</span>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
        <p className="px-1 text-[11px] text-slate-400">
          순서는 같은 카테고리 안에서만 변경되며 실제 사이트 노출 순서에 반영됩니다.
        </p>
      </section>

      {editingFaq && (
        <EditorModal
          faq={editingFaq}
          setFaq={setEditingFaq}
          isNew={isNew}
          canSave={canSave}
          onClose={requestCloseEditor}
          onSave={saveFaq}
        />
      )}
      {showDiscard && (
        <ConfirmModal
          title="작성 중인 내용을 닫을까요?"
          description="저장하지 않은 변경사항은 사라집니다."
          cancelLabel="계속 작성"
          confirmLabel="변경사항 버리기"
          onCancel={() => setShowDiscard(false)}
          onConfirm={closeEditor}
        />
      )}
      {deletingFaq && (
        <ConfirmModal
          danger
          title="FAQ를 삭제할까요?"
          description={`“${deletingFaq.question}”\n\n삭제한 항목은 복구할 수 없으며 노출 순서는 자동으로 다시 정리됩니다.`}
          cancelLabel="취소"
          confirmLabel="삭제"
          onCancel={() => setDeletingFaq(null)}
          onConfirm={deleteFaq}
        />
      )}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500">
            <Check size={12} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 ${className}`}>
      <p className="text-[11px] opacity-75">{label}</p>
      <p className="mt-0.5 text-base font-bold">{value}건</p>
    </div>
  );
}

function IconButton({
  children,
  label,
  title,
  disabled,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  title?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-2 disabled:cursor-not-allowed disabled:opacity-25 cursor-pointer ${danger ? 'text-slate-400 hover:bg-red-50 hover:text-red-600' : 'text-slate-500 hover:bg-slate-100'}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ reset, showReset }: { reset: () => void; showReset: boolean }) {
  return (
    <div className="flex flex-col items-center py-14 text-center">
      <Search size={28} className="text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-700">조건에 맞는 FAQ가 없습니다.</p>
      <p className="mt-1 text-xs text-slate-400">검색어나 필터 조건을 변경해 보세요.</p>
      {showReset && (
        <button
          onClick={reset}
          className="mt-4 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          검색 조건 초기화
        </button>
      )}
    </div>
  );
}

function EditorModal({
  faq,
  setFaq,
  isNew,
  canSave,
  onClose,
  onSave,
}: {
  faq: FaqItem;
  setFaq: (faq: FaqItem) => void;
  isNew: boolean;
  canSave: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="faq-editor-title"
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h3 id="faq-editor-title" className="text-base font-bold text-slate-900">
              {isNew ? '새 FAQ 등록' : 'FAQ 수정'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              사이트 이용자가 이해하기 쉬운 질문과 답변을 작성해 주세요.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="팝업 닫기"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[68vh] space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_160px]">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
              <span className="flex h-4 items-center gap-0.5">
                카테고리 <span className="text-red-500">*</span>
              </span>
              <select
                value={faq.category}
                onChange={(event) =>
                  setFaq({ ...faq, category: event.target.value as FaqCategory })
                }
                className="block h-[42px] w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none"
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1.5">
              <span className="flex h-4 items-center text-xs font-semibold text-slate-700">
                노출 설정
              </span>
              <label className="flex h-[42px] items-center gap-2 rounded-lg border border-slate-200 px-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={faq.visible}
                  onChange={(event) => setFaq({ ...faq, visible: event.target.checked })}
                  className="h-4 w-4 accent-red-500"
                />
                <span className="text-sm text-slate-700">사이트에 노출</span>
              </label>
            </div>
          </div>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            질문 <span className="text-red-500">*</span>
            <input
              autoFocus
              value={faq.question}
              maxLength={120}
              onChange={(event) => setFaq({ ...faq, question: event.target.value })}
              placeholder="예: 비전공자도 지원 가능한가요?"
              className="block w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50"
            />
            <span className="block text-right text-[11px] font-normal text-slate-400">
              {faq.question.length}/120
            </span>
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            답변 <span className="text-red-500">*</span>
            <textarea
              value={faq.answer}
              maxLength={1200}
              rows={8}
              onChange={(event) => setFaq({ ...faq, answer: event.target.value })}
              placeholder="이용자가 이해하기 쉬운 답변을 작성해 주세요."
              className="block w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm font-normal leading-6 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-50"
            />
            <span className="block text-right text-[11px] font-normal text-slate-400">
              {faq.answer.length}/1,200
            </span>
          </label>
          <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-700">
            새 항목은 선택한 카테고리의 마지막 순서에 등록됩니다. 등록 후 목록에서 순서를 변경할 수
            있습니다.
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <span className="text-[11px] text-slate-400">
            ESC 또는 바깥 영역을 눌러 닫을 수 있습니다.
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={onSave}
              disabled={!canSave}
              className="rounded-lg bg-red-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300 cursor-pointer"
            >
              {isNew ? 'FAQ 등록' : '변경사항 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  cancelLabel,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        {danger && (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
            <Trash2 size={18} />
          </div>
        )}
        <h3
          id="confirm-title"
          className={`${danger ? 'mt-4' : ''} text-base font-bold text-slate-900`}
        >
          {title}
        </h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-500">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2.5 text-xs font-bold text-white cursor-pointer ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
