import { useState } from 'react';
import { BellRing, CheckCircle2, Download, Eye, HelpCircle, Megaphone } from 'lucide-react';

import { useQuestions } from '@/entities/recruitment/model/useQuestions';
import { useRecruitments } from '@/entities/recruitment/model/useRecruitments';
import type { QuestionCategory } from '@/entities/recruitment/model/types';
import { DataLoadFailedNotice } from '@/shared/ui/DataLoadFailedNotice';

import { NotificationsTab } from './NotificationsTab';
import { PostsTab } from './PostsTab';
import { QuestionsTab } from './QuestionsTab';

type TrackType = Exclude<QuestionCategory, 'COMMON'>;
type RecruitingTab = 'posts' | 'questions' | 'preview' | 'csv' | 'notifications';

const TAB_PAGE: Record<RecruitingTab, string> = {
  posts: 'recruiting-posts',
  questions: 'recruiting-questions',
  preview: 'recruiting-preview',
  csv: 'recruiting-csv',
  notifications: 'recruiting-leads',
};

const TABS = [
  { id: 'posts', label: '모집 공고 관리', icon: Megaphone },
  { id: 'questions', label: '지원서 문항 설정', icon: HelpCircle },
  { id: 'preview', label: '지원자 화면 미리보기', icon: Eye },
  { id: 'csv', label: '지원서 CSV 추출', icon: Download },
  { id: 'notifications', label: '사전 알림 명단', icon: BellRing },
] as const;

// 지원서 CSV 추출(REC-CSV)은 백엔드가 파일을 돌려주지 않아 아직 고정 예시 지원자로 동작한다(#90 범위 밖).
export interface LocalApplicant {
  id: number;
  term: number;
  status: 'DRAFT' | 'SUBMITTED';
  track: TrackType;
  name: string;
}

const INITIAL_LOCAL_APPLICANTS: LocalApplicant[] = [
  ...Array.from({ length: 52 }, (_, i) => ({
    id: 100 + i,
    term: 28,
    status: 'SUBMITTED' as const,
    track: (i % 3 === 0 ? 'ANALYSIS' : i % 3 === 1 ? 'ENGINEERING' : 'VISUALIZATION') as TrackType,
    name: `지원자_${i + 1}`,
  })),
  ...Array.from({ length: 24 }, (_, i) => ({
    id: 200 + i,
    term: 28,
    status: 'DRAFT' as const,
    track: (i % 3 === 0 ? 'ANALYSIS' : i % 3 === 1 ? 'ENGINEERING' : 'VISUALIZATION') as TrackType,
    name: `작성중_${i + 1}`,
  })),
  ...Array.from({ length: 110 }, (_, i) => ({
    id: 300 + i,
    term: 27,
    status: 'SUBMITTED' as const,
    track: (i % 3 === 0 ? 'ANALYSIS' : i % 3 === 1 ? 'ENGINEERING' : 'VISUALIZATION') as TrackType,
    name: `27기수료_${i + 1}`,
  })),
];

const CATEGORY_META: Record<
  QuestionCategory,
  { label: string; short: string; color: string; bg: string; border: string }
> = {
  COMMON: {
    label: '전체 공통 문항',
    short: '공통',
    color: '#334155',
    bg: '#f1f5f9',
    border: '#cbd5e1',
  },
  ANALYSIS: {
    label: '데이터 분석 트랙',
    short: '분석',
    color: '#0f172a',
    bg: '#f8fafc',
    border: '#cbd5e1',
  },
  ENGINEERING: {
    label: '데이터 엔지니어링 트랙',
    short: '엔지니어링',
    color: '#0f172a',
    bg: '#f8fafc',
    border: '#cbd5e1',
  },
  VISUALIZATION: {
    label: '데이터 시각화 트랙',
    short: '시각화',
    color: '#0f172a',
    bg: '#f8fafc',
    border: '#cbd5e1',
  },
};

