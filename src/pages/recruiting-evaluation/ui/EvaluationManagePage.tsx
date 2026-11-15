import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileCheck2,
  FileText,
  RefreshCw,
  Shield,
  User,
  UserCheck,
  X,
} from 'lucide-react';

import { registerLeaveGuard } from '@/shared/lib/leaveGuard';
import { Toast, type ToastMessage } from '@/shared/ui/Toast';

import {
  DEFAULT_REVIEW_QUERY,
  filterReviewList,
  type ReviewListQuery,
} from '../model/applicantList';
import {
  draftFromMyEvaluation,
  EMPTY_DRAFT,
  isDraftChanged,
  type MyEvaluationDraft,
  saveFailureNoticeOf,
  toSaveInput,
  UNSAVED_EVALUATION_MESSAGE,
  validateMyEvaluation,
} from '../model/myEvaluationForm';
import { FINAL_DECISION_SAVED_MESSAGE, finalDecisionFailureNoticeOf } from '../model/finalDecision';
import type { ApplicantEvaluationDto, EvaluationDecision, EvaluationTab } from '../model/types';
import { useEvaluationData } from '../model/useEvaluationData';
import { useFinalDecisionPermission } from '../model/useFinalDecisionPermission';
import { ApplicantReviewDetail, type ReviewDetailTab } from './ApplicantReviewDetail';
import { ApplicantsOverview } from './ApplicantsOverview';
import { MyEvaluationList } from './MyEvaluationList';
import { SegmentedTabs } from './SegmentedTabs';

interface EvaluationManagePageProps {
  initialTab?: EvaluationTab;
  /** 상단 탭을 누르면 사이드바 선택도 같은 메뉴로 맞춘다. */
  onTabChange?: (tab: EvaluationTab) => void;
}

