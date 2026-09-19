export function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-2xs ${className}`}
    >
      {children}
    </div>
  );
}
