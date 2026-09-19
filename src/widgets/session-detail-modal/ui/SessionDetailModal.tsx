import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Eye,
  Image as ImageIcon,
  ShieldCheck,
  X,
  ZoomIn,
} from 'lucide-react';

import { STATUS_BUTTON_STYLES, STATUS_CFG, WEEKS } from '@/entities/attendance/model/constants';
import type { AttendanceStatus, SessionRecord } from '@/entities/attendance/model/types';
import { ACTIVITIES, MEMBERS } from '@/entities/study-team/model/constants';
import type { Member } from '@/entities/study-team/model/types';
import { Btn } from '@/shared/ui/Btn';
import { Tag } from '@/shared/ui/Tag';

interface SessionDetailModalProps {
  weekId: string;
  actId: string;
  team: string;
  record: SessionRecord | null;
  onClose: () => void;
  onConfirmAdmin: (w: string, a: string, t: string) => void;
  onDirectEdit: (
    w: string,
    a: string,
    t: string,
    memberId: string,
    to: AttendanceStatus,
    reason: string,
  ) => void;
  membersMap?: Record<string, Member[]>;
}

export function SessionDetailModal({
  weekId,
  actId,
  team,
  record,
  onClose,
  onConfirmAdmin,
  onDirectEdit,
  membersMap,
}: SessionDetailModalProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<{
    id: string;
    name: string;
    current: AttendanceStatus;
  } | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('present');
  const [editReason, setEditReason] = useState('');

  const weekObj = WEEKS.find((w) => w.id === weekId);
  const actObj = ACTIVITIES.find((a) => a.id === actId);
  const members = (membersMap && membersMap[team]) || MEMBERS[team] || [];

  if (!record) {
    return null;
  }

  function handleSaveEdit() {
    if (!editingMember) {
      return;
    }
    if (!editReason.trim()) {
      alert('운영지원팀 수정 시 수정 사유 입력은 필수입니다.');
      return;
    }
    onDirectEdit(weekId, actId, team, editingMember.id, editStatus, editReason);
    setEditingMember(null);
    setEditReason('');
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col bg-white border border-slate-200 shadow-2xl">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}
        >
          <div className="flex items-center gap-3">
            <span
              className="px-2.5 py-1 rounded-md text-xs font-bold"
              style={{
                background: actObj?.bg,
                color: actObj?.color,
                border: `1px solid ${actObj?.color}30`,
              }}
            >
              {actObj?.name}
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>{team}</span>
                <span className="text-muted-foreground font-normal text-xs">·</span>
                <span className="text-xs font-mono text-[#8ba5ff]">
                  {weekObj?.label} ({weekObj?.date})
                </span>
                {record.submitted ? (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium"
                    style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399' }}
                  >
                    <CheckCircle2 size={11} /> 제출완료
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium"
                    style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}
                  >
                    <AlertCircle size={11} /> 미제출
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {record.submitted
                  ? `제출일시: ${record.submittedAt} (HOST 스터디장 입력)`
                  : '스터디장의 출결 입력 대기 중'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: Proof Image Review */}
          <div
            className="rounded-xl p-4.5"
            style={{ background: '#f8fafc', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera size={15} style={{ color: '#5b7fff' }} />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  출석 인증 사진 (증빙 자료)
                </h3>
                {record.photoUrl && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {record.photoName ?? record.photo}{' '}
                    {record.photoSize ? `(${record.photoSize})` : ''}
                  </span>
                )}
              </div>
              {record.photoUrl && (
                <button
                  onClick={() => setLightboxOpen(true)}
                  className="inline-flex items-center gap-1 text-xs text-[#8ba5ff] hover:underline cursor-pointer"
                >
                  <ZoomIn size={12} /> 크게 보기
                </button>
              )}
            </div>

            {record.photoUrl ? (
              <div
                className="relative rounded-lg overflow-hidden group cursor-pointer border border-slate-200"
                onClick={() => setLightboxOpen(true)}
                style={{ maxHeight: '260px', background: '#f8fafc' }}
              >
                <img
                  src={record.photoUrl}
                  alt="출석 인증 사진"
                  className="w-full h-56 object-cover object-center group-hover:scale-[1.02] transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold">
                  <Eye size={16} /> 클릭하여 원본 사진 확인
                </div>
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/40 backdrop-blur-xs text-[11px] text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 size={11} style={{ color: '#34d399' }} />
                  <span>운영지원팀 확인용 인증 사진 정상 등록됨</span>
                </div>
              </div>
            ) : (
              <div className="h-28 rounded-lg flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 bg-white/[0.01]">
                <ImageIcon size={24} className="text-muted-foreground/50 mb-1" />
                <p className="text-xs text-muted-foreground">등록된 출석 인증 이미지가 없습니다.</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  스터디장이 출석 제출 시 사진을 첨부하지 않았거나 미제출 상태입니다.
                </p>
              </div>
            )}
          </div>

          {/* Section: Member Attendance & Reason Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ClipboardList size={15} style={{ color: '#5b7fff' }} />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  부원별 출결 상태 및 사유
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                총 {members.length}명 (출석{' '}
                {members.filter((m) => (record.statuses[m.id] ?? 'present') === 'present').length} ·
                지각 {members.filter((m) => record.statuses[m.id] === 'late').length} · 결석{' '}
                {members.filter((m) => record.statuses[m.id] === 'absent').length})
              </span>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-12">
                      #
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-28">
                      부원
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-24">
                      출결 상태
                    </th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">
                      사유 (선택 입력 내역)
                    </th>
                    <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-20">
                      운영진 수정
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m, idx) => {
                    const st: AttendanceStatus = record.statuses[m.id] ?? 'present';
                    const memo = record.memos?.[m.id];
                    const cfg = STATUS_CFG[st] ?? STATUS_CFG.present;

                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold text-foreground">{m.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">
                            {m.year}기
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Tag label={cfg.label} color={cfg.color} bg={cfg.bg} />
                        </td>
                        <td className="px-3 py-2.5">
                          {memo ? (
                            <span className="text-foreground/90 bg-slate-100 px-2 py-1 rounded text-[11px] inline-block">
                              {memo}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 italic text-[11px]">
                              — 사유 없음 (정상 출석 또는 미기재) —
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => {
                              setEditingMember({ id: m.id, name: m.name, current: st });
                              setEditStatus(st);
                              setEditReason(memo ?? '');
                            }}
                            className="text-[10px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-100 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                          >
                            수정
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Direct Edit Box by Admin (사유 필수) */}
          {editingMember && (
            <div className="rounded-xl p-4 border border-[#fb923c]/30 bg-[#fb923c]/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#fb923c]">
                  <AlertTriangle size={13} />
                  <span>운영지원팀 출결 수동 수정 — {editingMember.name}</span>
                </div>
                <Tag label="사유 필수 입력" color="#fb923c" bg="rgba(251,146,60,0.15)" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                제출 후 출결 수정은 감사가 기록되므로 반드시 구체적인 수정 사유를 입력해야 합니다.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-500 mr-1 font-medium">변경 상태:</span>
                  {(['present', 'late', 'absent'] as AttendanceStatus[]).map((s) => {
                    const active = editStatus === s;
                    const styleCfg = STATUS_BUTTON_STYLES[s];
                    return (
                      <button
                        key={s}
                        onClick={() => setEditStatus(s)}
                        className={`px-3 py-1 text-xs rounded-lg transition-all cursor-pointer ${
                          active ? styleCfg.active : styleCfg.inactive
                        }`}
                      >
                        {STATUS_CFG[s].label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="수정 사유를 반드시 입력하세요 (예: 증빙 서류 확인 완료, 스터디장 오기재 인정)"
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg outline-none"
                  style={{
                    background: '#ffffff',
                    border: '1px solid rgba(251,146,60,0.3)',
                    color: '#fff',
                  }}
                />
                <Btn variant="success" size="xs" onClick={handleSaveEdit}>
                  저장 및 반영
                </Btn>
                <Btn variant="ghost" size="xs" onClick={() => setEditingMember(null)}>
                  취소
                </Btn>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff' }}
        >
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="text-[#34d399]" />
            <span>운영지원팀 검토 모드 · 인증 사진 및 출결 사유 대조 완료</span>
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="outline" onClick={onClose}>
              닫기
            </Btn>
            {record.submitted && !record.confirmedByAdmin && (
              <Btn
                variant="success"
                onClick={() => {
                  onConfirmAdmin(weekId, actId, team);
                  onClose();
                }}
              >
                <CheckCheck size={14} /> 출결 확인 완료 처리
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* Full Lightbox */}
      {lightboxOpen && record.photoUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-60 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={record.photoUrl}
              alt="출석 인증 원본 사진"
              className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-slate-300"
            />
            <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-700">
              <span>
                {team} · {weekObj?.label} 출석 인증 원본 사진 ({record.photoName ?? record.photo})
              </span>
              <button
                onClick={() => setLightboxOpen(false)}
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
