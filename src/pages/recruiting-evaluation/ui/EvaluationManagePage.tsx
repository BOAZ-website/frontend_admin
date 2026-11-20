import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  CheckSquare,
  Clock,
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
import {
  type ApplicantEvaluationDto,
  type EvaluationDecision,
  type EvaluationTab,
  TRACK_LABELS,
  type TrackType,
} from '../model/types';
import { useEvaluationData } from '../model/useEvaluationData';
import { useFinalDecisionPermission } from '../model/useFinalDecisionPermission';
import { ApplicantReviewDetail, type ReviewDetailTab } from './ApplicantReviewDetail';
import { ApplicantsOverview } from './ApplicantsOverview';
import { MyEvaluationList } from './MyEvaluationList';

/** 제목은 사이드바 메뉴 이름(PAGE_LABELS)과 같다. */
const MAIN_TAB_TITLES: Record<EvaluationTab, string> = {
  applicants: '전체 지원 현황',
  my: '서류 평가',
  promotions: '합격자 승격',
};

interface EvaluationManagePageProps {
  initialTab?: EvaluationTab;
  /** 서류 평가 목록(my)이 보여 줄 부문. 사이드바의 부문 메뉴가 정한다. */
  track: TrackType;
  /** 그 부문의 서류 평가 메뉴로 옮긴다(전체 지원 현황의 "평가하기"). */
  onOpenTrack: (track: TrackType) => void;
  /** 사이드바 메뉴를 누를 때마다 바뀐다. 바뀌면 지원자 상세를 닫고 목록으로 돌아간다. */
  listRequest?: number;
}

