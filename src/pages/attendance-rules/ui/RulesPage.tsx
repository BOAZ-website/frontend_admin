import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Pencil, Plus, Save, Trash2, X } from 'lucide-react';

import { formatDateRange, getTodayString } from '@/entities/score-rule/model/lib';
import type { ScoreRule } from '@/entities/score-rule/model/types';
import { MODAL_PRIMARY_BTN, MODAL_SURFACE } from '@/shared/ui/modalStyles';

interface RulesPageProps {
  rules: ScoreRule[];
  onUpdateRules: (newRules: ScoreRule[]) => void;
}

export function RulesPage({ rules, onUpdateRules }: RulesPageProps) {
  const todayStr = useMemo(() => getTodayString(), []);

  // 규칙 목록 정규화 (기수 및 기간 누락 방지)
  const safeRules = useMemo(() => {
    return (rules || []).map((r, idx) => {
      const fallbackTerm = r.term ?? 27 - idx;
      const fallbackVersion = r.version ?? (rules?.length || 3) - idx;
      return {
        ...r,
        term: fallbackTerm,
        version: fallbackVersion,
        name: r.name ?? `Version ${fallbackVersion} 점수 규칙`,
        startDate:
          r.startDate ??
          (fallbackTerm === 27 ? '2026-07-01' : fallbackTerm === 26 ? '2026-01-01' : '2025-07-01'),
        endDate:
          r.endDate !== undefined
            ? r.endDate
            : fallbackTerm === 27
              ? '2026-12-31'
              : fallbackTerm === 26
                ? '2026-06-30'
                : '2025-12-31',
      };
    });
  }, [rules]);

  // 기본 선택 기수
  const defaultSelectedTerm = useMemo(() => {
    const active = safeRules.find((r) => r.status === 'ACTIVE');
    return active?.term ?? safeRules[0]?.term ?? 27;
  }, [safeRules]);

  const [selectedTerm, setSelectedTerm] = useState<number>(defaultSelectedTerm);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // 현재 선택된 기수의 규칙
  const currentRule = useMemo(() => {
    return safeRules.find((r) => r.term === selectedTerm) || safeRules[0];
  }, [safeRules, selectedTerm]);

  // 편집 폼 상태
  const [editingValues, setEditingValues] = useState({
    name: currentRule?.name ?? '',
    startDate: currentRule?.startDate ?? '',
    endDate: currentRule?.endDate ?? '',
    description: currentRule?.description ?? '',
    absentPenalty: currentRule?.absentPenalty ?? -3,
    unexcusedAbsentPenalty: currentRule?.unexcusedAbsentPenalty ?? -4,
    latePenalty: currentRule?.latePenalty ?? -1,
    earlyLeavePenalty: currentRule?.earlyLeavePenalty ?? -1,
    unexcusedLatePenalty: currentRule?.unexcusedLatePenalty ?? -4,
    presentScore: currentRule?.presentScore ?? 0,
    studyFailPenalty: currentRule?.studyFailPenalty ?? -5,
    studyPerfectBonus: currentRule?.studyPerfectBonus ?? 3,
    studyPassBonus: currentRule?.studyPassBonus ?? 1,
    studyLeaderBonus: currentRule?.studyLeaderBonus ?? 1,
  });

  useEffect(() => {
    if (currentRule) {
      setEditingValues({
        name: currentRule.name ?? `${currentRule.term}기 점수 규칙`,
        startDate: currentRule.startDate ?? '',
        endDate: currentRule.endDate ?? '',
        description: currentRule.description ?? '',
        absentPenalty: currentRule.absentPenalty ?? -3,
        unexcusedAbsentPenalty: currentRule.unexcusedAbsentPenalty ?? -4,
        latePenalty: currentRule.latePenalty ?? -1,
        earlyLeavePenalty: currentRule.earlyLeavePenalty ?? -1,
        unexcusedLatePenalty: currentRule.unexcusedLatePenalty ?? -4,
        presentScore: currentRule.presentScore ?? 0,
        studyFailPenalty: currentRule.studyFailPenalty ?? -5,
        studyPerfectBonus: currentRule.studyPerfectBonus ?? 3,
        studyPassBonus: currentRule.studyPassBonus ?? 1,
        studyLeaderBonus: currentRule.studyLeaderBonus ?? 1,
      });
      setIsEditMode(false);
    }
  }, [currentRule]);

  // 저장 처리
  const handleSaveCurrentRule = () => {
    if (!currentRule) return;

    const updatedRules = safeRules.map((r) => {
      if (r.term === currentRule.term) {
        return {
          ...r,
          name: editingValues.name,
          startDate: editingValues.startDate,
          endDate: editingValues.endDate || null,
          description: editingValues.description,
          absentPenalty: Number(editingValues.absentPenalty),
          unexcusedAbsentPenalty: Number(editingValues.unexcusedAbsentPenalty),
          latePenalty: Number(editingValues.latePenalty),
          earlyLeavePenalty: Number(editingValues.earlyLeavePenalty),
          unexcusedLatePenalty: Number(editingValues.unexcusedLatePenalty),
          presentScore: Number(editingValues.presentScore),
          studyFailPenalty: Number(editingValues.studyFailPenalty),
          studyPerfectBonus: Number(editingValues.studyPerfectBonus),
          studyPassBonus: Number(editingValues.studyPassBonus),
          studyLeaderBonus: Number(editingValues.studyLeaderBonus),
          present: Number(editingValues.presentScore),
          absent: Number(editingValues.absentPenalty),
          late: Number(editingValues.latePenalty),
        };
      }
      return r;
    });

    onUpdateRules(updatedRules);
    setIsEditMode(false);
  };

  // 규칙 삭제
  const handleDeleteRule = (term: number) => {
    if (safeRules.length <= 1) {
      alert('최소 하나의 점수 규칙은 유지되어야 합니다.');
      return;
    }
    const targetRule = safeRules.find((r) => r.term === term);
    const ruleLabel = targetRule ? `Version ${targetRule.version}` : `${term}기`;
    if (confirm(`${ruleLabel} 점수 규칙을 삭제하시겠습니까?`)) {
      const remaining = safeRules.filter((r) => r.term !== term);
      onUpdateRules(remaining);
      setSelectedTerm(remaining[0].term);
    }
  };

  // 신규 기수 등록 폼 상태
  const [newRuleForm, setNewRuleForm] = useState({
    term: 28,
    name: '28기 점수 규칙',
    startDate: todayStr,
    endDate: '',
    noEndDate: true,
    description: '',
    templateTerm: currentRule?.term ?? 27,
    status: 'ACTIVE' as 'ACTIVE' | 'DRAFT',
    absentPenalty: currentRule?.absentPenalty ?? -3,
    unexcusedAbsentPenalty: currentRule?.unexcusedAbsentPenalty ?? -4,
    latePenalty: currentRule?.latePenalty ?? -1,
    earlyLeavePenalty: currentRule?.earlyLeavePenalty ?? -1,
    unexcusedLatePenalty: currentRule?.unexcusedLatePenalty ?? -4,
    presentScore: currentRule?.presentScore ?? 0,
    studyFailPenalty: currentRule?.studyFailPenalty ?? -5,
    studyPerfectBonus: currentRule?.studyPerfectBonus ?? 3,
    studyPassBonus: currentRule?.studyPassBonus ?? 1,
    studyLeaderBonus: currentRule?.studyLeaderBonus ?? 1,
  });

  const handleOpenAddModal = (copyFromTerm?: number) => {
    const source = copyFromTerm
      ? safeRules.find((r) => r.term === copyFromTerm) || currentRule
      : currentRule;

    const maxTerm = Math.max(...safeRules.map((r) => r.term), 27);
    const nextTerm = copyFromTerm ? copyFromTerm + 1 : maxTerm + 1;

    setNewRuleForm({
      term: nextTerm,
      name: `${nextTerm}기 점수 규칙`,
      startDate: todayStr,
      endDate: '',
      noEndDate: true,
      description: '',
      templateTerm: source?.term ?? 27,
      status: 'ACTIVE',
      absentPenalty: source?.absentPenalty ?? -3,
      unexcusedAbsentPenalty: source?.unexcusedAbsentPenalty ?? -4,
      latePenalty: source?.latePenalty ?? -1,
      earlyLeavePenalty: source?.earlyLeavePenalty ?? -1,
      unexcusedLatePenalty: source?.unexcusedLatePenalty ?? -4,
      presentScore: source?.presentScore ?? 0,
      studyFailPenalty: source?.studyFailPenalty ?? -5,
      studyPerfectBonus: source?.studyPerfectBonus ?? 3,
      studyPassBonus: source?.studyPassBonus ?? 1,
      studyLeaderBonus: source?.studyLeaderBonus ?? 1,
    });
    setIsAddModalOpen(true);
  };

  const handleCreateNewRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleForm.startDate) {
      alert('적용 시작일을 입력해주세요.');
      return;
    }

    const termNum = Number(newRuleForm.term);
    if (safeRules.some((r) => r.term === termNum)) {
      alert(`이미 ${termNum}기 규칙이 존재합니다.`);
      return;
    }

    const newRule: ScoreRule = {
      id: `rule-${termNum}`,
      version: (safeRules.length || 0) + 1,
      term: termNum,
      name: newRuleForm.name,
      startDate: newRuleForm.startDate,
      endDate: newRuleForm.noEndDate || !newRuleForm.endDate ? null : newRuleForm.endDate,
      status: newRuleForm.status,
      activatedAt: newRuleForm.status === 'ACTIVE' ? todayStr : null,
      createdBy: `${termNum}기 대표진`,
      description: newRuleForm.description,
      present: Number(newRuleForm.presentScore),
      absent: Number(newRuleForm.absentPenalty),
      late: Number(newRuleForm.latePenalty),
      absentPenalty: Number(newRuleForm.absentPenalty),
      unexcusedAbsentPenalty: Number(newRuleForm.unexcusedAbsentPenalty),
      latePenalty: Number(newRuleForm.latePenalty),
      earlyLeavePenalty: Number(newRuleForm.earlyLeavePenalty),
      unexcusedLatePenalty: Number(newRuleForm.unexcusedLatePenalty),
      presentScore: Number(newRuleForm.presentScore),
      studyFailPenalty: Number(newRuleForm.studyFailPenalty),
      studyPerfectBonus: Number(newRuleForm.studyPerfectBonus),
      studyPassBonus: Number(newRuleForm.studyPassBonus),
      studyLeaderBonus: Number(newRuleForm.studyLeaderBonus),
    };

    let updatedList = [...safeRules];
    if (newRuleForm.status === 'ACTIVE') {
      updatedList = updatedList.map((r) => ({
        ...r,
        status: 'INACTIVE' as const,
      }));
    }
    updatedList.unshift(newRule);
    updatedList.sort((a, b) => b.term - a.term);

    onUpdateRules(updatedList);
    setSelectedTerm(termNum);
    setIsAddModalOpen(false);
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
      </div>

      {/* ─── 2. Two-Pane Layout (좌측: 기수 목록 카드 / 우측: 선택 기수 상세 표) ─── */}
      <div className="relative w-full flex-1 min-h-0 flex flex-row gap-4 h-full min-w-0 items-start">
        {/* 좌측: 규칙 목록 패널 */}
        <div className="w-64 shrink-0 space-y-2.5 h-full overflow-y-auto pr-1">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              규칙 목록
            </span>
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-slate-200 shadow-2xs"
            >
              <Plus size={12} />
              <span>새 규칙</span>
            </button>
          </div>

          <div className="space-y-2">
            {safeRules.map((rule) => {
              const isSelected = rule.term === selectedTerm;

              return (
                <div
                  key={rule.term}
                  onClick={() => {
                    setSelectedTerm(rule.term);
                    setIsEditMode(false);
                  }}
                  className={`relative rounded-2xl border transition-all cursor-pointer p-3.5 select-none ${
                    isSelected
                      ? 'bg-slate-100/80 border-slate-300 shadow-2xs'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <h4
                        className={`text-sm font-bold truncate ${
                          isSelected ? 'text-slate-950' : 'text-slate-800'
                        }`}
                      >
                        Version {rule.version}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate font-mono">
                        {formatDateRange(rule.startDate, rule.endDate)}
                      </p>
                    </div>
                    <ChevronRight
                      size={15}
                      className={`shrink-0 ${isSelected ? 'text-slate-700' : 'text-slate-400'}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 우측: 선택된 점수 규칙 상세 표 */}
        {currentRule && (
          <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4 shadow-2xs h-full overflow-y-auto">
            {/* Header / Meta / Actions */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Version {currentRule.version} 점수 규칙
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                  <span>적용 기간 :</span>
                  {isEditMode ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={editingValues.startDate}
                        onChange={(e) =>
                          setEditingValues((v) => ({ ...v, startDate: e.target.value }))
                        }
                        className="border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800"
                      />
                      <span>~</span>
                      <input
                        type="date"
                        value={editingValues.endDate}
                        onChange={(e) =>
                          setEditingValues((v) => ({ ...v, endDate: e.target.value }))
                        }
                        placeholder="종료일(선택)"
                        className="border border-slate-300 rounded px-1.5 py-0.5 text-xs text-slate-800"
                      />
                    </div>
                  ) : (
                    <span className="font-semibold text-slate-700">
                      {formatDateRange(currentRule.startDate, currentRule.endDate)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Edit Button */}
                {isEditMode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditMode(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCurrentRule}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Save size={13} />
                      <span>저장</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsEditMode(true)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Pencil size={13} />
                      <span>수정</span>
                    </button>
                    {safeRules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(currentRule.term)}
                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="규칙 삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Clean Table (정규 활동 + 스터디 전체 표시) */}
            <div className="border border-slate-200/90 rounded-xl overflow-hidden bg-white">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-700 font-bold">
                  <tr>
                    <th className="px-4 py-3 w-28 text-center">구분</th>
                    <th className="px-4 py-3 w-40">출결 상태 / 항목</th>
                    <th className="px-4 py-3">세부 기준 및 조건</th>
                    <th className="px-4 py-3 w-32 text-right">배점</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* 1. 정규 활동 세션 항목 */}
                  <tr className="hover:bg-slate-50/40">
                    <td
                      rowSpan={6}
                      className="px-4 py-3 text-center font-bold text-slate-800 bg-slate-50/30 border-r border-slate-100 align-middle"
                    >
                      정규 활동
                      <br />
                      (세션 / ADV)
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">지각</td>
                    <td className="px-4 py-2.5 text-slate-600">세션 시작 후 ~ 15분까지</td>
                    <td className="px-4 py-2 text-right">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={editingValues.latePenalty}
                          onChange={(e) =>
                            setEditingValues((v) => ({
                              ...v,
                              latePenalty: Number(e.target.value),
                            }))
                          }
                          className="w-16 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                        />
                      ) : (
                        <span className="font-mono font-bold text-rose-600 text-sm">
                          {editingValues.latePenalty}점
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">무단지각 3회</td>
                    <td className="px-4 py-2.5 text-slate-600">사전 연락 없는 지각 3회 누적 시</td>
                    <td className="px-4 py-2 text-right">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={editingValues.unexcusedLatePenalty}
                          onChange={(e) =>
                            setEditingValues((v) => ({
                              ...v,
                              unexcusedLatePenalty: Number(e.target.value),
                            }))
                          }
                          className="w-16 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                        />
                      ) : (
                        <span className="font-mono font-bold text-rose-600 text-sm">
                          {editingValues.unexcusedLatePenalty}점
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">조퇴</td>
                    <td className="px-4 py-2.5 text-slate-600">정규 세션 종료 전 조기 퇴장</td>
                    <td className="px-4 py-2 text-right">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={editingValues.earlyLeavePenalty}
                          onChange={(e) =>
                            setEditingValues((v) => ({
                              ...v,
                              earlyLeavePenalty: Number(e.target.value),
                            }))
                          }
                          className="w-16 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                        />
                      ) : (
                        <span className="font-mono font-bold text-rose-600 text-sm">
                          {editingValues.earlyLeavePenalty}점
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">사유결석</td>
                    <td className="px-4 py-2.5 text-slate-600">사전 통보된 개인 사정 결석</td>
                    <td className="px-4 py-2 text-right">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={editingValues.absentPenalty}
                          onChange={(e) =>
                            setEditingValues((v) => ({
                              ...v,
                              absentPenalty: Number(e.target.value),
                            }))
                          }
                          className="w-16 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                        />
                      ) : (
                        <span className="font-mono font-bold text-rose-600 text-sm">
                          {editingValues.absentPenalty}점
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">무단결석</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      사전 통보 없는 결석{' '}
                      <span className="text-slate-400">(3회 시 동아리 제명)</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={editingValues.unexcusedAbsentPenalty}
                          onChange={(e) =>
                            setEditingValues((v) => ({
                              ...v,
                              unexcusedAbsentPenalty: Number(e.target.value),
                            }))
                          }
                          className="w-16 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                        />
                      ) : (
                        <span className="font-mono font-bold text-rose-600 text-sm">
                          {editingValues.unexcusedAbsentPenalty}점
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">인정 사유결석</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      운영진 승인 불가피 사유결석 (증빙 제출)
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-bold text-slate-500">0점</td>
                  </tr>

                  {/* 2. 스터디 항목 */}
                  <tr className="hover:bg-slate-50/40">
                    <td
                      rowSpan={4}
                      className="px-4 py-3 text-center font-bold text-slate-800 bg-slate-50/30 border-r border-slate-100 align-middle"
                    >
                      스터디
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800">미이수 / 저조</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      각 Term 방학 기간 출석률 70% 미만 (4회 이하)
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={editingValues.studyFailPenalty}
                          onChange={(e) =>
                            setEditingValues((v) => ({
                              ...v,
                              studyFailPenalty: Number(e.target.value),
                            }))
                          }
                          className="w-16 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                        />
                      ) : (
                        <span className="font-mono font-bold text-rose-600 text-sm">
                          {editingValues.studyFailPenalty}점
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">정규 수료</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      출석률 70% 이상 100% 미만 (5~6회 출석)
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={editingValues.studyPassBonus}
                          onChange={(e) =>
                            setEditingValues((v) => ({
                              ...v,
                              studyPassBonus: Number(e.target.value),
                            }))
                          }
                          className="w-16 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-slate-800 bg-white"
                        />
                      ) : (
                        <span className="font-mono font-bold text-slate-800 text-sm">
                          +{editingValues.studyPassBonus}점
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">100% 개근</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      성실 출석률 100% (7~8회 성실 출석)
                    </td>
                    <td className="px-4 py-2 text-right">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={editingValues.studyPerfectBonus}
                          onChange={(e) =>
                            setEditingValues((v) => ({
                              ...v,
                              studyPerfectBonus: Number(e.target.value),
                            }))
                          }
                          className="w-16 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-slate-800 bg-white"
                        />
                      ) : (
                        <span className="font-mono font-bold text-slate-800 text-sm">
                          +{editingValues.studyPerfectBonus}점
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-50/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-800">스터디 팀장</td>
                    <td className="px-4 py-2.5 text-slate-600">스터디장 리더 가산점</td>
                    <td className="px-4 py-2 text-right">
                      {isEditMode ? (
                        <input
                          type="number"
                          value={editingValues.studyLeaderBonus}
                          onChange={(e) =>
                            setEditingValues((v) => ({
                              ...v,
                              studyLeaderBonus: Number(e.target.value),
                            }))
                          }
                          className="w-16 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-slate-800 bg-white"
                        />
                      ) : (
                        <span className="font-mono font-bold text-slate-800 text-sm">
                          +{editingValues.studyLeaderBonus}점
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ─── 4. 새 기수 점수 규칙 등록 모달 ─── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className={`rounded-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 ${MODAL_SURFACE}`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">새 기수 점수 규칙 등록</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewRule} className="space-y-4">
              {/* 기수 및 시작일 직접 입력 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    기수 (Term) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      value={newRuleForm.term}
                      onChange={(e) =>
                        setNewRuleForm((prev) => ({
                          ...prev,
                          term: Number(e.target.value),
                          name: `${e.target.value}기 점수 규칙`,
                        }))
                      }
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold"
                    />
                    <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold">
                      기
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    적용 시작일 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newRuleForm.startDate}
                    onChange={(e) =>
                      setNewRuleForm((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* 종료일 설정 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">적용 종료일</label>
                  <label className="flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRuleForm.noEndDate}
                      onChange={(e) =>
                        setNewRuleForm((prev) => ({ ...prev, noEndDate: e.target.checked }))
                      }
                      className="rounded text-slate-900"
                    />
                    <span>종료일 미지정 (기수 종료 시까지)</span>
                  </label>
                </div>
                <input
                  type="date"
                  disabled={newRuleForm.noEndDate}
                  value={newRuleForm.endDate}
                  onChange={(e) => setNewRuleForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 font-mono disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              {/* 템플릿 복제 옵션 */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  기존 기수 배점 복제
                </label>
                <select
                  value={newRuleForm.templateTerm}
                  onChange={(e) => {
                    const termNum = Number(e.target.value);
                    const source = safeRules.find((r) => r.term === termNum);
                    if (source) {
                      setNewRuleForm((prev) => ({
                        ...prev,
                        templateTerm: termNum,
                        absentPenalty: source.absentPenalty ?? -3,
                        unexcusedAbsentPenalty: source.unexcusedAbsentPenalty ?? -4,
                        latePenalty: source.latePenalty ?? -1,
                        earlyLeavePenalty: source.earlyLeavePenalty ?? -1,
                        unexcusedLatePenalty: source.unexcusedLatePenalty ?? -4,
                        presentScore: source.presentScore ?? 0,
                        studyFailPenalty: source.studyFailPenalty ?? -5,
                        studyPerfectBonus: source.studyPerfectBonus ?? 3,
                        studyPassBonus: source.studyPassBonus ?? 1,
                        studyLeaderBonus: source.studyLeaderBonus ?? 1,
                      }));
                    }
                  }}
                  className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 text-slate-800"
                >
                  {safeRules.map((r) => (
                    <option key={r.term} value={r.term}>
                      Version {r.version} 배점 복제 ({formatDateRange(r.startDate, r.endDate)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${MODAL_PRIMARY_BTN}`}
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
