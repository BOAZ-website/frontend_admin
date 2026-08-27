import type { AttendanceStatus } from "@/entities/attendance/model/types";

export interface ExceptionRequest {
  id: string;
  team: string;
  week: string;
  memberName: string;
  from: AttendanceStatus;
  to: AttendanceStatus;
  reason: string;
}
