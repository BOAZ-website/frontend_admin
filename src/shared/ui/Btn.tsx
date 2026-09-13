export function Btn({
  children,
  variant = 'default',
  size = 'sm',
  onClick,
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'ghost' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'xs' | 'md';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const base =
    'inline-flex items-center gap-1.5 font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';
  const sz =
    size === 'xs'
      ? 'text-xs px-2.5 py-1'
      : size === 'md'
        ? 'text-sm px-4 py-2'
        : 'text-xs px-3.5 py-1.5';
  const v = {
    default: 'bg-slate-900 text-white hover:bg-slate-800 shadow-2xs active:scale-[0.98]',
    ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
    danger: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 shadow-2xs',
    success:
      'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 shadow-2xs',
    outline: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80 shadow-2xs',
  }[variant];
  return (
    <button className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
