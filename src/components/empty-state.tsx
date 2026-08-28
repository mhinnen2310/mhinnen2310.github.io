export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-card px-6 py-14 text-center">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden className="text-ink-faint">
        <circle cx="19" cy="19" r="12" stroke="currentColor" strokeWidth="2" />
        <path d="M28 28l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="text-base font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-md text-sm text-ink-soft">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
