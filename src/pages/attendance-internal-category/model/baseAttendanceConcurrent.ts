export { isConcurrentBaseMember } from '@/entities/attendance/model/concurrent';

export function shouldShowMatrixTrack(category: string, selectedTrackFilter: string): boolean {
  return category === 'SESSION' || selectedTrackFilter === 'ALL';
}

export function shouldShowConcurrentColumn(category: string): boolean {
  return category === 'SESSION' || category === 'ADV';
}

export function sortConcurrentMembersLast<T extends { isConcurrent: boolean }>(members: T[]): T[] {
  return members
    .map((member, index) => ({ member, index }))
    .sort(
      (a, b) => Number(a.member.isConcurrent) - Number(b.member.isConcurrent) || a.index - b.index,
    )
    .map(({ member }) => member);
}
