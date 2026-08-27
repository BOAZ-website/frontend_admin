import { MEMBERS } from "@/entities/study-team/model/constants";

import { SAMPLE_PROOF_IMAGES, WEEKS } from "./constants";
import type { AttendanceState, AttendanceStatus } from "./types";

export function sessionKey(w: string, a: string, t: string) {
  return `${w}|${a}|${t}`;
}

export function calcScore(s: AttendanceStatus) {
  return s === "present" ? 1 : s === "late" ? 0.5 : 0;
}

export function buildInitialAttendance(): AttendanceState {
  const st: AttendanceState = {};
  const teams = ["A팀", "B팀", "C팀", "D팀"];
  for (const w of WEEKS) {
    for (const team of teams) {
      const members = MEMBERS[team] ?? [];
      const statuses: Record<string, AttendanceStatus> = {};
      const memos: Record<string, string> = {};
      members.forEach((m, i) => {
        const s: AttendanceStatus = i % 7 === 0 ? "late" : i % 11 === 0 ? "absent" : "present";
        statuses[m.id] = s;
        if (s === "late") {
          memos[m.id] = "15분 늦게 도착 (교통 정체)";
        }
        if (s === "absent") {
          memos[m.id] = "개인 사정으로 결석";
        }
      });
      const submitted = w.id === "w1" || w.id === "w2" || (w.id === "w3" && team !== "C팀");

      const imgIdx = (w.id.charCodeAt(1) + team.charCodeAt(0)) % SAMPLE_PROOF_IMAGES.length;

      st[sessionKey(w.id, "study", team)] = {
        statuses,
        memos,
        photo: submitted ? `스터디_${team}_${w.label}_인증.jpg` : null,
        photoUrl: submitted ? SAMPLE_PROOF_IMAGES[imgIdx] : null,
        photoName: submitted ? `스터디_${team}_${w.label}_인증사진.jpg` : null,
        photoSize: submitted ? "2.4 MB" : null,
        submitted,
        submittedAt: submitted
          ? w.id === "w1"
            ? "2025-03-04 21:15"
            : w.id === "w2"
              ? "2025-03-11 20:47"
              : "2025-03-18 19:32"
          : null,
        confirmedByAdmin: w.id === "w1" || w.id === "w2",
      };
    }
  }
  return st;
}
