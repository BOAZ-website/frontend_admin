import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, Search, Star } from 'lucide-react';

import { fetchScoreSheet } from '@/entities/attendance/api/attendanceApi';
import { fetchActiveAttendanceTerms } from '@/entities/attendance/api/termsApi';
import type { ScoreSheetMemberDto, ScoreSheetResponse } from '@/entities/attendance/model/dto';
import type { AttendanceStatus } from '@/entities/attendance/model/types';
import { Tooltip } from '@/shared/ui/Tooltip';
import { withoutKeys } from '@/shared/lib/object';

/** CSV 저장을 아직 할 수 없는 이유. 저장 버튼에 마우스를 올리면 보인다. */
const CSV_BLOCKED_REASON = '활동 점수가 아직 연결되지 않아 저장할 수 없습니다';

export type AggregationTab = 'BASE_MID' | 'ADV_MID' | 'BASE_FINAL' | 'ADV_FINAL';

export type DisplayStatus = '출석' | '비대면' | '지각' | '조퇴' | '결석' | '인정결석' | '미정';

/**
 * 점수표 한 행. 주차·감점·점수는 모두 API(GET /api/v1/attendance/score-sheet)가 계산해 내려주고,
 * 화면은 출결 상태를 표시용 글자로 바꾸기만 한다.
 */
type MemberFullRecord = Omit<ScoreSheetMemberDto, 'statuses'> & { sessionWeeks: DisplayStatus[] };

function toDisplayStatus(status: AttendanceStatus | null): DisplayStatus {
  if (status === 'present') return '출석';
  if (status === 'remote') return '비대면';
  if (status === 'late' || status === 'unexcusedLate') return '지각';
  if (status === 'earlyLeave') return '조퇴';
  if (status === 'excusedAbsent') return '인정결석';
  if (status === 'absent' || status === 'unexcusedAbsent') return '결석';
  return '미정';
}

type SheetGroup = ScoreSheetResponse['group'];

/** 구분(BASE·ADV)별로 받아 둔 점수표와 읽기 실패 사유. */
interface ScoreSheetCache {
  sheets: Partial<Record<SheetGroup, ScoreSheetResponse>>;
  errors: Partial<Record<SheetGroup, Error>>;
}

const SHEET_GROUPS: readonly SheetGroup[] = ['BASE', 'ADV'];

/**
 * 출결 점수 집계 탭. 탭을 열면 BASE·ADV 점수표를 둘 다 API에서 읽어 두고,
 * 탭을 바꾸면 받아 둔 표를 바로 보여 주면서 그 구분의 점수표를 다시 읽어 갱신한다(표가 비었다가 다시 채워지며 깜빡이지 않게).
 */
