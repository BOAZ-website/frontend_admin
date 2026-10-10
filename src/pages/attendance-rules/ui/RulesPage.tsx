import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripVertical, Settings, X } from 'lucide-react';

import { createScoreRule, updateScoreRule } from '@/entities/score-rule/api/scoreRuleApi';
import { formatDateRange, getTodayString } from '@/entities/score-rule/model/lib';
import type { ScoreRule } from '@/entities/score-rule/model/types';
import { alertApiError } from '@/shared/lib/alertApiError';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';
import { Tooltip } from '@/shared/ui/Tooltip';
import { CreateButton } from '@/shared/ui/CreateButton';

import {
  formatScore,
  ruleSectionsOf,
  SCORE_FIELDS,
  scoreOf,
  type RuleSection,
  type ScoreField,
} from '../model/ruleSections';
import { ScoreInput } from './ScoreInput';

interface RulesPageProps {
  /** DB의 점수 규칙(API 응답). */
  rules: ScoreRule[];
  /** 규칙을 저장하거나 생성한 뒤 목록을 다시 읽게 한다. */
  onRulesChanged: () => void;
}

function ruleIdOf(rule: ScoreRule): string {
  if (!rule.id) throw new Error('규칙 id가 없습니다.');
  return rule.id;
}

function validateRuleInput(
  term: number,
  startDate: string,
  endDate: string | null | undefined,
): boolean {
  if (!Number.isInteger(term) || term <= 0) {
    window.alert('기수는 1 이상의 정수로 입력해 주세요.');
    return false;
  }
  if (!startDate) {
    window.alert('적용 시작일을 입력해 주세요.');
    return false;
  }
  if (endDate && endDate < startDate) {
    window.alert('적용 종료일은 시작일보다 빠를 수 없습니다.');
    return false;
  }
  return true;
}

type RuleColumn = 'item' | 'detail' | 'score';

const RULE_COLUMNS: readonly { key: RuleColumn; label: string }[] = [
  { key: 'item', label: '항목' },
  { key: 'detail', label: '조건' },
  { key: 'score', label: '점수' },
];
/**
 * 열 너비(px). 표는 세 열 너비의 합까지만 넓어지고, 머리글과 칸 내용은 모두 열 가운데에 둔다.
 * 패널이 그보다 좁으면 열 비율을 지킨 채 함께 줄어들어 가로 스크롤이 생기지 않는다(긴 글자는 줄을 바꾼다).
 * 머리글 오른쪽 끝을 끌어 너비를 바꾼다.
 */
const DEFAULT_COL_WIDTHS: Record<RuleColumn, number> = {
  item: 170,
  detail: 300,
  score: 200,
};
const MIN_COL_WIDTH = 72;

/** 규칙 생성 창의 배점 입력값. 지금 보고 있는 규칙의 배점을 그대로 가져와 고친다. */
function scoresOf(rule: ScoreRule | undefined): Record<ScoreField, number> {
  return Object.fromEntries(
    SCORE_FIELDS.map((field) => [field.key, rule ? scoreOf(rule, field.key) : field.default]),
  ) as Record<ScoreField, number>;
}

/**
 * 배점 칸 글자 색. 가점은 초록, 감점은 빨강, 0점은 회색, 처리 방식(글자)은 진한 회색이다.
 * 글씨는 규칙 생성 버튼과 같은 보통 굵기의 본문 글꼴로 쓴다(고정폭 글꼴·굵은 글씨를 쓰지 않는다).
 */
function scoreClassOf(score: number | string): string {
  if (typeof score === 'string') return 'text-slate-700';
  if (score > 0) return 'text-emerald-600';
  if (score < 0) return 'text-rose-600';
  return 'text-slate-400';
}

// 왼쪽 규칙 목록 너비(px). 가운데 구분선을 끌어 바꾼다.
const DEFAULT_LIST_WIDTH = 256;
const MIN_LIST_WIDTH = 180;
const MAX_LIST_WIDTH = 480;

