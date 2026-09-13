import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Edit3,
  Eye,
  EyeOff,
  History,
  Key,
  KeyRound,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
  UserPlus,
  X,
} from 'lucide-react';

export type AdminRole = 'MASTER' | 'SUPER' | 'TEAM';
export type AdminTrack = 'ANALYSIS' | 'VISUALIZATION' | 'ENGINEERING';
export type AdminTeamName =
  | '대표진'
  | '차기대표진'
  | '서비스운영팀'
  | '운영지원팀'
  | '기획팀'
  | '대외협력팀'
  | '디자인팀'
  | '자료연구팀';

// 5. 전체 계정 조회 DTO (AdminAccountResponse)
export interface AdminAccountDto {
  id: number;
  username: string;
  role: AdminRole;
  name: string;
  track: AdminTrack;
  term: number;
  team_name: AdminTeamName;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: string;
  actor: string;
  target: string;
  actionType:
    'ACCOUNT_CREATE' | 'ROLE_CHANGE' | 'ACCOUNT_DELETE' | 'PASSWORD_RESET' | 'PERMISSION_GRANT';
  description: string;
  ipAddress: string;
}

const TEAM_NAMES: AdminTeamName[] = [
  '대표진',
  '차기대표진',
  '서비스운영팀',
  '운영지원팀',
  '기획팀',
  '대외협력팀',
  '디자인팀',
  '자료연구팀',
];

const TRACK_NAMES: AdminTrack[] = ['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'];

const INITIAL_ACCOUNTS: AdminAccountDto[] = [
  {
    id: 1,
    username: 'boaz_master_lead',
    role: 'MASTER',
    name: '남민서 (팀장)',
    track: 'ANALYSIS',
    term: 28,
    team_name: '서비스운영팀',
    created_by: null,
    created_at: '2026-07-01T09:00:00',
    updated_at: '2026-08-16T19:00:00',
  },
  {
    id: 2,
    username: 'boaz_president',
    role: 'SUPER',
    name: '강민석 (대표)',
    track: 'ANALYSIS',
    term: 27,
    team_name: '대표진',
    created_by: 1,
    created_at: '2026-07-05T14:30:00',
    updated_at: '2026-07-05T14:30:00',
  },
  {
    id: 3,
    username: 'boaz_next_president',
    role: 'SUPER',
    name: '문혁준 (차기대표)',
    track: 'ENGINEERING',
    term: 28,
    team_name: '차기대표진',
    created_by: 1,
    created_at: '2026-07-06T10:00:00',
    updated_at: '2026-07-06T10:00:00',
  },
  {
    id: 4,
    username: 'boaz_ops_lead',
    role: 'TEAM',
    name: '김대현 (팀장)',
    track: 'ENGINEERING',
    term: 28,
    team_name: '운영지원팀',
    created_by: 1,
    created_at: '2026-07-10T11:20:00',
    updated_at: '2026-07-20T16:00:00',
  },
  {
    id: 5,
    username: 'boaz_service_dev',
    role: 'TEAM',
    name: '이재현 (개발)',
    track: 'ENGINEERING',
    term: 28,
    team_name: '서비스운영팀',
    created_by: 1,
    created_at: '2026-07-12T15:40:00',
    updated_at: '2026-08-10T18:10:00',
  },
  {
    id: 6,
    username: 'boaz_viz_lead',
    role: 'TEAM',
    name: '손채민 (팀장)',
    track: 'VISUALIZATION',
    term: 28,
    team_name: '기획팀',
    created_by: 1,
    created_at: '2026-07-15T09:10:00',
    updated_at: '2026-07-15T09:10:00',
  },
  {
    id: 7,
    username: 'boaz_design_lead',
    role: 'TEAM',
    name: '신재원 (팀장)',
    track: 'VISUALIZATION',
    term: 28,
    team_name: '디자인팀',
    created_by: 1,
    created_at: '2026-07-18T13:00:00',
    updated_at: '2026-07-18T13:00:00',
  },
];

const INITIAL_AUDIT_LOGS: SecurityAuditLog[] = [
  {
    id: 'l1',
    timestamp: '2026-08-16 19:25:10',
    actor: '남민서 (MASTER)',
    target: '김대현 (boaz_ops_lead)',
    actionType: 'PERMISSION_GRANT',
    description: '운영지원팀 출결 관리 및 HOST 계정 발급 권한 확인',
    ipAddress: '121.134.82.11',
  },
  {
    id: 'l2',
    timestamp: '2026-08-16 18:40:00',
    actor: '남민서 (MASTER)',
    target: '신재원 (boaz_design_lead)',
    actionType: 'PASSWORD_RESET',
    description: '디자인팀장 계정 비밀번호 초기화 및 RefreshToken 무효화',
    ipAddress: '121.134.82.11',
  },
  {
    id: 'l3',
    timestamp: '2026-07-18 13:00:00',
    actor: '남민서 (MASTER)',
    target: '신재원 (boaz_design_lead)',
    actionType: 'ACCOUNT_CREATE',
    description: '신규 운영진 계정 발급 (POST /api/v1/admin/accounts)',
    ipAddress: '121.134.82.11',
  },
  {
    id: 'l4',
    timestamp: '2026-07-10 11:20:00',
    actor: '남민서 (MASTER)',
    target: '김대현 (boaz_ops_lead)',
    actionType: 'ACCOUNT_CREATE',
    description: '운영지원팀장 계정 발급',
    ipAddress: '121.134.82.11',
  },
];

