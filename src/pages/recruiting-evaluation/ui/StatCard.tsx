interface StatCardProps {
  label: string;
  value: string;
}

/** 서류 평가 탭 위쪽의 통계 칸 하나. `evaluation-stats` 격자 안에 둔다. */
export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="space-y-1 rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
