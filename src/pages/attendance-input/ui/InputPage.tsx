import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  FileCheck,
  Image as ImageIcon,
  Info,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  ZoomIn,
} from 'lucide-react';

import { SAMPLE_PROOF_IMAGES, STATUS_CFG } from '@/entities/attendance/model/constants';
import { sessionKey } from '@/entities/attendance/model/lib';
import type {
  AttendanceState,
  AttendanceStatus,
  SessionRecord,
} from '@/entities/attendance/model/types';
import { INITIAL_STUDY_TEAMS, MEMBERS } from '@/entities/study-team/model/constants';
import type { Member, StudyPeriodType, StudyTeamInfo } from '@/entities/study-team/model/types';
import type { UserRole } from '@/entities/user/model/types';
import { Btn } from '@/shared/ui/Btn';
import { SectionCard } from '@/shared/ui/SectionCard';

// ─── Page: 출결 입력 (HOST 스터디장 전용 페이지) ───────────────────────────────

const EXT_STATUS_BTNS: { id: AttendanceStatus; label: string }[] = [
  { id: 'present', label: '출석' },
  { id: 'late', label: '지각' },
  { id: 'absent', label: '결석' },
];

export function InputPage({
  attendance,
  setAttendance,
  onRequestException,
  currentHostTeam,
  studyTeams,
  membersMap,
  currentRole,
  onOpenAddStudy,
  setMembersMap,
}: {
  attendance: AttendanceState;
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceState>>;
  onRequestException: (
    team: string,
    week: string,
    memberName: string,
    from: AttendanceStatus,
    to: AttendanceStatus,
    reason: string,
  ) => void;
  currentHostTeam: string;
  studyTeams: StudyTeamInfo[];
  membersMap: Record<string, Member[]>;
  setMembersMap?: React.Dispatch<React.SetStateAction<Record<string, Member[]>>>;
  currentRole: UserRole;
  onOpenAddStudy?: () => void;
}) {
  const [selectedTeam, setSelectedTeam] = useState(
    currentRole === 'HOST' ? currentHostTeam || 'A팀' : studyTeams[0]?.teamName || 'A팀',
  );
  const TOTAL_WEEKS = 8;

  useEffect(() => {
    if (currentRole === 'HOST' && currentHostTeam) {
      setSelectedTeam(currentHostTeam);
    }
  }, [currentRole, currentHostTeam]);

  const [weekNum, setWeekNum] = useState(3);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [extStatuses, setExtStatuses] = useState<Record<string, Record<string, AttendanceStatus>>>(
    {},
  );

  const [uploadedImage, setUploadedImage] = useState<{
    file: File | null;
    url: string | null;
    name: string | null;
    size: string | null;
  }>({
    file: null,
    url: null,
    name: null,
    size: null,
  });

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqMember, setReqMember] = useState('');
  const [reqToStatus, setReqToStatus] = useState<AttendanceStatus>('present');
  const [reqReason, setReqReason] = useState('');
  const [imageWarning, setImageWarning] = useState(false);

  // Member management states for study leader (HOST)
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberYear, setNewMemberYear] = useState('23');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const weekId = `w${weekNum <= 4 ? weekNum : weekNum}`;
  const hasData = weekNum <= 4;
  const key = hasData ? sessionKey(`w${weekNum}`, 'study', selectedTeam) : '';
  const rec: SessionRecord =
    hasData && key && attendance?.[key]
      ? attendance[key]
      : {
          statuses: {},
          memos: {},
          photo: null,
          photoUrl: null,
          submitted: false,
          submittedAt: null,
        };

  const members = (membersMap && membersMap[selectedTeam]) || MEMBERS[selectedTeam] || [];

  function handleAddMember() {
    if (!newMemberName.trim()) {
      alert('추가할 스터디원 이름을 입력해주세요.');
      return;
    }

    const rawNames = newMemberName
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (rawNames.length === 0) {
      return;
    }

    const newMembers: Member[] = rawNames.map((name, idx) => ({
      id: `m_${Date.now()}_${idx}`,
      name,
      year: newMemberYear.trim() || '23',
    }));

    if (setMembersMap) {
      setMembersMap((prev) => {
        const existing = prev[selectedTeam] || [];
        return {
          ...prev,
          [selectedTeam]: [...existing, ...newMembers],
        };
      });
    }

    setNewMemberName('');
    setShowAddMember(false);
  }

  function handleDeleteMember(memberId: string) {
    if (rec?.submitted) {
      return;
    }
    if (window.confirm('해당 부원을 스터디 명단에서 삭제하시겠습니까?')) {
      if (setMembersMap) {
        setMembersMap((prev) => {
          const existing = prev[selectedTeam] || [];
          return {
            ...prev,
            [selectedTeam]: existing.filter((m) => m.id !== memberId),
          };
        });
      }
    }
  }
  const currentStudy =
    (studyTeams && studyTeams.find((s) => s.teamName === selectedTeam)) ||
    INITIAL_STUDY_TEAMS.find((s) => s.teamName === selectedTeam);

  const currentPhotoUrl = uploadedImage?.url || rec?.photoUrl || null;
  const currentPhotoName = uploadedImage?.name || rec?.photoName || rec?.photo || null;
  const currentPhotoSize = uploadedImage?.size || rec?.photoSize || null;

  function getStatus(memberId: string): AttendanceStatus {
    return extStatuses[weekId]?.[memberId] ?? rec?.statuses?.[memberId] ?? 'present';
  }

  function setStatus(memberId: string, val: AttendanceStatus) {
    if (rec?.submitted) {
      return;
    }
    if (hasData && key) {
      setAttendance((prev) => {
        const curRec = prev?.[key] ?? {
          statuses: {},
          memos: {},
          photo: null,
          submitted: false,
          submittedAt: null,
        };
        return {
          ...prev,
          [key]: {
            ...curRec,
            statuses: { ...(curRec.statuses ?? {}), [memberId]: val },
          },
        };
      });
    }
    setExtStatuses((prev) => ({
      ...prev,
      [weekId]: { ...(prev[weekId] ?? {}), [memberId]: val },
    }));
  }

  function getMemo(memberId: string): string {
    const memoKey = `${weekId}-${memberId}`;
    return memos[memoKey] ?? rec?.memos?.[memberId] ?? '';
  }

  function setMemo(memberId: string, val: string) {
    if (rec?.submitted) {
      return;
    }
    const memoKey = `${weekId}-${memberId}`;
    setMemos((prev) => ({ ...prev, [memoKey]: val }));
    if (hasData && key) {
      setAttendance((prev) => {
        const curRec = prev?.[key] ?? {
          statuses: {},
          memos: {},
          photo: null,
          submitted: false,
          submittedAt: null,
        };
        return {
          ...prev,
          [key]: {
            ...curRec,
            memos: { ...(curRec.memos ?? {}), [memberId]: val },
          },
        };
      });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setImageWarning(false);
    const url = URL.createObjectURL(file);
    const sizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    setUploadedImage({
      file,
      url,
      name: file.name,
      size: sizeStr,
    });
  }

  function handleAttachSample() {
    setImageWarning(false);
    setUploadedImage({
      file: null,
      url: SAMPLE_PROOF_IMAGES[0],
      name: `스터디_${selectedTeam}_${weekNum}주차_단체인증.jpg`,
      size: '2.8 MB',
    });
  }

  function handleRemoveImage() {
    setUploadedImage({ file: null, url: null, name: null, size: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function submit() {
    if (!hasData || !key) {
      return;
    }

    if (!currentPhotoUrl) {
      setImageWarning(true);
      const confirmNoPhoto = window.confirm(
        '출석 인증 사진이 첨부되지 않았습니다.\n운영지원팀의 확인을 위해 사진 업로드가 필요합니다.\n사진 없이 그대로 제출하시겠습니까?',
      );
      if (!confirmNoPhoto) {
        return;
      }
    }

    const currentStatuses: Record<string, AttendanceStatus> = {};
    const currentMemos: Record<string, string> = {};
    members.forEach((m) => {
      currentStatuses[m.id] = getStatus(m.id);
      const memo = getMemo(m.id);
      if (memo) {
        currentMemos[m.id] = memo;
      }
    });

    setAttendance((prev) => ({
      ...prev,
      [key]: {
        statuses: currentStatuses,
        memos: currentMemos,
        submitted: true,
        photo: currentPhotoName || `스터디_${selectedTeam}_${weekNum}주차.jpg`,
        photoUrl: currentPhotoUrl,
        photoName: currentPhotoName || `스터디_${selectedTeam}_${weekNum}주차.jpg`,
        photoSize: currentPhotoSize || '2.1 MB',
        submittedAt: new Date().toLocaleString('ko-KR', { hour12: false }).slice(0, 16),
        confirmedByAdmin: false,
      },
    }));

    setImageWarning(false);
  }

  function handleSendRequest() {
    if (!reqMember || !reqReason.trim()) {
      alert('부원과 수정 사유를 입력해 주세요.');
      return;
    }
    const mem = members.find((m) => m.id === reqMember);
    if (!mem) {
      return;
    }
    const fromStatus = getStatus(reqMember);
    onRequestException(
      selectedTeam,
      `${weekNum}주차`,
      mem.name,
      fromStatus,
      reqToStatus,
      reqReason,
    );
    setShowRequestModal(false);
    setReqReason('');
    alert('운영지원팀에 출결 수정 요청이 전송되었습니다.');
  }

  const [periodFilter, setPeriodFilter] = useState<StudyPeriodType>('학기 스터디');
  const filteredStudyTeams = studyTeams.filter((s) => s.studyType === periodFilter);

  const counts = (members || []).reduce(
    (acc, m) => {
      const s = getStatus(m.id);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<AttendanceStatus, number>,
  );
  const presentN = counts['present'] ?? 0;
  const lateN = counts['late'] ?? 0;
  const absentN = counts['absent'] ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Study & Team Information Banner */}
      <div className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0 font-bold">
            <BookOpen size={18} />
          </div>
          <div>
            <div className="mb-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                  currentStudy?.studyType === '방학 스터디'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}
              >
                {currentStudy?.studyType || '학기 스터디'}
              </span>
            </div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
              {currentStudy?.studyName || '스터디 출결 관리'}
            </h1>
          </div>
        </div>

        {/* Role-based Controls */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
          {currentRole === 'HOST' ? (
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>내 담당 스터디 출결 뷰</span>
            </div>
          ) : (
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
                    {filteredStudyTeams.map((t) => (
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

              {onOpenAddStudy && (
                <button
                  onClick={onOpenAddStudy}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="새 스터디 개설"
                >
                  <Plus size={12} />
                  <span>개설</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Week Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 mr-1 shrink-0 font-medium">진행 주차:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => {
            const isActive = w === weekNum;
            const isPast =
              w <= 4 && attendance[sessionKey(`w${w}`, 'study', selectedTeam)]?.submitted;
            return (
              <button
                key={w}
                onClick={() => setWeekNum(w)}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all relative cursor-pointer flex items-center justify-center ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : isPast
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 border border-slate-200/80 hover:bg-slate-200'
                }`}
              >
                {w}주
                {isPast && !isActive && (
                  <span
                    className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500"
                    title="제출 완료"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full min-w-0 space-y-5">
          <SectionCard>
            <div className="p-4.5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Camera size={16} style={{ color: '#ef4444' }} />
                  <h3 className="text-xs font-bold text-foreground">출석 인증 사진 업로드</h3>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                  >
                    필수
                  </span>
                </div>
                {currentPhotoUrl && !rec.submitted && (
                  <button
                    onClick={handleAttachSample}
                    className="text-[11px] text-[#8ba5ff] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={11} /> 샘플 사진으로 변경
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={rec.submitted}
                className="hidden"
              />

              {currentPhotoUrl ? (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-3 flex gap-4 items-center">
                  <div
                    className="relative w-36 h-24 rounded-lg overflow-hidden group shrink-0 border border-slate-200 cursor-pointer"
                    onClick={() => setLightboxOpen(true)}
                  >
                    <img
                      src={currentPhotoUrl}
                      alt="인증 사진 미리보기"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <ZoomIn size={16} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCheck size={14} className="text-[#34d399]" />
                      <p className="text-xs font-bold text-foreground truncate">
                        {currentPhotoName ?? `스터디_${selectedTeam}_${weekNum}주차_인증.jpg`}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      용량:{' '}
                      <span className="font-mono text-foreground/80">
                        {currentPhotoSize ?? '2.4 MB'}
                      </span>{' '}
                      · 형식: 이미지
                    </p>
                    <p className="text-[10px] text-[#34d399] mt-1 flex items-center gap-1">
                      <CheckCircle2 size={10} /> 운영지원팀에서 출석 현황 대조 시 확인할 수
                      있습니다.
                    </p>

                    {!rec.submitted && (
                      <div className="flex items-center gap-2 mt-2">
                        <Btn
                          variant="outline"
                          size="xs"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload size={11} /> 다른 사진으로 변경
                        </Btn>
                        <Btn variant="danger" size="xs" onClick={handleRemoveImage}>
                          <Trash2 size={11} /> 삭제
                        </Btn>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !rec.submitted && fileInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
                    imageWarning
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : 'border-slate-200 bg-white/[0.01] hover:bg-slate-50 hover:border-slate-300'
                  } ${rec.submitted ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div
                    className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.12)' }}
                  >
                    <Upload size={18} style={{ color: '#ef4444' }} />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    클릭하여 스터디 출석 인증 사진 업로드
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    스터디 현장 단체 사진 또는 온라인 화면 캡처 파일 (JPG, PNG)
                  </p>

                  {!rec.submitted && (
                    <div
                      className="mt-3 flex items-center justify-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Btn size="xs" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={11} /> 파일 선택
                      </Btn>
                      <Btn variant="outline" size="xs" onClick={handleAttachSample}>
                        <ImageIcon size={11} /> 샘플 사진 바로 첨부
                      </Btn>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard>
            <div className="p-4.5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    부원별 출결 입력
                    <span className="text-xs font-normal text-slate-500 ml-1.5 font-mono">
                      ({members.length}명)
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {!rec?.submitted && (
                    <button
                      type="button"
                      onClick={() => setShowAddMember((v) => !v)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    >
                      <UserPlus size={13} />
                      <span>+ 스터디원 추가</span>
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 hidden sm:flex">
                    <Info size={12} className="text-blue-500" />
                    <span>
                      사유는 <strong>선택 사항</strong>입니다.
                    </span>
                  </div>
                </div>
              </div>

              {/* Inline Add Member Panel for Study Leader */}
              {showAddMember && !rec?.submitted && (
                <div className="p-3.5 mb-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <UserPlus size={13} className="text-blue-600" />
                      <span>새 스터디 부원 추가</span>
                    </p>
                    <button
                      onClick={() => setShowAddMember(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <input
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddMember();
                        }
                      }}
                      placeholder="부원 이름 (쉼표로 구분하여 여러 명 추가 가능: 예: 김보아즈, 이서연)"
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white border border-blue-200 outline-none focus:border-blue-500 text-slate-900 placeholder:text-slate-400"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        value={newMemberYear}
                        onChange={(e) => setNewMemberYear(e.target.value)}
                        placeholder="23"
                        className="w-14 px-2.5 py-1.5 text-xs text-center rounded-lg bg-white border border-blue-200 outline-none focus:border-blue-500 text-slate-900 font-mono"
                      />
                      <span className="text-xs text-slate-500 font-medium">기</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMember}
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs shrink-0"
                    >
                      추가
                    </button>
                  </div>
                </div>
              )}

              {members.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <Users size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">
                    아직 등록된 스터디원이 없습니다
                  </p>
                  <p className="text-[11px] text-slate-500">
                    우측 상단의 [+ 스터디원 추가] 버튼을 눌러 스터디원을 등록해 주세요.
                  </p>
                  {!rec?.submitted && (
                    <button
                      type="button"
                      onClick={() => setShowAddMember(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 cursor-pointer shadow-xs inline-flex items-center gap-1.5 mt-1"
                    >
                      <UserPlus size={13} />
                      <span>스터디원 추가하기</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[620px]">
                    <div
                      className="grid text-xs font-semibold text-slate-500 pb-2.5 mb-1.5 items-center"
                      style={{
                        gridTemplateColumns: '36px 120px 130px 1fr 180px 40px',
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      <span className="text-center"></span>
                      <span className="font-bold text-slate-900">이름</span>
                      <span className="font-bold text-slate-800">소속 / 기수</span>
                      <span className="text-center font-bold text-slate-900">출결</span>
                      <span className="font-semibold text-slate-700">비고</span>
                      <span className="text-center text-slate-400">관리</span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {members.map((m, i) => {
                        const s = getStatus(m.id);
                        const currentMemo = getMemo(m.id);

                        return (
                          <div
                            key={m.id}
                            className="grid items-center py-2.5 gap-2 hover:bg-slate-50/60 px-1 rounded-xl transition-colors"
                            style={{ gridTemplateColumns: '36px 120px 130px 1fr 180px 40px' }}
                          >
                            <span className="text-xs text-slate-400 font-mono text-center">
                              {i + 1}
                            </span>

                            <div>
                              <p className="text-xs font-bold text-slate-900">{m.name}</p>
                            </div>

                            <div>
                              <span className="text-xs text-slate-700 font-medium">
                                {m.year ? `${m.year}기 부원` : '부원'}
                              </span>
                            </div>

                            <div className="flex items-center justify-center gap-1">
                              {EXT_STATUS_BTNS.map((btn) => {
                                const active = s === btn.id;
                                const statusStyles: Record<
                                  string,
                                  { active: string; inactive: string }
                                > = {
                                  present: {
                                    active:
                                      'bg-[#def2e6] text-[#0f5132] font-bold border border-[#b6e3c9] shadow-2xs',
                                    inactive:
                                      'bg-white text-slate-400 hover:text-[#0f5132] hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-medium',
                                  },
                                  late: {
                                    active:
                                      'bg-[#fceed2] text-[#7c4a03] font-bold border border-[#f5d5a4] shadow-2xs',
                                    inactive:
                                      'bg-white text-slate-400 hover:text-[#7c4a03] hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-medium',
                                  },
                                  absent: {
                                    active:
                                      'bg-[#fce4e6] text-[#8a1c32] font-bold border border-[#f8b4bc] shadow-2xs',
                                    inactive:
                                      'bg-white text-slate-400 hover:text-[#8a1c32] hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-medium',
                                  },
                                };
                                const styleCfg = statusStyles[btn.id] || {
                                  active:
                                    'bg-[#e9eef4] text-slate-800 font-bold border border-slate-300 shadow-2xs',
                                  inactive:
                                    'bg-white text-slate-400 hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-medium',
                                };
                                return (
                                  <button
                                    key={btn.id}
                                    type="button"
                                    onClick={() => setStatus(m.id, btn.id)}
                                    disabled={rec?.submitted ?? false}
                                    className={`px-3 py-1 text-xs rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed ${
                                      active ? styleCfg.active : styleCfg.inactive
                                    }`}
                                  >
                                    {btn.label}
                                  </button>
                                );
                              })}
                            </div>

                            <div>
                              <input
                                value={currentMemo}
                                onChange={(e) => setMemo(m.id, e.target.value)}
                                disabled={rec?.submitted ?? false}
                                placeholder="비고 입력 (선택)"
                                className="w-full px-2.5 py-1 text-xs rounded-lg outline-none transition-all bg-white border border-slate-200 focus:border-blue-500 text-slate-900 placeholder:text-slate-400 shadow-2xs"
                              />
                            </div>

                            <div className="flex items-center justify-center">
                              {!rec?.submitted ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(m.id)}
                                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                                  title="스터디원 삭제"
                                >
                                  <Trash2 size={13} />
                                </button>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="w-full lg:w-72 shrink-0 lg:sticky top-4 space-y-4">
          <SectionCard>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-black text-slate-900 tracking-tight">
                    {weekNum}주차 출결 요약
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]">
                    {currentStudy?.studyName || '스터디'}
                  </p>
                </div>
                {rec?.submitted ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                    제출완료
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
                    작성중
                  </span>
                )}
              </div>

              {/* 3 Attendance Metrics */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: '출석',
                    val: presentN,
                    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200/70',
                    numColor: 'text-emerald-700',
                  },
                  {
                    label: '지각',
                    val: lateN,
                    badge: 'bg-amber-50 text-amber-800 border-amber-200/70',
                    numColor: 'text-amber-700',
                  },
                  {
                    label: '결석',
                    val: absentN,
                    badge: 'bg-rose-50 text-rose-800 border-rose-200/70',
                    numColor: 'text-rose-700',
                  },
                ].map(({ label, val, badge, numColor }) => (
                  <div
                    key={label}
                    className={`p-2.5 rounded-xl border ${badge} transition-all shadow-2xs`}
                  >
                    <p className="text-[11px] font-bold opacity-80 mb-0.5">{label}</p>
                    <p className={`text-xl font-black font-mono ${numColor}`}>
                      {val}
                      <span className="text-xs font-semibold text-slate-600 ml-1">명</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Photo Status Card - Neutral Slate/Blue for high distinction */}
              {currentPhotoUrl ? (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Camera size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">인증 사진 첨부됨</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate max-w-[110px]">
                        {currentPhotoName || '인증사진.jpg'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/90 shadow-2xs cursor-pointer shrink-0 transition-colors"
                  >
                    사진 확인
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                      <AlertTriangle size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-amber-950">인증 사진 미첨부</p>
                      <p className="text-[10px] text-amber-700">제출 전 사진 등록 필요</p>
                    </div>
                  </div>
                  {!rec?.submitted && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-950 text-xs font-bold border border-amber-300/80 shadow-2xs cursor-pointer shrink-0 transition-colors"
                    >
                      사진 등록
                    </button>
                  )}
                </div>
              )}

              {!rec?.submitted ? (
                <div className="space-y-2 pt-1">
                  <button
                    onClick={submit}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send size={13} />
                    <span>출결 & 사진 제출하기</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400 leading-tight">
                    제출 후에는 운영지원팀 요청을 통해서만 수정할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {/* Distinct Solid Emerald Submission Receipt Banner */}
                  <div className="p-3.5 rounded-2xl bg-emerald-600 text-white space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <CheckCircle2 size={15} className="text-white shrink-0" />
                        <span>최종 제출 완료</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded-md">
                        저장됨
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-100 font-mono bg-black/15 px-2.5 py-1 rounded-lg">
                      제출일시: {rec.submittedAt}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <p className="text-xs font-bold text-slate-800">출결 수정이 필요하신가요?</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      제출 후 스터디장은 직접 수정이 불가합니다. 운영지원팀에 사유와 함께 수정
                      요청을 보내세요.
                    </p>
                    <button
                      onClick={() => setShowRequestModal(true)}
                      className="w-full py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200/90 shadow-2xs transition-colors cursor-pointer text-center"
                    >
                      운영지원팀에 수정 요청
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && currentPhotoUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-60 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentPhotoUrl}
              alt="출석 인증 사진"
              className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-slate-300"
            />
            <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-700">
              <span>
                {selectedTeam} · {weekNum}주차 출석 인증 사진 ({currentPhotoName})
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

      {/* Exception Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl overflow-hidden p-5 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">운영지원팀에 출결 수정 요청</h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1">대상 부원</label>
                <select
                  value={reqMember}
                  onChange={(e) => setReqMember(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg outline-none bg-slate-100 border border-slate-200 text-foreground"
                >
                  <option value="">부원을 선택하세요</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id} className="bg-white">
                      {m.name} ({m.year}기)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">변경 희망 상태</label>
                <div className="flex gap-2">
                  {(['present', 'late', 'absent'] as AttendanceStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setReqToStatus(s)}
                      className="flex-1 py-1.5 text-xs font-medium rounded transition-all cursor-pointer"
                      style={
                        reqToStatus === s
                          ? { background: STATUS_CFG[s].color, color: '#000', fontWeight: 'bold' }
                          : { background: '#f1f5f9', color: '#64748b' }
                      }
                    >
                      {STATUS_CFG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">수정 요청 사유 (필수)</label>
                <textarea
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="구체적인 사유를 작성하세요 (예: 출결 체크 오기재, 지각 사유 서류 제출 완료)"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg outline-none bg-slate-100 border border-slate-200 text-foreground resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setShowRequestModal(false)}>
                취소
              </Btn>
              <Btn onClick={handleSendRequest}>요청 보내기</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
