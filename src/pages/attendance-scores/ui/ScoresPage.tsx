import { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, Search, Star } from 'lucide-react';

import { fetchActiveAttendanceTerms } from '@/entities/attendance/api/termsApi';
import { sessionKey } from '@/entities/attendance/model/lib';
import { isConcurrentBaseMember } from '@/entities/attendance/model/concurrent';
import type { AttendanceState, AttendanceStatus } from '@/entities/attendance/model/types';
import { getRuleForTerm } from '@/entities/score-rule/model/lib';
import type { ScoreRule } from '@/entities/score-rule/model/types';
import type { Member, StudyTeamInfo } from '@/entities/study-team/model/types';

export type AggregationTab = 'BASE_MID' | 'ADV_MID' | 'BASE_FINAL' | 'ADV_FINAL';
export type ViewMode = 'status' | 'score';

// 1~7주차 방학 세션 일정 정의 (사용자 엑셀 명세 준수)
const SESSION_WEEKS = [
  { id: 'w1', weekNum: 1, label: '1주차', date: '2026-07-06' },
  { id: 'w2', weekNum: 2, label: '2주차', date: '2026-07-13' },
  { id: 'w3', weekNum: 3, label: '3주차', date: '2026-07-20' },
  { id: 'w4', weekNum: 4, label: '4주차', date: '2026-07-27' },
  { id: 'w5', weekNum: 5, label: '5주차', date: '2026-08-03' },
  { id: 'w6', weekNum: 6, label: '6주차', date: '2026-08-10' },
  { id: 'w7', weekNum: 7, label: '7주차', date: '2026-08-17' },
];

export type DisplayStatus = '출석' | '비대면' | '지각' | '조퇴' | '결석' | '인정결석' | '미정';

interface MemberFullRecord {
  id: string;
  name: string;
  term: number;
  track: '분석' | '엔지니어링' | '시각화';
  // 1~7주차 출결 상태
  sessionWeeks: DisplayStatus[];

  // 1. BASE 중간 항목
  baseDefaultScore: number; // 기본점수 10점
  lateCount: number; // 지각 회수
  lateDeduction: number; // 기본 -1, 무단 3회시 -4
  earlyLeaveCount: number; // 조퇴 회수
  earlyLeaveDeduction: number; // 기본 -1
  absentCount: number; // 결석 회수
  absentDeduction: number; // 기본 -3, 무단 -4, 인정 -0
  attendanceScore: number; // 출석점수 = 10 - 감점들
  baseStudyScore: number; // 스터디 점수 (감점 포함)
  chinbaScore: number; // 친바 참여점수 (회당 +0.5)
  promoScore: number; // 홍보점수 (컨퍼런스)
  baseTaskScore: number; // BASE 과제점수 (분석 6회, 시각화 4회, 미제출시 -0.5)
  mtScore: number; // MT 참여 (정규세션과 동일)
  etcScore: number; // 기타
  baseMidScore: number; // BASE 중간점수

  // 2. ADV 중간 항목
  baseFinalRefScore: number; // BASE 최종점수
  advStudyScore: number; // 스터디 점수 (미이수 0, 기본 +1, 개근 +3, 팀장 +1)
  confScore: number; // 컨퍼런스 참여 (출석당 1점)
  advMidScore: number; // ADV 중간점수

  // 3. BASE 최종 집계 항목
  termSessionScore: number; // 학기세션 출석
  finalTaskScore: number; // 과제점수
  termStudyScore: number; // 학기스터디
  officerScore: number; // 운영진
  jointSessionScore: number; // 공동세션
  finalEtcScore: number; // 기타점수
  newRecruitPromoScore: number; // 신입모집 홍보점수
  parallelMidScore: number; // 병행 중간점수
  parallelScore: number; // 병행점수
  parallelAttendance: number; // 병행출석
  parallelGiveup: string; // 병행포기
  baseFinalScore: number; // BASE 최종점수

  // 4. ADV 최종 집계 항목
  advFinalScore: number; // ADV 최종점수
  isTop5: boolean; // 상위 5명
}

