import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  LogOut,
  Megaphone,
  Search,
  Settings,
  X,
} from 'lucide-react';

import type { UserRole } from '@/entities/user/model/types';
import type { ActivePage } from '@/shared/config/activePage';

const SIDEBAR_NAV = [
  {
    id: 'content',
    label: '콘텐츠 관리',
    icon: BookOpen,
    permission: 'CONTENT_MANAGE',
    groups: [
      {
        title: '아카이브',
        pages: [
          { id: 'content-archive', label: '아카이빙 (프로젝트·블로그·사진)' },
          { id: 'content-reviews', label: '수료자 후기 관리' },
        ],
      },
      {
        title: '소개 및 안내',
        pages: [
          { id: 'content-curriculum', label: '커리큘럼 관리' },
          { id: 'content-faq', label: '자주 묻는 질문 (FAQ)' },
        ],
      },
    ],
  },
  {
    id: 'recruiting',
    label: '리크루팅 공고',
    icon: Megaphone,
    permission: 'RECRUITMENT_MANAGE',
    groups: [
      {
        title: '공고 및 문항',
        pages: [
          { id: 'recruiting-posts', label: '모집 공고 관리' },
          { id: 'recruiting-questions', label: '지원서 문항 설정' },
          { id: 'recruiting-preview', label: '지원자 화면 미리보기' },
        ],
      },
      {
        title: '지원자 데이터',
        pages: [
          { id: 'recruiting-csv', label: '지원서 CSV 추출' },
          { id: 'recruiting-leads', label: '사전 알림 명단' },
        ],
      },
    ],
  },
  {
    id: 'evaluation',
    label: '서류 평가',
    icon: FileText,
    permission: 'EVALUATION',
    groups: [
      {
        title: '서류 심사',
        pages: [
          { id: 'evaluation-evals', label: '서류 평가 대시보드 (SUBMITTED)' },
          { id: 'evaluation-applicants', label: '전체 지원자 현황 (DRAFT 포함)' },
        ],
      },
      {
        title: '합격 및 승격',
        pages: [{ id: 'evaluation-promote', label: '최종 합불 & 정회원 승격' }],
      },
    ],
  },
  {
    id: 'attendance',
    label: '출결 & 점수 시스템',
    icon: ClipboardList,
    permission: 'ATTENDANCE_*',
    groups: [
      {
        title: '출결 관리',
        pages: [
          { id: 'att-session', label: 'BASE Term 출결 관리' },
          { id: 'att-adv', label: 'ADV Term 출결 관리' },
          { id: 'att-study', label: '스터디 출결 관리' },
          { id: 'att-events', label: '행사 출결 관리' },
          { id: 'att-scores', label: '출결 점수 집계' },
        ],
      },
      {
        title: '출결 입력',
        pages: [
          { id: 'att-input-adv', label: 'ADV 입력 및 증빙 (팀장용)' },
          { id: 'att-input-study', label: '스터디 입력 및 증빙 (팀장용)' },
        ],
      },
      {
        title: '설정',
        pages: [
          { id: 'att-hosts', label: 'HOST 계정·팀 연결 (ID/PW 발급)' },
          { id: 'att-rules', label: '점수 규칙' },
        ],
      },
    ],
  },
  {
    id: 'system',
    label: '시스템·계정',
    icon: Settings,
    permission: 'ACCOUNT_MANAGE',
    groups: [
      {
        title: '계정 및 권한',
        pages: [
          { id: 'system-accounts', label: '운영진 계정 관리 (CRUD)' },
          { id: 'system-permissions', label: '권한 매트릭스 (10대 Permission)' },
        ],
      },
      {
        title: '보안',
        pages: [{ id: 'system-audit', label: '보안 감사 로그' }],
      },
    ],
  },
];

