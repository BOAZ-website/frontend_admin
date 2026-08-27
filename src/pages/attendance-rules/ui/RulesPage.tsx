import { useEffect, useState } from "react";
import { CheckCircle2, Edit3, Plus, Save } from "lucide-react";

import type { ScoreRule } from "@/entities/score-rule/model/types";

interface RulesPageProps {
  rules: ScoreRule[];
  onUpdateRules: (newRules: ScoreRule[]) => void;
}

export function RulesPage({ rules, onUpdateRules }: RulesPageProps) {
  const activeRule = rules.find((r) => r.status === "ACTIVE") || rules[0];
  const [isEditMode, setIsEditMode] = useState(false);

  const [editingValues, setEditingValues] = useState({
    absentPenalty: activeRule?.absentPenalty ?? -3,
    unexcusedAbsentPenalty: activeRule?.unexcusedAbsentPenalty ?? -4,
    latePenalty: activeRule?.latePenalty ?? -1,
    earlyLeavePenalty: activeRule?.earlyLeavePenalty ?? -1,
    unexcusedLatePenalty: activeRule?.unexcusedLatePenalty ?? -4,
    presentScore: activeRule?.presentScore ?? 0,
    studyFailPenalty: activeRule?.studyFailPenalty ?? -5,
    studyPerfectBonus: activeRule?.studyPerfectBonus ?? 3,
    studyPassBonus: activeRule?.studyPassBonus ?? 1,
    studyLeaderBonus: activeRule?.studyLeaderBonus ?? 1,
  });

  const [showDraft, setShowDraft] = useState(false);
  const [draftValues, setDraftValues] = useState({
    absentPenalty: -3,
    unexcusedAbsentPenalty: -4,
    latePenalty: -1,
    earlyLeavePenalty: -1,
    unexcusedLatePenalty: -4,
    presentScore: 0,
    studyFailPenalty: -5,
    studyPerfectBonus: 3,
    studyPassBonus: 1,
    studyLeaderBonus: 1,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (activeRule) {
      setEditingValues({
        absentPenalty: activeRule.absentPenalty ?? -3,
        unexcusedAbsentPenalty: activeRule.unexcusedAbsentPenalty ?? -4,
        latePenalty: activeRule.latePenalty ?? -1,
        earlyLeavePenalty: activeRule.earlyLeavePenalty ?? -1,
        unexcusedLatePenalty: activeRule.unexcusedLatePenalty ?? -4,
        presentScore: activeRule.presentScore ?? 0,
        studyFailPenalty: activeRule.studyFailPenalty ?? -5,
        studyPerfectBonus: activeRule.studyPerfectBonus ?? 3,
        studyPassBonus: activeRule.studyPassBonus ?? 1,
        studyLeaderBonus: activeRule.studyLeaderBonus ?? 1,
      });
    }
  }, [activeRule]);

  const handleSaveActiveRule = () => {
    const updated = rules.map((r) => {
      if (r.status === "ACTIVE") {
        return {
          ...r,
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
        };
      }
      return r;
    });
    onUpdateRules(updated);
    setIsEditMode(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCreateDraft = () => {
    const newVersion = Math.max(...rules.map((r) => r.version), 0) + 1;
    const newDraft: ScoreRule = {
      version: newVersion,
      status: "DRAFT",
      activatedAt: null,
      createdBy: "차기대표진",
      absentPenalty: Number(draftValues.absentPenalty),
      unexcusedAbsentPenalty: Number(draftValues.unexcusedAbsentPenalty),
      latePenalty: Number(draftValues.latePenalty),
      earlyLeavePenalty: Number(draftValues.earlyLeavePenalty),
      unexcusedLatePenalty: Number(draftValues.unexcusedLatePenalty),
      presentScore: Number(draftValues.presentScore),
      studyFailPenalty: Number(draftValues.studyFailPenalty),
      studyPerfectBonus: Number(draftValues.studyPerfectBonus),
      studyPassBonus: Number(draftValues.studyPassBonus),
      studyLeaderBonus: Number(draftValues.studyLeaderBonus),
      present: Number(draftValues.presentScore),
      late: Number(draftValues.latePenalty),
      absent: Number(draftValues.absentPenalty),
    };
    onUpdateRules([newDraft, ...rules]);
    setShowDraft(false);
  };

  const handleActivateRule = (targetVersion: number) => {
    const today = new Date().toISOString().slice(0, 10);
    const updated = rules.map((r) => {
      if (r.version === targetVersion) {
        return { ...r, status: "ACTIVE" as const, activatedAt: today };
      }
      if (r.status === "ACTIVE") {
        return { ...r, status: "INACTIVE" as const };
      }
      return r;
    });
    onUpdateRules(updated);
  };

  return (
    <div className="w-full space-y-6">
      {/* Toast Alert */}
      {savedSuccess && (
        <div className="p-3 rounded-lg bg-slate-900 text-white flex items-center justify-between text-xs font-semibold shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>점수 규칙이 저장되었습니다. 전체 출결 표와 시트 수식에 반영되었습니다.</span>
          </div>
          <span className="font-mono text-slate-300 text-[11px]">저장 완료</span>
        </div>
      )}

      {/* Main Container */}
      {activeRule && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-2xs w-full">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">출결 및 스터디 점수 규칙</h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  v{activeRule.version} ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                정규 활동(세션/ADV) 및 스터디 출결 점수 산출 기준
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <button
                    onClick={() => setIsEditMode(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveActiveRule}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Save size={13} />
                    <span>저장</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEditMode(true)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Edit3 size={13} />
                  <span>수치 수정</span>
                </button>
              )}
            </div>
          </div>

          {/* 2-Column Tables */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full items-start">
            {/* ─── 1. 정규 활동 (세션 / ADV) ─── */}
            <div className="space-y-3">
              {/* Formula Bar (Excel fx style) */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                <span className="font-serif italic font-bold text-slate-400 shrink-0">fx</span>
                <span className="text-slate-400">|</span>
                <span className="truncate font-sans font-medium text-[11.5px] text-slate-700">
                  총점 = (사유결석 × {editingValues.absentPenalty}) + (무단결석 ×{" "}
                  {editingValues.unexcusedAbsentPenalty}) + (지각·조퇴 × {editingValues.latePenalty}
                  )
                </span>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>출석 (정규 활동)</span>
                  <span className="text-[11px] font-normal text-slate-500">감점</span>
                </div>

                <table className="w-full text-xs border-collapse">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">지각 (세션 시작 후 ~ 15분까지)</td>
                      <td className="px-4 py-2 text-right w-24">
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
                            className="w-14 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                          />
                        ) : (
                          <span className="font-mono font-bold text-rose-600 text-sm">
                            {editingValues.latePenalty}
                          </span>
                        )}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">무단지각 3회</td>
                      <td className="px-4 py-2 text-right w-24">
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
                            className="w-14 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                          />
                        ) : (
                          <span className="font-mono font-bold text-rose-600 text-sm">
                            {editingValues.unexcusedLatePenalty}
                          </span>
                        )}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">조퇴</td>
                      <td className="px-4 py-2 text-right w-24">
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
                            className="w-14 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                          />
                        ) : (
                          <span className="font-mono font-bold text-rose-600 text-sm">
                            {editingValues.earlyLeavePenalty}
                          </span>
                        )}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">사유결석</td>
                      <td className="px-4 py-2 text-right w-24">
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
                            className="w-14 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                          />
                        ) : (
                          <span className="font-mono font-bold text-rose-600 text-sm">
                            {editingValues.absentPenalty}
                          </span>
                        )}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">
                        <span>무단결석</span>
                        <span className="text-[11px] text-slate-400 ml-1.5">
                          (3회 시 동아리 제명)
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right w-24">
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
                            className="w-14 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                          />
                        ) : (
                          <span className="font-mono font-bold text-rose-600 text-sm">
                            {editingValues.unexcusedAbsentPenalty}
                          </span>
                        )}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">
                        <span>불가피한 상황 또는 운영진 인정 사유결석</span>
                        <span className="text-[11px] text-slate-400 ml-1.5">(증빙 필요)</span>
                      </td>
                      <td className="px-4 py-2 text-right w-24 font-medium text-slate-400 text-xs">
                        변동 없음
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Subtitle / Footnote */}
                <div className="bg-slate-50/50 py-2 px-4 text-center text-[11px] text-slate-500 border-t border-slate-100">
                  * (1Term 기준) &apos;연속 4주 결석&apos; 또는 &apos;총 6회 이상 결석&apos; 시
                  동아리에서 제명될 수 있음
                </div>
              </div>
            </div>

            {/* ─── 2. 스터디 ─── */}
            <div className="space-y-3">
              {/* Formula Bar (Excel fx style) */}
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                <span className="font-serif italic font-bold text-slate-400 shrink-0">fx</span>
                <span className="text-slate-400">|</span>
                <span className="truncate font-sans font-medium text-[11.5px] text-slate-700">
                  =SUM( IF(출석 ≤ 4, {editingValues.studyFailPenalty}, IF(출석 &lt; 7,{" "}
                  {editingValues.studyPassBonus}, {editingValues.studyPerfectBonus})), 스터디장 )
                </span>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 font-bold text-slate-800 text-xs flex items-center justify-between">
                  <span>스터디</span>
                  <span className="text-[11px] font-normal text-slate-500">배점</span>
                </div>

                <table className="w-full text-xs border-collapse">
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">
                        각 Term 방학 기간에 스터디를 하나도 이수하지 못할 경우
                      </td>
                      <td className="px-4 py-2 text-right w-24">
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
                            className="w-14 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                          />
                        ) : (
                          <span className="font-mono font-bold text-rose-600 text-sm">
                            {editingValues.studyFailPenalty}
                          </span>
                        )}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">
                        각 Term 방학 기간에 스터디 출석률이 70% 미만일 경우 (4회 이하)
                      </td>
                      <td className="px-4 py-2 text-right w-24">
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
                            className="w-14 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-rose-600 bg-white"
                          />
                        ) : (
                          <span className="font-mono font-bold text-rose-600 text-sm">
                            {editingValues.studyFailPenalty}
                          </span>
                        )}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">
                        스터디 100% 출석률 회원 (7~8회 성실 출석)
                      </td>
                      <td className="px-4 py-2 text-right w-24">
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
                            className="w-14 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-blue-600 bg-white"
                          />
                        ) : (
                          <span className="font-mono font-bold text-blue-600 text-sm">
                            +{editingValues.studyPerfectBonus}
                          </span>
                        )}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">
                        스터디 70% 이상 100% 미만 출석률 회원 (5~6회 정규 수료)
                      </td>
                      <td className="px-4 py-2 text-right w-24">
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
                            className="w-14 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-blue-600 bg-white"
                          />
                        ) : (
                          <span className="font-mono font-bold text-blue-600 text-sm">
                            +{editingValues.studyPassBonus}
                          </span>
                        )}
                      </td>
                    </tr>

                    <tr className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 text-slate-700">스터디 팀장 (스터디장 가산점)</td>
                      <td className="px-4 py-2 text-right w-24">
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
                            className="w-14 text-center font-mono font-bold border border-slate-300 rounded py-0.5 text-xs text-blue-600 bg-white"
                          />
                        ) : (
                          <span className="font-mono font-bold text-blue-600 text-sm">
                            +{editingValues.studyLeaderBonus}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Subtitle / Footnote */}
                <div className="bg-slate-50/50 py-2 px-4 text-center text-[11px] text-slate-500 border-t border-slate-100">
                  * 8주 기준 70%(5회) 이상 출석 시 수료(+{editingValues.studyPassBonus}점), 100%(7회
                  이상) 출석 시 우수(+{editingValues.studyPerfectBonus}점), 팀장 +
                  {editingValues.studyLeaderBonus}점
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rules History Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs w-full">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">규칙 버전 관리</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              역대 점수 규칙 버전 기록 및 차기 대표진 DRAFT 작성
            </p>
          </div>
          <button
            onClick={() => setShowDraft((v) => !v)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>신규 DRAFT 작성</span>
          </button>
        </div>

        {showDraft && (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3 text-xs">
            <div className="font-bold text-slate-900 flex items-center justify-between">
              <span>새로운 DRAFT 규칙 작성</span>
              <span className="font-mono text-slate-500 text-[11px]">
                v{Math.max(...rules.map((r) => r.version), 0) + 1} 생성 예정
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">지각/조퇴 (점)</label>
                <input
                  type="number"
                  value={draftValues.latePenalty}
                  onChange={(e) =>
                    setDraftValues((v) => ({
                      ...v,
                      latePenalty: Number(e.target.value),
                      earlyLeavePenalty: Number(e.target.value),
                    }))
                  }
                  className="w-full px-2.5 py-1 text-xs text-center rounded border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">사유결석 (점)</label>
                <input
                  type="number"
                  value={draftValues.absentPenalty}
                  onChange={(e) =>
                    setDraftValues((v) => ({ ...v, absentPenalty: Number(e.target.value) }))
                  }
                  className="w-full px-2.5 py-1 text-xs text-center rounded border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">무단결석 (점)</label>
                <input
                  type="number"
                  value={draftValues.unexcusedAbsentPenalty}
                  onChange={(e) =>
                    setDraftValues((v) => ({
                      ...v,
                      unexcusedAbsentPenalty: Number(e.target.value),
                    }))
                  }
                  className="w-full px-2.5 py-1 text-xs text-center rounded border border-slate-300 bg-white"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block mb-1">스터디 미이수 (점)</label>
                <input
                  type="number"
                  value={draftValues.studyFailPenalty}
                  onChange={(e) =>
                    setDraftValues((v) => ({ ...v, studyFailPenalty: Number(e.target.value) }))
                  }
                  className="w-full px-2.5 py-1 text-xs text-center rounded border border-slate-300 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowDraft(false)}
                className="px-3 py-1 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleCreateDraft}
                className="px-3 py-1 text-xs bg-slate-900 text-white rounded font-bold hover:bg-slate-800 cursor-pointer"
              >
                DRAFT 저장
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
          {rules.map((rule) => (
            <div
              key={rule.version}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-xs"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono font-bold text-slate-900">v{rule.version}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    rule.status === "ACTIVE"
                      ? "bg-slate-900 text-white"
                      : rule.status === "DRAFT"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {rule.status}
                </span>
                <span className="text-slate-500 text-[11px]">
                  {rule.activatedAt ? `활성: ${rule.activatedAt}` : "미활성"} · 작성:{" "}
                  {rule.createdBy}
                </span>
                <span className="text-slate-600 text-[11px] font-mono">
                  정규: 결석 {rule.absentPenalty ?? -3} / 무단 {rule.unexcusedAbsentPenalty ?? -4} /
                  지각 {rule.latePenalty ?? -1} · 스터디: 미이수 {rule.studyFailPenalty ?? -5} /
                  100% +{rule.studyPerfectBonus ?? 3}
                </span>
              </div>

              {rule.status === "DRAFT" && (
                <button
                  onClick={() => handleActivateRule(rule.version)}
                  className="px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold cursor-pointer"
                >
                  활성화
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
