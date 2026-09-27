import { useMemo, useState } from 'react';
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  MessageSquare,
  Plus,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';

import type { AssignedGroup, GroupType, HostAccount } from '@/entities/host-account/model/types';
import type { Member, StudyPeriodType, StudyTeamInfo } from '@/entities/study-team/model/types';
import type { UserProfile } from '@/entities/user/model/types';
import {
  addPermissionToHost,
  findHostAccountByIdentity,
  getHostPermissions,
  type HostPermission,
} from '@/pages/attendance-hosts/model/accountLookup';
import { resolveConfiguredTeam } from '@/pages/attendance-hosts/model/teamSelection';
import { MODAL_PRIMARY_BTN, MODAL_SURFACE } from '@/shared/ui/modalStyles';

export type HostCategory = 'ADV' | 'STUDY' | string;

type AccountLookupState =
  | { status: 'idle' }
  | { status: 'found'; account: HostAccount }
  | { status: 'not-found' };

// 겸직 감지 헬퍼 함수
const detectConcurrentRoles = (
  leaderName: string,
  currentTeam: string,
  hosts: HostAccount[],
): string[] => {
  if (!leaderName.trim()) return [];
  const clean = leaderName.replace(/\s*\(.*\)/, '').trim();
  const roles: string[] = [];

  // hosts 내 다른 팀 그룹리더 확인
  hosts.forEach((h) => {
    const hName = (h.hostName || '').replace(/\s*\(.*\)/, '').trim();
    if (hName === clean && h.team !== currentTeam) {
      const typeLabel = h.groupType || (h.accountType === 'ADV' ? 'ADV' : '스터디');
      const roleStr = `${typeLabel} ${h.team}`;
      if (!roles.includes(roleStr)) {
        roles.push(roleStr);
      }
    }
  });

  // 운영진 겸직 대상자 (고준서, 이민준)
  if (['고준서', '이민준'].includes(clean) && !roles.includes('운영진')) {
    roles.unshift('운영진');
  }

  return roles;
};

/** 스터디 유형 표시: 멘멘 스터디인지 일반 스터디인지. 팀이 아직 없으면 '-'. */
const studyKindLabel = (kind: StudyTeamInfo['studyKind']): string =>
  kind === 'MENTORING' ? '멘멘 스터디' : kind === 'GENERAL' ? '일반 스터디' : '-';

/** 표의 "팀 이름": 행이 가리키는 팀 이름을 쓰고, 팀이 아직 없으면 계정에 저장된 담당 팀(없으면 '팀 개설 대기')을 쓴다. */
const teamNameOf = (account: HostAccount, rowTeamName?: string): string =>
  rowTeamName?.trim() || account.team?.trim() || '팀 개설 대기';

const generationLabel = (year?: string): string => {
  const value = year?.trim();
  if (!value) return '기수 미정';
  return value.endsWith('기') ? value : `${value}기`;
};