export function Sidebar({
  activePage,
  onChange,
  open,
  onClose,
  currentRole,
  onToggleRole: _onToggleRole,
  onOpenLogin,
  loggedHostTeam,
  loggedUsername,
}: {
  activePage: ActivePage;
  onChange: (p: ActivePage) => void;
  open: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onToggleRole: () => void;
  onOpenLogin: () => void;
  loggedHostTeam?: string;
  loggedUsername?: string;
}) {
  const [expanded, setExpanded] = useState<string>('recruiting');
  const [navSearch, setNavSearch] = useState('');

  const filteredNav = SIDEBAR_NAV.filter((section) => {
    if (!navSearch.trim()) {
      return true;
    }
    const q = navSearch.toLowerCase();
    const allPages = section.groups.flatMap((g) => g.pages);
    return (
      section.label.toLowerCase().includes(q) ||
      allPages.some((p) => p.label.toLowerCase().includes(q))
    );
  });

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-20 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full z-30 w-72 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto bg-white border-r border-slate-200/80 shadow-[0_0_15px_rgba(0,0,0,0.03)] ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ fontFamily: "'Pretendard', 'Noto Sans KR', -apple-system, sans-serif" }}
      >
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-black text-base shadow-md shadow-blue-500/20 tracking-tighter">
              B
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-slate-900 tracking-tight">
                  BOAZ Console
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-blue-50 text-blue-600 border border-blue-200/60">
                  v28
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">빅데이터 동아리 관리 시스템</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Toolbar */}
        <div className="px-4 pt-3.5 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              placeholder="메뉴 및 기능 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200/80 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-2xs font-medium"
            />
            {navSearch && (
              <button
                onClick={() => setNavSearch('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation List */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {filteredNav.map((section, _sIdx) => {
            const Icon = section.icon;
            const isExpanded = expanded === section.id || navSearch.trim().length > 0;
            const isSelected =
              activePage.startsWith(section.id) ||
              (section.id === 'attendance' && activePage.startsWith('att-'));
            const isSystem = section.id === 'system';

            return (
              <div key={section.id} className="space-y-1">
                {/* System Section Divider */}
                {isSystem && (
                  <div className="pt-3 mt-3.5 mb-1.5 border-t border-slate-200/80">
                    <p className="px-3 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                      시스템 설정
                    </p>
                  </div>
                )}

                {/* Top-level Category Button */}
                <button
                  onClick={() => {
                    setExpanded(isExpanded && !navSearch ? '' : section.id);
                    if (section.id === 'recruiting') {
                      onChange('recruiting-posts');
                    }
                    if (section.id === 'evaluation') {
                      onChange('evaluation-evals');
                    }
                    if (section.id === 'attendance') {
                      onChange('att-session');
                    }
                    if (section.id === 'content') {
                      onChange('content-archive');
                    }
                    if (section.id === 'system') {
                      onChange('system-accounts');
                    }
                  }}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-all cursor-pointer group ${
                    isSelected
                      ? 'bg-blue-50/90 text-blue-900 font-bold shadow-2xs'
                      : 'text-slate-800 hover:bg-slate-100/70 hover:text-slate-950 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      size={15}
                      strokeWidth={isSelected ? 2.2 : 1.8}
                      className={`shrink-0 transition-colors ${
                        isSelected ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-800'
                      }`}
                    />
                    <span className="text-[12.5px] font-bold tracking-tight truncate">
                      {section.label}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown
                      size={14}
                      className={isSelected ? 'text-blue-600' : 'text-slate-400'}
                    />
                  ) : (
                    <ChevronRight size={14} className="text-slate-400" />
                  )}
                </button>

                {/* Expanded Submenu */}
                {isExpanded && (
                  <div className="ml-2 pt-1 pb-2.5 mb-1 space-y-3 border-b border-slate-100">
                    {section.groups.map((grp, gIdx) => (
                      <div key={gIdx} className="space-y-1">
                        {grp.title && (
                          <div className="text-[11.5px] font-bold text-slate-800 px-2 pt-1 pb-0.5 tracking-tight flex items-center justify-between">
                            <span>{grp.title}</span>
                          </div>
                        )}
                        <div className="ml-2.5 pl-2.5 border-l-2 border-slate-100 space-y-0.5">
                          {grp.pages.map((page) => {
                            const isActive = activePage === page.id;
                            return (
                              <button
                                key={page.id}
                                onClick={() => {
                                  onChange(page.id as ActivePage);
                                  onClose();
                                }}
                                className={`flex items-center w-full px-2.5 py-1.5 rounded-lg text-left text-xs transition-all cursor-pointer ${
                                  isActive
                                    ? 'bg-blue-600 text-white shadow-xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                                }`}
                              >
                                <span className="truncate">{page.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {/* User Footer Card */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shadow-2xs text-white bg-slate-900">
              {currentRole === 'SUPER'
                ? '대표'
                : currentRole === 'CONTENT_ADMIN'
                  ? '운영'
                  : currentRole === 'HOST'
                    ? '팀장'
                    : '지원'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">
                {currentRole === 'SUPER'
                  ? '차기대표진 (SUPER)'
                  : currentRole === 'CONTENT_ADMIN'
                    ? '서비스운영팀'
                    : currentRole === 'HOST'
                      ? `${loggedHostTeam || 'A팀'} (${loggedUsername || 'host_a'})`
                      : '운영지원팀 (admin)'}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {currentRole === 'SUPER'
                  ? '전 부문 총괄 승격 권한'
                  : currentRole === 'CONTENT_ADMIN'
                    ? '콘텐츠 관리 권한'
                    : currentRole === 'HOST'
                      ? '출결 입력 권한'
                      : '출결 관리/승인 권한'}
              </p>
            </div>
            <button
              onClick={onOpenLogin}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              title="로그아웃 / 계정 변경"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