/** 서류 평가 탭 3개를 같은 데이터로 그린다. 데이터 접근은 useEvaluationData Hook만 거친다. */
export function EvaluationManagePage({
  initialTab = 'applicants',
  onTabChange,
}: EvaluationManagePageProps) {
  const [mainTab, setMainTab] = useState<EvaluationTab>(initialTab);

  const {
    applicants,
    currentEvaluatorId,
    fetchApplicants,
    fetchAnswers,
    fetchEvaluations,
    fetchInterviewQuestions,
    fetchMyEvaluation,
    saveMyEvaluation,
    updateFinalDecision,
    promoteUsers,
  } = useEvaluationData();
  const canWriteFinalDecision = useFinalDecisionPermission();

  // 서류 평가 목록의 검색·필터·정렬. 상세에서 목록으로 돌아와도 남도록 여기서 가진다.
  const [reviewQuery, setReviewQuery] = useState<ReviewListQuery>(DEFAULT_REVIEW_QUERY);

  // 지원자 상세와 그 탭. 탭은 이전·다음으로 다른 지원자를 열어도 유지한다.
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantEvaluationDto | null>(null);
  const [modalTab, setModalTab] = useState<ReviewDetailTab>('review');

  // 내 평가 입력 초안과 마지막으로 불러오거나 저장한 값. 둘이 다르면 저장하지 않은 수정이 있다.
  // 내 평가가 없으면 빈 폼이다(명세 §4.4, 판정·점수 기본값 없음).
  const [draft, setDraft] = useState<MyEvaluationDraft>(EMPTY_DRAFT);
  const [savedDraft, setSavedDraft] = useState<MyEvaluationDraft>(EMPTY_DRAFT);
  // 저장을 한 번 눌러 검증에 걸린 뒤부터 필드 오류를 보여 준다(§7.4).
  const [showDraftErrors, setShowDraftErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const isDraftDirty = selectedApplicant !== null && isDraftChanged(draft, savedDraft);
  const draftErrors = showDraftErrors ? validateMyEvaluation(draft) : {};
  // 내 평가(REC-ADMIN-16)를 읽는 중인지와 실패 오류. 늦게 온 옛 응답은 openRequestRef로 버린다.
  const [isMyEvaluationLoading, setIsMyEvaluationLoading] = useState(false);
  const [myEvaluationError, setMyEvaluationError] = useState<Error | null>(null);
  const openRequestRef = useRef(0);
  // 평가 화면의 이전·다음 이동 순서(지원서 id). 화면을 연 목록의 필터·정렬 순서를 따른다.
  const [reviewQueue, setReviewQueue] = useState<number[]>([]);

  // Promotions Tab Selection State (UserAdminController: PATCH /api/v1/admin/users/promote)
  const [selectedPromoteUserIds, setSelectedPromoteUserIds] = useState<number[]>([]);
  const [showPromoteConfirmModal, setShowPromoteConfirmModal] = useState(false);
  const [promoteCheck1, setPromoteCheck1] = useState(false);
  const [promoteCheck2, setPromoteCheck2] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [, setPromoteResult] = useState<{
    successCount: number;
    failedList: { user_id: number; error_code: string }[];
  } | null>(null);

  useEffect(() => {
    if (initialTab) {
      setMainTab(initialTab);
    }
  }, [initialTab]);

  function handleTabChange(tab: EvaluationTab) {
    setMainTab(tab);
    onTabChange?.(tab);
  }

  // 저장하지 않은 평가가 있으면 사이드바로 다른 메뉴에 갈 때도 묻는다(§4.5).
  useEffect(
    () =>
      isDraftDirty
        ? registerLeaveGuard(() => window.confirm(UNSAVED_EVALUATION_MESSAGE))
        : undefined,
    [isDraftDirty],
  );

  /** 저장하지 않은 평가가 없거나, 있어도 버리고 옮기기로 했는지. 취소하면 입력은 그대로 남는다. */
  const canDiscardDraft = () => !isDraftDirty || window.confirm(UNSAVED_EVALUATION_MESSAGE);

  const showToast = (message: string, tone: ToastMessage['tone']) =>
    setToast({ id: Date.now(), message, tone });

  // List of Passed Candidates for Promotion Tab (UserAdminController)
  const passedCandidates = useMemo(() => {
    return applicants.filter((a) => a.final_decision === 'PASS');
  }, [applicants]);

  const unpromotedPassedCandidates = useMemo(() => {
    return passedCandidates.filter((a) => !a.is_promoted_to_member);
  }, [passedCandidates]);

  // 평가 화면을 열고 내 평가(REC-ADMIN-16)를 읽어 폼을 채운다. 없으면(null) 빈 폼으로 둔다.
  async function handleOpenModal(
    app: ApplicantEvaluationDto,
    tab: ReviewDetailTab,
    queueIds: number[],
  ) {
    const requestId = ++openRequestRef.current;
    setSelectedApplicant(app);
    setModalTab(tab);
    setReviewQueue(queueIds);
    setDraft(EMPTY_DRAFT);
    setSavedDraft(EMPTY_DRAFT);
    setShowDraftErrors(false);
    setMyEvaluationError(null);
    setIsMyEvaluationLoading(true);
    try {
      const loaded = draftFromMyEvaluation(await fetchMyEvaluation(app.id));
      if (requestId !== openRequestRef.current) return;
      setDraft(loaded);
      setSavedDraft(loaded);
    } catch (error) {
      if (requestId !== openRequestRef.current) return;
      setMyEvaluationError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      if (requestId === openRequestRef.current) setIsMyEvaluationLoading(false);
    }
  }

  // 서류 평가 목록에서 지원자를 고르면 그 목록 순서로 평가 화면을 연다.
  function handleOpenFromMyList(applicantId: number, orderedIds: number[]) {
    const app = applicants.find((item) => item.id === applicantId);
    if (app) void handleOpenModal(app, 'review', orderedIds);
  }

  // 전체 지원 현황 상세의 "평가하기": 서류 평가 탭으로 옮기고 그 지원자의 평가 화면을 연다.
  function handleEvaluateFromOverview(applicantId: number) {
    const app = applicants.find((item) => item.id === applicantId);
    if (!app || app.status !== 'SUBMITTED') return;
    handleTabChange('my');
    // 이전·다음은 서류 평가 목록의 기본 순서(제출 완료, 제출일 최신순)를 따른다.
    const defaultOrder = filterReviewList(applicants, DEFAULT_REVIEW_QUERY).map((item) => item.id);
    void handleOpenModal(app, 'review', defaultOrder);
  }

  // 평가 화면의 이전·다음 이동. 화면을 연 목록 순서(reviewQueue)를 끝에서 처음으로 돌아가며 따른다.
  function handleNavigateModal(direction: 'PREV' | 'NEXT') {
    if (!selectedApplicant) {
      return;
    }
    const curIdx = reviewQueue.indexOf(selectedApplicant.id);
    if (curIdx === -1) {
      return;
    }
    const step = direction === 'PREV' ? -1 : 1;
    const nextId = reviewQueue[(curIdx + step + reviewQueue.length) % reviewQueue.length];
    const nextApp = applicants.find((item) => item.id === nextId);
    if (nextApp && canDiscardDraft()) void handleOpenModal(nextApp, modalTab, reviewQueue);
  }

  // 평가 화면에서 목록으로 돌아간다. 저장하지 않은 평가가 있으면 먼저 묻는다.
  function handleBackToList() {
    if (canDiscardDraft()) setSelectedApplicant(null);
  }

  // 개인 평가 저장(MY-07). 검증 → 저장 → 결과 안내 순서이고, 실패해도 입력은 그대로 둔다(§4.5).
  // 데이터 변경은 Hook(saveMyEvaluation)이 맡고, 여기서는 화면 상태와 안내만 다룬다.
  async function handleSaveMyEvaluation() {
    if (!selectedApplicant || isSaving) {
      return;
    }
    const input = toSaveInput(draft);
    if (!input || Object.keys(validateMyEvaluation(draft)).length > 0) {
      setShowDraftErrors(true);
      return;
    }
    const applicant = selectedApplicant;
    setIsSaving(true);
    try {
      const updatedApplicant = await saveMyEvaluation(applicant, input);
      setSelectedApplicant(updatedApplicant);
      setSavedDraft(draft);
      setShowDraftErrors(false);
      showToast('평가가 저장되었습니다.', 'success');
    } catch (error) {
      const notice = saveFailureNoticeOf(error, applicant.status);
      if (notice.display === 'modal') {
        // shortcut: 오류 안내 창을 브라우저 기본 알림으로 띄운다, 공통 확인 창(PLT-CONFIRM)이 생기면 바꾼다
        window.alert(notice.message);
      } else {
        showToast(notice.message, 'error');
      }
      if (notice.leave) setSelectedApplicant(null);
    } finally {
      setIsSaving(false);
    }
  }

  // 지원자별 최종 판정 저장(GROUP-08). 데이터 변경은 Hook이 맡고, 여기서는 결과 안내만 한다.
  async function handleSaveFinalDecision(
    applicant: ApplicantEvaluationDto,
    decision: EvaluationDecision,
  ): Promise<boolean> {
    try {
      await updateFinalDecision(applicant.id, decision);
      showToast(FINAL_DECISION_SAVED_MESSAGE, 'success');
      return true;
    } catch (error) {
      const notice = finalDecisionFailureNoticeOf(error, applicant.status);
      if (notice.display === 'modal') {
        // shortcut: 오류 안내 창을 브라우저 기본 알림으로 띄운다, 공통 확인 창(PLT-CONFIRM)이 생기면 바꾼다
        window.alert(notice.message);
      } else {
        showToast(notice.message, 'error');
      }
      return false;
    }
  }

  // Promotion Selection Handlers (PATCH /api/v1/admin/users/promote)
  function handleTogglePromoteSelect(userId: number) {
    setSelectedPromoteUserIds((prev) =>
      prev.includes(userId) ? prev.filter((item) => item !== userId) : [...prev, userId],
    );
  }

  function handleSelectAllPromote() {
    if (selectedPromoteUserIds.length === unpromotedPassedCandidates.length) {
      setSelectedPromoteUserIds([]);
    } else {
      setSelectedPromoteUserIds(unpromotedPassedCandidates.map((c) => c.user_id));
    }
  }

  function handleOpenPromoteModal() {
    if (selectedPromoteUserIds.length === 0) {
      alert('승격할 합격자를 최소 1명 이상 선택해 주세요.');
      return;
    }
    setPromoteCheck1(false);
    setPromoteCheck2(false);
    setPromoteResult(null);
    setShowPromoteConfirmModal(true);
  }

  // 승격 실행. 데이터 변경은 Hook(promoteUsers)이 맡고, 여기서는 창 상태와 결과 안내만 다룬다.
  async function handleExecutePromotion() {
    if (!promoteCheck1 || !promoteCheck2) {
      return;
    }
    setIsPromoting(true);
    const result = await promoteUsers(selectedPromoteUserIds);
    setIsPromoting(false);
    setShowPromoteConfirmModal(false);
    setSelectedPromoteUserIds([]);
    alert(
      `정회원 승격 처리가 완료되었습니다.\n` +
        `• 승격 완료: ${result.successUserIds.length}명\n` +
        `• 실패 건수: ${result.failedList.length}건`,
    );
  }

  const toastNode = <Toast toast={toast} onClose={() => setToast(null)} />;

  if (selectedApplicant)
    return (
      <>
        <ApplicantReviewDetail
          applicant={selectedApplicant}
          currentEvaluatorId={currentEvaluatorId}
          tab={modalTab}
          onTabChange={setModalTab}
          fetchAnswers={fetchAnswers}
          fetchEvaluations={fetchEvaluations}
          fetchInterviewQuestions={fetchInterviewQuestions}
          onNotify={showToast}
          isMyEvaluationLoading={isMyEvaluationLoading}
          myEvaluationError={myEvaluationError}
          onRetryMyEvaluation={() => void handleOpenModal(selectedApplicant, modalTab, reviewQueue)}
          decision={draft.decision}
          score={draft.score}
          memo={draft.memo}
          interview={draft.interview_question}
          errors={draftErrors}
          saving={isSaving}
          onDecision={(decision) => setDraft((current) => ({ ...current, decision }))}
          onScore={(score) => setDraft((current) => ({ ...current, score }))}
          onMemo={(memo) => setDraft((current) => ({ ...current, memo }))}
          onInterview={(interview_question) =>
            setDraft((current) => ({ ...current, interview_question }))
          }
          onSave={handleSaveMyEvaluation}
          onBack={handleBackToList}
          onNavigate={handleNavigateModal}
          position={reviewQueue.indexOf(selectedApplicant.id) + 1}
          total={reviewQueue.length}
        />
        {toastNode}
      </>
    );
  return (
    <div className="evaluation-page space-y-4">
      {toastNode}
      {/* ─── Top Main Header Bar ─── */}
      <div className="evaluation-header flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#3b82f6] text-white flex items-center justify-center shadow-md">
              <FileText size={18} />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">서류 평가</h1>
            </div>
          </div>

          {/* 사이드바 메뉴 3개와 같은 순서 */}
          <SegmentedTabs
            label="서류 평가 화면"
            value={mainTab}
            onChange={handleTabChange}
            items={[
              { id: 'applicants', label: '전체 지원 현황', icon: FileText },
              { id: 'my', label: '서류 평가', icon: FileCheck2 },
              {
                id: 'promotions',
                label: `합격자 승격 (${unpromotedPassedCandidates.length}명)`,
                icon: UserCheck,
              },
            ]}
          />
        </div>

        {/* Right Info: Track Filter & Logged-In User Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-emerald-400">문혁준 로그인됨</span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {mainTab === 'promotions' ? '(서비스운영팀 팀장 권한)' : '(엔지니어링 평가자)'}
            </span>
          </div>
        </div>
      </div>

      {mainTab === 'applicants' && (
        <ApplicantsOverview
          fetchApplicants={fetchApplicants}
          fetchAnswers={fetchAnswers}
          onEvaluate={handleEvaluateFromOverview}
        />
      )}

      {mainTab === 'my' && (
        <MyEvaluationList
          fetchApplicants={fetchApplicants}
          query={reviewQuery}
          onQueryChange={setReviewQuery}
          onOpen={handleOpenFromMyList}
          canWriteFinalDecision={canWriteFinalDecision}
          onSaveFinalDecision={handleSaveFinalDecision}
        />
      )}

      {/* ─── TAB 3: 합격자 정회원 승격 전용 탭 (UserAdminController: PATCH /api/v1/admin/users/promote) ─── */}
      {mainTab === 'promotions' && (
        <div className="space-y-4">
          {/* Promotion Header Banner */}
          <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.03] space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <UserCheck size={18} className="text-emerald-400" />
                  <span>최종 합격자 정회원(MEMBER) 승격 관리</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  프론트엔드에서 합격자(PASS)를 선택하여{' '}
                  <code className="text-foreground font-mono">user_ids</code> 목록을 전송하면,
                  서버가 각 유저의 최신 SUBMITTED 지원서에서{' '}
                  <strong>이름/전화번호/대학교/전공</strong>을 User 엔티티로 복사하고{' '}
                  <code className="text-[#34d399] font-mono">memberType=MEMBER</code>로 일괄
                  승격합니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllPromote}
                  disabled={unpromotedPassedCandidates.length === 0}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-100 text-foreground border border-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <CheckSquare size={13} />
                  <span>
                    {selectedPromoteUserIds.length === unpromotedPassedCandidates.length &&
                    unpromotedPassedCandidates.length > 0
                      ? '선택 해제'
                      : '승격 대상 전체 선택'}
                  </span>
                </button>

                <button
                  onClick={handleOpenPromoteModal}
                  disabled={selectedPromoteUserIds.length === 0}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  <Award size={14} />
                  <span>선택한 {selectedPromoteUserIds.length}명 정회원 승격 실행 (PATCH)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-muted-foreground text-[11px]">최종 합격자 (PASS)</p>
                <p className="text-foreground font-bold font-mono text-base">
                  {passedCandidates.length}명
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-muted-foreground text-[11px]">승격 대기 인원</p>
                <p className="text-amber-400 font-bold font-mono text-base">
                  {unpromotedPassedCandidates.length}명
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-muted-foreground text-[11px]">정회원 승격 완료 (MEMBER)</p>
                <p className="text-emerald-400 font-bold font-mono text-base">
                  {passedCandidates.filter((c) => c.is_promoted_to_member).length}명
                </p>
              </div>
            </div>
          </div>

          {/* Members Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <Shield size={13} className="text-[#34d399]" />
                <span>PATCH /api/v1/admin/users/promote (개별 트랜잭션 부분 성공 허용)</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                평가 점수는 노출되지 않으며 회원 정보만 안전하게 조회됩니다.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-muted-foreground font-semibold whitespace-nowrap">
                    <th className="text-center px-4 py-3.5 w-12">선택</th>
                    <th className="text-left px-4 py-3.5 w-20">User ID</th>
                    <th className="text-left px-5 py-3.5">지원자 성명</th>
                    <th className="text-left px-4 py-3.5">합격 부문</th>
                    <th className="text-left px-4 py-3.5">이메일 주소 (계정 ID)</th>
                    <th className="text-left px-4 py-3.5">연락처</th>
                    <th className="text-left px-4 py-3.5">대학교 / 본전공</th>
                    <th className="text-center px-4 py-3.5">계정 상태 & 권한</th>
                    <th className="text-right px-5 py-3.5">승격 상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {passedCandidates.map((candidate) => {
                    const isSelected = selectedPromoteUserIds.includes(candidate.user_id);
                    const isPromoted = candidate.is_promoted_to_member;

                    return (
                      <tr
                        key={candidate.id}
                        onClick={() => !isPromoted && handleTogglePromoteSelect(candidate.user_id)}
                        className={`transition-colors ${isPromoted ? 'opacity-60 bg-white/[0.01]' : 'hover:bg-slate-50 cursor-pointer'}`}
                      >
                        {/* Checkbox */}
                        <td
                          className="text-center px-4 py-3.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected || !!isPromoted}
                            disabled={!!isPromoted}
                            onChange={() => handleTogglePromoteSelect(candidate.user_id)}
                            className="rounded accent-emerald-500 w-4 h-4 cursor-pointer disabled:opacity-40"
                          />
                        </td>

                        {/* User ID */}
                        <td className="px-4 py-3.5 font-bold text-[#8ba5ff]">
                          #{candidate.user_id}
                        </td>

                        {/* Name */}
                        <td className="px-5 py-3.5 font-sans font-bold text-foreground">
                          {candidate.name}
                        </td>

                        {/* Track */}
                        <td className="px-4 py-3.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            {candidate.track}
                          </span>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3.5 text-muted-foreground font-sans">
                          {candidate.email}
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-3.5 text-muted-foreground">{candidate.phone}</td>

                        {/* Univ / Major */}
                        <td className="px-4 py-3.5 font-sans text-muted-foreground">
                          <p className="text-foreground">{candidate.university}</p>
                          <p className="text-[11px] text-muted-foreground">{candidate.major}</p>
                        </td>

                        {/* Role Status */}
                        <td className="px-4 py-3.5 text-center font-sans">
                          {isPromoted ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold text-[11px] border border-emerald-500/30 flex items-center justify-center gap-1">
                              <Shield size={11} />
                              <span>정회원 (MEMBER)</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-muted-foreground text-[11px] border border-slate-200 flex items-center justify-center gap-1">
                              <User size={11} />
                              <span>지원자 (APPLICANT)</span>
                            </span>
                          )}
                        </td>

                        {/* Promotion Action */}
                        <td className="px-5 py-3.5 text-right font-sans">
                          {isPromoted ? (
                            <span className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-1">
                              <CheckCircle2 size={13} /> 승격 완료됨
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-400 flex items-center justify-end gap-1">
                              <Clock size={13} /> 승격 대기중
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 합격자 정회원 승격 최종 확인 모달 (PATCH /api/v1/admin/users/promote) ─── */}
      {showPromoteConfirmModal && (
        <div className="fixed inset-0 bg-black/85 z-80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <UserCheck size={18} />
                <h3 className="text-base font-bold text-foreground">
                  정회원(MEMBER) 승격 최종 확인
                </h3>
              </div>
              <button
                onClick={() => setShowPromoteConfirmModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-foreground flex items-center justify-between">
                <span>승격 실행 대상 user_ids 목록 ({selectedPromoteUserIds.length}명)</span>
                <span className="text-[#34d399] font-mono font-bold">PATCH /users/promote</span>
              </p>

              <div className="max-h-40 overflow-y-auto rounded-xl bg-slate-100 border border-slate-200 p-3 space-y-2 divide-y divide-white/5">
                {passedCandidates
                  .filter((c) => selectedPromoteUserIds.includes(c.user_id))
                  .map((app) => (
                    <div
                      key={app.id}
                      className="pt-2 first:pt-0 flex items-center justify-between font-mono text-[11px]"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-foreground font-sans">
                          <span className="text-[#8ba5ff] mr-1.5">User #{app.user_id}</span>
                          {app.name} ({app.university} · {app.major})
                        </p>
                        <p className="text-muted-foreground">{app.email}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                        {app.track}
                      </span>
                    </div>
                  ))}
              </div>

              {/* JSON Request Body Preview */}
              <div className="p-2.5 rounded-xl bg-black/50 border border-slate-100 font-mono text-[11px]">
                <span className="text-muted-foreground">Request Body: </span>
                <code className="text-[#34d399] font-bold">
                  {JSON.stringify({ user_ids: selectedPromoteUserIds })}
                </code>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoteCheck1}
                  onChange={(e) => setPromoteCheck1(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-foreground leading-relaxed">
                  대표진 면접 및 최종 선발 회의를 거쳐{' '}
                  <strong>합격(PASS)이 최종 확정된 명단</strong>임을 확인했습니다.
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoteCheck2}
                  onChange={(e) => setPromoteCheck2(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-foreground leading-relaxed">
                  승격 시 서버가 각 유저의 최신 SUBMITTED 지원서에서 이름/전화번호/대학/전공을 User
                  엔티티로 복사하고 <strong>memberType=MEMBER로 변경</strong>합니다. (개별 트랜잭션
                  부분 성공 허용)
                </span>
              </label>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-200">
              <span className="text-[11px] font-mono text-muted-foreground">
                PATCH /api/v1/admin/users/promote
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPromoteConfirmModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-100 cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={handleExecutePromotion}
                  disabled={!promoteCheck1 || !promoteCheck2 || isPromoting}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  {isPromoting ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>정회원 일괄 승격 실행</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
