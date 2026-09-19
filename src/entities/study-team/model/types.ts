export interface Member {
  id: string;
  name: string;
  year: string;
}

export type StudyPeriodType = '방학 스터디' | '학기 스터디';

export interface StudyTeamInfo {
  id: string;
  teamName: string;
  studyName: string;
  leaderName: string;
  category: string;
  schedule: string;
  studyType: StudyPeriodType;
  description?: string;
  createdAt: string;
}