/** 서류 평가 탭 3개를 같은 데이터로 그린다. 데이터 접근은 useEvaluationData Hook만 거친다. */
export function EvaluationManagePage({
  initialTab = 'applicants',
  track,
  onOpenTrack,
  listRequest = 0,
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

  // 부문별 서류 평가 목록의 검색·필터·정렬. 상세에서 목록으로 돌아오거나 다른 부문에 다녀와도 남도록 여기서 가진다.
  const [reviewQueries, setReviewQueries] = useState<Record<TrackType, ReviewListQuery>>({
    ANALYSIS: DEFAULT_REVIEW_QUERY,
    VISUALIZATION: DEFAULT_REVIEW_QUERY,
    ENGINEERING: DEFAULT_REVIEW_QUERY,
  });

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
  // 내 평가를 저장할 때마다 올린다. 운영진 평가 현황이 다시 읽어 집계·행을 맞춘다.
  const [statusRefreshKey, setStatusRefreshKey] = useState(0);

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

  // 사이드바 메뉴로 옮기면(같은 메뉴 재클릭 포함) 상세와 입력 초안을 버린다. 이동 확인은 App이 이미 했다.
  // 읽는 중인 내 평가 응답은 요청 번호를 올려 버린다. 목 데이터를 잃지 않도록 화면을 key로 새로 만들지 않는다.
  const handledListRequestRef = useRef(listRequest);
  useEffect(() => {
    if (listRequest === handledListRequestRef.current) return;
    handledListRequestRef.current = listRequest;
    openRequestRef.current += 1;
    setSelectedApplicant(null);
    setReviewQueue([]);
    setDraft(EMPTY_DRAFT);
    setSavedDraft(EMPTY_DRAFT);
    setShowDraftErrors(false);
    setMyEvaluationError(null);
    setIsMyEvaluationLoading(false);
  }, [listRequest]);

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

  // 전체 지원 현황 상세의 "평가하기": 그 지원자 부문의 서류 평가 메뉴로 옮기고 평가 화면을 연다.
  function handleEvaluateFromOverview(applicantId: number) {
    const app = applicants.find((item) => item.id === applicantId);
    if (!app || app.status !== 'SUBMITTED') return;
    onOpenTrack(app.track);
    // 이전·다음은 그 부문 서류 평가 목록의 기본 순서(제출 완료, 제출일 최신순)를 따른다.
    const defaultOrder = filterReviewList(applicants, {
      ...DEFAULT_REVIEW_QUERY,
      track: app.track,
    }).map((item) => item.id);
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

  /** 저장하지 않은 입력을 버리고 저장값으로 되돌린다. */
  function resetDraft() {
    setDraft(savedDraft);
    setShowDraftErrors(false);
  }

  // 개인 평가 ↔ 운영진 평가 현황 전환. 저장하지 않은 입력이 있으면 묻고, 옮기면 입력을 저장값으로 되돌린다.
  function handleDetailTabChange(tab: ReviewDetailTab) {
    if (tab === modalTab || !canDiscardDraft()) return;
    resetDraft();
    setModalTab(tab);
  }

  // 평가 화면에서 목록으로 돌아간다. 저장하지 않은 평가가 있으면 먼저 묻는다.
  function handleBackToList() {
    if (canDiscardDraft()) setSelectedApplicant(null);
  }

  // 개인 평가 저장(MY-07). 검증 → 저장 → 결과 안내 순서이고, 실패해도 입력은 그대로 둔다(§4.5).
  // 데이터 변경은 Hook(saveMyEvaluation)이 맡고, 여기서는 화면 상태와 안내만 다룬다.
  // 성공하면 true. 운영진 평가 현황의 본인 행 저장도 이 함수를 쓴다.
  async function handleSaveMyEvaluation(): Promise<boolean> {
    if (!selectedApplicant || isSaving) {
      return false;
    }
    const input = toSaveInput(draft);
    if (!input || Object.keys(validateMyEvaluation(draft)).length > 0) {
      setShowDraftErrors(true);
      return false;
    }
    const applicant = selectedApplicant;
    // 저장 중 메뉴를 옮기면 요청 번호가 바뀐다. 그때는 저장 결과로 닫힌 상세를 다시 열지 않는다.
    const requestId = openRequestRef.current;
    setIsSaving(true);
    try {
      const updatedApplicant = await saveMyEvaluation(applicant, input);
      if (requestId !== openRequestRef.current) return false;
      setSelectedApplicant(updatedApplicant);
      setSavedDraft(draft);
      setShowDraftErrors(false);
      showToast('평가가 저장되었습니다.', 'success');
      setStatusRefreshKey((key) => key + 1);
      return true;
    } catch (error) {
      const notice = saveFailureNoticeOf(error, applicant.status);
      window.alert(notice.message);
      if (notice.leave && requestId === openRequestRef.current) setSelectedApplicant(null);
      return false;
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
      window.alert(notice.message);
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
      window.alert('승격할 합격자를 최소 1명 이상 선택해 주세요.');
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
    window.alert(
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
          onTabChange={handleDetailTabChange}
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
          isDirty={isDraftDirty}
          statusRefreshKey={statusRefreshKey}
          ownRowEditing={{
            draft,
            errors: draftErrors,
            saving: isSaving,
            locked: isMyEvaluationLoading || myEvaluationError !== null,
            onChange: (patch) => setDraft((current) => ({ ...current, ...patch })),
            onStart: () => {
              if (!canDiscardDraft()) return false;
              resetDraft();
              return true;
            },
            onCancel: resetDraft,
            onSave: handleSaveMyEvaluation,
          }}
          onDecision={(decision) => setDraft((current) => ({ ...current, decision }))}
          onScore={(score) => setDraft((current) => ({ ...current, score }))}
          onMemo={(memo) => setDraft((current) => ({ ...current, memo }))}
          onInterview={(interview_question) =>
            setDraft((current) => ({ ...current, interview_question }))
          }
          onSave={() => void handleSaveMyEvaluation()}
          onBack={handleBackToList}
          onNavigate={handleNavigateModal}
          position={reviewQueue.indexOf(selectedApplicant.id) + 1}
          total={reviewQueue.length}
        />
        {toastNode}
      </>
    );
  return (
    <div className="evaluation-page space-y-6">
      {toastNode}
      {/* 출결 화면과 같은 제목 줄. 화면 전환은 사이드바 메뉴 3개가 맡는다. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {mainTab === 'my'
            ? `${MAIN_TAB_TITLES.my} · ${TRACK_LABELS[track]}`
            : MAIN_TAB_TITLES[mainTab]}
        </h1>
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
          track={track}
          query={reviewQueries[track]}
          onQueryChange={(query) => setReviewQueries((current) => ({ ...current, [track]: query }))}
          onOpen={handleOpenFromMyList}
          canWriteFinalDecision={canWriteFinalDecision}
          onSaveFinalDecision={handleSaveFinalDecision}
        />
      )}

      {/* 합격자 승격. 승격 API 연동과 화면 재기획은 보류(docs/evaluation-rework-plan.md §5). */}
      {mainTab === 'promotions' && (
        <div className="space-y-4">
          {/* Promotion Header Banner */}
          <div className="p-5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.03] space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <UserCheck size={18} className="text-emerald-400" />
                  <span>최종 합격자 정회원 승격</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  최종 합격자를 골라 정회원으로 승격합니다. 지원서의 이름·연락처·학교·전공 등이 회원
                  정보로 옮겨집니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAllPromote}
                  disabled={unpromotedPassedCandidates.length === 0}
                  className="px-3.5 py-2 rounded-sm text-xs font-bold bg-slate-100 hover:bg-slate-100 text-foreground border border-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
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
                  className="px-4 py-2 rounded-sm text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer "
                >
                  <Award size={14} />
                  <span>선택한 {selectedPromoteUserIds.length}명 승격</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-md bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-muted-foreground text-[11px]">최종 합격자</p>
                <p className="text-foreground font-bold font-mono text-base">
                  {passedCandidates.length}명
                </p>
              </div>
              <div className="p-3 rounded-md bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-muted-foreground text-[11px]">승격 대기 인원</p>
                <p className="text-amber-400 font-bold font-mono text-base">
                  {unpromotedPassedCandidates.length}명
                </p>
              </div>
              <div className="p-3 rounded-md bg-slate-50 border border-slate-100 space-y-0.5">
                <p className="text-muted-foreground text-[11px]">정회원 승격 완료</p>
                <p className="text-emerald-400 font-bold font-mono text-base">
                  {passedCandidates.filter((c) => c.is_promoted_to_member).length}명
                </p>
              </div>
            </div>
          </div>

          {/* Members Table */}
          <div>
            <p className="pb-3 text-[11px] text-muted-foreground">
              평가 점수는 보이지 않고 회원 정보만 보입니다.
            </p>

            <div className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-2xs">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-muted-foreground font-semibold whitespace-nowrap">
                    <th className="text-center px-4 py-3.5 w-12">선택</th>
                    <th className="text-left px-5 py-3.5">지원자 성명</th>
                    <th className="text-left px-4 py-3.5">합격 부문</th>
                    <th className="text-left px-4 py-3.5">이메일</th>
                    <th className="text-left px-4 py-3.5">연락처</th>
                    <th className="text-left px-4 py-3.5">대학교 / 본전공</th>
                    <th className="text-center px-4 py-3.5">회원 상태</th>
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
                              <span>정회원</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-muted-foreground text-[11px] border border-slate-200 flex items-center justify-center gap-1">
                              <User size={11} />
                              <span>지원자</span>
                            </span>
                          )}
                        </td>

                        {/* Promotion Action */}
                        <td className="px-5 py-3.5 text-right font-sans">
                          {isPromoted ? (
                            <span className="text-xs font-bold text-emerald-400 flex items-center justify-end gap-1">
                              <CheckCircle2 size={13} /> 승격 완료
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-amber-400 flex items-center justify-end gap-1">
                              <Clock size={13} /> 승격 대기
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

      {/* 합격자 승격 확인 창 */}
      {showPromoteConfirmModal && (
        <div className="fixed inset-0 bg-black/85 z-80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-lg overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <UserCheck size={18} />
                <h3 className="text-base font-bold text-foreground">정회원 승격 확인</h3>
              </div>
              <button
                onClick={() => setShowPromoteConfirmModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-bold text-foreground">
                승격 대상 {selectedPromoteUserIds.length}명
              </p>

              <div className="max-h-40 overflow-y-auto rounded-md bg-slate-100 border border-slate-200 p-3 space-y-2 divide-y divide-white/5">
                {passedCandidates
                  .filter((c) => selectedPromoteUserIds.includes(c.user_id))
                  .map((app) => (
                    <div
                      key={app.id}
                      className="pt-2 first:pt-0 flex items-center justify-between font-mono text-[11px]"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-foreground font-sans">
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
            </div>

            <div className="p-3.5 rounded-md bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoteCheck1}
                  onChange={(e) => setPromoteCheck1(e.target.checked)}
                  className="mt-0.5 rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-foreground leading-relaxed">
                  대표진 면접과 최종 선발 회의를 거쳐 <strong>합격이 최종 확정된 명단</strong>임을
                  확인했습니다.
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
                  승격하면 지원서의 회원 정보가 계정에 옮겨지고 <strong>정회원으로 바뀝니다</strong>
                  . 되돌리는 기능은 없습니다.
                </span>
              </label>
            </div>

            <div className="flex justify-end items-center pt-3 border-t border-slate-200">
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPromoteConfirmModal(false)}
                  className="px-4 py-2 rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-100 cursor-pointer"
                >
                  취소
                </button>
                <button
                  onClick={handleExecutePromotion}
                  disabled={!promoteCheck1 || !promoteCheck2 || isPromoting}
                  className="px-5 py-2 rounded-sm text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer "
                >
                  {isPromoting ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  <span>승격</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
