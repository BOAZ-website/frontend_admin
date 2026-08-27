export function Tag({ label, color, bg }: { label: string; color?: string; bg?: string }) {
  return (
    <span
      className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md font-mono font-medium tracking-tight border"
      style={
        color && bg
          ? { background: bg, color, borderColor: `${color}30` }
          : { background: "#f8fafc", color: "#475569", borderColor: "#e2e8f0" }
      }
    >
      {label}
    </span>
  );
}
