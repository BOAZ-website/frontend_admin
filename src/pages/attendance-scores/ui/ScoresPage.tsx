import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { WEEKS } from '@/entities/attendance/model/constants';
import { calcScore, sessionKey } from '@/entities/attendance/model/lib';
import type { AttendanceState } from '@/entities/attendance/model/types';
import type { Member, StudyPeriodType, StudyTeamInfo } from '@/entities/study-team/model/types';
import { CardHeader } from '@/shared/ui/CardHeader';
import { SectionCard } from '@/shared/ui/SectionCard';
import { Tag } from '@/shared/ui/Tag';

export function ScoresPage({
  attendance,
  studyTeams,
  membersMap,
}: {
  attendance: AttendanceState;
  studyTeams: StudyTeamInfo[];
  membersMap: Record<string, Member[]>;
}) {
  const [periodFilter, setPeriodFilter] = useState<StudyPeriodType>('학기 스터디');
  const filteredTeams = studyTeams.filter((t) => t.studyType === periodFilter);
  const [selectedTeam, setSelectedTeam] = useState(
    studyTeams.find((t) => t.studyType === '학기 스터디')?.teamName ||
      studyTeams[0]?.teamName ||
      'A팀',
  );
  const actId = 'study';
  const members = membersMap[selectedTeam] ?? [];
  const currentStudy = studyTeams.find((s) => s.teamName === selectedTeam);

  const rows = members
    .map((m) => {
      let total = 0;
      const weekly = WEEKS.map((w) => {
        const rec = attendance[sessionKey(w.id, actId, selectedTeam)];
        if (!rec?.submitted) {
          return null;
        }
        const pts = calcScore(rec.statuses[m.id] ?? 'present');
        total += pts;
        return pts;
      });
      return { ...m, weekly, total };
    })
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Serial Season Toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
            {(['방학 스터디', '학기 스터디'] as const).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriodFilter(p);
                  const matched = studyTeams.find((s) => s.studyType === p);
                  if (matched) {
                    setSelectedTeam(matched.teamName);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  periodFilter === p
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Study List Toggle Dropdown */}
          <div className="relative flex items-center">
            <div className="relative">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="appearance-none pl-3.5 pr-8 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[220px]"
              >
                {filteredTeams.map((t) => (
                  <option key={t.teamName} value={t.teamName}>
                    {t.studyName}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 text-xs">
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 font-medium">
            출석 +1점
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 font-medium">
            지각 +0.5점
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 font-medium">
            결석 0점
          </span>
        </div>
      </div>

      <SectionCard>
        <CardHeader
          title={`${currentStudy?.studyName || '스터디'} · 활동 점수 집계`}
          sub={`구분: ${currentStudy?.studyType || '스터디'} · 담당 팀장: ${currentStudy?.leaderName || ''} · 출결 기반 자동 계산`}
          right={
            <Tag
              label={currentStudy?.studyType || '점수 집계'}
              color={currentStudy?.studyType === '방학 스터디' ? '#d97706' : '#2563eb'}
              bg={currentStudy?.studyType === '방학 스터디' ? '#fef3c7' : '#eff6ff'}
            />
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground w-8"></th>
                <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground">
                  이름
                </th>
                {WEEKS.map((w) => (
                  <th
                    key={w.id}
                    className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground"
                  >
                    {w.label}
                  </th>
                ))}
                <th
                  className="text-center px-4 py-2.5 text-xs font-semibold"
                  style={{ color: '#8ba5ff' }}
                >
                  합계
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="hover:bg-white/[0.015] transition-colors"
                  style={{ borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none' }}
                >
                  <td className="px-5 py-3 text-xs text-muted-foreground">{i + 1}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background: 'rgba(91,127,255,0.2)', color: '#8ba5ff' }}
                      >
                        {row.name[0]}
                      </div>
                      <span className="text-sm font-medium text-foreground">{row.name}</span>
                      <span className="text-[10px] text-muted-foreground">{row.year}학번</span>
                    </div>
                  </td>
                  {row.weekly.map((pts, j) => (
                    <td key={j} className="px-4 py-3 text-center font-mono text-sm">
                      {pts === null ? (
                        <span className="text-muted-foreground opacity-30">—</span>
                      ) : (
                        <span
                          style={{
                            color: pts === 1 ? '#34d399' : pts === 0.5 ? '#fbbf24' : '#f87171',
                          }}
                        >
                          {pts}
                        </span>
                      )}
                    </td>
                  ))}
                  <td
                    className="px-4 py-3 text-center font-mono font-bold"
                    style={{
                      color: row.total >= 3 ? '#34d399' : row.total >= 1.5 ? '#fbbf24' : '#f87171',
                    }}
                  >
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