const FIXED_CSV_HEADERS = [
  '지원자 식별자(user_id)',
  '지원 트랙',
  '이름',
  '이메일',
  '전화번호',
  '1차 합불결과',
  '대학교',
  '전공',
  '복수전공',
  '재학 학기',
  '병역',
  '생년월일',
  '졸업예정연월',
  '향후계획',
  '제출일시',
];

function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) {
    return '';
  }
  let str = String(val).trim();
  if (
    str.startsWith('=') ||
    str.startsWith('+') ||
    str.startsWith('-') ||
    str.startsWith('@') ||
    str.startsWith('\t') ||
    str.startsWith('\r')
  ) {
    str = "'" + str;
  }
  return str;
}

/**
 * 리크루팅 관리 화면. 탭은 사이드바 화면(activePage)과 1:1이라 App이 initialTab으로 정하고,
 * 탭을 누르면 onTabChange로 화면을 바꾼다. 모집 공고와 고른 공고의 문항은 여러 탭이 함께 쓴다.
 */
export function RecruitmentManagePage({
  initialTab = 'posts',
  onTabChange,
}: {
  initialTab?: RecruitingTab | 'leads';
  onTabChange?: (tab: string) => void;
}) {
  const activeTab: RecruitingTab = initialTab === 'leads' ? 'notifications' : initialTab;
  const recruitmentsState = useRecruitments();
  const recruitments = recruitmentsState.recruitments ?? [];
  const [pickedRecruitmentId, setPickedRecruitmentId] = useState<number | null>(null);
  // 고른 공고가 없거나 지워졌으면 가장 최근 기수 공고를 쓴다.
  const selectedRecruitment =
    recruitments.find((r) => r.recruitment_id === pickedRecruitmentId) ?? recruitments[0] ?? null;
  const questionsState = useQuestions(selectedRecruitment?.recruitment_id ?? null);
  const questions = questionsState.questions ?? [];
  const previewTerm = selectedRecruitment ? `제${selectedRecruitment.term}기` : '';
  const [previewTrack, setPreviewTrack] = useState<TrackType>('ANALYSIS');
  const [csvTerm] = useState<number>(28);
  const [csvDecision] = useState<'ALL' | 'PASS' | 'FAIL' | 'PENDING'>('ALL');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  function showToast(message: string) {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  }

  function handleDownloadTrackCsv(track: TrackType) {
    const commonQuestions = questions
      .filter((q) => q.category === 'COMMON')
      .sort((a, b) => a.order_num - b.order_num);
    const trackQuestions = questions
      .filter((q) => q.category === track)
      .sort((a, b) => a.order_num - b.order_num);
    const allHeaders = [
      ...FIXED_CSV_HEADERS,
      ...commonQuestions.map((q) => q.label),
      ...trackQuestions.map((q) => q.label),
    ];
    const headerRow = allHeaders.map((h) => `"${sanitizeCsvValue(h)}"`).join(',');

    const mockRows = [
      [
        'usr_101',
        track,
        '이도현',
        'dohyun@snu.ac.kr',
        '010-3819-2910',
        '합격',
        '서울대학교',
        '통계학과',
        '컴퓨터공학 복전',
        '4학년 1학기',
        '군필',
        '2001-05-14',
        '2027-02',
        '미정',
        '2026-08-15 19:20',
        '통계적 가설 검정과 ML을 응용한 데이터 분석가가 되고 싶어 지원했습니다.',
        '해커톤에서 결측치 처리 기준 갈등을 EDA 차트로 설득하여 최우수상을 수상했습니다.',
        track === 'ANALYSIS'
          ? '과목/라이브러리명: Scikit-learn, PyTorch\n프로젝트 내용: 뉴스 텍스트 감성 분류'
          : 'RDBMS 인덱스 최적화 및 데이터 파이프라인 구축',
        '가설 설정부터 LightGBM 모델링, A/B 테스트 검증까지 진행했습니다.',
      ],
      [
        'usr_102',
        track,
        '김서하',
        'seoha@yonsei.ac.kr',
        '010-5519-8821',
        csvDecision === 'FAIL' ? '불합격' : '합격',
        '연세대학교',
        '경영학과',
        '빅데이터 응용',
        '3학년 2학기',
        '해당없음',
        '2002-09-22',
        '2027-08',
        '진학 예정',
        '2026-08-16 11:30',
        '비즈니스 관점의 그로스 데이터 분석가가 되고 싶습니다.',
        '홍보 예산 집행 시 A/B 테스트로 전환율 개선 경험',
        track === 'ANALYSIS'
          ? '과목/라이브러리: Pandas, SQL\n프로젝트 경험: 코호트 분석'
          : 'Docker 컨테이너 인프라 관리',
        '이커머스 고객 이탈 예측 모델링 수행',
      ],
    ];

    const dataRows = mockRows.map((row) =>
      row.map((v) => `"${sanitizeCsvValue(v).replace(/"/g, '""')}"`).join(','),
    );
    const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `applicants_${track}_${csvDecision}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(
      `${CATEGORY_META[track].short} 트랙 지원서 CSV가 성공적으로 다운로드되었습니다.`,
    );
    setTimeout(() => setDownloadSuccess(null), 4000);
  }

  const previewQuestions = [
    ...questions.filter((q) => q.category === 'COMMON'),
    ...questions.filter((q) => q.category === previewTrack),
  ];

  return (
    <div className="space-y-6 w-full">
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-70 flex items-center gap-2 rounded-md bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-lg"
        >
          <CheckCircle2 size={16} className="shrink-0 text-emerald-400" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl border border-slate-300/50">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onTabChange?.(TAB_PAGE[tab.id])}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-slate-800' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'posts' && <PostsTab state={recruitmentsState} onToast={showToast} />}

      {activeTab === 'questions' && (
        <QuestionsTab
          recruitments={recruitments}
          recruitmentId={selectedRecruitment?.recruitment_id ?? null}
          onSelectRecruitment={setPickedRecruitmentId}
          state={questionsState}
          onToast={showToast}
        />
      )}

      {/* ─── TAB 3: 지원자 화면 미리보기 (Preview) ─── */}
      {activeTab === 'preview' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          {(recruitmentsState.error || questionsState.error) && (
            <DataLoadFailedNotice
              onRetry={() => {
                recruitmentsState.reload();
                questionsState.reload();
              }}
            />
          )}
          <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Eye size={16} className="text-red-600" />
                <span>지원자 화면 실시간 미리보기</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                실제 신입 지원자가 보게 될 공통 및 트랙별 지원서 입력 화면입니다.
              </p>
            </div>

            {/* Track Selector for Preview */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              {(['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'] as TrackType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setPreviewTrack(t)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    previewTrack === t
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {CATEGORY_META[t].short} 트랙 뷰
                </button>
              ))}
            </div>
          </div>

          {/* Form Preview Container */}
          <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4 space-y-1">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                {previewTerm} 신입 지원서
              </span>
              <h1 className="text-xl font-bold text-slate-900">
                BOAZ {previewTerm} 정규 부원 지원서 ({CATEGORY_META[previewTrack].label})
              </h1>
              <p className="text-xs text-slate-500">
                작성 중인 내용은 임시저장(DRAFT)되며, 최종 제출(SUBMITTED) 전까지 자유롭게 수정할 수
                있습니다.
              </p>
            </div>

            {/* Basic Info Mock */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-700">1. 기본 인적 사항 (자동 기재)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">이름</span>
                  <span className="font-bold text-slate-800">홍길동</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">지원 트랙</span>
                  <span className="font-bold text-blue-600">
                    {CATEGORY_META[previewTrack].label}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">이메일</span>
                  <span className="font-mono text-slate-800">gildong@univ.ac.kr</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">전화번호</span>
                  <span className="font-mono text-slate-800">010-1234-5678</span>
                </div>
              </div>
            </div>

            {/* Dynamic Application Questions List */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-slate-700">
                2. 자기소개 및 전공 역량 문항 ({previewQuestions.length}문항)
              </h3>

              {questionsState.questions === null && questionsState.isLoading && (
                <p className="text-xs text-slate-500">문항을 불러오는 중입니다.</p>
              )}
              {questionsState.questions !== null && previewQuestions.length === 0 && (
                <p className="text-xs text-slate-500">등록된 문항이 없습니다.</p>
              )}
              {previewQuestions.map((q, idx) => {
                const meta = CATEGORY_META[q.category];
                return (
                  <div
                    key={q.question_id}
                    className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold border"
                          style={{
                            background: meta.bg,
                            color: meta.color,
                            borderColor: meta.border,
                          }}
                        >
                          {meta.short}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          Q{idx + 1}. {q.label}
                        </span>
                        {q.is_required && <span className="text-red-500 font-bold text-xs">*</span>}
                      </div>
                      {q.type === 'TEXT' && (
                        <span className="text-xs text-slate-400 font-mono">
                          0 / {q.limit_length}자
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {q.content}
                    </p>

                    {q.type === 'TABLE' ? (
                      <div className="space-y-2 overflow-x-auto">
                        <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden bg-white">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-semibold">
                              <th className="text-left px-3 py-2.5 border-r border-slate-200 w-44 bg-slate-200/60">
                                구분 / 항목
                              </th>
                              {q.metadata?.columns?.map((c, i) => (
                                <th
                                  key={i}
                                  className="text-left px-3 py-2.5 border-r border-slate-200 last:border-r-0"
                                >
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-mono">
                            {(q.metadata?.rows && q.metadata.rows.length > 0
                              ? q.metadata.rows
                              : ['항목 1']
                            ).map((rowLabel, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50/70">
                                <td className="px-3 py-2 border-r border-slate-200 bg-slate-50 font-bold text-slate-800 text-[11px] font-sans">
                                  {rowLabel}
                                </td>
                                {q.metadata?.columns?.map((_, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="px-3 py-2 border-r border-slate-200 last:border-r-0"
                                  >
                                    <input
                                      placeholder="내용 입력..."
                                      className="w-full px-2 py-1 rounded bg-slate-50/50 border border-slate-200 outline-none text-xs text-slate-900 focus:bg-white focus:border-blue-500 transition-colors"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <textarea
                        rows={4}
                        placeholder="답변을 작성해 주세요..."
                        className="w-full p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 outline-none focus:border-blue-500 transition-colors"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <button className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">
                임시 저장 (DRAFT)
              </button>
              <button className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer shadow-xs">
                지원서 최종 제출 (SUBMITTED)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: 지원서 CSV 추출 (CSV Download) ─── */}
      {activeTab === 'csv' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">지원서 CSV 추출</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              기수 및 트랙별 지원서 데이터를 UTF-8 BOM 엑셀 호환 CSV 형식으로 브라우저에서 즉시
              다운로드합니다.
            </p>
          </div>

          {downloadSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 shadow-2xs">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'] as TrackType[]).map((track) => {
              const meta = CATEGORY_META[track];
              const applicants = INITIAL_LOCAL_APPLICANTS.filter(
                (a) => a.track === track && a.term === csvTerm,
              );
              return (
                <div
                  key={track}
                  className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4 hover:border-slate-300 transition-all"
                >
                  <div className="space-y-1">
                    <span
                      className="px-2.5 py-0.5 rounded-md text-xs font-bold border"
                      style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}
                    >
                      {meta.label}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-2">
                      {meta.short} 트랙 지원서
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      제{csvTerm}기 지원자: {applicants.length}명
                    </p>
                  </div>

                  <button
                    onClick={() => handleDownloadTrackCsv(track)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all hover:opacity-95 active:scale-[0.98]"
                    style={{ background: meta.color }}
                  >
                    <Download size={14} />
                    <span>{meta.short} 트랙 CSV 즉시 받기</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <NotificationsTab recruitments={recruitmentsState.recruitments} onToast={showToast} />
      )}
    </div>
  );
}
