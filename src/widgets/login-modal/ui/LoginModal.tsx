import { useState } from "react";
import { LogIn, X } from "lucide-react";

import type { HostAccount } from "@/entities/host-account/model/types";
import type { StudyTeamInfo } from "@/entities/study-team/model/types";
import type { UserRole } from "@/entities/user/model/types";

export function LoginModal({
  onClose,
  onLoginSuccess,
  hosts,
  studyTeams,
}: {
  onClose: () => void;
  onLoginSuccess: (role: UserRole, hostTeam?: string, username?: string) => void;
  hosts: HostAccount[];
  studyTeams: StudyTeamInfo[];
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedQuickHostTeam, setSelectedQuickHostTeam] = useState(
    studyTeams[0]?.teamName || "A팀"
  );

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      setErrorMsg("아이디와 비밀번호를 모두 입력해 주세요.");
      return;
    }

    // 0. 최고 관리자 (SUPER)
    if (u === "super" && (p === "super1234" || p === "1234")) {
      onLoginSuccess("SUPER", undefined, "super");
      onClose();
      return;
    }

    // 1. 운영지원팀 마스터 계정 (TEAM)
    if (u === "admin" && (p === "admin1234" || p === "1234")) {
      onLoginSuccess("TEAM", undefined, "admin");
      onClose();
      return;
    }

    // 2. 서비스운영팀(콘텐츠) 계정
    if (u === "content" && (p === "content1234" || p === "1234")) {
      onLoginSuccess("CONTENT_ADMIN", undefined, "content");
      onClose();
      return;
    }

    // 3. HOST (스터디장) 발급 계정 대조
    const foundHost = hosts.find(
      (h) => h.username === u && (h.initialPassword === p || p === "boaz2026!a" || p === "1234")
    );
    if (foundHost) {
      if (!foundHost.active) {
        setErrorMsg("해당 HOST 계정은 현재 회수(잠금) 상태입니다. 운영지원팀에 문의하세요.");
        return;
      }
      onLoginSuccess("HOST", foundHost.team, foundHost.username);
      onClose();
      return;
    }

    // 4. ADV 팀장 계정 테스트 지원 (host_adv1, adv1 등)
    if (
      (u === "host_adv" || u === "host_adv1" || u === "adv1") &&
      (p === "boaz2026!a" || p === "1234")
    ) {
      onLoginSuccess("HOST", "분석 1팀", u);
      onClose();
      return;
    }

    setErrorMsg("아이디 또는 비밀번호가 일치하지 않습니다. (아래 퀵 로그인 버튼을 이용해 보세요)");
  }

  const currentSelectedHost = hosts.find((h) => h.team === selectedQuickHostTeam) || hosts[0];

  return (
    <div className="fixed inset-0 bg-black/60 z-70 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl overflow-hidden p-6 space-y-5 bg-white border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <LogIn size={18} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">BOAZ 콘솔 로그인</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
          <div>
            <label className="text-slate-700 block mb-1 font-semibold">로그인 아이디 (ID)</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="예: super, admin, host_a"
              className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 font-mono"
            />
          </div>

          <div>
            <label className="text-slate-700 block mb-1 font-semibold">비밀번호 (Password)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 font-mono"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-600">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-xs"
          >
            로그인
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 space-y-2">
          <p className="text-[11px] text-slate-500 font-semibold">빠른 역할 전환 테스트 계정</p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              onClick={() => {
                onLoginSuccess("SUPER", undefined, "super");
                onClose();
              }}
              className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-left cursor-pointer transition-colors"
            >
              <p className="font-bold">차기대표진 (SUPER)</p>
              <p className="text-[10px] text-purple-600 font-mono">전 부문 권한 · 승격 전권</p>
            </button>
            <button
              onClick={() => {
                onLoginSuccess("TEAM", undefined, "admin");
                onClose();
              }}
              className="p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-left cursor-pointer transition-colors"
            >
              <p className="font-bold">운영지원팀 (출결)</p>
              <p className="text-[10px] text-blue-600 font-mono">admin / admin1234</p>
            </button>
            <button
              onClick={() => {
                const targetTeam = selectedQuickHostTeam;
                const h = hosts.find((item) => item.team === targetTeam);
                const isAdvTarget =
                  targetTeam.startsWith("분석") ||
                  targetTeam.startsWith("시각화") ||
                  targetTeam.startsWith("엔지");
                onLoginSuccess(
                  "HOST",
                  targetTeam,
                  h?.username || (isAdvTarget ? "host_adv1" : `host_${targetTeam.toLowerCase()}`)
                );
                onClose();
              }}
              className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between gap-1">
                <p className="font-bold truncate">{selectedQuickHostTeam} 팀장</p>
                <select
                  value={selectedQuickHostTeam}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSelectedQuickHostTeam(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] bg-white border border-emerald-300 rounded px-1 py-0.5 font-sans shrink-0"
                >
                  <optgroup label="스터디 팀">
                    {studyTeams.map((t) => (
                      <option key={t.teamName} value={t.teamName}>
                        {t.teamName}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="ADV 프로젝트 팀">
                    <option value="분석 1팀">분석 1팀</option>
                    <option value="분석 2팀">분석 2팀</option>
                    <option value="시각화 1팀">시각화 1팀</option>
                    <option value="엔지니어링 1팀">엔지니어링 1팀</option>
                  </optgroup>
                </select>
              </div>
              <p className="text-[10px] text-emerald-600 font-mono">
                {currentSelectedHost?.username || (selectedQuickHostTeam.startsWith("분석") || selectedQuickHostTeam.startsWith("시각화") || selectedQuickHostTeam.startsWith("엔지") ? "host_adv" : `host_${selectedQuickHostTeam.toLowerCase()}`)}{" "}
                (HOST)
              </p>
            </button>
            <button
              onClick={() => {
                onLoginSuccess("CONTENT_ADMIN", undefined, "content");
                onClose();
              }}
              className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-left cursor-pointer transition-colors"
            >
              <p className="font-bold">서비스운영팀 (콘텐츠)</p>
              <p className="text-[10px] text-amber-600 font-mono">content / content1234</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
