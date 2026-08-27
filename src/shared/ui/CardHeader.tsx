export function CardHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white flex-wrap gap-2">
      <div>
        <p className="text-sm font-bold text-slate-900 tracking-tight">{title}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
