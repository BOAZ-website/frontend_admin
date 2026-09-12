import { useState } from "react";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Unlock,
  X,
} from "lucide-react";

import type { HostAccount } from "@/entities/host-account/model/types";
import type { StudyPeriodType, StudyTeamInfo } from "@/entities/study-team/model/types";
import { CardHeader } from "@/shared/ui/CardHeader";
import { SectionCard } from "@/shared/ui/SectionCard";
import { Tag } from "@/shared/ui/Tag";

export function HostsPage({
  hosts,
  setHosts,
  studyTeams,
  onRegisterStudyTeam,
}: {
  hosts: HostAccount[];
  setHosts: React.Dispatch<React.SetStateAction<HostAccount[]>>;
  studyTeams: StudyTeamInfo[];
  onRegisterStudyTeam: (data: {
    teamName: string;
    studyName: string;
    leaderName: string;
    category: string;
    schedule: string;
    studyType?: StudyPeriodType;
    description?: string;
    customUsername: string;
    customPassword?: string;
    memberNames?: string[];
  }) => HostAccount;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTeam, setNewTeam] = useState("E팀");
  const [newStudyType, setNewStudyType] = useState<StudyPeriodType>("방학 스터디");
  const [newStudyName, setNewStudyName] = useState("");
  const [newHostName, setNewHostName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [customUsername, setCustomUsername] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [visiblePwId, setVisiblePwId] = useState<string | null>(null);

  const DEFAULT_DELIVERY_TEMPLATE = `[BOAZ 스터디 출결 관리 - HOST(스터디장) 계정 발급 안내]

안녕하세요, {이름} 스터디장님!
BOAZ 출결 관리 시스템 스터디장 계정이 발급되었습니다.

■ 접속 URL: http://localhost:5173
■ 담당 스터디: {스터디명}
■ 아이디: {아이디}
■ 초기 비밀번호: {비밀번호}

※ 첫 로그인 후 스터디 출결 및 인증 사진을 매주 세션 종료 후 입력해 주시기 바랍니다.
※ 문의: BOAZ 운영지원팀`;

  const [savedTemplate, setSavedTemplate] = useState<string>(() => {
    return localStorage.getItem("boaz_delivery_template") || DEFAULT_DELIVERY_TEMPLATE;
  });
  const [savedTemplateNotice, setSavedTemplateNotice] = useState(false);

  const [issuedHost, setIssuedHost] = useState<HostAccount | null>(null);
  const [issuedDeliveryText, setIssuedDeliveryText] = useState("");
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [resetModalHost, setResetModalHost] = useState<{
    host: HostAccount;
    newPass: string;
  } | null>(null);
  const [deliveryModal, setDeliveryModal] = useState<{
    host: HostAccount;
    studyName: string;
    text: string;
    originalText: string;
  } | null>(null);

  function generateRandomPassword() {
    return "Boaz77!!";
  }

  function generateDeliveryText(host: HostAccount, password?: string, customTpl?: string) {
    const pw = password || host.initialPassword || "Boaz77!!";
    const matchedStudy = studyTeams.find((s) => s.teamName === host.team);
    const studyName = matchedStudy?.studyName || host.team;
    const rawName = matchedStudy?.leaderName || host.hostName || "";
    const cleanLeaderName =
      rawName
        .replace(/\s*\(.*?\)\s*/g, "")
        .replace(/팀장/g, "")
        .trim() || "보아즈";

    const tpl = customTpl || savedTemplate || DEFAULT_DELIVERY_TEMPLATE;
    return tpl
      .replace(/\{이름\}/g, cleanLeaderName)
      .replace(/\{스터디명\}/g, studyName)
      .replace(/\{아이디\}/g, host.username)
      .replace(/\{비밀번호\}/g, pw)
      .replace(/\{접속URL\}/g, "http://localhost:5173");
  }

  function handleSaveAsDefaultTemplate(currentText: string, host: HostAccount, password?: string) {
    const pw = password || host.initialPassword || "Boaz77!!";
    const matchedStudy = studyTeams.find((s) => s.teamName === host.team);
    const studyName = matchedStudy?.studyName || host.team;
    const rawName = matchedStudy?.leaderName || host.hostName || "";
    const cleanLeaderName =
      rawName
        .replace(/\s*\(.*?\)\s*/g, "")
        .replace(/팀장/g, "")
        .trim() || "보아즈";

    let tpl = currentText;
    if (cleanLeaderName) {
      tpl = tpl.split(cleanLeaderName).join("{이름}");
    }
    if (studyName) {
      tpl = tpl.split(studyName).join("{스터디명}");
    }
    if (host.username) {
      tpl = tpl.split(host.username).join("{아이디}");
    }
    if (pw) {
      tpl = tpl.split(pw).join("{비밀번호}");
    }

    setSavedTemplate(tpl);
    localStorage.setItem("boaz_delivery_template", tpl);
    setSavedTemplateNotice(true);
    setTimeout(() => setSavedTemplateNotice(false), 2500);
  }

  function handleResetToSavedTemplate(host: HostAccount, password?: string) {
    return generateDeliveryText(host, password, savedTemplate);
  }

  function handleOpenDeliveryModal(host: HostAccount, password?: string) {
    const text = generateDeliveryText(host, password);
    const matchedStudy = studyTeams.find((s) => s.teamName === host.team);
    setDeliveryModal({
      host,
      studyName: matchedStudy?.studyName || host.team,
      text,
      originalText: text,
    });
  }

  function handleCopyDeliveryMessage(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    });
  }

  function handleOpenAddModal() {
    // Generate next team letter automatically based on existing teams
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nextIdx = studyTeams.length;
    const defaultTeam = `${alphabet[nextIdx] || "E"}팀`;

    setNewTeam(defaultTeam);
    setNewStudyType("방학 스터디");
    setNewStudyName("");
    setNewHostName("");
    setNewDescription("");
    setCustomUsername("");
    setCustomPassword("");
    setShowAddModal(true);
  }

  function handleCreateStudyAndHost() {
    const finalStudyName = newStudyName.trim() || "Terraform 스터디";
    const finalHostName = newHostName.trim() || "보아즈";
    const finalUsername = customUsername.trim() || "Boaz2013";
    const finalPassword = customPassword.trim() || "Boaz77!!";

    const createdHost = onRegisterStudyTeam({
      teamName: newTeam.trim(),
      studyName: finalStudyName,
      leaderName: finalHostName,
      studyType: newStudyType,
      category: "스터디",
      schedule: "정기 세션",
      description: newDescription.trim(),
      customUsername: finalUsername,
      customPassword: finalPassword,
    });

    setShowAddModal(false);
    setIssuedDeliveryText(generateDeliveryText(createdHost, finalPassword));
    setIssuedHost(createdHost);
  }

  function handleResetPassword(host: HostAccount) {
    const newPass = generateRandomPassword();
    setHosts((prev) =>
      prev.map((h) => (h.id === host.id ? { ...h, initialPassword: newPass } : h))
    );
    setResetModalHost({ host, newPass });
  }

  function toggleHost(id: string) {
    setHosts((prev) => prev.map((h) => (h.id === id ? { ...h, active: !h.active } : h)));
  }

  return (
    <div
      className="space-y-5"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}
    >
      {/* Flow steps */}
      <SectionCard>
        <div className="flex items-center gap-0 px-5 py-4 overflow-x-auto">
          {[
            { num: "①", title: "스터디 등록", desc: "스터디명·구분·팀장 입력" },
            { num: "②", title: "HOST 계정 자동 발급", desc: "아이디 & 임시 비밀번호 생성" },
            {
              num: "③",
              title: "출결 탭 & 대시보드 연동",
              desc: "출결 매트릭스 및 점수 집계 탭 자동 생성",
            },
            {
              num: "④",
              title: "스터디장에게 정보 전달",
              desc: "카카오톡/슬랙으로 접속 정보 복사 전달",
            },
          ].map((step, i) => (
            <div key={step.title} className="flex items-center gap-0 shrink-0">
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200/80">
                <span className="font-bold font-mono text-slate-900">{step.num}</span>
                <div>
                  <p className="font-bold text-slate-800">{step.title}</p>
                  <p className="text-[10px] text-slate-500">{step.desc}</p>
                </div>
              </div>
              {i < 3 && <ChevronRight size={14} className="mx-2 text-slate-300 shrink-0" />}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <CardHeader
          title="등록된 스터디 팀 및 HOST(스터디장) 계정 관리"
          sub="운영지원팀이 스터디를 개설하면 전체 대시보드와 출결 입력 화면에 해당 스터디 탭이 즉시 생성됩니다."
          right={
            <div className="flex items-center gap-2">
              <Tag
                label={`총 ${studyTeams.length}개 스터디`}
                color="#059669"
                bg="rgba(16,185,129,0.12)"
              />
              <button
                onClick={handleOpenAddModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={13} />
                <span>스터디 등록 & 계정 발급</span>
              </button>
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[780px]">
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <th className="text-left px-5 py-3 font-semibold text-slate-500">
                  스터디명 / 구분
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500">
                  스터디장 (이름)
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500">
                  로그인 아이디 (ID)
                </th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500">
                  초기 비밀번호 (PW)
                </th>
                <th className="text-center px-4 py-3 font-semibold text-slate-500">계정 상태</th>
                <th className="text-right px-5 py-3 font-semibold text-slate-500">
                  전달 및 관리 액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studyTeams.map((st) => {
                const h = hosts.find((host) => host.team === st.teamName) || {
                  id: "h_" + st.teamName,
                  team: st.teamName,
                  username: `host_${st.teamName.toLowerCase()}`,
                  initialPassword: "boaz2026!a",
                  hostName: `${st.leaderName} (${st.teamName}장)`,
                  createdAt: st.createdAt || "2025-02-28",
                  active: true,
                };
                const isPwVisible = visiblePwId === h.id;
                const pw = h.initialPassword || "boaz2026!a";

                return (
                  <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
                            st.studyType === "방학 스터디"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-slate-100 text-slate-800 border-slate-300"
                          }`}
                        >
                          {st.studyType}
                        </span>
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">{st.studyName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{st.teamName}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-800">{st.leaderName}</p>
                      <p className="text-[10px] text-slate-400">출결 입력 전담</p>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-900 font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800">
                        {h.username}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-slate-800 font-medium">
                          {isPwVisible ? pw : "••••••••"}
                        </span>
                        <button
                          onClick={() => setVisiblePwId(isPwVisible ? null : h.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          title={isPwVisible ? "비밀번호 숨김" : "비밀번호 확인"}
                        >
                          {isPwVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {h.active ? (
                        <Tag label="정상 활성" color="#059669" bg="rgba(16,185,129,0.12)" />
                      ) : (
                        <Tag label="회수·잠금" color="#64748b" bg="rgba(100,116,139,0.12)" />
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDeliveryModal(h)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="계정 안내문 확인 및 복사"
                        >
                          <Copy size={11} /> 안내문 복사
                        </button>
                        <button
                          onClick={() => handleResetPassword(h)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                          title="임시 비밀번호 재발급"
                        >
                          <KeyRound size={11} /> 재발급
                        </button>
                        {h.active ? (
                          <button
                            onClick={() => toggleHost(h.id)}
                            className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="계정 회수 (잠금)"
                          >
                            <Lock size={11} /> 회수
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleHost(h.id)}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="계정 활성화"
                          >
                            <Unlock size={11} /> 활성화
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Modal 1: 새 스터디(팀) 등록 & HOST 발급 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                  <BookOpen size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">새 스터디 등록 & 계정 발급</h3>
                  <p className="text-[11px] text-slate-500">
                    등록 즉시 대시보드와 출결 입력 탭이 생성됩니다.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">스터디 구분 *</label>
                <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setNewStudyType("방학 스터디")}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      newStudyType === "방학 스터디"
                        ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    방학 스터디
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStudyType("학기 스터디")}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      newStudyType === "학기 스터디"
                        ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    학기 스터디
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">
                  스터디 공식 명칭 (Study Name) *
                </label>
                <input
                  value={newStudyName}
                  onChange={(e) => setNewStudyName(e.target.value)}
                  placeholder="예: Terraform 스터디"
                  className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">
                  담당 스터디장(팀장) 이름 *
                </label>
                <input
                  value={newHostName}
                  onChange={(e) => setNewHostName(e.target.value)}
                  placeholder="예: 보아즈"
                  className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">
                    로그인 아이디 (ID) *
                  </label>
                  <input
                    value={customUsername}
                    onChange={(e) => setCustomUsername(e.target.value)}
                    placeholder="예: Boaz2013"
                    className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-semibold">초기 비밀번호 (PW) *</label>
                    <button
                      type="button"
                      onClick={() => setCustomPassword(generateRandomPassword())}
                      className="text-[11px] text-slate-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={10} /> 생성
                    </button>
                  </div>
                  <input
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="예: Boaz77!!"
                    className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleCreateStudyAndHost}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
              >
                스터디 개설 및 계정 발급
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: 발급 완료 안내 팝업 */}
      {issuedHost && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare size={16} className="text-slate-700" />
                  <span>스터디장 안내문 양식 (직접 수정 가능)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  아래 템플릿의 문구를 자유롭게 수정하세요. 실시간으로 복사 내용에 반영됩니다.
                </p>
              </div>
              <button
                onClick={() => setIssuedHost(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Action Button Bar verbatim to screenshot */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* [기본 양식으로 설정] Button */}
              <button
                type="button"
                onClick={() => handleSaveAsDefaultTemplate(issuedDeliveryText, issuedHost)}
                className="w-[132px] justify-center py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                title="현재 수정한 문구를 영구 기본 양식으로 저장합니다."
              >
                <Save size={12} />
                <span>{savedTemplateNotice ? "저장 완료!" : "기본 양식으로 설정"}</span>
              </button>

              {/* [기본 양식 복원] Button */}
              <button
                type="button"
                onClick={() => setIssuedDeliveryText(handleResetToSavedTemplate(issuedHost))}
                className="w-[105px] justify-center py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                title="저장된 기본 양식으로 되돌립니다."
              >
                <RotateCcw size={11} />
                <span>기본 양식 복원</span>
              </button>

              {/* [양식 복사] Button */}
              <button
                type="button"
                onClick={() => handleCopyDeliveryMessage(issuedDeliveryText)}
                className="w-[90px] justify-center py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
              >
                {copiedNotice ? (
                  <Check size={12} className="text-emerald-400" />
                ) : (
                  <Copy size={12} />
                )}
                <span>{copiedNotice ? "복사 완료!" : "양식 복사"}</span>
              </button>
            </div>

            <textarea
              rows={12}
              value={issuedDeliveryText}
              onChange={(e) => setIssuedDeliveryText(e.target.value)}
              className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 leading-relaxed outline-none focus:bg-white focus:border-slate-800 resize-none"
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} /> 계정 발급 완료
              </span>
              <button
                onClick={() => {
                  setIssuedHost(null);
                  setIssuedDeliveryText("");
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: 비밀번호 재발급 팝업 */}
      {resetModalHost && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-amber-300 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-600">
                <KeyRound size={18} />
                <h3 className="text-sm font-bold text-slate-900">새 임시 비밀번호 생성 완료</h3>
              </div>
              <button
                onClick={() => setResetModalHost(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              <strong>
                {resetModalHost.host.team} ({resetModalHost.host.username})
              </strong>
              의 새 임시 비밀번호가 생성되었습니다.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs flex items-center justify-between">
              <span className="text-amber-700 font-bold text-sm">{resetModalHost.newPass}</span>
              <button
                onClick={() => handleOpenDeliveryModal(resetModalHost.host, resetModalHost.newPass)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Copy size={12} /> 안내문 복사
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setResetModalHost(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: 스터디장 계정 안내문 모달 */}
      {deliveryModal && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare size={16} className="text-slate-700" />
                  <span>스터디장 안내문 양식 (직접 수정 가능)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  아래 템플릿의 문구를 자유롭게 수정하세요. 실시간으로 복사 내용에 반영됩니다.
                </p>
              </div>
              <button
                onClick={() => setDeliveryModal(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Action Button Bar verbatim to screenshot */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* [기본 양식으로 설정] Button */}
              <button
                type="button"
                onClick={() => handleSaveAsDefaultTemplate(deliveryModal.text, deliveryModal.host)}
                className="w-[132px] justify-center py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                title="현재 수정한 문구를 영구 기본 양식으로 저장합니다."
              >
                <Save size={12} />
                <span>{savedTemplateNotice ? "저장 완료!" : "기본 양식으로 설정"}</span>
              </button>

              {/* [기본 양식 복원] Button */}
              <button
                type="button"
                onClick={() => {
                  const text = handleResetToSavedTemplate(deliveryModal.host);
                  setDeliveryModal({ ...deliveryModal, text });
                }}
                className="w-[105px] justify-center py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                title="저장된 기본 양식으로 되돌립니다."
              >
                <RotateCcw size={11} />
                <span>기본 양식 복원</span>
              </button>

              {/* [양식 복사] Button */}
              <button
                type="button"
                onClick={() => handleCopyDeliveryMessage(deliveryModal.text)}
                className="w-[90px] justify-center py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
              >
                {copiedNotice ? (
                  <Check size={12} className="text-emerald-400" />
                ) : (
                  <Copy size={12} />
                )}
                <span>{copiedNotice ? "복사 완료!" : "양식 복사"}</span>
              </button>
            </div>

            <textarea
              rows={12}
              value={deliveryModal.text}
              onChange={(e) => setDeliveryModal({ ...deliveryModal, text: e.target.value })}
              className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 leading-relaxed outline-none focus:bg-white focus:border-slate-800 resize-none"
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">{deliveryModal.studyName} 전달용</span>
              <button
                onClick={() => setDeliveryModal(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
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