export function ScoresPage({
  attendance,
  studyTeams,
  advTeams,
  baseTeams,
  membersMap,
  scoreRules,
}: {
  attendance: AttendanceState;
  studyTeams: StudyTeamInfo[];
  advTeams: StudyTeamInfo[];
  baseTeams: StudyTeamInfo[];
  membersMap: Record<string, Member[]>;
  scoreRules?: ScoreRule[];
}) {
  const [activeTab, setActiveTab] = useState<AggregationTab>('BASE_MID');

  // 검색 및 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [termsList, setTermsList] = useState<string[]>(['26', '27']);
  const [termFilter, setTermFilter] = useState<string>('ALL');
  const [trackFilter, setTrackFilter] = useState<'ALL' | '분석' | '엔지니어링' | '시각화'>('ALL');
  const [isLoadingTerms, setIsLoadingTerms] = useState(false);

  // API를 통한 현재 출결 점수 관리 기수 목록 조회
  const loadTerms = async () => {
    setIsLoadingTerms(true);
    try {
      const fetched = await fetchActiveAttendanceTerms();
      if (fetched && fetched.length > 0) {
        setTermsList(fetched);
      }
    } catch {
      // fallback
    } finally {
      setIsLoadingTerms(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, []);

  // 전체 부원 데이터 구축 및 엑셀 수식 기반 점수 산정
  const leaderIds = useMemo(
    () => new Set([...studyTeams, ...advTeams].map((team) => team.leaderId).filter(Boolean)),
    [studyTeams, advTeams],
  );

  const allMemberRecords: MemberFullRecord[] = useMemo(() => {
    const list: {
      id: string;
      name: string;
      term: number;
      track: '분석' | '엔지니어링' | '시각화';
    }[] = [];
    const seenIds = new Set<string>();
    const teams = [...baseTeams, ...studyTeams, ...advTeams];
    const userIdOf = (member: Member, teamId: string) =>
      member.id.startsWith(`${teamId}_`) ? member.id.slice(teamId.length + 1) : member.id;

    // 팀별 회원 ID에서 원본 사용자 ID를 복원해 동명이인을 구분한다.
    teams.forEach((team) => {
      const mList = membersMap[team.id] ?? [];
      mList.forEach((m) => {
        const userId = userIdOf(m, team.id);
        if (seenIds.has(userId)) return;
        seenIds.add(userId);
        const track = (m.track as '분석' | '엔지니어링' | '시각화') || '분석';
        list.push({ id: userId, name: m.name, term: Number(m.year) || 0, track });
      });
    });

    // 기본 정렬: 기수 순 -> 이름 가나다 순 (사용자 제공 엑셀 형태: 27기 고준서, 김동현, 남소희 ...)
    list.sort((a, b) => {
      if (a.term !== b.term) return a.term - b.term;
      return a.name.localeCompare(b.name, 'ko');
    });

    // 각 부원별 실무 엑셀 수식 점수 계산
    const calculated: MemberFullRecord[] = list.map((m) => {
      const memberTeams = teams.filter((team) =>
        (membersMap[team.id] ?? []).some((member) => userIdOf(member, team.id) === m.id),
      );
      const selectedTeams = activeTab.startsWith('BASE')
        ? memberTeams.filter((team) => baseTeams.some((base) => base.id === team.id))
        : memberTeams.filter((team) => advTeams.some((adv) => adv.id === team.id));
      const selectedTeam = selectedTeams[0];
      const selectedMember =
        selectedTeam &&
        (membersMap[selectedTeam.id] ?? []).find(
          (member) => userIdOf(member, selectedTeam.id) === m.id,
        );

      // 1) 1~7주차 방학 세션 출결 상태 (사용자 이미지 스타일 일치)
      const rawStatuses: Array<AttendanceStatus | undefined> = SESSION_WEEKS.map((week) =>
        selectedTeam && selectedMember
          ? attendance[sessionKey(week.id, 'study', selectedTeam.id)]?.statuses[selectedMember.id]
          : undefined,
      );
      const sessionWeeks: DisplayStatus[] = rawStatuses.map((status) => {
        if (status === 'present') return '출석';
        if (status === 'remote') return '비대면';
        if (status === 'late' || status === 'unexcusedLate') return '지각';
        if (status === 'earlyLeave') return '조퇴';
        if (status === 'excusedAbsent') return '인정결석';
        if (status === 'absent' || status === 'unexcusedAbsent') return '결석';
        return '미정';
      });

      // 2) 출결 감점 계산 (해당 부원의 기수별 점수 규칙 적용)
      const termRule = scoreRules ? getRuleForTerm(scoreRules, m.term) : undefined;
      const latePenalty = termRule?.latePenalty ?? -1;
      const unexcusedLatePenalty = termRule?.unexcusedLatePenalty ?? -4;
      const earlyLeavePenalty = termRule?.earlyLeavePenalty ?? -1;
      const absentPenalty = termRule?.absentPenalty ?? -3;
      const unexcusedAbsentPenalty = termRule?.unexcusedAbsentPenalty ?? -4;

      const lateCount = rawStatuses.filter(
        (status) => status === 'late' || status === 'unexcusedLate',
      ).length;
      const lateDeduction = rawStatuses.reduce<number>(
        (sum, status) =>
          sum +
          (status === 'unexcusedLate' ? unexcusedLatePenalty : status === 'late' ? latePenalty : 0),
        0,
      );

      const earlyLeaveCount = rawStatuses.filter((status) => status === 'earlyLeave').length;
      const earlyLeaveDeduction = earlyLeaveCount * earlyLeavePenalty;

      const absentCount = rawStatuses.filter(
        (status) => status === 'absent' || status === 'unexcusedAbsent',
      ).length;
      const absentDeduction = rawStatuses.reduce<number>(
        (sum, status) =>
          sum +
          (status === 'unexcusedAbsent'
            ? unexcusedAbsentPenalty
            : status === 'absent'
              ? absentPenalty
              : 0),
        0,
      );

      const baseDefaultScore = 10;
      const attendanceScore = Math.max(
        0,
        baseDefaultScore + lateDeduction + earlyLeaveDeduction + absentDeduction,
      );

      // 3) 활동 점수 (친바, 홍보, 과제, 스터디, MT, 컨퍼런스)
      const chinbaScore = 0;
      const promoScore = 0;
      const mtScore = 0;
      const etcScore = 0;

      // BASE 스터디 & 과제
      const baseStudyScore = 0;
      const baseTaskScore = 0;

      // BASE 중간점수 (출석점수 + 스터디 + 친바 + 홍보 + 과제 + MT + 기타)
      const baseMidScore = Number(
        (
          attendanceScore +
          baseStudyScore +
          chinbaScore +
          promoScore +
          baseTaskScore +
          mtScore +
          etcScore
        ).toFixed(1),
      );

      // ADV 중간 항목
      const baseFinalRefScore = 0;
      // 스터디 점수: 미이수 0, 기본 +1, 개근 +3, 팀장 +1
      const isLeader = leaderIds.has(m.id);
      const advStudyScore = 0;
      const confScore = 0;
      const advMidScore = Number(
        (
          attendanceScore +
          advStudyScore +
          chinbaScore +
          promoScore +
          confScore +
          mtScore +
          etcScore
        ).toFixed(1),
      );

      // BASE 최종 집계 항목
      const termSessionScore = 0;
      const finalTaskScore = 0;
      const termStudyScore = 0;
      const officerScore = isLeader ? 2 : 0;
      const jointSessionScore = 0;
      const finalEtcScore = 0;
      const newRecruitPromoScore = 0;
      const isParallel = isConcurrentBaseMember(
        m.id,
        '',
        m.term,
        baseTeams,
        [...advTeams, ...studyTeams],
        membersMap,
      );
      const parallelMidScore = 0;
      const parallelScore = 0;
      const parallelAttendance = 0;
      const parallelGiveup: string = isParallel ? '미연동' : '-';

      const baseFinalScore = Number(
        (
          baseMidScore +
          termSessionScore +
          finalTaskScore +
          termStudyScore +
          officerScore +
          jointSessionScore +
          finalEtcScore +
          newRecruitPromoScore +
          (parallelGiveup === 'O' ? 0 : parallelScore)
        ).toFixed(1),
      );

      // ADV 최종 집계 항목
      const advFinalScore = Number(
        (
          advMidScore +
          termSessionScore +
          termStudyScore +
          officerScore +
          jointSessionScore +
          finalEtcScore +
          newRecruitPromoScore +
          (parallelGiveup === 'O' ? 0 : parallelScore)
        ).toFixed(1),
      );

      return {
        id: m.id,
        name: m.name,
        term: m.term,
        track: m.track,
        sessionWeeks,
        baseDefaultScore,
        lateCount,
        lateDeduction,
        earlyLeaveCount,
        earlyLeaveDeduction,
        absentCount,
        absentDeduction,
        attendanceScore,
        baseStudyScore,
        chinbaScore,
        promoScore,
        baseTaskScore,
        mtScore,
        etcScore,
        baseMidScore,
        baseFinalRefScore,
        advStudyScore,
        confScore,
        advMidScore,
        termSessionScore,
        finalTaskScore,
        termStudyScore,
        officerScore,
        jointSessionScore,
        finalEtcScore,
        newRecruitPromoScore,
        parallelMidScore,
        parallelScore,
        parallelAttendance,
        parallelGiveup,
        baseFinalScore,
        advFinalScore,
        isTop5: false,
      };
    });

    return calculated;
  }, [membersMap, leaderIds, scoreRules, attendance, activeTab, baseTeams, advTeams, studyTeams]);

  // 필터링 적용
  const filteredRecords = useMemo(() => {
    return allMemberRecords.filter((m) => {
      if (searchQuery.trim() && !m.name.includes(searchQuery.trim())) {
        return false;
      }
      if (termFilter !== 'ALL' && String(m.term) !== termFilter) {
        return false;
      }
      if (trackFilter !== 'ALL' && m.track !== trackFilter) {
        return false;
      }
      return true;
    });
  }, [allMemberRecords, searchQuery, termFilter, trackFilter]);

  // 출결 상태 텍스트 렌더링 (상태로 보기 모드 고정)
  const renderStatus = (st: DisplayStatus) => {
    switch (st) {
      case '출석':
        return <span className="text-emerald-600 font-medium">출석</span>;
      case '비대면':
        return <span className="text-indigo-600 font-bold">비대면</span>;
      case '지각':
        return <span className="text-amber-600 font-bold">지각</span>;
      case '조퇴':
        return <span className="text-amber-600 font-bold">조퇴</span>;
      case '결석':
        return <span className="text-rose-600 font-bold">결석</span>;
      case '인정결석':
        return <span className="text-blue-600 font-medium">인정결석</span>;
      case '미정':
      default:
        return <span className="text-slate-400 font-normal">미정</span>;
    }
  };

  // CSV 추출
  const handleDownloadCsv = () => {
    let headers: string[] = [];
    let rows: Array<Array<string | number | boolean>> = [];

    if (activeTab === 'BASE_MID') {
      headers = [
        '기수',
        '부문',
        '이름',
        '1주차',
        '2주차',
        '3주차',
        '4주차',
        '5주차',
        '6주차',
        '7주차',
        '기본점수',
        '지각',
        '조퇴',
        '결석',
        '출석점수',
        '스터디 점수',
        '친바 참여점수',
        '홍보점수',
        'BASE 과제점수',
        'MT 참여',
        '기타',
        '중간점수',
      ];
      rows = filteredRecords.map((m) => [
        `${m.term}기`,
        m.track,
        m.name,
        ...m.sessionWeeks,
        m.baseDefaultScore,
        m.lateDeduction,
        m.earlyLeaveDeduction,
        m.absentDeduction,
        m.attendanceScore,
        m.baseStudyScore,
        m.chinbaScore,
        m.promoScore,
        m.baseTaskScore,
        m.mtScore,
        m.etcScore,
        m.baseMidScore,
      ]);
    } else if (activeTab === 'ADV_MID') {
      headers = [
        '기수',
        '부문',
        '이름',
        '1주차',
        '2주차',
        '3주차',
        '4주차',
        '5주차',
        '6주차',
        '7주차',
        'BASE 최종점수',
        '지각',
        '조퇴',
        '결석',
        '출석점수',
        '스터디 점수',
        '친바 참여점수',
        '홍보점수',
        '컨퍼런스 참여',
        'MT 참여',
        '기타',
        '중간점수',
      ];
      rows = filteredRecords.map((m) => [
        `${m.term}기`,
        m.track,
        m.name,
        ...m.sessionWeeks,
        m.baseFinalRefScore,
        m.lateDeduction,
        m.earlyLeaveDeduction,
        m.absentDeduction,
        m.attendanceScore,
        m.advStudyScore,
        m.chinbaScore,
        m.promoScore,
        m.confScore,
        m.mtScore,
        m.etcScore,
        m.advMidScore,
      ]);
    } else if (activeTab === 'BASE_FINAL') {
      headers = [
        '기수',
        '부문',
        '이름',
        '중간점수',
        '학기세션',
        '과제점수',
        '학기스터디',
        '운영진',
        '공동세션',
        '기타점수',
        '신입모집',
        '병행',
        '병행점수',
        '병행출석',
        '병행포기',
        '최종점수',
      ];
      rows = filteredRecords.map((m) => [
        `${m.term}기`,
        m.track,
        m.name,
        m.baseMidScore,
        m.termSessionScore,
        m.finalTaskScore,
        m.termStudyScore,
        m.officerScore,
        m.jointSessionScore,
        m.finalEtcScore,
        m.newRecruitPromoScore,
        m.parallelMidScore > 0 ? m.parallelMidScore : '-',
        m.parallelScore > 0 ? m.parallelScore : '-',
        m.parallelAttendance > 0 ? m.parallelAttendance : '-',
        m.parallelGiveup,
        m.baseFinalScore,
      ]);
    } else if (activeTab === 'ADV_FINAL') {
      headers = [
        '기수',
        '부문',
        '이름',
        '중간점수',
        '학기세션 출석',
        '학기스터디',
        '운영진',
        '공동세션',
        '기타점수',
        '병행 중간점수',
        '병행점수',
        '병행출석',
        '병행포기',
        '신입모집 홍보점수',
        '최종점수',
        '상위 5명',
      ];
      rows = filteredRecords.map((m) => [
        `${m.term}기`,
        m.track,
        m.name,
        m.advMidScore,
        m.termSessionScore,
        m.termStudyScore,
        m.officerScore,
        m.jointSessionScore,
        m.finalEtcScore,
        m.parallelMidScore > 0 ? m.parallelMidScore : '-',
        m.parallelScore > 0 ? m.parallelScore : '-',
        m.parallelAttendance > 0 ? m.parallelAttendance : '-',
        m.parallelGiveup,
        m.newRecruitPromoScore,
        m.advFinalScore,
        m.isTop5 ? '상위 5명' : '-',
      ]);
    }

    const csvCell = (value: string | number | boolean) => {
      if (typeof value === 'number') return String(value);
      const safe = String(value)
        .replace(/^[=+@-]/, "'$&")
        .replace(/"/g, '""');
      return `"${safe}"`;
    };
    const csvContent =
      '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `BOAZ_${activeTab}_점수집계표_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* 0. 상단 페이지 제목 영역 */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <h2 className="text-slate-950 font-black text-lg sm:text-xl tracking-tight">
          출결 점수 집계
        </h2>
      </div>

      {/* 1. 상단 4대 집계 탭 네비게이션 */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-1">
        <div className="flex items-center gap-1 p-1 rounded-md bg-slate-100 border border-slate-200">
          <button
            onClick={() => setActiveTab('BASE_MID')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer ${
              activeTab === 'BASE_MID'
                ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            BASE 중간 점수 집계
          </button>

          <button
            onClick={() => setActiveTab('ADV_MID')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer ${
              activeTab === 'ADV_MID'
                ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ADV 중간 점수 집계
          </button>

          <button
            onClick={() => setActiveTab('BASE_FINAL')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer ${
              activeTab === 'BASE_FINAL'
                ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            BASE 최종 점수 집계
          </button>

          <button
            onClick={() => setActiveTab('ADV_FINAL')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer ${
              activeTab === 'ADV_FINAL'
                ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ADV 최종 점수 집계
          </button>
        </div>

        {/* CSV 다운로드 버튼 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            disabled
            title="활동 점수 데이터가 연결되면 내보낼 수 있습니다."
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-md shadow-xs transition-all cursor-pointer"
          >
            <Download size={13} />
            <span>CSV 다운로드 준비 중</span>
          </button>
        </div>
      </div>

      {/* 2. 필터 바 및 범례 */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 flex items-center justify-between flex-wrap gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 이름 검색 */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="부원 이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44"
            />
          </div>

          {/* 기수 토글 필터 (API 연동: 26기, 27기 등) */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">기수:</span>
            <div className="inline-flex items-center p-0.5 rounded-md bg-slate-100 border border-slate-200">
              <button
                onClick={() => {
                  setTermFilter('ALL');
                  loadTerms();
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-all cursor-pointer ${
                  termFilter === 'ALL'
                    ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                전체
              </button>
              {termsList.map((tm) => (
                <button
                  key={tm}
                  onClick={() => {
                    setTermFilter(tm);
                    loadTerms();
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-all cursor-pointer ${
                    termFilter === tm
                      ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tm}기
                </button>
              ))}
              {isLoadingTerms && (
                <RefreshCw size={11} className="animate-spin text-slate-400 mx-1" />
              )}
            </div>
          </div>

          {/* 부문 토글 필터 */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">부문:</span>
            <div className="inline-flex items-center p-0.5 rounded-md bg-slate-100 border border-slate-200">
              {(['ALL', '분석', '엔지니어링', '시각화'] as const).map((tr) => (
                <button
                  key={tr}
                  onClick={() => setTrackFilter(tr)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-all cursor-pointer ${
                    trackFilter === tr
                      ? 'bg-white text-slate-900 font-bold shadow-xs border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tr === 'ALL' ? '전체' : tr}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. 디자인 시안(media_1789296457006.png) 레이아웃 + 엑셀 시트 4종 컬럼명 100% 일치 */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          {/* TAB 1: BASE 방학·중간 집계 표 */}
          {activeTab === 'BASE_MID' && (
            <table className="w-full border-collapse text-xs whitespace-nowrap min-w-[1550px]">
              <thead>
                {/* 1행: 대분류 및 상단 컬럼명 */}
                <tr className="bg-[#f8fafc] border-b border-slate-200 text-slate-700 text-xs">
                  <th
                    rowSpan={2}
                    className="min-w-[72px] py-3 px-3 text-center font-bold border-r border-slate-200/60 align-middle bg-[#f8fafc] whitespace-nowrap"
                  >
                    기수
                  </th>
                  <th
                    rowSpan={2}
                    className="min-w-[105px] py-3 px-3 text-center font-bold border-r border-slate-200/60 align-middle bg-[#f8fafc] whitespace-nowrap"
                  >
                    부문
                  </th>
                  <th
                    rowSpan={2}
                    className="min-w-[95px] py-3 px-3 text-center font-bold border-r border-slate-200/60 align-middle bg-[#f8fafc] whitespace-nowrap"
                  >
                    이름
                  </th>

                  {/* 방학 세션 출결 점수 7주차 묶음 헤더 */}
                  <th
                    colSpan={7}
                    className="py-2.5 px-2 text-center font-bold text-blue-900 bg-blue-50/70 border-r border-slate-200/60 border-b border-blue-200/80 tracking-tight"
                  >
                    방학 세션 출결 점수
                  </th>

                  <th className="min-w-[76px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    기본점수
                  </th>
                  <th className="min-w-[84px] py-2 px-2 text-center font-bold text-amber-700 border-r border-slate-200/60 bg-[#f8fafc]">
                    지각
                  </th>
                  <th className="min-w-[70px] py-2 px-2 text-center font-bold text-amber-700 border-r border-slate-200/60 bg-[#f8fafc]">
                    조퇴
                  </th>
                  <th className="min-w-[84px] py-2 px-2 text-center font-bold text-rose-700 border-r border-slate-200/60 bg-[#f8fafc]">
                    결석
                  </th>
                  <th className="min-w-[84px] py-2 px-2 text-center font-bold text-slate-900 border-r border-slate-200/60 bg-slate-100/60">
                    출석점수
                  </th>

                  <th className="min-w-[80px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    스터디 점수
                  </th>
                  <th className="min-w-[84px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    친바 참여점수
                  </th>
                  <th className="min-w-[76px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    홍보점수
                  </th>
                  <th className="min-w-[88px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    BASE 과제점수
                  </th>
                  <th className="min-w-[76px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    MT 참여
                  </th>
                  <th
                    rowSpan={2}
                    className="min-w-[65px] py-3 px-2 text-center font-bold border-r border-slate-200/60 align-middle bg-[#f8fafc]"
                  >
                    기타
                  </th>
                  <th
                    rowSpan={2}
                    className="min-w-[88px] py-3 px-2 text-center font-bold bg-blue-100/60 text-blue-900 align-middle"
                  >
                    중간점수
                  </th>
                </tr>

                {/* 2행: 1주차~7주차 및 각 컬럼 감점/안내 */}
                <tr className="bg-[#f8fafc] border-b border-slate-200 text-xs">
                  {SESSION_WEEKS.map((w) => (
                    <th
                      key={w.id}
                      className="min-w-[70px] py-2.5 px-1 text-center border-r border-slate-200/60 bg-blue-50/20 font-bold text-slate-900 text-xs"
                    >
                      {w.label}
                    </th>
                  ))}

                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10.5px] text-slate-500 font-normal">
                    10점
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-amber-600 font-normal leading-tight">
                    기본 -1
                    <br />
                    (3회 -4)
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-amber-600 font-normal">
                    기본 -1
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-rose-600 font-normal leading-tight">
                    기본 -3
                    <br />
                    무단 -4
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-slate-600 font-medium bg-slate-100/50">
                    지각+조퇴+결석
                  </th>

                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-slate-500 font-normal">
                    감점 포함
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-emerald-600 font-semibold">
                    회당 +0.5
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-slate-500 font-normal">
                    컨퍼런스
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-slate-500 font-normal">
                    미제출 -0.5
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-slate-500 font-normal">
                    정규세션 동일
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 text-xs"
                  >
                    <td className="py-3 px-3 text-center text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">
                      {m.term}기
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">
                      {m.track}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900 border-r border-slate-100 whitespace-nowrap">
                      {m.name}
                    </td>

                    {m.sessionWeeks.map((st, i) => (
                      <td
                        key={i}
                        className="py-3 px-2 text-center border-r border-slate-100 font-sans"
                      >
                        {renderStatus(st)}
                      </td>
                    ))}

                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.baseDefaultScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-semibold text-amber-600 border-r border-slate-100">
                      {m.lateDeduction}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-semibold text-amber-600 border-r border-slate-100">
                      {m.earlyLeaveDeduction}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-semibold text-rose-600 border-r border-slate-100">
                      {m.absentDeduction}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-bold text-slate-900 bg-slate-50/50 border-r border-slate-100">
                      {m.attendanceScore}
                    </td>

                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.baseStudyScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-emerald-600 font-bold border-r border-slate-100">
                      +{m.chinbaScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.promoScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.baseTaskScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.mtScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-500 border-r border-slate-100">
                      {m.etcScore}
                    </td>

                    <td className="py-3 px-2 text-center font-mono font-bold text-blue-700 bg-blue-50/30">
                      {m.baseMidScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 2: ADV 방학·중간 집계 표 */}
          {activeTab === 'ADV_MID' && (
            <table className="w-full border-collapse text-xs whitespace-nowrap min-w-[1550px]">
              <thead>
                {/* 1행: 대분류 및 상단 컬럼명 */}
                <tr className="bg-[#f8fafc] border-b border-slate-200 text-slate-700 text-xs">
                  <th
                    rowSpan={2}
                    className="min-w-[72px] py-3 px-3 text-center font-bold border-r border-slate-200/60 align-middle bg-[#f8fafc] whitespace-nowrap"
                  >
                    기수
                  </th>
                  <th
                    rowSpan={2}
                    className="min-w-[105px] py-3 px-3 text-center font-bold border-r border-slate-200/60 align-middle bg-[#f8fafc] whitespace-nowrap"
                  >
                    부문
                  </th>
                  <th
                    rowSpan={2}
                    className="min-w-[95px] py-3 px-3 text-center font-bold border-r border-slate-200/60 align-middle bg-[#f8fafc] whitespace-nowrap"
                  >
                    이름
                  </th>

                  {/* 방학 세션 출결 7주차 묶음 헤더 */}
                  <th
                    colSpan={7}
                    className="py-2.5 px-2 text-center font-bold text-purple-900 bg-purple-50/70 border-r border-slate-200/60 border-b border-purple-200/80 tracking-tight"
                  >
                    방학 세션 출결
                  </th>

                  <th className="min-w-[88px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    BASE 최종점수
                  </th>
                  <th className="min-w-[84px] py-2 px-2 text-center font-bold text-amber-700 border-r border-slate-200/60 bg-[#f8fafc]">
                    지각
                  </th>
                  <th className="min-w-[70px] py-2 px-2 text-center font-bold text-amber-700 border-r border-slate-200/60 bg-[#f8fafc]">
                    조퇴
                  </th>
                  <th className="min-w-[84px] py-2 px-2 text-center font-bold text-rose-700 border-r border-slate-200/60 bg-[#f8fafc]">
                    결석
                  </th>
                  <th className="min-w-[84px] py-2 px-2 text-center font-bold text-slate-900 border-r border-slate-200/60 bg-slate-100/60">
                    출석점수
                  </th>

                  <th className="min-w-[84px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    스터디 점수
                  </th>
                  <th className="min-w-[84px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    친바 참여점수
                  </th>
                  <th className="min-w-[76px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    홍보점수
                  </th>
                  <th className="min-w-[84px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    컨퍼런스 참여
                  </th>
                  <th className="min-w-[76px] py-2 px-2 text-center font-bold border-r border-slate-200/60 bg-[#f8fafc]">
                    MT 참여
                  </th>
                  <th
                    rowSpan={2}
                    className="min-w-[65px] py-3 px-2 text-center font-bold border-r border-slate-200/60 align-middle bg-[#f8fafc]"
                  >
                    기타
                  </th>
                  <th
                    rowSpan={2}
                    className="min-w-[88px] py-3 px-2 text-center font-bold bg-purple-100/60 text-purple-900 align-middle"
                  >
                    중간점수
                  </th>
                </tr>

                {/* 2행: 1주차~7주차 및 각 컬럼 감점/안내 */}
                <tr className="bg-[#f8fafc] border-b border-slate-200 text-xs">
                  {SESSION_WEEKS.map((w) => (
                    <th
                      key={w.id}
                      className="min-w-[70px] py-2.5 px-1 text-center border-r border-slate-200/60 bg-purple-50/20 font-bold text-slate-900 text-xs"
                    >
                      {w.label}
                    </th>
                  ))}

                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10.5px] text-slate-400 font-normal">
                    -
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-amber-600 font-normal leading-tight">
                    기본 -1
                    <br />
                    (3회 -4)
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-amber-600 font-normal">
                    기본 -1
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-rose-600 font-normal leading-tight">
                    기본 -3
                    <br />
                    무단 -4
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-slate-600 font-medium bg-slate-100/50">
                    SUM
                  </th>

                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[9.5px] text-slate-500 font-normal leading-tight">
                    미0/기1
                    <br />
                    개3/팀1
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-emerald-600 font-semibold">
                    회당 +0.5
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-slate-500 font-normal">
                    컨퍼런스
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-indigo-600 font-medium">
                    출석당 1점
                  </th>
                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-slate-500 font-normal">
                    정규세션 동일
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 text-xs"
                  >
                    <td className="py-3 px-3 text-center text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">
                      {m.term}기
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">
                      {m.track}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900 border-r border-slate-100 whitespace-nowrap">
                      {m.name}
                    </td>

                    {m.sessionWeeks.map((st, i) => (
                      <td
                        key={i}
                        className="py-3 px-2 text-center border-r border-slate-100 font-sans"
                      >
                        {renderStatus(st)}
                      </td>
                    ))}

                    <td className="py-3 px-2 text-center font-mono font-bold text-slate-800 bg-slate-50 border-r border-slate-100">
                      {m.baseFinalRefScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-semibold text-amber-600 border-r border-slate-100">
                      {m.lateDeduction}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-semibold text-amber-600 border-r border-slate-100">
                      {m.earlyLeaveDeduction}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-semibold text-rose-600 border-r border-slate-100">
                      {m.absentDeduction}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-bold text-slate-900 bg-slate-50/50 border-r border-slate-100">
                      {m.attendanceScore}
                    </td>

                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.advStudyScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-emerald-600 font-bold border-r border-slate-100">
                      +{m.chinbaScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.promoScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-indigo-600 font-bold border-r border-slate-100">
                      +{m.confScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.mtScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-500 border-r border-slate-100">
                      {m.etcScore}
                    </td>

                    <td className="py-3 px-2 text-center font-mono font-bold text-purple-700 bg-purple-50/30">
                      {m.advMidScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 3: BASE 최종점수 집계 표 */}
          {activeTab === 'BASE_FINAL' && (
            <table className="w-full border-collapse text-xs whitespace-nowrap min-w-[1400px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-200 text-slate-700 text-xs">
                  <th className="min-w-[72px] py-3.5 px-3 text-center font-bold border-r border-slate-200/60 whitespace-nowrap">
                    기수
                  </th>
                  <th className="min-w-[105px] py-3.5 px-3 text-center font-bold border-r border-slate-200/60 whitespace-nowrap">
                    부문
                  </th>
                  <th className="min-w-[95px] py-3.5 px-3 text-center font-bold border-r border-slate-200/60 whitespace-nowrap">
                    이름
                  </th>

                  <th className="min-w-[85px] py-2 px-2 text-center border-r border-slate-200/60 bg-blue-50/30">
                    <div className="font-bold text-blue-900 text-[11px] leading-tight">
                      중간점수
                    </div>
                  </th>
                  <th className="min-w-[80px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      학기세션
                    </div>
                  </th>
                  <th className="min-w-[80px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      과제점수
                    </div>
                  </th>
                  <th className="min-w-[80px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      학기스터디
                    </div>
                  </th>
                  <th className="min-w-[70px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">운영진</div>
                  </th>
                  <th className="min-w-[70px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      공동세션
                    </div>
                  </th>
                  <th className="min-w-[70px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      기타점수
                    </div>
                  </th>
                  <th className="min-w-[80px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      신입모집
                    </div>
                  </th>

                  <th className="min-w-[75px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">병행</div>
                  </th>
                  <th className="min-w-[75px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      병행점수
                    </div>
                  </th>
                  <th className="min-w-[75px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      병행출석
                    </div>
                  </th>
                  <th className="min-w-[75px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      병행포기
                    </div>
                  </th>

                  <th className="min-w-[90px] py-2 px-2 text-center bg-emerald-50/60 font-bold">
                    <div className="font-bold text-emerald-900 text-[11px] leading-tight">
                      최종점수
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/70 transition-colors border-b border-slate-100 text-xs"
                  >
                    <td className="py-3 px-3 text-center text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">
                      {m.term}기
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">
                      {m.track}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900 border-r border-slate-100 whitespace-nowrap">
                      {m.name}
                    </td>

                    <td className="py-3 px-2 text-center font-mono font-bold text-blue-700 bg-blue-50/20 border-r border-slate-100">
                      {m.baseMidScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.termSessionScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.finalTaskScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.termStudyScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.officerScore > 0 ? `+${m.officerScore}` : '0'}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.jointSessionScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-500 border-r border-slate-100">
                      {m.finalEtcScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.newRecruitPromoScore}
                    </td>

                    <td className="py-3 px-2 text-center font-mono text-slate-400 border-r border-slate-100">
                      {m.parallelMidScore > 0 ? m.parallelMidScore : '-'}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-400 border-r border-slate-100">
                      {m.parallelScore > 0 ? m.parallelScore : '-'}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-400 border-r border-slate-100">
                      {m.parallelAttendance > 0 ? m.parallelAttendance : '-'}
                    </td>
                    <td className="py-3 px-2 text-center font-bold text-slate-400 border-r border-slate-100">
                      {m.parallelGiveup}
                    </td>

                    <td className="py-3 px-2 text-center font-mono font-bold text-emerald-700 bg-emerald-50/40">
                      {m.baseFinalScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 4: ADV 최종점수 집계 표 */}
          {activeTab === 'ADV_FINAL' && (
            <table className="w-full border-collapse text-xs whitespace-nowrap min-w-[1450px]">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-slate-200 text-slate-700 text-xs">
                  <th className="min-w-[72px] py-3.5 px-3 text-center font-bold border-r border-slate-200/60 whitespace-nowrap">
                    기수
                  </th>
                  <th className="min-w-[105px] py-3.5 px-3 text-center font-bold border-r border-slate-200/60 whitespace-nowrap">
                    부문
                  </th>
                  <th className="min-w-[95px] py-3.5 px-3 text-center font-bold border-r border-slate-200/60 whitespace-nowrap">
                    이름
                  </th>

                  <th className="min-w-[85px] py-2 px-2 text-center border-r border-slate-200/60 bg-purple-50/30">
                    <div className="font-bold text-purple-900 text-[11px] leading-tight">
                      중간점수
                    </div>
                  </th>
                  <th className="min-w-[88px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      학기세션 출석
                    </div>
                  </th>
                  <th className="min-w-[80px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      학기스터디
                    </div>
                  </th>
                  <th className="min-w-[70px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">운영진</div>
                  </th>
                  <th className="min-w-[70px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      공동세션
                    </div>
                  </th>
                  <th className="min-w-[70px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      기타점수
                    </div>
                  </th>

                  <th className="min-w-[88px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      병행 중간점수
                    </div>
                  </th>
                  <th className="min-w-[75px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      병행점수
                    </div>
                  </th>
                  <th className="min-w-[75px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      병행출석
                    </div>
                  </th>
                  <th className="min-w-[75px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      병행포기
                    </div>
                  </th>

                  <th className="min-w-[95px] py-2 px-2 text-center border-r border-slate-200/60">
                    <div className="font-bold text-slate-800 text-[11px] leading-tight">
                      신입모집 홍보점수
                    </div>
                  </th>
                  <th className="min-w-[90px] py-2 px-2 text-center border-r border-slate-200/60 bg-amber-50/50 font-bold">
                    <div className="font-bold text-amber-900 text-[11px] leading-tight">
                      최종점수
                    </div>
                  </th>
                  <th className="min-w-[90px] py-2 px-2 text-center bg-amber-100/40 font-bold">
                    <div className="font-bold text-amber-900 text-[11px] leading-tight">
                      상위 5명
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((m) => (
                  <tr
                    key={m.id}
                    className={`hover:bg-slate-50/70 transition-colors border-b border-slate-100 text-xs ${
                      m.isTop5 ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-3 text-center text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">
                      {m.term}기
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 font-medium border-r border-slate-100 whitespace-nowrap">
                      {m.track}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900 border-r border-slate-100 whitespace-nowrap">
                      {m.name}
                    </td>

                    <td className="py-3 px-2 text-center font-mono font-bold text-purple-700 bg-purple-50/20 border-r border-slate-100">
                      {m.advMidScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.termSessionScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.termStudyScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.officerScore > 0 ? `+${m.officerScore}` : '0'}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.jointSessionScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-500 border-r border-slate-100">
                      {m.finalEtcScore}
                    </td>

                    <td className="py-3 px-2 text-center font-mono text-slate-400 border-r border-slate-100">
                      {m.parallelMidScore > 0 ? m.parallelMidScore : '-'}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-400 border-r border-slate-100">
                      {m.parallelScore > 0 ? m.parallelScore : '-'}
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-slate-400 border-r border-slate-100">
                      {m.parallelAttendance > 0 ? m.parallelAttendance : '-'}
                    </td>
                    <td className="py-3 px-2 text-center font-bold text-slate-400 border-r border-slate-100">
                      {m.parallelGiveup}
                    </td>

                    <td className="py-3 px-2 text-center font-mono text-slate-700 border-r border-slate-100">
                      {m.newRecruitPromoScore}
                    </td>
                    <td className="py-3 px-2 text-center font-mono font-bold text-amber-700 bg-amber-50/30 border-r border-slate-100">
                      {m.advFinalScore}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {m.isTop5 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
                          <Star size={11} className="fill-amber-500 text-amber-500" />
                          상위 5명
                        </span>
                      ) : (
                        <span className="text-slate-300 font-mono">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 테이블 하단 푸터 바 */}
        <div className="px-5 py-3 border-t border-slate-200 bg-[#f8fafc] flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500">
          <div>
            총 <span className="font-bold text-slate-800">{filteredRecords.length}</span>명의 부원
            점수가 집계되었습니다. (정렬: 기수 순 → 가나다 순)
          </div>
          <div className="flex items-center gap-4 text-xs">
            {activeTab === 'ADV_FINAL' && (
              <span className="text-amber-700 font-semibold flex items-center gap-1">
                <Star size={12} className="fill-amber-500 text-amber-500" />
                활동 점수 미연동 · 순위 미확정
              </span>
            )}
            <span className="text-slate-400">
              출결 점수는 실제 기록을 사용합니다. 활동 점수는 미연동이며 0점으로 표시됩니다.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