export function RulesPage({ rules, onRulesChanged }: RulesPageProps) {
  const todayStr = useMemo(() => getTodayString(), []);

  // 규칙은 DB에서 기수·기간·버전이 모두 채워져 내려온다.
  const safeRules = rules;

  // 기본 선택 버전
  const defaultSelectedRuleId = useMemo(() => {
    const active = safeRules.find((r) => r.status === 'ACTIVE');
    return active?.id ?? safeRules[0]?.id ?? '';
  }, [safeRules]);

  const [selectedRuleId, setSelectedRuleId] = useState(defaultSelectedRuleId);
  // 규칙 목록과 상세 표 사이 구분선: 다른 관리 탭처럼 끌어서 목록 너비를 바꾼다.
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [listWidth, setListWidth] = useState(DEFAULT_LIST_WIDTH);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  useEffect(() => {
    if (!isDraggingDivider) return;
    const handleMove = (event: MouseEvent | TouchEvent) => {
      const container = splitContainerRef.current;
      if (!container) return;
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const width = clientX - container.getBoundingClientRect().left;
      setListWidth(Math.min(Math.max(width, MIN_LIST_WIDTH), MAX_LIST_WIDTH));
    };
    const handleUp = () => setIsDraggingDivider(false);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDraggingDivider]);
  // 점수 규칙 표의 열 너비(px). 머리글 오른쪽 끝을 끌어 바꾼다.
  const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS);
  const [resizingCol, setResizingCol] = useState<RuleColumn | null>(null);
  const startColumnResize = (event: React.MouseEvent<HTMLElement>, column: RuleColumn) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = colWidths[column];
    setResizingCol(column);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const handleMove = (moveEvent: MouseEvent) => {
      const width = Math.max(MIN_COL_WIDTH, startWidth + moveEvent.clientX - startX);
      setColWidths((prev) => ({ ...prev, [column]: width }));
    };
    const handleUp = () => {
      setResizingCol(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [metadataRule, setMetadataRule] = useState<ScoreRule | null>(null);
  const [metadata, setMetadata] = useState({ name: '', startDate: '', endDate: '' });
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  // 현재 선택된 버전의 규칙
  const currentRule = useMemo(() => {
    return safeRules.find((r) => r.id === selectedRuleId) || safeRules[0];
  }, [safeRules, selectedRuleId]);

  const handleSaveMetadata = () => {
    if (!metadataRule || isSavingMetadata) return;
    if (!metadata.name.trim()) {
      window.alert('규칙 제목을 입력해 주세요.');
      return;
    }
    if (!validateRuleInput(metadataRule.term, metadata.startDate, metadata.endDate)) return;
    if (!window.confirm('규칙 설정을 정말 변경하시겠습니까?')) return;

    setIsSavingMetadata(true);
    updateScoreRule(ruleIdOf(metadataRule), {
      name: metadata.name.trim(),
      startDate: metadata.startDate,
      endDate: metadataRule.status === 'ACTIVE' ? null : metadata.endDate || null,
    })
      .then(() => {
        setMetadataRule(null);
        onRulesChanged();
      })
      .catch(alertApiError)
      .finally(() => setIsSavingMetadata(false));
  };

  // 신규 규칙 생성 폼 상태. 배점은 지금 보고 있는 규칙의 값에서 시작한다.
  const [newRuleForm, setNewRuleForm] = useState({
    term: currentRule?.term ?? 0,
    name: `Version ${Math.max(0, ...safeRules.map((rule) => rule.version)) + 1}`,
    startDate: todayStr,
    description: '',
    scores: scoresOf(currentRule),
  });

  const handleOpenAddModal = () => {
    const currentTerm = currentRule?.term ?? safeRules[0]?.term ?? 0;
    const nextVersion = Math.max(0, ...safeRules.map((rule) => rule.version)) + 1;

    setNewRuleForm({
      term: currentTerm,
      name: `Version ${nextVersion}`,
      startDate: todayStr,
      description: '',
      scores: scoresOf(currentRule),
    });
    setIsAddModalOpen(true);
  };

  const handleCreateNewRule = (e: React.FormEvent) => {
    e.preventDefault();
    const termNum = Number(newRuleForm.term);
    if (!validateRuleInput(termNum, newRuleForm.startDate, null)) return;
    if (!newRuleForm.name.trim()) {
      window.alert('규칙명을 입력해 주세요.');
      return;
    }
    if (!window.confirm('새 점수 규칙을 생성하고 적용하시겠습니까?')) return;
    createScoreRule({
      term: termNum,
      name: newRuleForm.name.trim(),
      startDate: newRuleForm.startDate,
      endDate: null,
      description: newRuleForm.description,
      ...newRuleForm.scores,
    })
      .then((rule) => {
        onRulesChanged();
        setSelectedRuleId(ruleIdOf(rule));
        setIsAddModalOpen(false);
      })
      .catch(alertApiError);
  };

  return (
    <div
      className="flex flex-col flex-1 h-full min-h-0 space-y-3 w-full"
      style={{
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      {/* ─── 1. Top Header ─── */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          <h2 className="text-slate-950 font-black text-lg sm:text-xl tracking-tight">
            출결 점수 규칙
          </h2>
        </div>
        <CreateButton label="규칙" aria-label="새 규칙" onClick={() => handleOpenAddModal()} />
      </div>

      {/* ─── 2. Two-Pane Layout (좌측: 기수 목록 카드 / 우측: 선택 기수 상세 표) ─── */}
      <div
        ref={splitContainerRef}
        className="relative w-full flex-1 min-h-0 flex flex-row h-full min-w-0 items-start"
      >
        {/* 좌측: 규칙 목록 패널 */}
        <div
          className="shrink-0 space-y-2.5 h-full overflow-y-auto [scrollbar-gutter:stable] pr-1"
          style={{ width: listWidth }}
        >
          <div className="space-y-2">
            {safeRules.map((rule) => {
              const isSelected = rule.id === selectedRuleId;

              return (
                <div
                  key={rule.id}
                  className={`relative flex items-center gap-2 rounded-md border transition-all select-none ${
                    isSelected
                      ? 'bg-slate-100/80 border-slate-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setSelectedRuleId(ruleIdOf(rule));
                    }}
                    className="min-w-0 flex-1 p-3.5 pr-0 text-left cursor-pointer"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <h4
                        className={`text-sm font-bold truncate ${
                          isSelected ? 'text-slate-950' : 'text-slate-800'
                        }`}
                      >
                        {rule.name}
                      </h4>
                    </div>
                  </button>
                  <div className="mr-2.5 flex shrink-0 items-center">
                    {/* 목록 오른쪽 끝에 붙은 버튼이라 말풍선을 버튼 오른쪽 끝에 맞춘다. */}
                    <Tooltip label="규칙 정보 수정" align="end">
                      <button
                        type="button"
                        onClick={() => {
                          setMetadataRule(rule);
                          setMetadata({
                            name: rule.name,
                            startDate: rule.startDate,
                            endDate: rule.status === 'ACTIVE' ? '' : (rule.endDate ?? ''),
                          });
                        }}
                        aria-label={`Version ${rule.version} 규칙 정보 수정`}
                        className="shrink-0 rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                      >
                        <Settings size={14} aria-hidden="true" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 목록과 상세 표 사이 구분선(다른 관리 탭과 같은 손잡이) */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="규칙 목록 너비 조절"
          onMouseDown={(event) => {
            event.preventDefault();
            setIsDraggingDivider(true);
          }}
          onTouchStart={(event) => {
            event.preventDefault();
            setIsDraggingDivider(true);
          }}
          className={`group mx-1 flex w-4 shrink-0 cursor-col-resize select-none items-center justify-center self-stretch py-12 transition-colors ${
            isDraggingDivider ? 'bg-slate-200/50' : 'hover:bg-slate-100/80'
          }`}
          title="마우스로 드래그하여 패널 너비 조절"
        >
          <div
            className={`flex w-1 flex-col items-center justify-center rounded-full transition-all ${
              isDraggingDivider
                ? 'h-20 bg-slate-700'
                : 'h-14 bg-slate-300 group-hover:h-16 group-hover:bg-slate-500'
            }`}
          >
            <GripVertical
              size={10}
              className="text-white opacity-0 transition-opacity group-hover:opacity-100"
            />
          </div>
        </div>

        {/* 우측: 선택된 점수 규칙 상세 표 */}
        {currentRule && (
          <div className="flex-1 min-w-0 bg-white rounded-md border border-slate-200/90 p-5 space-y-4 shadow-2xs h-full overflow-y-auto [scrollbar-gutter:stable]">
            {/* Header / Meta / Actions */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <h3 className="text-base font-bold text-slate-900">{currentRule.name}</h3>

              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500">
                  {formatDateRange(currentRule.startDate, currentRule.endDate)}
                </p>
              </div>
            </div>

            {/* 최종 활동점수 계산식(문서 「활동점수 계산 기준」) */}
            {/* 기본점수는 '+10점'처럼 부호를 붙이면 더하기 기호와 겹쳐 읽히므로 부호 없이 '기본점수 10점'으로 쓴다.
                항목과 기호 사이를 띄워 식이 붙어 보이지 않게 한다. */}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <span className="text-slate-900">최종 활동점수</span>
              <span>=</span>
              <span>기본점수 {scoreOf(currentRule, 'baseScore')}점</span>
              <span>+</span>
              <span>가점 합계</span>
              <span>−</span>
              <span>감점 합계</span>
            </p>

            {/* 「관리자 시스템 관련 현행 운영 방식」 문서의 절 순서대로 표를 둔다 */}
            {ruleSectionsOf(currentRule).map((section) => (
              <RuleSectionTable
                key={section.title}
                section={section}
                colWidths={colWidths}
                resizingCol={resizingCol}
                onResizeStart={startColumnResize}
              />
            ))}
          </div>
        )}
      </div>

      {metadataRule &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-rule-title"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !isSavingMetadata) setMetadataRule(null);
            }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
          >
            <div className={`relative w-full max-w-md rounded-lg p-6 space-y-5 ${MODAL_SURFACE}`}>
              <div className="flex items-center justify-between">
                <h3 id="edit-rule-title" className="text-base font-bold text-slate-900">
                  규칙 설정 변경
                </h3>
                <button
                  type="button"
                  aria-label="규칙 정보 수정 닫기"
                  onClick={() => setMetadataRule(null)}
                  disabled={isSavingMetadata}
                  className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer disabled:opacity-50"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="rule-settings-name"
                    className="text-[11px] font-semibold text-slate-500"
                  >
                    규칙 제목
                  </label>
                  <input
                    id="rule-settings-name"
                    type="text"
                    autoFocus
                    value={metadata.name}
                    onChange={(event) => {
                      setMetadata((prev) => ({ ...prev, name: event.target.value }));
                    }}
                    className="mt-1.5 h-10 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400"
                  />
                </div>
                <div>
                  <div
                    className={`grid gap-3 ${metadataRule.status === 'ACTIVE' ? 'grid-cols-1' : 'grid-cols-2'}`}
                  >
                    <label className="block text-[11px] font-semibold text-slate-500">
                      시작일
                      <input
                        type="date"
                        value={metadata.startDate}
                        onChange={(event) => {
                          setMetadata((prev) => ({ ...prev, startDate: event.target.value }));
                        }}
                        className="mt-1.5 h-10 w-full rounded-sm border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400"
                      />
                    </label>
                    {metadataRule.status !== 'ACTIVE' && (
                      <label className="block text-[11px] font-semibold text-slate-500">
                        종료일
                        <input
                          type="date"
                          value={metadata.endDate}
                          onChange={(event) => {
                            setMetadata((prev) => ({ ...prev, endDate: event.target.value }));
                          }}
                          className="mt-1.5 h-10 w-full rounded-sm border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400"
                        />
                      </label>
                    )}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveMetadata}
                    disabled={
                      isSavingMetadata ||
                      !metadata.name.trim() ||
                      (metadata.name.trim() === metadataRule.name &&
                        metadata.startDate === metadataRule.startDate &&
                        metadata.endDate === (metadataRule.endDate ?? ''))
                    }
                    className="h-9 rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 cursor-pointer disabled:cursor-default disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white"
                  >
                    적용
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ─── 4. 점수 규칙 생성 모달 ─── */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-rule-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setIsAddModalOpen(false);
          }}
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <div
            // 바깥 상자는 모서리를 둥글게 자르기만 하고, 스크롤은 가운데 영역에서 한다
            // (바깥에서 스크롤하면 스크롤 막대가 오른쪽 둥근 모서리를 덮는다).
            className={`flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg animate-in fade-in zoom-in-95 duration-150 ${MODAL_SURFACE}`}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 pt-5 pb-3">
              <h3 id="add-rule-title" className="text-base font-bold text-slate-900">
                점수 규칙 생성
              </h3>
              <button
                type="button"
                aria-label="규칙 등록 닫기"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewRule} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto [scrollbar-gutter:stable] px-6 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-[11px] font-semibold text-slate-500">
                    규칙명 <span className="text-rose-500">*</span>
                    <input
                      type="text"
                      required
                      value={newRuleForm.name}
                      onChange={(event) =>
                        setNewRuleForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      className="mt-1.5 h-9 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-slate-400"
                    />
                  </label>
                  <label className="block text-[11px] font-semibold text-slate-500">
                    시작일 <span className="text-rose-500">*</span>
                    <input
                      type="date"
                      required
                      value={newRuleForm.startDate}
                      onChange={(e) =>
                        setNewRuleForm((prev) => ({ ...prev, startDate: e.target.value }))
                      }
                      className="mt-1.5 h-9 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-slate-400"
                    />
                  </label>
                </div>

                {/* 상세 화면과 같은 표. 배점(과 횟수) 칸만 입력칸이고, 합산 값 등은 고친 값으로 바로 다시 계산된다. */}
                {ruleSectionsOf({ ...currentRule, ...newRuleForm.scores } as ScoreRule).map(
                  (section) => (
                    <RuleSectionTable
                      key={section.title}
                      section={section}
                      editor={{
                        values: newRuleForm.scores,
                        onChange: (field, value) =>
                          setNewRuleForm((prev) => ({
                            ...prev,
                            scores: { ...prev.scores, [field]: value },
                          })),
                      }}
                      colWidths={colWidths}
                      resizingCol={resizingCol}
                      onResizeStart={startColumnResize}
                    />
                  ),
                )}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-6 py-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 cursor-pointer"
                >
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/** 규칙 생성 창에서 표의 배점·횟수 칸을 입력칸으로 바꿀 때 넘기는 값. */
interface RuleScoreEditor {
  values: Record<ScoreField, number>;
  onChange: (field: ScoreField, value: number) => void;
}

interface RuleSectionTableProps {
  section: RuleSection;
  /** 넘기면 배점(과 횟수) 칸이 입력칸이 된다. 표 모양은 보기와 같다. */
  editor?: RuleScoreEditor;
  colWidths: Record<RuleColumn, number>;
  resizingCol: RuleColumn | null;
  onResizeStart: (event: React.MouseEvent<HTMLElement>, column: RuleColumn) => void;
}

/** 규칙 한 절: 제목 · 기준 설명 · 항목/조건/점수 표 · 덧붙임. 열 너비는 모든 절이 함께 쓴다. */
function RuleSectionTable({
  section,
  editor,
  colWidths,
  resizingCol,
  onResizeStart,
}: RuleSectionTableProps) {
  const totalWidth = Object.values(colWidths).reduce((sum, width) => sum + width, 0);
  return (
    <section className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h4 className="text-sm font-normal text-slate-900">{section.title}</h4>
        {section.scope && <span className="text-[11px] text-slate-400">{section.scope}</span>}
      </div>
      {/* 표와 기준 설명을 나란히 둔다. 패널이 좁으면 설명이 표 아래로 내려간다. */}
      <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
        <div
          className="border border-slate-200/90 rounded-md overflow-hidden bg-white"
          style={{ width: totalWidth, maxWidth: '100%' }}
        >
          <table className="w-full table-fixed text-xs text-center border-collapse">
            <colgroup>
              {RULE_COLUMNS.map((column) => (
                <col
                  key={column.key}
                  style={{ width: `${(colWidths[column.key] / totalWidth) * 100}%` }}
                />
              ))}
            </colgroup>
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-700 font-normal">
              <tr>
                {RULE_COLUMNS.map((column) => (
                  <th key={column.key} className="relative px-3 py-2.5 text-center font-normal">
                    {column.label}
                    {/* 열 너비 조절 손잡이: 다른 관리 탭과 같은 방식으로 오른쪽 끝을 끈다. */}
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`${column.label} 열 너비 조절`}
                      title="열 너비 조절"
                      onMouseDown={(event) => onResizeStart(event, column.key)}
                      className={`absolute -right-2 top-0 bottom-0 z-10 w-4 cursor-col-resize select-none after:absolute after:inset-y-2 after:left-1/2 after:w-px after:-translate-x-1/2 after:transition-colors hover:after:bg-slate-400 ${
                        resizingCol === column.key ? 'after:bg-slate-500' : ''
                      }`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {section.rows.map((row) => {
                const editableCount =
                  editor && row.itemCount && row.itemCount.offset === 0 ? row.itemCount : null;
                const editableField = editor && row.field ? row.field : null;
                return (
                  <tr key={`${row.item}-${row.condition}`} className="hover:bg-slate-50/40">
                    <td
                      className={`px-3 text-center text-slate-800 ${editableCount ? 'py-1.5' : 'py-2.5'}`}
                    >
                      {editableCount ? (
                        // 항목 이름 안의 횟수(예: 결석 1~N회)도 고칠 수 있다.
                        <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
                          {editableCount.before.trim()}
                          <ScoreInput
                            value={editor!.values[editableCount.field]}
                            onChange={(value) => editor!.onChange(editableCount.field, value)}
                            ariaLabel={`${row.item} 횟수`}
                            unit={editableCount.after}
                            min={0}
                            isSigned={false}
                          />
                        </span>
                      ) : (
                        row.item
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-600">
                      {row.condition || '-'}
                    </td>
                    <td
                      className={`px-3 text-center ${editableField ? 'py-1.5' : `py-2.5 ${scoreClassOf(row.score)}`}`}
                    >
                      {editableField ? (
                        <ScoreInput
                          value={editor!.values[editableField]}
                          onChange={(value) => editor!.onChange(editableField, value)}
                          ariaLabel={`${row.item} 배점`}
                        />
                      ) : typeof row.score === 'number' ? (
                        formatScore(row.score)
                      ) : (
                        row.score
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {section.notes && (
          <ul className="min-w-[220px] flex-1 list-disc space-y-1 pl-4 pt-1 text-[11px] leading-relaxed text-slate-500">
            {section.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </div>
      {section.footnotes && (
        <ul className="space-y-0.5 text-[11px] text-slate-400">
          {section.footnotes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
