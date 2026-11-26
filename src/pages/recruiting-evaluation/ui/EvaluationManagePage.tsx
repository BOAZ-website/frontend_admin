import { useEffect, useRef, useState } from 'react';

import boazLogo from '@/shared/assets/boaz-logo.png';
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
  type MyEvaluationInput,
  TRACK_LABELS,
  type TrackType,
} from '../model/types';
import { useEvaluationData } from '../model/useEvaluationData';
import { useMyPermission } from '../model/useMyPermission';
import { ApplicantReviewDetail, type ReviewDetailTab } from './ApplicantReviewDetail';
import { ApplicantsOverview } from './ApplicantsOverview';
import { MemberRegistrationList } from './MemberRegistrationList';
import { MyEvaluationList } from './MyEvaluationList';
import { TRACK_IMAGE } from './trackImages';

/** 제목은 사이드바 메뉴 이름(PAGE_LABELS)과 같다. */
const MAIN_TAB_TITLES: Record<EvaluationTab, string> = {
  applicants: '전체 지원 현황',
  my: '서류 평가',
  promotions: '합격자 부원 등록',
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
  const canWriteFinalDecision = useMyPermission('FINAL_DECISION_WRITE');
  const canRegisterMembers = useMyPermission('MEMBER_PROMOTION_WRITE');

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
  // 진행 중인 개인 평가 저장. 끝나면 null이다.
  const savingRef = useRef<Promise<boolean> | null>(null);
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

  /**
   * 저장하지 않은 평가가 없으면 바로 옮긴다. 있으면 저장할지 묻고, 확인이면 저장에 성공한 뒤 옮긴다.
   * 취소하거나 저장에 실패하면 그 자리에 머문다.
   */
  const leaveAfterSave = async (proceed: () => void) => {
    if (!isDraftDirty) return proceed();
    if (window.confirm(UNSAVED_EVALUATION_MESSAGE) && (await handleSaveMyEvaluation())) proceed();
  };

  // 저장하지 않은 평가가 있으면 사이드바로 다른 메뉴에 갈 때도 목록 버튼과 같이 묻는다(§4.5).
  // 일단 머물고(false), 저장에 성공하면 App이 넘긴 proceed로 누른 메뉴에 옮긴다. 취소·실패면 입력을 둔 채 머문다.
  // 저장이 진행 중이면(어디서 시작했든) 묻지 않고 누른 메뉴만 기억해, 그 저장이 성공하면 마지막에 누른 메뉴로 옮긴다.
  const leaveAfterSaveRef = useRef(leaveAfterSave);
  useEffect(() => {
    leaveAfterSaveRef.current = leaveAfterSave;
  });
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  useEffect(
    () =>
      isDraftDirty
        ? registerLeaveGuard((proceed) => {
            const isWaiting = pendingLeaveRef.current !== null;
            pendingLeaveRef.current = proceed;
            if (isWaiting) return false;
            const goToPendingMenu = () => pendingLeaveRef.current?.();
            const saving = savingRef.current;
            const leaving = saving
              ? saving.then((saved) => {
                  if (saved) goToPendingMenu();
                })
              : leaveAfterSaveRef.current(goToPendingMenu);
            void leaving.finally(() => {
              pendingLeaveRef.current = null;
            });
            return false;
          })
        : undefined,
    [isDraftDirty],
  );

  const showToast = (message: string, tone: ToastMessage['tone']) =>
    setToast({ id: Date.now(), message, tone });

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
    if (nextApp) void leaveAfterSave(() => void handleOpenModal(nextApp, modalTab, reviewQueue));
  }

  // 평가 화면에서 목록으로 돌아간다. 저장하지 않은 평가가 있으면 먼저 저장할지 묻는다.
  function handleBackToList() {
    void leaveAfterSave(() => setSelectedApplicant(null));
  }

  // 개인 평가 저장(MY-07). 검증 → 저장 → 결과 안내 순서이고, 실패해도 입력은 그대로 둔다(§4.5).
  // 데이터 변경은 Hook(saveMyEvaluation)이 맡고, 여기서는 화면 상태와 안내만 다룬다.
  // 성공하면 true. 저장하지 않고 옮기려 할 때(leaveAfterSave·사이드바)도 이 함수로 저장한다.
  async function handleSaveMyEvaluation(): Promise<boolean> {
    if (!selectedApplicant || isSaving) {
      return false;
    }
    const input = toSaveInput(draft);
    if (!input || Object.keys(validateMyEvaluation(draft)).length > 0) {
      setShowDraftErrors(true);
      return false;
    }
    // 진행 중인 저장을 남겨 둔다. 저장 중 사이드바를 누르면 새로 저장하지 않고 이 결과를 따른다.
    const saving = submitMyEvaluation(selectedApplicant, input);
    savingRef.current = saving;
    return saving;
  }

  async function submitMyEvaluation(
    applicant: ApplicantEvaluationDto,
    input: MyEvaluationInput,
  ): Promise<boolean> {
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
      savingRef.current = null;
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
          isDirty={isDraftDirty}
          // 본인 행 편집은 개인 평가 탭과 같은 초안을 쓴다. 탭을 오가도 입력이 남으므로 편집을 시작할 때 묻지 않는다.
          ownRowEditing={{
            draft,
            saving: isSaving,
            locked: isMyEvaluationLoading || myEvaluationError !== null,
            onChange: (patch) => setDraft((current) => ({ ...current, ...patch })),
            onStart: () => true,
            onCancel: () => {
              setDraft(savedDraft);
              setShowDraftErrors(false);
            },
            onSave: handleSaveMyEvaluation,
          }}
          statusRefreshKey={statusRefreshKey}
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
    // evaluation-scale: 서류 평가 관리 화면 공통 크기·여백 규칙(review-design.css 맨 아래, docs/screens/03-evaluation-layout.md)
    <div className="evaluation-page evaluation-scale space-y-6">
      {toastNode}
      {/* 출결 화면과 같은 제목 줄. 화면 전환은 사이드바 메뉴 3개가 맡는다. */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
          {/* 서류 평가는 부문 캐릭터, 전체 지원 현황·합격자 부원 등록은 BOAZ 로고를 제목 앞에 둔다. */}
          <img
            src={mainTab === 'my' ? TRACK_IMAGE[track] : boazLogo}
            alt=""
            width={28}
            height={28}
            className="size-7 object-contain"
          />
          {mainTab === 'my'
            ? `${TRACK_LABELS[track]} ${MAIN_TAB_TITLES.my}`
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

      {mainTab === 'promotions' && (
        <MemberRegistrationList
          fetchApplicants={fetchApplicants}
          fetchAnswers={fetchAnswers}
          promoteUsers={promoteUsers}
          canRegister={canRegisterMembers}
        />
      )}
    </div>
  );
}
