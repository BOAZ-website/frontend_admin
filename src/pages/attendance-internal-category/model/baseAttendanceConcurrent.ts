export function getMemberSampleSeed(name: string, sortedIndex: number): number {
  return (name.charCodeAt(0) || 0) + sortedIndex;
}

const CONCURRENT_EXAMPLE_MEMBER_NAMES = new Set(['정채원', '문지훈']);

export function isConcurrentBaseMember(name: string, sortedIndex: number): boolean {
  return (
    CONCURRENT_EXAMPLE_MEMBER_NAMES.has(name) || getMemberSampleSeed(name, sortedIndex) % 5 === 0
  );
}

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