const PERMISSION_MATRIX = [
  {
    name: 'ACCOUNT_MANAGE',
    desc: '운영진 계정 생성·삭제·권한 부여',
    master: '허용',
    super: '제한',
    serviceTeam: '제한',
    opsTeam: '제한',
    otherTeam: '제한',
    host: '제한',
  },
  {
    name: 'CONTENT_MANAGE',
    desc: '아카이빙·FAQ·후기·커리큘럼 CUD',
    master: '허용',
    super: '허용',
    serviceTeam: '허용',
    opsTeam: '제한',
    otherTeam: '제한',
    host: '제한',
  },
  {
    name: 'RECRUITMENT_MANAGE',
    desc: '모집 공고·질문·지원서 CSV 추출',
    master: '허용',
    super: '허용',
    serviceTeam: '허용',
    opsTeam: '제한',
    otherTeam: '제한',
    host: '제한',
  },
  {
    name: 'ATTENDANCE_MANAGE',
    desc: '활동·팀·명단·HOST 계정 발급',
    master: '허용',
    super: '허용',
    serviceTeam: '제한',
    opsTeam: '🌟 O (전담)',
    otherTeam: '제한',
    host: '제한',
  },
  {
    name: 'ATTENDANCE_APPROVE',
    desc: '제출 후 출결 수동 수정·사유 인정',
    master: '허용',
    super: '허용',
    serviceTeam: '제한',
    opsTeam: '🌟 O (전담)',
    otherTeam: '제한',
    host: '제한',
  },
  {
    name: 'SCORE_MANAGE',
    desc: '활동 점수 수동 조정 및 점수 확정',
    master: '허용',
    super: '허용',
    serviceTeam: '제한',
    opsTeam: '🌟 O (전담)',
    otherTeam: '제한',
    host: '제한',
  },
  {
    name: 'RULE_EDIT / ACTIVATE',
    desc: '점수 규칙 DRAFT 작성 및 활성화',
    master: '허용',
    super: '대표진 전용',
    serviceTeam: '제한',
    opsTeam: '제한',
    otherTeam: '제한',
    host: '제한',
  },
  {
    name: 'EVALUATION',
    desc: '서류 평가 (차기: 전 부문 / 일반: 본인 트랙)',
    master: '본인',
    super: '전 부문',
    serviceTeam: '본인',
    opsTeam: '본인',
    otherTeam: '본인',
    host: '제한',
  },
  {
    name: 'FINAL_DECISION',
    desc: '최종 합불 판정 및 확정',
    master: '허용',
    super: '대표진 전용',
    serviceTeam: '제한',
    opsTeam: '제한',
    otherTeam: '제한',
    host: '제한',
  },
];

interface SystemAccountsPageProps {
  initialSubTab?: 'accounts' | 'permissions' | 'audit';
}