export function ScoresPage() {
  const [activeTab, setActiveTab] = useState<AggregationTab>('BASE_MID');

  // 검색 및 필터 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [termsList, setTermsList] = useState<string[]>([]);
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
      // 기수 목록을 못 읽으면 '전체'만 보여준다. 점수표 자체의 오류는 아래에서 따로 표시한다.
    } finally {
      setIsLoadingTerms(false);
    }
  };

  useEffect(() => {
    loadTerms();
  }, []);

  // BASE 탭은 BASE 트랙 출결, ADV 탭은 ADV 팀 출결로 계산한 점수표를 API에서 받는다.
  const group = activeTab.startsWith('BASE') ? 'BASE' : 'ADV';
  const [sheetCache, setSheetCache] = useState<ScoreSheetCache>({ sheets: {}, errors: {} });
  const loadSheet = useCallback((target: SheetGroup) => {
    fetchScoreSheet({ group: target })
      .then((sheet) =>
        setSheetCache((prev) => {
          return {
            sheets: { ...prev.sheets, [target]: sheet },
            errors: withoutKeys(prev.errors, target),
          };
        }),
      )
      .catch((error: unknown) =>
        setSheetCache((prev) => ({
          ...prev,
          errors: {
            ...prev.errors,
            [target]: error instanceof Error ? error : new Error(String(error)),
          },
        })),
      );
  }, []);
  // 처음 열 때 다른 구분의 점수표도 미리 읽어 둔다.
  useEffect(() => {
    SHEET_GROUPS.forEach(loadSheet);
  }, [loadSheet]);
  // 탭을 바꾸면 그 구분의 점수표를 다시 읽어 최신 값으로 갱신한다(받아 둔 표는 그동안 그대로 보인다).
  const isFirstGroupRef = useRef(true);
  useEffect(() => {
    if (isFirstGroupRef.current) {
      isFirstGroupRef.current = false;
      return;
    }
    loadSheet(group);
  }, [group, loadSheet]);
  const sheet = sheetCache.sheets[group] ?? null;
  const sheetError = sheet ? null : (sheetCache.errors[group] ?? null);
  const isLoadingSheet = !sheet && !sheetError;
  const weeks = sheet?.weeks ?? [];
  const weekLabels = weeks.map((week) => week.label);

  const allMemberRecords: MemberFullRecord[] = useMemo(
    () =>
      (sheet?.members ?? []).map(({ statuses, ...row }) => ({
        ...row,
        sessionWeeks: statuses.map(toDisplayStatus),
      })),
    [sheet],
  );

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
        ...weekLabels,
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
        ...weekLabels,
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
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer border ${
              activeTab === 'BASE_MID'
                ? 'border-slate-200 bg-white text-slate-900 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            BASE 중간 점수 집계
          </button>

          <button
            onClick={() => setActiveTab('ADV_MID')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer border ${
              activeTab === 'ADV_MID'
                ? 'border-slate-200 bg-white text-slate-900 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            ADV 중간 점수 집계
          </button>

          <button
            onClick={() => setActiveTab('BASE_FINAL')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer border ${
              activeTab === 'BASE_FINAL'
                ? 'border-slate-200 bg-white text-slate-900 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            BASE 최종 점수 집계
          </button>

          <button
            onClick={() => setActiveTab('ADV_FINAL')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-sm transition-all cursor-pointer border ${
              activeTab === 'ADV_FINAL'
                ? 'border-slate-200 bg-white text-slate-900 shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            ADV 최종 점수 집계
          </button>
        </div>

        {/* CSV 저장 버튼: 아이콘만 있는 버튼. 지금은 저장할 수 없어서, 마우스를 올리면 금지 표시와 그 이유가 뜬다. */}
        <div className="flex items-center gap-2">
          <Tooltip label={CSV_BLOCKED_REASON} align="end" isBlocked>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled
              aria-label={`CSV 저장 (${CSV_BLOCKED_REASON})`}
              // 쓸 수 없는 버튼은 마우스 동작을 감싼 칸(말풍선)에 넘긴다.
              className="pointer-events-none inline-flex size-9 items-center justify-center rounded-sm text-slate-300"
            >
              <Download size={16} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 2. 필터 바 및 범례 */}
      <div className="bg-white rounded-md border border-slate-200/90 p-3.5 flex items-center justify-between flex-wrap gap-3 shadow-2xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 이름 검색 */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="이름 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44"
            />
          </div>

          {/* 기수 토글 필터 (API 연동: 26기, 27기 등) */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">기수:</span>
            <div className="inline-flex items-center p-0.5 rounded-md bg-slate-100 border border-slate-200">
              <button
                onClick={() => {
                  setTermFilter('ALL');
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-all cursor-pointer border ${
                  termFilter === 'ALL'
                    ? 'border-slate-200/80 bg-white text-slate-900 shadow-xs'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                전체
              </button>
              {termsList.map((tm) => (
                <button
                  key={tm}
                  onClick={() => {
                    setTermFilter(tm);
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-all cursor-pointer border ${
                    termFilter === tm
                      ? 'border-slate-200/80 bg-white text-slate-900 shadow-xs'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
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
                  className={`px-2.5 py-1 text-xs font-semibold rounded-sm transition-all cursor-pointer border ${
                    trackFilter === tr
                      ? 'border-slate-200/80 bg-white text-slate-900 shadow-xs'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
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

                  {/* 방학 세션 출결 점수 주차 묶음 헤더 */}
                  <th
                    colSpan={Math.max(weeks.length, 1)}
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

                {/* 2행: 주차(API가 내려준 주차) 및 각 컬럼 감점/안내 */}
                <tr className="bg-[#f8fafc] border-b border-slate-200 text-xs">
                  {weeks.map((w) => (
                    <th
                      key={w.weekNum}
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
                    결석 횟수 기준
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

                  {/* 방학 세션 출결 주차 묶음 헤더 */}
                  <th
                    colSpan={Math.max(weeks.length, 1)}
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

                {/* 2행: 주차(API가 내려준 주차) 및 각 컬럼 감점/안내 */}
                <tr className="bg-[#f8fafc] border-b border-slate-200 text-xs">
                  {weeks.map((w) => (
                    <th
                      key={w.weekNum}
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

                  <th className="py-2 px-1 text-center border-r border-slate-200/60 text-[10px] text-slate-500 font-normal">
                    결석 횟수 기준
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

        {(sheetError || isLoadingSheet) && (
          <div
            className={`px-5 py-3 border-t border-slate-200 text-xs ${
              sheetError ? 'text-red-600 bg-red-50' : 'text-slate-500'
            }`}
          >
            {sheetError
              ? `점수표를 불러오지 못했습니다. (${sheetError.message})`
              : '점수표를 불러오는 중입니다.'}
          </div>
        )}
      </div>
    </div>
  );
}
