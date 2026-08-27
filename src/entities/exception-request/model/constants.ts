import type { ExceptionRequest } from "./types";

export const INITIAL_EXCEPTIONS: ExceptionRequest[] = [
  {
    id: "e1",
    team: "C팀",
    week: "3주차",
    memberName: "원승민",
    from: "absent",
    to: "present",
    reason: "교통 지연으로 인한 결석 취소 요청",
  },
  {
    id: "e2",
    team: "B팀",
    week: "3주차",
    memberName: "류현우",
    from: "late",
    to: "present",
    reason: "지각 처리 오기재 수정 요청",
  },
];
