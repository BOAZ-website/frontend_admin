/**
 * 출결 입력(스터디·ADV) 화면 데이터. 화면을 열 때 현재 반기의 팀·팀원·주차별 출결을 API로 읽는다.
 * 입력·사진·PDF는 화면 초안에만 두었다가 제출할 때 제출 API 한 번으로 보낸다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { submitTeamWeek } from '@/entities/attendance/api/attendanceApi';
import type { AttendanceRecordInput, FileUpload } from '@/entities/attendance/model/dto';
import type { AttendanceState, SessionRecord } from '@/entities/attendance/model/types';
import { fetchTeams, removeTeamMember } from '@/entities/study-team/api/teamApi';
import { attendanceOfTeams, splitTeamList } from '@/entities/study-team/model/adapters';
import type { TeamListItemDto } from '@/entities/study-team/model/dto';
import type { Member, StudyTeamInfo } from '@/entities/study-team/model/types';

export interface InputPageData {
  status: 'loading' | 'ready' | 'error';
  error: Error | null;
  teams: StudyTeamInfo[];
  membersMap: Record<string, Member[]>;
  /** 화면이 보는 출결. 사진 첨부 같은 초안도 여기에 먼저 담긴다. */
  attendance: AttendanceState;
  setAttendance: Dispatch<SetStateAction<AttendanceState>>;
  submitWeek: (teamId: string, weekNum: number, record: SessionRecord) => Promise<void>;
  removeMember: (teamId: string, memberId: string) => Promise<void>;
}

function fileOf(
  url: string | null | undefined,
  name: string | null | undefined,
  size: string | null | undefined,
): FileUpload | null {
  return url ? { dataUrl: url, name: name ?? '첨부 파일', ...(size ? { size } : {}) } : null;
}

/** 화면의 주차 기록(출결 키 → 상태·비고)을 제출 API의 팀원별 줄로 바꾼다. */
function toRecords(record: SessionRecord): AttendanceRecordInput[] {
  return Object.entries(record.statuses).map(([memberKey, status]) => {
    const [memberId, subType = ''] = memberKey.split(':');
    return {
      memberId,
      subType: subType as '' | '멘멘' | '친바',
      status,
      memo: record.memos?.[memberKey] ?? null,
    };
  });
}

export function useInputPageData(isAdv: boolean, onChanged?: () => void): InputPageData {
  const group = isAdv ? 'ADV' : 'STUDY';
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{
    teams: TeamListItemDto[];
    status: InputPageData['status'];
    error: Error | null;
  }>({
    teams: [],
    status: 'loading',
    error: null,
  });
  const [attendance, setAttendance] = useState<AttendanceState>({});

  useEffect(() => {
    let isCancelled = false;
    fetchTeams(group, { include: 'sessions', period: 'all' })
      .then(({ teams }) => {
        if (isCancelled) return;
        setState({ teams, status: 'ready', error: null });
        setAttendance(attendanceOfTeams(teams));
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState((prev) => ({
            ...prev,
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          }));
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [group, version]);

  const reload = useCallback(() => {
    setVersion((value) => value + 1);
    onChanged?.();
  }, [onChanged]);

  const view = useMemo(() => {
    const { teams, members } = splitTeamList(state.teams);
    return { teams, membersMap: members };
  }, [state.teams]);

  const submitWeek = useCallback(
    async (teamId: string, weekNum: number, record: SessionRecord) => {
      const isMentoring = state.teams.find((team) => team.id === teamId)?.kind === 'MENTORING';
      await submitTeamWeek(group, teamId, weekNum, {
        records: toRecords(record),
        photo: fileOf(record.photoUrl, record.photoName, record.photoSize),
        // PDF는 멘멘 스터디만 첨부한다.
        ...(isMentoring ? { pdf: fileOf(record.pdfUrl, record.pdfName, record.pdfSize) } : {}),
      });
      reload();
    },
    [group, state.teams, reload],
  );

  const removeMember = useCallback(
    async (teamId: string, memberId: string) => {
      await removeTeamMember(group, teamId, memberId);
      reload();
    },
    [group, reload],
  );

  return {
    status: state.status,
    error: state.error,
    ...view,
    attendance,
    setAttendance,
    submitWeek,
    removeMember,
  };
}
