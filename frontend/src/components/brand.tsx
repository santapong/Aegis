import union from "@/lib/brand-mark.json";

/** Union: supportive curves, a rising A, and a continuous path forward. */
export function AegisMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 560 560" fill="currentColor" aria-hidden="true" focusable="false" className={className} data-aegis-mark="union">
      <g transform="translate(0 80)">{union.paths.map((d, index) => <path key={index} d={d} />)}</g>
    </svg>
  );
}

export function AegisBrand({ compact = false }: { compact?: boolean }) {
  return <span className="aegis-brand" role="img" aria-label="Aegis"><AegisMark size={38} />{!compact && <span aria-hidden="true">aegis.</span>}</span>;
}