export function HostsPage({
  hosts,
  setHosts,
  advTeams,
  studyTeams,
  membersMap,
  users,
  onChangeTeamLeader,
}: {
  hosts: HostAccount[];
  setHosts: React.Dispatch<React.SetStateAction<HostAccount[]>>;
  advTeams?: StudyTeamInfo[];
  studyTeams: StudyTeamInfo[];
  membersMap: Readonly<Record<string, readonly Member[]>>;
  users: readonly UserProfile[];
  onChangeTeamLeader: (groupType: GroupType, teamId: string, leaderName: string) => void;
}) {
  // 1. 좌측 2개 네비게이션: 'ADV' 또는 'STUDY'
  const [activeCategory, setActiveCategory] = useState<HostCategory>('ADV');

  // 2. ADV 우측 본문 부문 필터
  const [trackFilter, setTrackFilter] = useState<'ALL' | '분석' | '시각화' | '엔지니어링'>('ALL');

  // 비밀번호 가시성 토글
  const [visiblePwId, setVisiblePwId] = useState<string | null>(null);

  // 표 삭제 모드 (휴지통 버튼 → 전체 삭제 / 행별 삭제 버튼)
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 복사 알림 토글
  const [copiedNotice, setCopiedNotice] = useState(false);

  // 계정 발급 폼 오픈 여부
  const [showIssueCard, setShowIssueCard] = useState(false);

  // 발급 폼 상태 (이름, 기수, 부문 기반 계정 발급)
  const [formGroupType, setFormGroupType] = useState<GroupType>('ADV');
  const [formTeamId, setFormTeamId] = useState<string>('');
  const [formLeaderName, setFormLeaderName] = useState<string>('');
  const [formGeneration, setFormGeneration] = useState<string>('27기');
  const [formTrack, setFormTrack] = useState<string>('분석');
  const [formUsername, setFormUsername] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('');
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);
  const [accountLookup, setAccountLookup] = useState<AccountLookupState>({ status: 'idle' });
  const targetPermission: HostPermission = formGroupType === 'ADV' ? 'ADV' : 'STUDY';
  const targetPermissionLabel = targetPermission === 'ADV' ? 'ADV' : '스터디';
  const lookupPermissions =
    accountLookup.status === 'found' ? getHostPermissions(accountLookup.account) : [];
  const hasTargetPermission = lookupPermissions.includes(targetPermission);

  // 모달 상태
  const [deliveryModal, setDeliveryModal] = useState<{
    host: HostAccount;
    title: string;
    text: string;
  } | null>(null);

  // ADV 팀 목록 (App.tsx 및 InputPage에서 개설된 팀들 포함)
  const effectiveAdvTeams = useMemo(() => {
    return (advTeams ?? []).map((t, idx) => ({
      id: t.id || `adv_${idx}`,
      leaderId: t.leaderId,
      track: t.category || '분석',
      teamName: t.teamName,
      topic: t.studyName || t.description || '정규 ADV 프로젝트',
      defaultLeader: t.leaderName || '팀장 미정',
    }));
  }, [advTeams]);

  // 스터디 팀 목록 (App.tsx 및 InputPage에서 개설된 팀들 포함)
  const effectiveStudyTeams = useMemo(() => {
    return (studyTeams ?? []).map((t, idx) => ({
      id: t.id || `study_${idx}`,
      leaderId: t.leaderId,
      teamName: t.teamName,
      studyName: t.studyName || t.teamName,
      defaultLeader: t.leaderName || '팀장 미정',
      studyType: (t.studyType || '방학 스터디') as StudyPeriodType,
      studyKind: t.studyKind,
      track: t.track || t.category || '분석',
    }));
  }, [studyTeams]);

  const configuredTeams = formGroupType === 'ADV' ? effectiveAdvTeams : effectiveStudyTeams;
  const selectedTeamMembers = formTeamId ? (membersMap[formTeamId] ?? []) : [];

  // ADV 팀별 계정 매핑 (팀당 1개 원칙, 동일 인물인 경우 스터디 계정과 자동 연동)
  const advTeamRows = useMemo(() => {
    const baseRows = effectiveAdvTeams.map((team, idx) => {
      const leaderName = team.defaultLeader;
      const cleanLeader = (leaderName || '').replace(/\s*\(.*\)/, '').trim();

      // 계정 매핑:
      // (1) 해당 팀 직접 매핑
      // (2) assignedGroups 내 해당 팀 매핑
      // (3) 동일 인물(팀장 성명) 매핑 -> 스터디에서 먼저 발급된 경우에도 자동으로 연동되어 발급 완료로 노출!
      const account = hosts.find((h) => {
        const hasTeam =
          h.teamId === team.id ||
          h.assignedGroups?.some((g) => g.teamId === team.id) ||
          h.team === team.teamName ||
          h.assignedGroups?.some((g) => g.teamName === team.teamName);
        const hasLeader =
          cleanLeader &&
          h.hostName &&
          h.hostName.replace(/\s*\(.*\)/, '').trim() === cleanLeader;
        return hasTeam || hasLeader;
      });

      const effectiveLeader = account?.hostName || leaderName;
      const concurrent =
        account?.concurrentRoles ||
        detectConcurrentRoles(effectiveLeader, team.teamName, hosts);

      return {
        idx: idx + 1,
        team,
        account,
        concurrent,
        isIssued: !!account,
      };
    });

    const extraRows = hosts
      .filter((h) => {
        const hasAdv =
          h.permissions?.includes('ADV') ||
          h.assignedGroups?.some((g) => g.type === 'ADV') ||
          h.groupType === 'ADV' ||
          h.accountType === 'ADV';
        if (!hasAdv) return false;
        const alreadyInBase = baseRows.some(
          (r) =>
            r.account?.id === h.id ||
            (h.teamId && r.team.id === h.teamId) ||
            (h.team && h.team !== '팀 개설 대기' && r.team.teamName === h.team) ||
            r.account?.assignedGroups?.some((g) => g.teamName === r.team.teamName)
        );
        return !alreadyInBase;
      })
      .map((h, i) => {
        const leaderName = h.hostName || '';
        const concurrent =
          h.concurrentRoles || detectConcurrentRoles(leaderName, h.team, hosts);
        const isWaiting = !h.team || h.team === '팀 개설 대기';
        return {
          idx: baseRows.length + i + 1,
          team: {
            id: `extra_adv_${h.id}`,
            track: h.track || '분석',
            teamName: isWaiting ? '팀 개설 대기' : (h.team.includes('겸직') ? h.team : `${h.team} (ADV 겸직)`),
            topic: isWaiting ? '계정 발급 완료 (팀 미개설)' : 'ADV & 스터디 복수 권한 연동',
            defaultLeader: leaderName,
          },
          account: h,
          concurrent,
          isIssued: true,
        };
      });

    return [...baseRows, ...extraRows];
  }, [effectiveAdvTeams, hosts]);

  // 스터디 팀별 계정 매핑 (팀당 1개 원칙, 동일 인물인 경우 ADV 계정과 자동 연동)
  const studyTeamRows = useMemo(() => {
    const baseRows = effectiveStudyTeams.map((team, idx) => {
      const leaderName = team.defaultLeader;
      const cleanLeader = (leaderName || '').replace(/\s*\(.*\)/, '').trim();

      // 계정 매핑:
      // (1) 해당 팀 직접 매핑
      // (2) assignedGroups 내 해당 팀 매핑
      // (3) 동일 인물(팀장 성명) 매핑 -> ADV에서 먼저 발급된 경우에도 자동으로 연동되어 발급 완료로 노출!
      const account = hosts.find((h) => {
        const hasTeam =
          h.teamId === team.id ||
          h.assignedGroups?.some((g) => g.teamId === team.id) ||
          h.team === team.teamName ||
          h.team.includes(team.teamName) ||
          h.assignedGroups?.some(
            (g) => g.teamName === team.teamName || team.teamName.includes(g.teamName)
          );
        const hasLeader =
          cleanLeader &&
          h.hostName &&
          h.hostName.replace(/\s*\(.*\)/, '').trim() === cleanLeader;
        return hasTeam || hasLeader;
      });

      const effectiveLeader = account?.hostName || leaderName;
      const concurrent =
        account?.concurrentRoles ||
        detectConcurrentRoles(effectiveLeader, team.teamName, hosts);

      return {
        idx: idx + 1,
        team,
        account,
        concurrent,
        isIssued: !!account,
      };
    });

    const extraRows = hosts
      .filter((h) => {
        const hasStudy =
          h.permissions?.includes('STUDY') ||
          h.assignedGroups?.some((g) => g.type === '스터디') ||
          h.groupType === '스터디' ||
          h.accountType === 'STUDY';
        if (!hasStudy) return false;
        const alreadyInBase = baseRows.some(
          (r) =>
            r.account?.id === h.id ||
            (h.teamId && r.team.id === h.teamId) ||
            (h.team && h.team !== '팀 개설 대기' && (r.team.teamName === h.team || h.team.includes(r.team.teamName))) ||
            r.account?.assignedGroups?.some((g) => g.teamName === r.team.teamName)
        );
        return !alreadyInBase;
      })
      .map((h, i) => {
        const leaderName = h.hostName || '';
        const concurrent =
          h.concurrentRoles || detectConcurrentRoles(leaderName, h.team, hosts);
        const isWaiting = !h.team || h.team === '팀 개설 대기';
        return {
          idx: baseRows.length + i + 1,
          team: {
            id: `extra_study_${h.id}`,
            teamName: isWaiting ? '팀 개설 대기' : (h.team.includes('겸직') ? h.team : `${h.team} (스터디 겸직)`),
            studyName: isWaiting ? '계정 발급 완료 (팀 미개설)' : 'ADV & 스터디 복수 권한 연동',
            defaultLeader: leaderName,
            studyType: '방학 스터디' as StudyPeriodType,
            studyKind: undefined as StudyTeamInfo['studyKind'],
            track: h.track || '분석',
          },
          account: h,
          concurrent,
          isIssued: true,
        };
      });

    return [...baseRows, ...extraRows];
  }, [effectiveStudyTeams, hosts]);

  // 우측 필터링된 행 목록
  const filteredAdvRows = useMemo(() => {
    return advTeamRows.filter((row) => {
      if (!row.account) return false;

      const effectiveTrack = row.account.track || row.team.track;
      if (trackFilter !== 'ALL' && effectiveTrack !== trackFilter && row.team.track !== '겸직 연동') return false;
      return true;
    });
  }, [advTeamRows, trackFilter]);

  const filteredStudyRows = useMemo(() => {
    return studyTeamRows.filter((row) => {
      if (!row.account) return false;
      return true;
    });
  }, [studyTeamRows]);

  const deletableAccounts = useMemo(() => {
    const rows = activeCategory === 'ADV' ? filteredAdvRows : filteredStudyRows;
    const accounts = new Map<string, HostAccount>();

    rows.forEach((row) => {
      if (row.account) accounts.set(row.account.id, row.account);
    });

    return Array.from(accounts.values());
  }, [activeCategory, filteredAdvRows, filteredStudyRows]);

  const removeAccounts = (ids: string[]) => {
    const idSet = new Set(ids);
    setHosts((prev) => prev.filter((account) => !idSet.has(account.id)));
    setVisiblePwId((current) => (current && idSet.has(current) ? null : current));
  };

  // 현재 탭/필터에 보이는 계정 중 선택된 것만 대상으로 삼는다
  const selectedAccounts = deletableAccounts.filter((account) => selectedIds.includes(account.id));
  const isAllSelected =
    deletableAccounts.length > 0 && selectedAccounts.length === deletableAccounts.length;

  const exitDeleteMode = () => {
    setIsDeleteMode(false);
    setSelectedIds([]);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(isAllSelected ? [] : deletableAccounts.map((account) => account.id));
  };

  const handleDeleteSelected = () => {
    if (selectedAccounts.length === 0) return;
    const message =
      selectedAccounts.length === 1
        ? `${selectedAccounts[0].hostName || selectedAccounts[0].username} 계정을 삭제할까요? 연결된 모든 그룹에서 함께 제거됩니다.`
        : `선택한 계정 ${selectedAccounts.length}개를 삭제할까요? 연결된 모든 그룹에서 함께 제거됩니다.`;
    if (!window.confirm(message)) return;
    removeAccounts(selectedAccounts.map((account) => account.id));
    exitDeleteMode();
  };

  const renderSelectCell = (account: HostAccount) => (
    <td className="px-2 py-2 text-center whitespace-nowrap">
      {isDeleteMode && (
        <input
          type="checkbox"
          checked={selectedIds.includes(account.id)}
          onChange={() => toggleSelected(account.id)}
          aria-label={`${account.hostName || account.username} 선택`}
          className="size-4 rounded border-slate-300 accent-rose-600 cursor-pointer"
        />
      )}
    </td>
  );

  // 최상단 '+ 신규 계정 발급' 버튼 클릭 시 모달 열기 (이름, 기수, 부문 기반)
  const openNewIssueForm = () => {
    const targetType = activeCategory === 'ADV' ? 'ADV' : '스터디';
    setFormGroupType(targetType);
    setFormTeamId('');
    setFormLeaderName('');
    setFormGeneration('27기');
    const defaultTrack = trackFilter !== 'ALL' ? trackFilter : '분석';
    setFormTrack(defaultTrack);
    setFormUsername('');
    setFormPassword('');
    setShowRequiredErrors(false);
    setAccountLookup({ status: 'idle' });
    setShowIssueCard(true);
  };

  const resetAccountLookup = () => {
    setAccountLookup({ status: 'idle' });
    setFormUsername('');
    setFormPassword('');
    setShowRequiredErrors(false);
  };

  const handleSelectTeam = (teamId: string) => {
    const selectedTeam = configuredTeams.find((team) => team.id === teamId);
    const leaderName =
      selectedTeam?.defaultLeader === '팀장 미정' ? '' : (selectedTeam?.defaultLeader ?? '');
    const selectedLeader =
      users.find((user) => user.id === selectedTeam?.leaderId) ??
      users.find((user) => user.name === leaderName);
    resetAccountLookup();
    setFormTeamId(teamId);
    setFormLeaderName(leaderName);
    setFormGeneration(generationLabel(selectedLeader?.term.toString()));
    setFormTrack(selectedLeader?.track || selectedTeam?.track || '부문 미정');
  };

  const resolveTargetTeamInfo = (): { teamName: string; teamId?: string } => {
    const matchedTeam = resolveConfiguredTeam(
      formGroupType,
      formTeamId,
      effectiveAdvTeams,
      effectiveStudyTeams,
    );
    return matchedTeam
      ? { teamName: matchedTeam.teamName, teamId: matchedTeam.id }
      : { teamName: '팀 개설 대기' };
  };

  const handleLookupAccount = () => {
    const matchedAccount = findHostAccountByIdentity(hosts, {
      name: formLeaderName,
      generation: formGeneration,
      track: formTrack,
    });

    setAccountLookup(
      matchedAccount
        ? { status: 'found', account: matchedAccount }
        : { status: 'not-found' },
    );
    setFormUsername('');
    setFormPassword('');
  };

  // 전달문 텍스트 생성 헬퍼 (역할: 그룹리더 반영, 기수/부문 포함)
  const buildDeliveryText = (
    groupType: string,
    teamName: string,
    hostName: string,
    generation: string,
    track: string,
    username: string,
    pw: string
  ) => {
    return `[BOAZ 그룹리더 HOST 전용 계정 안내]

안녕하세요, ${hostName}님!
BOAZ ${generation} [${track}] 출결 관리를 위한 그룹리더(HOST) 계정이 발급되었습니다.

• 역할(Role): HOST (그룹리더)
• 담당 구분: [${groupType}] ${teamName}
• 로그인 아이디: ${username}
• 초기 비밀번호: ${pw}
• 접속 URL: https://attendance.boaz.org/host

[안내 사항]
• 로그인 후 담당 팀 개설 및 출결 관리를 진행해 주시기 바랍니다.
• 최초 접속 후 본인 계정 정보 및 비밀번호를 안전하게 변경해 주시기 바랍니다.
• 겸직 중인 다른 그룹(ADV/스터디)이 있으신 경우 본 단일 계정으로 통합 관리됩니다.`;
  };

  const handleAddPermission = () => {
    if (accountLookup.status !== 'found') return;

    const existingAccount = accountLookup.account;
    if (getHostPermissions(existingAccount).includes(targetPermission)) return;

    const { teamName: finalTeam, teamId: finalTeamId } = resolveTargetTeamInfo();
    if (finalTeamId) onChangeTeamLeader(formGroupType, finalTeamId, formLeaderName.trim());
    const assignedGroup =
      finalTeam === '팀 개설 대기'
        ? undefined
        : { type: formGroupType, teamName: finalTeam, teamId: finalTeamId };
    const updatedAccount = addPermissionToHost(
      existingAccount,
      targetPermission,
      assignedGroup,
    );

    setHosts((previous) =>
      previous.map((account) =>
        account.id === existingAccount.id ? updatedAccount : account,
      ),
    );

    setDeliveryModal({
      host: updatedAccount,
      title: `${formLeaderName.trim()} 권한 추가`,
      text: `[BOAZ 그룹리더 계정 권한 추가 안내]

안녕하세요, ${formLeaderName.trim()}님!
기존 HOST 계정에 ${targetPermissionLabel} 권한이 추가되었습니다.

• 기수/부문: ${formGeneration} [${formTrack}]
• 추가 권한: ${targetPermissionLabel}
• 로그인 아이디: ${existingAccount.username}
• 비밀번호: (기존 비밀번호 유지)`,
    });
    setShowIssueCard(false);
  };

  const handleShowPermissionDelivery = () => {
    if (accountLookup.status !== 'found' || !hasTargetPermission) return;

    const existingAccount = accountLookup.account;
    const permissionLabels = lookupPermissions
      .map((permission) => (permission === 'ADV' ? 'ADV' : '스터디'))
      .join(', ');

    setDeliveryModal({
      host: existingAccount,
      title: `${formLeaderName.trim()} ${targetPermissionLabel} 권한 안내`,
      text: `[BOAZ 그룹리더 계정 권한 안내]

안녕하세요, ${formLeaderName.trim()}님!
기존 HOST 계정으로 ${targetPermissionLabel} 출결 관리가 가능합니다.

• 기수/부문: ${formGeneration} [${formTrack}]
• 현재 보유 권한: ${permissionLabels}
• 로그인 아이디: ${existingAccount.username}
• 비밀번호: (기존 비밀번호 유지)
• 접속 URL: https://attendance.boaz.org/host

[안내 사항]
• 기존 계정으로 로그인한 뒤 ${targetPermissionLabel} 출결 관리 메뉴를 확인해 주세요.`,
    });
  };

  // 조회 결과가 없을 때 신규 계정 발급
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (accountLookup.status !== 'not-found') return;

    const leaderClean = formLeaderName.trim();
    const username = formUsername.trim();
    const password = formPassword.trim();
    if (!formTeamId || !leaderClean || !username || !password) {
      setShowRequiredErrors(true);
      return;
    }

    const finalType = formGroupType;
    const { teamName: finalTeam, teamId: finalTeamId } = resolveTargetTeamInfo();
    if (finalTeamId) onChangeTeamLeader(finalType, finalTeamId, leaderClean);
    const concurrent = detectConcurrentRoles(leaderClean, finalTeam, hosts);
    const assignedGroups: AssignedGroup[] =
      finalTeam === '팀 개설 대기'
        ? []
        : [{ type: finalType, teamName: finalTeam, teamId: finalTeamId }];

    const newHostAccount: HostAccount = {
      id: `h_${Date.now()}`,
      username,
      initialPassword: password,
      hostName: leaderClean,
      generation: formGeneration.trim() || '27기',
      track: formTrack.trim() || '분석',
      role: '그룹리더',
      team: finalTeam,
      ...(finalTeamId ? { teamId: finalTeamId } : {}),
      groupType: finalType,
      permissions: [targetPermission],
      assignedGroups,
      concurrentRoles: concurrent,
      createdAt: new Date().toISOString().slice(0, 10),
      active: true,
      accountType: finalType === 'ADV' ? 'ADV' : 'STUDY',
    };

    setHosts((previous) => [...previous, newHostAccount]);

    const delivery = buildDeliveryText(
      finalType,
      finalTeam,
      leaderClean,
      formGeneration.trim() || '27기',
      formTrack.trim() || '분석',
      username,
      password,
    );

    setDeliveryModal({
      host: newHostAccount,
      title: `${leaderClean} (${formGeneration} ${formTrack})`,
      text: delivery,
    });

    setShowIssueCard(false);
  };


  // 클립보드 복사 함수
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 타이틀 영역 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            그룹 계정 관리
          </h1>
        </div>

        {/* 상단 우측 계정 생성 및 권한 추가 버튼 */}
        <div className="flex items-center gap-3">
          <button
            onClick={openNewIssueForm}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-2 active:scale-[0.98] cursor-pointer"
          >
            <Plus size={14} className="text-slate-500" />
            <span>계정 생성</span>
          </button>
        </div>
      </div>

      {/* 2. 메인 2열 레이아웃: 좌측 컴팩트 탭 + 우측 최대 확장 본문 */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* =========================================================
            좌측 네비게이션: 그룹 유형 (Type) 탭 (w-48)
           ========================================================= */}
        <aside className="w-full lg:w-48 shrink-0 space-y-2">
          <div className="px-1 pb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              그룹 유형
            </span>
          </div>

          {/* 1. ADV 그룹 유형 */}
          <button
            onClick={() => {
              setActiveCategory('ADV');
              setShowIssueCard(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl border transition-all cursor-pointer ${
              activeCategory === 'ADV'
                ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500/20 text-blue-900 font-bold'
                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 text-slate-700 font-semibold'
            }`}
          >
            <div className="text-left">
              <span className="text-xs font-bold block">ADV</span>
            </div>
            <ChevronRight
              size={15}
              className={activeCategory === 'ADV' ? 'text-blue-600' : 'text-slate-400'}
            />
          </button>

          {/* 2. 스터디 그룹 유형 */}
          <button
            onClick={() => {
              setActiveCategory('STUDY');
              setShowIssueCard(false);
            }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-2xl border transition-all cursor-pointer ${
              activeCategory === 'STUDY'
                ? 'border-blue-600 bg-blue-50/70 shadow-xs ring-1 ring-blue-500/20 text-blue-900 font-bold'
                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 text-slate-700 font-semibold'
            }`}
          >
            <div className="text-left">
              <span className="text-xs font-bold block">스터디</span>
            </div>
            <ChevronRight
              size={15}
              className={activeCategory === 'STUDY' ? 'text-blue-600' : 'text-slate-400'}
            />
          </button>
        </aside>

        {/* =========================================================
            우측 메인 영역: 최대한 넓게 확장 (flex-1 min-w-0)
           ========================================================= */}
        <main className="flex-1 min-w-0 w-full space-y-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white shadow-2xs p-6 space-y-5">
            {/* 헤더 & 통계 배지 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>
                    {activeCategory === 'ADV' ? 'ADV 그룹리더 계정 현황' : '스터디 그룹리더 계정 현황'}
                  </span>
                </h2>
              </div>

              {activeCategory === 'ADV' && (
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
                  <button
                    onClick={() => setTrackFilter('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      trackFilter === 'ALL'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setTrackFilter('분석')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      trackFilter === '분석'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    분석
                  </button>
                  <button
                    onClick={() => setTrackFilter('시각화')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      trackFilter === '시각화'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    시각화
                  </button>
                  <button
                    onClick={() => setTrackFilter('엔지니어링')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      trackFilter === '엔지니어링'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    엔지니어링
                  </button>
                </div>
              )}
            </div>

            {/* =========================================================
          계정 발급 모달 창 (HOST 계정 부여 - 그룹리더)
         ========================================================= */}
      {showIssueCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onClick={() => setShowIssueCard(false)}
        >
          <div
            className={`w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${MODAL_SURFACE}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                HOST 계정 생성·권한 추가
              </h3>
              <button
                type="button"
                onClick={() => setShowIssueCard(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* 발급 폼 */}
            <form noValidate onSubmit={handleSaveAccount} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-3.5 p-6 overflow-y-auto flex-1 min-h-0">
                {/* 1. 현재 구성된 팀 */}
                <div>
                  <label
                    htmlFor="host-account-team"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    팀 이름
                  </label>
                  <select
                    id="host-account-team"
                    required
                    value={formTeamId}
                    disabled={configuredTeams.length === 0}
                    onChange={(e) => handleSelectTeam(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none focus:border-slate-800 transition-colors disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {configuredTeams.length === 0
                        ? `출결 관리에서 개설된 ${targetPermissionLabel} 팀이 없습니다`
                        : '팀을 선택해 주세요'}
                    </option>
                    {configuredTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.teamName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. 현재 팀장: 한 번 클릭하면 팀원 목록이 열린다 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    현재 팀장
                  </label>
                  <div className="relative">
                    <select
                      aria-label="팀장 변경"
                      value={formLeaderName}
                      disabled={!formTeamId || selectedTeamMembers.length === 0}
                      onChange={(e) => {
                        const selectedLeader = selectedTeamMembers.find(
                          (member) => member.name === e.target.value,
                        );
                        if (!selectedLeader) return;
                        resetAccountLookup();
                        setFormLeaderName(selectedLeader.name);
                        setFormGeneration(generationLabel(selectedLeader.year));
                        setFormTrack(selectedLeader.track || '부문 미정');
                      }}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-9 text-xs font-semibold text-slate-800 outline-none transition-colors hover:border-slate-400 hover:bg-white focus:border-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                      {!selectedTeamMembers.some((member) => member.name === formLeaderName) && (
                        <option value={formLeaderName}>{formLeaderName || '팀장 미정'}</option>
                      )}
                      {selectedTeamMembers.map((member) => (
                        <option key={member.id} value={member.name}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                  {formTeamId && selectedTeamMembers.length === 0 && (
                    <p className="mt-1 text-[10px] text-slate-400">등록된 팀원이 없습니다.</p>
                  )}
                </div>

                {/* 3. 선택된 팀원의 기수와 부문 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                      기수
                    </span>
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800">
                      {formGeneration}
                    </p>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                      부문
                    </span>
                    <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-800">
                      {formTrack}
                    </p>
                  </div>
                </div>

                <div className="flex justify-center pt-3">
                  <button
                    type="button"
                    onClick={handleLookupAccount}
                    disabled={
                      !formTeamId ||
                      !formLeaderName.trim() ||
                      !formGeneration.trim() ||
                      !formTrack.trim()
                    }
                    className={`text-xs font-semibold underline-offset-4 transition-colors disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline cursor-pointer ${
                      accountLookup.status === 'not-found'
                        ? 'text-red-600 hover:text-red-700 hover:underline'
                        : 'text-slate-600 hover:text-slate-950 hover:underline'
                    }`}
                  >
                    {accountLookup.status === 'not-found'
                      ? '계정이 존재하지 않습니다. 새 계정을 생성해 주세요.'
                      : '계정 존재 여부 확인'}
                  </button>
                </div>

                {accountLookup.status === 'found' && (
                  <div className="space-y-3 rounded-2xl border border-slate-300 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                        <UserCheck size={15} className="text-slate-600" />
                        기존 계정이 있습니다
                      </div>
                      <code className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                        {accountLookup.account.username}
                      </code>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-semibold text-slate-500">현재 보유 권한</p>
                      <div className="flex flex-wrap gap-1.5">
                        {lookupPermissions.map((permission) => (
                          <span
                            key={permission}
                            className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                          >
                            {permission === 'ADV' ? 'ADV' : '스터디'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] leading-5 text-slate-500">
                      {hasTargetPermission
                        ? `${targetPermissionLabel} 권한이 이미 등록되어 있습니다. 전달문을 바로 확인할 수 있습니다.`
                        : `현재 보고 있는 ${targetPermissionLabel} 탭의 권한을 이 계정에 추가할 수 있습니다.`}
                    </p>
                  </div>
                )}

                {accountLookup.status === 'not-found' && (
                  <div className="space-y-4 pt-2">
                    <div className="border-b border-slate-200">
                      <span className="inline-block border-b-2 border-slate-900 px-1 pb-2 text-xs font-bold text-slate-900">
                        계정 생성
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* 로그인 아이디 */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          로그인 아이디 (ID)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="아이디 직접 입력"
                          value={formUsername}
                          onChange={(e) => setFormUsername(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 outline-none focus:border-slate-800 transition-colors"
                        />
                        {showRequiredErrors && !formUsername.trim() && (
                          <p className="mt-1 text-[10px] text-rose-600">이 입력란을 작성하세요.</p>
                        )}
                      </div>

                      {/* 초기 비밀번호 */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          비밀번호 (PW)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="비밀번호 직접 입력"
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-800 outline-none focus:border-slate-800 transition-colors"
                        />
                        {showRequiredErrors && !formPassword.trim() && (
                          <p className="mt-1 text-[10px] text-rose-600">이 입력란을 작성하세요.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 모달 하단 버튼 */}
              <div className="flex items-center justify-end gap-2 px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowIssueCard(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  취소
                </button>
                {accountLookup.status === 'found' && (
                  <>
                    <button
                      type="button"
                      onClick={handleAddPermission}
                      disabled={hasTargetPermission}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 ${MODAL_PRIMARY_BTN}`}
                    >
                      <Check size={14} />
                      <span>{targetPermissionLabel} 권한 추가</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShowPermissionDelivery}
                      disabled={!hasTargetPermission}
                      className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:border-slate-500 hover:bg-slate-100 shadow-xs cursor-pointer inline-flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      <MessageSquare size={14} />
                      <span>전달문 보기</span>
                    </button>
                  </>
                )}
                {accountLookup.status === 'not-found' && (
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-[#e9eef4] text-[11px] text-slate-800 font-bold border border-slate-300 shadow-2xs hover:bg-slate-200 cursor-pointer inline-flex items-center transition-all active:scale-[0.98]"
                  >
                    <span>계정 및 전달문 생성</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

            {/* =========================================================
                테이블: 이름, 기수, 부문, 아이디, 비밀번호 (출결 입력 페이지 스타일 일치)
               ========================================================= */}
            <div className="w-full rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto select-none relative">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-50/80 select-none">
                    <tr className="border-b border-slate-200 divide-x divide-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                      <th className="text-center px-4 py-2 text-slate-700 font-bold bg-slate-100/90 min-w-[150px]">
                        팀 이름
                      </th>
                      {activeCategory === 'STUDY' && (
                        <th className="text-center px-4 py-2 text-slate-700 font-bold bg-slate-100/90 min-w-[110px]">
                          스터디 유형
                        </th>
                      )}
                      <th className="text-center px-4 py-2 text-slate-900 font-bold bg-slate-100/90 w-[140px]">
                        이름
                      </th>
                      <th className="text-center px-4 py-2 text-slate-700 font-bold bg-slate-100/90 w-[100px]">
                        기수
                      </th>
                      <th className="text-center px-4 py-2 text-slate-700 font-bold bg-slate-100/90 w-[110px]">
                        부문
                      </th>
                      <th className="text-center px-4 py-2 text-slate-900 font-bold bg-slate-50/80 min-w-[170px]">
                        아이디
                      </th>
                      <th className="text-center px-4 py-2 text-slate-700 font-bold min-w-[170px]">
                        비밀번호
                      </th>
                      <th className="text-center px-2 py-2 w-[56px]">
                        {isDeleteMode && selectedAccounts.length > 0 ? (
                          <button
                            type="button"
                            onClick={handleDeleteSelected}
                            title="선택한 계정 삭제"
                            aria-label="선택한 계정 삭제"
                            className="inline-flex items-center justify-center p-1.5 text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : isDeleteMode ? (
                          <button
                            type="button"
                            onClick={exitDeleteMode}
                            title="삭제 모드 종료"
                            aria-label="삭제 모드 종료"
                            className="inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          >
                            <Check size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsDeleteMode(true)}
                            disabled={deletableAccounts.length === 0}
                            title="계정 삭제"
                            aria-label="계정 삭제 모드"
                            className="inline-flex items-center justify-center p-1.5 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {activeCategory === 'ADV' ? (
                      filteredAdvRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400">
                            검색 조건에 일치하는 Adv 팀이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        filteredAdvRows.map((row) => {
                          const account = row.account;
                          if (!account) return null;

                          const effectiveLeader = account.hostName || row.team.defaultLeader || '—';
                          const effectiveGen = account.generation || '27기';
                          const effectiveTrack = account.track || row.team.track || '분석';

                          return (
                            <tr
                              key={row.team.id}
                              className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-200 h-[46px]"
                            >
                              {/* 팀 이름 */}
                              <td className="px-4 py-2 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                                {teamNameOf(account, row.team.teamName)}
                              </td>

                              {/* 이름 */}
                              <td className="px-4 py-2 text-center whitespace-nowrap">
                                <span className="font-bold text-slate-900 text-xs">{effectiveLeader}</span>
                              </td>

                              {/* 기수 */}
                              <td className="px-4 py-2 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                                {effectiveGen}
                              </td>

                              {/* 부문 */}
                              <td className="px-4 py-2 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                                {effectiveTrack}
                              </td>

                              {/* 아이디 */}
                              <td className="px-4 py-2 text-center font-mono">
                                <div className="flex items-center justify-center gap-1.5">
                                  <code className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] border border-slate-200/80">
                                    {account.username}
                                  </code>
                                  <button
                                    onClick={() => copyToClipboard(account.username)}
                                    title="아이디 복사"
                                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              </td>

                              {/* 비밀번호 */}
                              <td className="px-4 py-2 text-center font-mono">
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="text-slate-700">
                                    {visiblePwId === account.id
                                      ? account.initialPassword
                                      : '••••••••'}
                                  </span>
                                  <button
                                    onClick={() =>
                                      setVisiblePwId(visiblePwId === account.id ? null : account.id)
                                    }
                                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                  >
                                    {visiblePwId === account.id ? (
                                      <EyeOff size={13} />
                                    ) : (
                                      <Eye size={13} />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(account.initialPassword || '')}
                                    title="비밀번호 복사"
                                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                  >
                                    <Copy size={12} />
                                  </button>
                                </div>
                              </td>

                              {/* 삭제 */}
                              {renderSelectCell(account)}
                            </tr>
                          );
                        })
                      )
                    ) : filteredStudyRows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          검색 조건에 일치하는 스터디 팀이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredStudyRows.map((row) => {
                        const account = row.account;
                        if (!account) return null;

                        const effectiveLeader = account.hostName || row.team.defaultLeader || '—';
                        const effectiveGen = account.generation || '27기';
                        const effectiveTrack = account.track || '분석';

                        return (
                          <tr
                            key={row.team.id}
                            className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-200 h-[46px]"
                          >
                            {/* 팀 이름 */}
                            <td className="px-4 py-2 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                              {teamNameOf(account, row.team.teamName)}
                            </td>

                            {/* 스터디 유형: 멘멘 스터디 / 일반 스터디 */}
                            <td className="px-4 py-2 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                              {studyKindLabel(row.team.studyKind)}
                            </td>

                            {/* 이름 */}
                            <td className="px-4 py-2 text-center whitespace-nowrap">
                              <span className="font-bold text-slate-900 text-xs">{effectiveLeader}</span>
                            </td>

                            {/* 기수 */}
                            <td className="px-4 py-2 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                              {effectiveGen}
                            </td>

                            {/* 부문 */}
                            <td className="px-4 py-2 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                              {effectiveTrack}
                            </td>

                            {/* 아이디 */}
                            <td className="px-4 py-2 text-center font-mono">
                              <div className="flex items-center justify-center gap-1.5">
                                <code className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[11px] border border-slate-200/80">
                                  {account.username}
                                </code>
                                <button
                                  onClick={() => copyToClipboard(account.username)}
                                  title="아이디 복사"
                                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                            </td>

                            {/* 비밀번호 */}
                            <td className="px-4 py-2 text-center font-mono">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="text-slate-700">
                                  {visiblePwId === account.id
                                    ? account.initialPassword
                                    : '••••••••'}
                                </span>
                                <button
                                  onClick={() =>
                                    setVisiblePwId(visiblePwId === account.id ? null : account.id)
                                  }
                                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                >
                                  {visiblePwId === account.id ? (
                                    <EyeOff size={13} />
                                  ) : (
                                    <Eye size={13} />
                                  )}
                                </button>
                                <button
                                  onClick={() => copyToClipboard(account.initialPassword || '')}
                                  title="비밀번호 복사"
                                  className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                >
                                  <Copy size={12} />
                                </button>
                              </div>
                            </td>

                            {/* 삭제 */}
                            {renderSelectCell(account)}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>



      {/* 삭제 모드: 하단 플로팅 액션 필 (선택 개수 + 삭제 + 취소) */}
      {isDeleteMode && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 flex items-center gap-1 rounded-full bg-slate-900 py-1.5 pl-4 pr-1.5 text-white shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="pr-2 text-xs font-semibold tabular-nums">
            {selectedAccounts.length > 0 ? `${selectedAccounts.length}개 선택됨` : '계정을 선택해 주세요'}
          </span>
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={deletableAccounts.length === 0}
            title={isAllSelected ? '전체 선택 해제' : '전체 선택'}
            aria-label={isAllSelected ? '전체 선택 해제' : '전체 선택'}
            className={`inline-flex size-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 ${
              isAllSelected ? 'text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CheckCheck size={15} />
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedAccounts.length === 0}
            title="선택 항목 삭제"
            aria-label="선택 항목 삭제"
            className="inline-flex size-8 items-center justify-center rounded-full text-rose-300 hover:bg-white/10 hover:text-rose-200 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Trash2 size={15} />
          </button>
          <button
            type="button"
            onClick={exitDeleteMode}
            title="취소"
            aria-label="삭제 모드 취소"
            className="inline-flex size-8 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* =========================================================
          안내문 복사 모달 (카카오톡 / 슬랙 전달용)
         ========================================================= */}
      {deliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-18px_rgba(15,23,42,0.38)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <MessageSquare size={17} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 text-wrap-balance">
                    {deliveryModal.title} 계정 전달문
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">카카오톡 · 슬랙 전달용</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeliveryModal(null)}
                aria-label="전달문 닫기"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 px-6 py-5">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                <span className="text-xs text-slate-600 text-wrap-pretty">
                  내용을 확인한 뒤 팀장님께 전달해 주세요.
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(deliveryModal.text)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-800 px-3 text-xs font-semibold text-white shadow-2xs transition-[background-color,transform] hover:bg-slate-700 active:scale-[0.97] active:bg-slate-900 cursor-pointer"
                >
                  {copiedNotice ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedNotice ? '복사 완료' : '전달문 복사'}</span>
                </button>
              </div>

              <textarea
                rows={11}
                aria-label="계정 전달문 내용"
                value={deliveryModal.text}
                onChange={(e) => setDeliveryModal({ ...deliveryModal, text: e.target.value })}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-700 outline-none transition-[background-color,border-color,box-shadow] focus:border-slate-400 focus:bg-white focus:ring-3 focus:ring-slate-100"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-6 py-3.5">
              <span className="text-[11px] font-medium text-slate-500">
                HOST 계정: {deliveryModal.host.username}
              </span>
              <button
                type="button"
                onClick={() => setDeliveryModal(null)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-100 cursor-pointer"
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
