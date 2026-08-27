export interface ScoreRule {
  version: number;
  status: "ACTIVE" | "INACTIVE" | "DRAFT";
  activatedAt: string | null;
  createdBy: string;
  present: number;
  late: number;
  absent: number;
  absentPenalty?: number;
  unexcusedAbsentPenalty?: number;
  latePenalty?: number;
  earlyLeavePenalty?: number;
  unexcusedLatePenalty?: number;
  presentScore?: number;
  studyFailPenalty?: number;
  studyPerfectBonus?: number;
  studyPassBonus?: number;
  studyLeaderBonus?: number;
}