export function SystemAccountsPage({ initialSubTab = 'accounts' }: SystemAccountsPageProps) {
  const [subTab, setSubTab] = useState<'accounts' | 'permissions' | 'audit'>(initialSubTab);

  useEffect(() => {
    setSubTab(initialSubTab);
  }, [initialSubTab]);

  // States
  const [accounts, setAccounts] = useState<AdminAccountDto[]>(INITIAL_ACCOUNTS);
  const [auditLogs, setAuditLogs] = useState<SecurityAuditLog[]>(INITIAL_AUDIT_LOGS);

  // Current logged-in user selector (Default: 남민서 MASTER)
  const [currentLoggedInAdminId, setCurrentLoggedInAdminId] = useState<number>(1);
  const currentAdmin = accounts.find((a) => a.id === currentLoggedInAdminId) || accounts[0];
  const isMaster = currentAdmin.role === 'MASTER';

  // Filter & Search (For MASTER view)
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AdminRole>('ALL');
  const [teamFilter, setTeamFilter] = useState<'ALL' | AdminTeamName>('ALL');
  const [trackFilter, setTrackFilter] = useState<'ALL' | AdminTrack>('ALL');

  // Create Modal State (POST /api/v1/admin/accounts) - MASTER 전용
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('TEAM');
  const [newName, setNewName] = useState('');
  const [newTrack, setNewTrack] = useState<AdminTrack>('ANALYSIS');
  const [newTerm, setNewTerm] = useState<number>(28);
  const [newTeamName, setNewTeamName] = useState<AdminTeamName>('서비스운영팀');
  const [showPwText, setShowPwText] = useState(false);

  // Edit Modal State (PATCH /api/v1/admin/accounts/{id})
  const [editingAccount, setEditingAccount] = useState<AdminAccountDto | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<AdminRole>('TEAM');
  const [editTrack, setEditTrack] = useState<AdminTrack>('ANALYSIS');
  const [editTerm, setEditTerm] = useState<number>(28);
  const [editTeamName, setEditTeamName] = useState<AdminTeamName>('서비스운영팀');

  // Password Modal (PATCH /api/v1/admin/accounts/{id}/password)
  const [pwTargetAccount, setPwTargetAccount] = useState<{
    id: number;
    username: string;
    name: string;
    isSelf: boolean;
  } | null>(null);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // Password Policy Regex: 8자 이상 + 영문 + 숫자 + 특수문자(!@#$%^&*)
  function validatePassword(pw: string): boolean {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;
    return regex.test(pw);
  }

  function generateRandomPassword() {
    const gen = 'Boaz!' + Math.floor(1000 + Math.random() * 9000);
    setNewPassword(gen);
    setNewPasswordInput(gen);
    setConfirmPasswordInput(gen);
  }

  // Filtered Accounts (MASTER 전용)
  const filteredAccounts = useMemo(() => {
    return accounts
      .filter((acc) => {
        if (roleFilter !== 'ALL' && acc.role !== roleFilter) {
          return false;
        }
        if (teamFilter !== 'ALL' && acc.team_name !== teamFilter) {
          return false;
        }
        if (trackFilter !== 'ALL' && acc.track !== trackFilter) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            acc.username.toLowerCase().includes(q) ||
            acc.name.toLowerCase().includes(q) ||
            acc.team_name.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [accounts, roleFilter, teamFilter, trackFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = accounts.length;
    const masterCount = accounts.filter((a) => a.role === 'MASTER').length;
    const superCount = accounts.filter((a) => a.role === 'SUPER').length;
    const teamCount = accounts.filter((a) => a.role === 'TEAM').length;
    return { total, masterCount, superCount, teamCount };
  }, [accounts]);

  // 4. 계정 생성 (POST /api/v1/admin/accounts) - MASTER 전용
  function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!isMaster) {
      alert('UNAUTHORIZED: 운영진 계정 생성은 MASTER(서비스운영팀장) 권한 전용입니다.');
      return;
    }
    if (!newUsername.trim()) {
      alert('아이디(username)를 입력해 주세요.');
      return;
    }
    if (accounts.some((a) => a.username === newUsername.trim())) {
      alert('DUPLICATE_USERNAME: 이미 존재하는 관리자 아이디입니다.');
      return;
    }
    if (!validatePassword(newPassword)) {
      alert(
        '비밀번호 정책 위반: 8자 이상 + 영문, 숫자, 특수문자(!@#$%^&*)를 각 1개 이상 포함해야 합니다.',
      );
      return;
    }
    if (!newName.trim()) {
      alert('이름을 입력해 주세요.');
      return;
    }
    if (newTerm < 0) {
      alert('기수는 0 이상이어야 합니다.');
      return;
    }

    const nextId = Math.max(...accounts.map((a) => a.id)) + 1;
    const newAcc: AdminAccountDto = {
      id: nextId,
      username: newUsername.trim(),
      role: newRole,
      name: newName.trim(),
      track: newTrack,
      term: newTerm,
      team_name: newTeamName,
      created_by: currentLoggedInAdminId,
      created_at: new Date().toISOString().slice(0, 19),
      updated_at: new Date().toISOString().slice(0, 19),
    };

    setAccounts((prev) => [...prev, newAcc]);
    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        actor: `${currentAdmin.name} (${currentAdmin.role})`,
        target: `${newAcc.name} (${newAcc.username})`,
        actionType: 'ACCOUNT_CREATE',
        description: `신규 운영진 계정 발급 (역할: ${newRole}, 부서: ${newTeamName})`,
        ipAddress: '121.134.82.11',
      },
      ...prev,
    ]);

    setShowCreateModal(false);
    setNewUsername('');
    setNewPassword('');
    setNewName('');
    alert(`새 운영진 계정이 생성되었습니다.`);
  }

  // 8. 계정 수정 (PATCH /api/v1/admin/accounts/{id})
  function handleSaveEdit() {
    if (!editingAccount) {
      return;
    }
    if (!editName.trim()) {
      alert('이름을 입력해 주세요.');
      return;
    }

    // CANNOT_MODIFY_OWN_ROLE guard
    if (editingAccount.id === currentLoggedInAdminId && editRole !== editingAccount.role) {
      alert('CANNOT_MODIFY_OWN_ROLE: 본인의 관리자 역할은 스스로 변경할 수 없습니다.');
      return;
    }

    setAccounts((prev) =>
      prev.map((a) =>
        a.id === editingAccount.id
          ? {
              ...a,
              name: editName.trim(),
              role: editRole,
              track: editTrack,
              term: editTerm,
              team_name: editTeamName,
              updated_at: new Date().toISOString().slice(0, 19),
            }
          : a,
      ),
    );

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        actor: `${currentAdmin.name} (${currentAdmin.role})`,
        target: `${editingAccount.name} (${editingAccount.username})`,
        actionType: 'ROLE_CHANGE',
        description: `계정 정보 수정 (부서: ${editTeamName}, 역할: ${editRole})`,
        ipAddress: '121.134.82.11',
      },
      ...prev,
    ]);

    setEditingAccount(null);
    alert(
      `계정 정보가 성공적으로 수정되었습니다.\n[PATCH /api/v1/admin/accounts/${editingAccount.id}]`,
    );
  }

  // 9. 계정 삭제 (DELETE /api/v1/admin/accounts/{id}) - MASTER 전용
  function handleDeleteAccount(acc: AdminAccountDto) {
    if (acc.role === 'SUPER' && stats.superCount <= 1) {
      alert('LAST_SUPER_ACCOUNT: 시스템의 마지막 남은 SUPER 관리자 계정은 삭제할 수 없습니다.');
      return;
    }
    if (acc.role === 'MASTER' && stats.masterCount <= 1) {
      alert('시스템의 유일한 MASTER(서비스운영팀장) 계정은 삭제할 수 없습니다.');
      return;
    }

    if (
      confirm(
        `정말 운영진 계정 '${acc.username} (${acc.name})'을(를) 삭제하시겠습니까?\n(DELETE /api/v1/admin/accounts/${acc.id})`,
      )
    ) {
      setAccounts((prev) => prev.filter((a) => a.id !== acc.id));
      setAuditLogs((prev) => [
        {
          id: `log_${Date.now()}`,
          timestamp: new Date().toLocaleString(),
          actor: `${currentAdmin.name} (${currentAdmin.role})`,
          target: `${acc.name} (${acc.username})`,
          actionType: 'ACCOUNT_DELETE',
          description: '운영진 계정 Soft Delete 및 RefreshToken 무효화',
          ipAddress: '121.134.82.11',
        },
        ...prev,
      ]);
      alert('계정이 삭제되었습니다. (Soft Delete & RefreshToken 무효화 처리)');
    }
  }

  // 10. 비밀번호 변경/초기화 (PATCH /api/v1/admin/accounts/{id}/password)
  function handleSavePassword() {
    if (!pwTargetAccount) {
      return;
    }
    if (pwTargetAccount.isSelf && !currentPasswordInput) {
      alert('본인 비밀번호 변경 시 현재 비밀번호(current_password)를 입력해야 합니다.');
      return;
    }
    if (!validatePassword(newPasswordInput)) {
      alert(
        '새 비밀번호 정책 위반: 8자 이상 + 영문, 숫자, 특수문자(!@#$%^&*)를 각 1개 이상 포함해야 합니다.',
      );
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      alert('새 비밀번호와 확인 입력이 일치하지 않습니다.');
      return;
    }

    setAuditLogs((prev) => [
      {
        id: `log_${Date.now()}`,
        timestamp: new Date().toLocaleString(),
        actor: `${currentAdmin.name} (${currentAdmin.role})`,
        target: `${pwTargetAccount.name} (${pwTargetAccount.username})`,
        actionType: 'PASSWORD_RESET',
        description: pwTargetAccount.isSelf
          ? '본인 비밀번호 변경'
          : 'MASTER 권한으로 비밀번호 강제 초기화',
        ipAddress: '121.134.82.11',
      },
      ...prev,
    ]);

    alert(
      `✅ [PATCH /api/v1/admin/accounts/${pwTargetAccount.id}/password]\n비밀번호가 성공적으로 변경되었습니다.\n해당 계정의 Refresh Token이 무효화되어 재로그인이 요구됩니다.`,
    );
    setPwTargetAccount(null);
  }

  return (
    <div
      className="space-y-5"
      style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}
    >
      {/* ─── Top Header & Role State Bar ─── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-6">
          {[
            {
              id: 'accounts',
              label: isMaster ? '운영진 계정 관리 (MASTER 전용)' : '내 계정 정보 및 보안',
              icon: UserCog,
              count: isMaster ? accounts.length : 1,
            },
            {
              id: 'permissions',
              label: '권한 매트릭스 (10대 Permission)',
              icon: ShieldCheck,
              count: 'Matrix',
            },
            { id: 'audit', label: '보안 감사 로그', icon: KeyRound, count: auditLogs.length },
          ].map((tab) => {
            const isActive = subTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className="text-xs font-bold pb-1 relative transition-colors flex items-center gap-1.5 cursor-pointer"
                style={{ color: isActive ? '#0f172a' : '#64748b' }}
              >
                <Icon size={14} style={{ color: isActive ? '#c084fc' : 'currentColor' }} />
                <span>{tab.label}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 text-muted-foreground">
                  {tab.count}
                </span>
                {isActive && (
                  <div className="absolute -bottom-3.5 left-0 right-0 h-0.5 rounded-full bg-purple-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Current Login Account Switcher (테스트용) */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">로그인 시뮬레이션:</span>
          <select
            value={currentLoggedInAdminId}
            onChange={(e) => setCurrentLoggedInAdminId(Number(e.target.value))}
            className="px-2.5 py-1 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold font-mono outline-none cursor-pointer"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id} className="bg-white text-foreground">
                {a.name} ({a.role} · {a.team_name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── TAB 1: 운영진 계정 관리 (MASTER vs 일반 운영진 뷰 분기) ─── */}
      {subTab === 'accounts' && (
        <div className="space-y-4">
          {/* 1. MASTER 권한인 경우: 전체 운영진 계정 관리 (CRUD + 타인 비번 강제 초기화) */}
          {isMaster ? (
            <>
              {/* Top Notice Bar */}
              <div className="p-4 rounded-2xl border border-pink-500/30 bg-pink-500/[0.04] flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck size={16} className="text-pink-400" />
                    <span>서비스운영팀장(MASTER) 전용 운영진 계정 관리 콘솔</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    운영진 계정 및 권한 매트릭스 관리
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowCreateModal(true);
                    generateRandomPassword();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-pink-950/40"
                >
                  <UserPlus size={14} />
                  <span>새 운영진 계정 발급 (POST)</span>
                </button>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
                  <p className="text-[11px] text-muted-foreground font-medium">전체 활성 운영진</p>
                  <p className="text-xl font-bold text-foreground font-mono">{stats.total}명</p>
                  <p className="text-[10px] text-muted-foreground">미삭제 계정</p>
                </div>
                <div className="p-4 rounded-xl border border-pink-500/30 bg-white space-y-1">
                  <p className="text-[11px] text-pink-300 font-medium">MASTER (서비스운영팀장)</p>
                  <p className="text-xl font-bold text-pink-400 font-mono">{stats.masterCount}명</p>
                  <p className="text-[10px] text-pink-400/70">계정 CRUD & 시스템 관리</p>
                </div>
                <div className="p-4 rounded-xl border border-purple-500/30 bg-white space-y-1">
                  <p className="text-[11px] text-purple-300 font-medium">SUPER (대표진 / 차기)</p>
                  <p className="text-xl font-bold text-purple-400 font-mono">
                    {stats.superCount}명
                  </p>
                  <p className="text-[10px] text-purple-400/70">규칙 확정 & 최종 합불</p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1">
                  <p className="text-[11px] text-muted-foreground font-medium">
                    TEAM (부서별 운영진)
                  </p>
                  <p className="text-xl font-bold text-[#8ba5ff] font-mono">{stats.teamCount}명</p>
                  <p className="text-[10px] text-muted-foreground">출결(운영지원) / 서류평가</p>
                </div>
              </div>

              {/* Accounts Table */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3 bg-white/[0.01]">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-foreground">
                      전체 운영진 계정 목록 (생성일 오름차순)
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-[#8ba5ff]">
                      총 {filteredAccounts.length}명
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value as any)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-foreground text-xs outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-white">
                        전체 역할
                      </option>
                      <option value="MASTER" className="bg-white">
                        MASTER
                      </option>
                      <option value="SUPER" className="bg-white">
                        SUPER
                      </option>
                      <option value="TEAM" className="bg-white">
                        TEAM
                      </option>
                    </select>

                    <select
                      value={teamFilter}
                      onChange={(e) => setTeamFilter(e.target.value as any)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-foreground text-xs outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-white">
                        전체 부서
                      </option>
                      {TEAM_NAMES.map((t) => (
                        <option key={t} value={t} className="bg-white">
                          {t}
                        </option>
                      ))}
                    </select>

                    <select
                      value={trackFilter}
                      onChange={(e) => setTrackFilter(e.target.value as any)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-foreground text-xs outline-none cursor-pointer"
                    >
                      <option value="ALL" className="bg-white">
                        전체 트랙
                      </option>
                      {TRACK_NAMES.map((tr) => (
                        <option key={tr} value={tr} className="bg-white">
                          {tr}
                        </option>
                      ))}
                    </select>

                    <div className="relative">
                      <input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="아이디, 이름, 부서 검색..."
                        className="pl-8 pr-3 py-1 text-xs rounded-xl bg-slate-100 border border-slate-200 text-foreground placeholder:text-muted-foreground/60 outline-none w-44 font-mono"
                      />
                      <Search
                        size={12}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-muted-foreground font-semibold">
                        <th className="text-left px-5 py-3.5 w-16">ID</th>
                        <th className="text-left px-4 py-3.5">아이디 (username)</th>
                        <th className="text-left px-4 py-3.5">성명</th>
                        <th className="text-center px-4 py-3.5">역할 (role)</th>
                        <th className="text-left px-4 py-3.5">소속 부서 (team_name)</th>
                        <th className="text-left px-4 py-3.5">트랙 (track)</th>
                        <th className="text-center px-3 py-3.5">기수</th>
                        <th className="text-left px-4 py-3.5">생성 일시</th>
                        <th className="text-right px-5 py-3.5">관리 액션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {filteredAccounts.map((acc) => {
                        const isSelf = acc.id === currentLoggedInAdminId;

                        return (
                          <tr key={acc.id} className="hover:bg-white/[0.015] transition-colors">
                            <td className="px-5 py-3.5 font-bold text-muted-foreground">
                              #{acc.id}
                            </td>

                            {/* username */}
                            <td className="px-4 py-3.5 font-bold text-foreground font-sans">
                              <div className="flex items-center gap-1.5">
                                <span>{acc.username}</span>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-pink-500/15 text-pink-400 font-mono">
                                    나 (MASTER)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* name */}
                            <td className="px-4 py-3.5 font-sans font-semibold text-foreground">
                              {acc.name}
                            </td>

                            {/* role */}
                            <td className="px-4 py-3.5 text-center">
                              <span
                                className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono"
                                style={
                                  acc.role === 'MASTER'
                                    ? {
                                        background: 'rgba(236,72,153,0.15)',
                                        color: '#f472b6',
                                        border: '1px solid rgba(236,72,153,0.3)',
                                      }
                                    : acc.role === 'SUPER'
                                      ? {
                                          background: 'rgba(168,85,247,0.15)',
                                          color: '#c084fc',
                                          border: '1px solid rgba(168,85,247,0.3)',
                                        }
                                      : {
                                          background: 'rgba(91,127,255,0.12)',
                                          color: '#8ba5ff',
                                          border: '1px solid rgba(91,127,255,0.3)',
                                        }
                                }
                              >
                                {acc.role}
                              </span>
                            </td>

                            {/* team_name */}
                            <td className="px-4 py-3.5 font-sans text-foreground">
                              <div className="flex items-center gap-1.5">
                                <span>{acc.team_name}</span>
                                {acc.team_name === '운영지원팀' && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 font-mono">
                                    출결 전담
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* track */}
                            <td className="px-4 py-3.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200 text-muted-foreground">
                                {acc.track}
                              </span>
                            </td>

                            {/* term */}
                            <td className="px-3 py-3.5 text-center text-foreground font-bold">
                              {acc.term}기
                            </td>

                            {/* created_at */}
                            <td className="px-4 py-3.5 text-muted-foreground text-[11px]">
                              {acc.created_at.replace('T', ' ')}
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-3.5 text-right font-sans">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setPwTargetAccount({
                                      id: acc.id,
                                      username: acc.username,
                                      name: acc.name,
                                      isSelf,
                                    });
                                    setCurrentPasswordInput('');
                                    setNewPasswordInput('');
                                    setConfirmPasswordInput('');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-100 text-[#8ba5ff] border border-slate-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                                  title={
                                    isSelf
                                      ? '본인 비밀번호 변경 (현재 비번 필수)'
                                      : 'MASTER 권한으로 비밀번호 강제 초기화'
                                  }
                                >
                                  <Key size={11} />
                                  <span>{isSelf ? '비번 변경' : '비번 초기화'}</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setEditingAccount(acc);
                                    setEditName(acc.name);
                                    setEditRole(acc.role);
                                    setEditTrack(acc.track);
                                    setEditTerm(acc.term);
                                    setEditTeamName(acc.team_name);
                                  }}
                                  className="p-1 rounded-lg bg-slate-100 hover:bg-slate-100 text-foreground border border-slate-200 cursor-pointer"
                                  title="계정 정보 수정 (PATCH /accounts/{id})"
                                >
                                  <Edit3 size={13} />
                                </button>

                                {!isSelf && (
                                  <button
                                    onClick={() => handleDeleteAccount(acc)}
                                    className="p-1 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 border border-slate-200 cursor-pointer"
                                    title="계정 삭제 (DELETE /accounts/{id})"
                                  >
                                    <Trash2 size={13} />
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
              </div>
            </>
          ) : (
            /* 2. 일반 운영진(TEAM / SUPER)인 경우: 본인 계정 정보 및 본인 비밀번호 변경 전용 뷰 */
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Info Notice */}
              <div className="p-4 rounded-2xl border border-blue-500/30 bg-blue-500/[0.04] flex items-start gap-3">
                <AlertCircle size={18} className="text-[#8ba5ff] mt-0.5 shrink-0" />
                <div className="text-xs space-y-1">
                  <p className="font-bold text-foreground">
                    운영진 본인 계정 정보 및 보안 관리 (GET /api/v1/admin/accounts/me)
                  </p>
                  <p className="text-muted-foreground">
                    타 운영진의 전체 계정 생성·수정·삭제는 <strong>서비스운영팀장(MASTER)</strong>{' '}
                    전용 권한입니다. 현재 로그인된 본인의 프로필 확인 및 비밀번호 변경을 안전하게
                    수행할 수 있습니다.
                  </p>
                </div>
              </div>

              {/* My Profile Card */}
              <div className="p-6 rounded-2xl border border-slate-200 bg-white space-y-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold text-lg">
                      {currentAdmin.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        <span>{currentAdmin.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {currentAdmin.role}
                        </span>
                      </h3>
                      <p className="text-xs font-mono text-muted-foreground mt-0.5">
                        아이디: @{currentAdmin.username} · 소속: {currentAdmin.team_name} (
                        {currentAdmin.track})
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setPwTargetAccount({
                        id: currentAdmin.id,
                        username: currentAdmin.username,
                        name: currentAdmin.name,
                        isSelf: true,
                      });
                      setCurrentPasswordInput('');
                      setNewPasswordInput('');
                      setConfirmPasswordInput('');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Key size={14} />
                    <span>내 비밀번호 변경하기</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-muted-foreground text-[11px]">활동 기수</span>
                    <p className="text-foreground font-bold text-sm">{currentAdmin.term}기</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-muted-foreground text-[11px]">소속 트랙</span>
                    <p className="text-[#8ba5ff] font-bold text-sm">{currentAdmin.track}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-muted-foreground text-[11px]">계정 생성일시</span>
                    <p className="text-muted-foreground text-xs">
                      {currentAdmin.created_at.replace('T', ' ')}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-muted-foreground text-[11px]">비밀번호 보안 정책</span>
                    <p className="text-emerald-400 font-bold text-xs">8자+영문+숫자+특수문자</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: 권한 매트릭스 (10대 Permission) ─── */}
      {subTab === 'permissions' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>BOAZ 2개의 축(Role & TeamName) 기반 권한 매트릭스</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              서비스마다 role과 teamName을 직접 하드코딩하지 않고, 계정이 가진{' '}
              <code className="text-foreground font-mono">Permission</code> 열거형으로 접근을
              통제합니다.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-muted-foreground font-semibold">
                    <th className="text-left px-5 py-3.5">Permission (권한)</th>
                    <th className="text-left px-4 py-3.5">기능 설명</th>
                    <th className="text-center px-4 py-3.5 text-pink-400">
                      MASTER (서비스운영팀장)
                    </th>
                    <th className="text-center px-4 py-3.5 text-purple-400">SUPER (대표진/차기)</th>
                    <th className="text-center px-4 py-3.5 text-blue-400">운영지원팀</th>
                    <th className="text-center px-4 py-3.5">기타 운영진 (TEAM)</th>
                    <th className="text-center px-4 py-3.5 text-amber-400">HOST (스터디장)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {PERMISSION_MATRIX.map((pm) => (
                    <tr key={pm.name} className="hover:bg-white/[0.015]">
                      <td className="px-5 py-3.5 font-bold text-[#8ba5ff]">{pm.name}</td>
                      <td className="px-4 py-3.5 font-sans text-foreground">{pm.desc}</td>
                      <td className="px-4 py-3.5 text-center font-sans font-bold text-pink-300">
                        {pm.master}
                      </td>
                      <td className="px-4 py-3.5 text-center font-sans font-bold text-purple-300">
                        {pm.super}
                      </td>
                      <td className="px-4 py-3.5 text-center font-sans font-bold text-blue-300">
                        {pm.opsTeam}
                      </td>
                      <td className="px-4 py-3.5 text-center font-sans text-muted-foreground">
                        {pm.otherTeam}
                      </td>
                      <td className="px-4 py-3.5 text-center font-sans text-muted-foreground">
                        {pm.host}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: 보안 감사 로그 ─── */}
      {subTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <History size={16} className="text-[#8ba5ff]" />
                <span>운영진 계정 보안 및 감사 로그 (Audit Log)</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                계정 발급, 역할 변경, 비밀번호 초기화, 토큰 무효화 실시간 기록
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-muted-foreground font-semibold">
                    <th className="text-left px-5 py-3.5">발생 일시</th>
                    <th className="text-left px-4 py-3.5">수행자 (Actor)</th>
                    <th className="text-left px-4 py-3.5">작업 유형</th>
                    <th className="text-left px-4 py-3.5">대상 (Target)</th>
                    <th className="text-left px-5 py-3.5">상세 내용</th>
                    <th className="text-right px-5 py-3.5">IP 주소</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.015]">
                      <td className="px-5 py-3.5 text-muted-foreground text-[11px]">
                        {log.timestamp}
                      </td>
                      <td className="px-4 py-3.5 font-sans font-bold text-[#8ba5ff]">
                        {log.actor}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200 text-foreground">
                          {log.actionType}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-sans text-foreground">{log.target}</td>
                      <td className="px-5 py-3.5 font-sans text-muted-foreground">
                        {log.description}
                      </td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground text-[11px]">
                        {log.ipAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 1: 새 관리자 계정 생성 (POST /api/v1/admin/accounts) ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/85 z-80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <UserPlus size={18} className="text-pink-400" />
                  <span>새 운영진 계정 생성 (MASTER)</span>
                </h3>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  POST /api/v1/admin/accounts (created_by: #{currentLoggedInAdminId} 자동 기록)
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1 font-semibold">
                    아이디 (username) <span className="text-red-400 font-bold">*</span>
                  </label>
                  <input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="예: boaz_team2"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1 font-semibold">
                    성명 (name) <span className="text-red-400 font-bold">*</span>
                  </label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="예: 김보아즈"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-sans font-bold"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-muted-foreground font-semibold">
                    초기 비밀번호 (password) <span className="text-red-400 font-bold">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[10px] text-pink-400 hover:underline flex items-center gap-0.5 cursor-pointer font-mono"
                  >
                    <Sparkles size={10} /> 임의 안전 비밀번호 생성
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPwText ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="8자 이상 + 영문/숫자/특수문자(!@#$%^&*)"
                    className="w-full px-3 py-2 pr-10 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwText((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPwText ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1 font-semibold">
                    관리자 역할 (role) <span className="text-red-400 font-bold">*</span>
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as AdminRole)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono font-bold"
                  >
                    <option value="TEAM" className="bg-white">
                      TEAM (일반 운영진)
                    </option>
                    <option value="SUPER" className="bg-white">
                      SUPER (대표진/차기)
                    </option>
                    <option value="MASTER" className="bg-white">
                      MASTER (서비스운영팀장)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1 font-semibold">
                    소속 부서 (team_name) <span className="text-red-400 font-bold">*</span>
                  </label>
                  <select
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value as AdminTeamName)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-sans font-semibold"
                  >
                    {TEAM_NAMES.map((t) => (
                      <option key={t} value={t} className="bg-white">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1 font-semibold">
                    소속 트랙 (track) <span className="text-red-400 font-bold">*</span>
                  </label>
                  <select
                    value={newTrack}
                    onChange={(e) => setNewTrack(e.target.value as AdminTrack)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono font-bold"
                  >
                    <option value="ANALYSIS" className="bg-white">
                      ANALYSIS (데이터 분석)
                    </option>
                    <option value="ENGINEERING" className="bg-white">
                      ENGINEERING (엔지니어링)
                    </option>
                    <option value="VISUALIZATION" className="bg-white">
                      VISUALIZATION (시각화)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1 font-semibold">
                    활동 기수 (term) <span className="text-red-400 font-bold">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newTerm}
                    onChange={(e) => setNewTerm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 cursor-pointer shadow-lg shadow-pink-950/40"
                >
                  계정 발급하기 (POST)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal 2: 계정 정보 수정 (PATCH /api/v1/admin/accounts/{id}) ─── */}
      {editingAccount && (
        <div className="fixed inset-0 bg-black/85 z-80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  운영진 계정 정보 수정 (#{editingAccount.id})
                </h3>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  PATCH /api/v1/admin/accounts/{editingAccount.id}
                </p>
              </div>
              <button
                onClick={() => setEditingAccount(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  아이디 (변경 불가)
                </label>
                <input
                  disabled
                  value={editingAccount.username}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-muted-foreground font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  성명 (name)
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-sans font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1 font-semibold">
                    역할 (role)
                  </label>
                  <select
                    disabled={!isMaster || editingAccount.id === currentLoggedInAdminId}
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as AdminRole)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono font-bold disabled:opacity-40"
                  >
                    <option value="TEAM" className="bg-white">
                      TEAM
                    </option>
                    <option value="SUPER" className="bg-white">
                      SUPER
                    </option>
                    <option value="MASTER" className="bg-white">
                      MASTER
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1 font-semibold">
                    소속 부서 (team_name)
                  </label>
                  <select
                    value={editTeamName}
                    onChange={(e) => setEditTeamName(e.target.value as AdminTeamName)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-sans font-semibold"
                  >
                    {TEAM_NAMES.map((t) => (
                      <option key={t} value={t} className="bg-white">
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-muted-foreground block mb-1 font-semibold">
                    소속 트랙 (track)
                  </label>
                  <select
                    value={editTrack}
                    onChange={(e) => setEditTrack(e.target.value as AdminTrack)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono font-bold"
                  >
                    {TRACK_NAMES.map((tr) => (
                      <option key={tr} value={tr} className="bg-white">
                        {tr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-muted-foreground block mb-1 font-semibold">
                    활동 기수 (term)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editTerm}
                    onChange={(e) => setEditTerm(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#3b82f6] hover:bg-[#2563eb] cursor-pointer shadow-lg shadow-blue-950/40"
              >
                수정 저장하기 (PATCH)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal 3: 비밀번호 변경/초기화 (PATCH /accounts/{id}/password) ─── */}
      {pwTargetAccount && (
        <div className="fixed inset-0 bg-black/85 z-80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Key size={16} className="text-[#8ba5ff]" />
                  <span>
                    {pwTargetAccount.isSelf
                      ? '내 비밀번호 변경'
                      : `비밀번호 강제 초기화 (${pwTargetAccount.name})`}
                  </span>
                </h3>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  PATCH /api/v1/admin/accounts/{pwTargetAccount.id}/password
                </p>
              </div>
              <button
                onClick={() => setPwTargetAccount(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* 본인 변경 시에만 현재 비밀번호 필수 */}
              {pwTargetAccount.isSelf && (
                <div>
                  <label className="text-muted-foreground block mb-1 font-semibold">
                    현재 비밀번호 (current_password){' '}
                    <span className="text-red-400 font-bold">*</span>
                  </label>
                  <input
                    type="password"
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="현재 사용 중인 비밀번호 입력"
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-muted-foreground font-semibold">
                    새 비밀번호 (new_password) <span className="text-red-400 font-bold">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[10px] text-pink-400 hover:underline flex items-center gap-0.5 cursor-pointer font-mono"
                  >
                    <Sparkles size={10} /> 임의 안전 비밀번호 생성
                  </button>
                </div>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="8자 이상 + 영문/숫자/특수문자(!@#$%^&*)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  새 비밀번호 확인 <span className="text-red-400 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="새 비밀번호 다시 입력"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-100 border border-slate-100 space-y-1 text-[11px] text-muted-foreground">
                <p className="font-semibold text-foreground">• 보안 안내:</p>
                <p>
                  {pwTargetAccount.isSelf
                    ? '본인 비밀번호 변경 시 current_password 검증을 통과해야 하며, 변경 즉시 기존 토큰이 무효화됩니다.'
                    : 'MASTER 권한으로 초기화 시 current_password 없이 즉시 재설정되며 해당 계정의 Refresh Token이 삭제됩니다.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPwTargetAccount(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                onClick={handleSavePassword}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-500 cursor-pointer shadow-lg shadow-pink-950/40"
              >
                비밀번호 변경 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
