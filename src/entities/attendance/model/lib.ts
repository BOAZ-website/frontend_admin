import { ADV_MEMBERS, MEMBERS } from '@/entities/study-team/model/constants';

import { SAMPLE_PROOF_IMAGES } from './constants';
import type { AttendanceState, AttendanceStatus } from './types';

export function sessionKey(w: string, a: string, t: string) {
  return `${w}|${a}|${t}`;
}

export function calcScore(s: AttendanceStatus) {
  if (s === 'present' || s === 'excusedAbsent' || s === 'remote') return 1;
  if (s === 'late' || s === 'earlyLeave') return 0.5;
  return 0;
}

export const ALL_8_WEEKS = Array.from({ length: 8 }, (_, i) => ({
  id: `w${i + 1}`,
  weekNum: i + 1,
  label: `${i + 1}주차`,
}));

export function buildInitialAttendance(): AttendanceState {
  const st: AttendanceState = {};
  const studyTeams = ['A팀', 'B팀', 'C팀', 'D팀'];
  const advTeams = Object.keys(ADV_MEMBERS);
  const allTeams = [...studyTeams, ...advTeams];

  const allMembersMap: Record<string, (typeof MEMBERS)[string]> = {
    ...MEMBERS,
    ...ADV_MEMBERS,
  };

  for (const w of ALL_8_WEEKS) {
    const isPastWeek = w.weekNum < 3; // 1주차, 2주차는 지난 주차 (마감)
    const isCurrentWeek = w.weekNum === 3; // 3주차는 현재 진행 중인 주차
    const isFutureWeek = w.weekNum > 3; // 4주차 ~ 8주차는 미래 주차 (미정 & 수정 불가)

    for (const team of allTeams) {
      const members = allMembersMap[team] ?? [];
      const statuses: Record<string, AttendanceStatus> = {};
      const memos: Record<string, string> = {};

      if (isFutureWeek) {
        // 미래 주차: 모든 부원이 "미정 (unmarked)" 상태
        members.forEach((m) => {
          statuses[m.id] = 'unmarked';
        });
      } else {
        // 지난 주차(1, 2주차) 및 현재 주차(3주차): 정상 출결 상태 배정
        members.forEach((m, i) => {
          const s: AttendanceStatus = i % 7 === 0 ? 'late' : i % 11 === 0 ? 'absent' : 'present';
          statuses[m.id] = s;
          if (s === 'late') {
            memos[m.id] = '15분 늦게 도착 (교통 정체)';
          }
          if (s === 'absent') {
            memos[m.id] = '개인 사정으로 결석';
          }
        });
      }

      // 제출 상태 판정:
      // 1주차, 2주차: 스터디 및 ADV 전체 팀 제출 완료
      // 3주차 (현재 주차): 일부 팀 제출 완료, 일부 팀 미제출(진행 중)
      // 4주차 이상: 미제출
      let submitted = false;
      if (isPastWeek) {
        submitted = true;
      } else if (isCurrentWeek) {
        if (studyTeams.includes(team)) {
          submitted = team !== 'C팀';
        } else {
          submitted = team === '분석 1팀' || team === '시각화 1팀' || team === '엔지 1팀';
        }
      } else {
        submitted = false;
      }

      const imgIdx = (w.weekNum + team.charCodeAt(0) + team.length) % SAMPLE_PROOF_IMAGES.length;

      st[sessionKey(w.id, 'study', team)] = {
        statuses,
        memos,
        photo: submitted ? `${team}_${w.label}_활동인증.jpg` : null,
        photoUrl: submitted ? SAMPLE_PROOF_IMAGES[imgIdx] : null,
        photoName: submitted ? `${team}_${w.label}_활동인증.jpg` : null,
        photoSize: submitted ? '2.4 MB' : null,
        submitted,
        submittedAt: submitted
          ? w.id === 'w1'
            ? '2026-08-04 21:15'
            : w.id === 'w2'
              ? '2026-08-11 20:47'
              : '2026-08-18 19:32'
          : null,
        confirmedByAdmin: isPastWeek,
      };
    }
  }
  return st;
}
