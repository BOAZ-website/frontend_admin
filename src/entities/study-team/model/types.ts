export interface Member {
  id: string;
  name: string;
  year: string;
  track?: string;
}

export type StudyPeriodType = '방학 스터디' | '학기 스터디';

export interface StudyTeamInfo {
  id: string;
  /** 팀장인 users.id. 팀장 프로필 조회는 이 FK를 우선 사용한다. */
  leaderId?: string;
  teamName: string;
  studyName: string;
  leaderName: string;
  category: string;
  schedule: string;
  studyType: StudyPeriodType;
  /** 방학 멘멘 스터디 여부. 없으면 일반 스터디로 취급한다. */
  studyKind?: 'MENTORING' | 'GENERAL';
  /** 멘멘 스터디의 부문(분석·시각화·엔지니어링). */
  track?: string;
  description?: string;
  createdAt: string;
  /** 활동 기수. 없으면 기본(현재) 기수로 본다. */
  cohort?: number;
}
