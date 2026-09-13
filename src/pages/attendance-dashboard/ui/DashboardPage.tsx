import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Layers,
  Plus,
  X,
} from 'lucide-react';

import { SessionDetailModal } from '@/widgets/session-detail-modal/ui/SessionDetailModal';
import { STATUS_CFG, WEEKS } from '@/entities/attendance/model/constants';
import { sessionKey } from '@/entities/attendance/model/lib';
import type { AttendanceState, AttendanceStatus } from '@/entities/attendance/model/types';
import type { ExceptionRequest } from '@/entities/exception-request/model/types';
import type { Member, StudyPeriodType, StudyTeamInfo } from '@/entities/study-team/model/types';
import { Btn } from '@/shared/ui/Btn';
import { CardHeader } from '@/shared/ui/CardHeader';
import { SectionCard } from '@/shared/ui/SectionCard';
import { Tag } from '@/shared/ui/Tag';

export function DashboardPage({
  attendance,
  exceptions,
  studyTeams,
  membersMap,
  onApprove,
  onReject,
  onDirectEdit,
  onConfirmAdmin,
  onOpenAddStudy,
}: {
  attendance: AttendanceState;
  exceptions: ExceptionRequest[];
  studyTeams: StudyTeamInfo[];
  membersMap?: Record<string, Member[]>;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDirectEdit: (
    w: string,
    a: string,
    t: string,
    memberId: string,
    to: AttendanceStatus,
    reason: string,
  ) => void;
  onConfirmAdmin: (w: string, a: string, t: string) => void;
  onOpenAddStudy?: () => void;
}) {
  const [selectedCell, setSelectedCell] = useState<{
    weekId: string;
    actId: string;
    team: string;
  } | null>(null);
  // 방학 스터디와 학기 스터디는 시리얼하게(순차적으로) 진행되므로 현재 활성 시즌인 학기 스터디를 기본값으로 설정
  const [currentSeason, setCurrentSeason] = useState<StudyPeriodType>('학기 스터디');

  const displayedStudyTeams = studyTeams.filter((t) => t.studyType === currentSeason);
  const allTeams = displayedStudyTeams.map((t) => ({
    team: t.teamName,
    studyName: t.studyName,
    actId: 'study',
    color: '#3b82f6',
  }));
  const totalCells = WEEKS.length * allTeams.length;
  const submittedCells = WEEKS.reduce(
    (acc, w) =>
      acc +
      allTeams.filter(({ team, actId }) => attendance[sessionKey(w.id, actId, team)]?.submitted)
        .length,
    0,
  );

  const activeModalRecord = selectedCell
    ? (attendance[sessionKey(selectedCell.weekId, selectedCell.actId, selectedCell.team)] ?? null)
    : null;

  const vacationCount = studyTeams.filter((t) => t.studyType === '방학 스터디').length;
  const semesterCount = studyTeams.filter((t) => t.studyType === '학기 스터디').length;

  return (
    <div className="space-y-5">
      {/* Serial Timeline Phase Progress Header */}
      <div className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Layers size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">
                  기수 활동 순차 주기 (Serial Timeline)
                </span>
                <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {currentSeason === '학기 스터디' ? '2단계 진행 중' : '1단계 완료 기록'}
                </span>
              </div>
              <h2 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                {currentSeason === '학기 스터디'
                  ? '정규 학기 스터디 출결 현황 (현재 진행)'
                  : '방학 집중 스터디 출결 현황 (종료)'}
              </h2>
            </div>
          </div>

          {/* Serial Phase Stepper Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start lg:self-center flex-wrap">
            <button
              onClick={() => setCurrentSeason('방학 스터디')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                currentSeason === '방학 스터디'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  currentSeason === '방학 스터디'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                1
              </span>
              <span>방학 스터디 시즌</span>
              <span className="text-[10px] text-slate-400 font-medium">({vacationCount}개 팀)</span>
            </button>

            <span className="text-slate-300 font-bold text-xs px-0.5">→</span>

            <button
              onClick={() => setCurrentSeason('학기 스터디')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                currentSeason === '학기 스터디'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  currentSeason === '학기 스터디'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                2
              </span>
              <span>학기 스터디 시즌</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                진행 중
              </span>
              <span className="text-[10px] text-slate-400 font-medium">({semesterCount}개 팀)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats row for Selected Season */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: `${currentSeason} 전체 제출 현황`,
            value: `${submittedCells} / ${totalCells}`,
            sub: '스터디장 제출률 ' + Math.round((submittedCells / (totalCells || 1)) * 100) + '%',
          },
          {
            label: `${currentSeason} 이번 주 미제출`,
            value: `${allTeams.filter(({ team, actId }) => !attendance[sessionKey('w3', actId, team)]?.submitted).length}팀`,
            sub: currentSeason === '학기 스터디' ? '3주차 진행 중' : '전체 주차 마감 완료',
          },
          {
            label: '예외 승인 대기',
            value: `${exceptions.length}건`,
            sub: '운영지원팀 확인 필요',
          },
        ].map((s) => (
          <SectionCard key={s.label}>
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 mb-1 font-semibold">{s.label}</p>
              <p className="text-2xl font-bold font-mono text-slate-900">{s.value}</p>
              {s.sub && <p className="text-[11px] text-slate-400 mt-1">{s.sub}</p>}
            </div>
          </SectionCard>
        ))}
      </div>

      {/* Submission matrix */}
      <SectionCard>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white flex-wrap gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border shadow-2xs ${
                  currentSeason === '학기 스터디'
                    ? 'bg-slate-100 text-slate-800 border-slate-200'
                    : 'bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                {currentSeason}
              </span>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {currentSeason} 주차별 출결 현황 및 인증 사진 검토
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              제출 완료 (초록) · 미제출 (빨강) · 셀 클릭 시 상세 인증 사진 및 부원별 사유를 대조
              검토합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenAddStudy && (
              <button
                onClick={onOpenAddStudy}
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} />
                <span>스터디 등록</span>
              </button>
            )}
            <Tag label="운영지원팀 검토 뷰" color="#059669" bg="rgba(16,185,129,0.12)" />
          </div>
        </div>

        <div className="overflow-x-auto p-5">
          {displayedStudyTeams.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              등록된 {currentSeason}가 없습니다.
            </div>
          ) : (
            <table className="text-xs border-separate border-spacing-2 min-w-[540px]">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left pr-4 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-20">
                    진행 주차
                  </th>
                  {displayedStudyTeams.map((st) => (
                    <th
                      key={st.teamName}
                      className="text-center pb-2 font-bold text-slate-800 text-xs min-w-[120px]"
                    >
                      <div
                        className="text-xs font-extrabold text-slate-900 truncate max-w-[140px]"
                        title={st.studyName}
                      >
                        {st.studyName}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400">
                        {st.leaderName} 팀장
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKS.map((w) => (
                  <tr key={w.id}>
                    <td className="pr-4 py-1 font-bold text-slate-700 whitespace-nowrap text-xs">
                      {w.label}
                    </td>
                    {displayedStudyTeams.map((st) => {
                      const team = st.teamName;
                      const rec = attendance[sessionKey(w.id, 'study', team)];
                      const done = rec?.submitted ?? false;
                      const hasPhoto = !!rec?.photoUrl;
                      return (
                        <td key={team} className="py-1 px-1">
                          <div
                            onClick={() => setSelectedCell({ weekId: w.id, actId: 'study', team })}
                            title={`${st.studyName} (${w.label}) - 클릭하여 인증 사진 및 출결 상세 보기`}
                            className="w-full h-11 px-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 group relative shadow-2xs"
                            style={{
                              background: done ? '#ecfdf5' : '#fef2f2',
                              border: `1px solid ${done ? '#a7f3d0' : '#fecaca'}`,
                            }}
                          >
                            {done ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                {hasPhoto && (
                                  <Camera
                                    size={11}
                                    className="text-slate-700"
                                    {...({
                                      title: '인증사진 첨부됨',
                                    } as React.SVGProps<SVGSVGElement>)}
                                  />
                                )}
                              </div>
                            ) : (
                              <AlertCircle size={13} className="text-red-500" />
                            )}
                            <span
                              className="text-[10px] font-bold mt-0.5 whitespace-nowrap"
                              style={{ color: done ? '#047857' : '#b91c1c' }}
                            >
                              {done ? (hasPhoto ? '사진 인증' : '제출완료') : '미제출'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>

      {/* Exception queue */}
      <SectionCard>
        <CardHeader
          title="예외 승인 대기"
          sub="제출 후 수정 요청은 운영지원팀이 사유 확인 후 승인합니다"
          right={<Tag label="ATTENDANCE_APPROVE" color="#fb923c" bg="rgba(251,146,60,0.12)" />}
        />
        {exceptions.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">
            대기 중인 요청이 없습니다
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f1f5f9' }}>
            {exceptions.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between px-5 py-3.5 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <AlertTriangle size={14} style={{ color: '#fbbf24' }} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{ex.team}</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span className="text-muted-foreground">{ex.week}</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span>{ex.memberName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{ex.reason}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs" style={{ color: STATUS_CFG[ex.from]?.color ?? '#fff' }}>
                    {STATUS_CFG[ex.from]?.label ?? ex.from}
                  </span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-xs" style={{ color: STATUS_CFG[ex.to]?.color ?? '#fff' }}>
                    {STATUS_CFG[ex.to]?.label ?? ex.to}
                  </span>
                  <Btn variant="success" size="xs" onClick={() => onApprove(ex.id)}>
                    <Check size={11} />
                    승인
                  </Btn>
                  <Btn variant="danger" size="xs" onClick={() => onReject(ex.id)}>
                    <X size={11} />
                    거절
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Selected Cell Modal */}
      {selectedCell && (
        <SessionDetailModal
          weekId={selectedCell.weekId}
          actId={selectedCell.actId}
          team={selectedCell.team}
          record={activeModalRecord}
          onClose={() => setSelectedCell(null)}
          onConfirmAdmin={onConfirmAdmin}
          onDirectEdit={onDirectEdit}
          membersMap={membersMap}
        />
      )}
    </div>
  );
}
