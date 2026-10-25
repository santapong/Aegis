/** Aegis Horizon: a sheltering arch, with an open path through its centre. */
export function AegisMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <path d="M20 3.5 34 9v12c0 7-6.5 12-14 15.5C12.5 33 6 28 6 21V9L20 3.5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m13 26 7-14 7 14M16 21h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AegisBrand({ compact = false }: { compact?: boolean }) {
  return <span className="aegis-brand"><AegisMark />{!compact && <span>aegis<span className="aegis-brand-dot">.</span></span>}</span>;
}
