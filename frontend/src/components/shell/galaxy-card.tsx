import { cn } from "@/lib/utils";
import { CodeChip } from "./code-chip";

interface GalaxyCardProps {
  code?: string;
  title?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * GalaxyCard — themed surface with the 3-letter code chip + title +
 * dashed-bottom divider pattern. Uses the cosmic `--pane` / `--pane-edge` /
 * `--card-radius` / `--card-blur` tokens so it automatically picks up the
 * active theme (4px sharp Observatory, 2px + corner markers Constellation,
 * 6px + amber edge Supernova).
 */
export function GalaxyCard({ code, title, meta, className, children }: GalaxyCardProps) {
  return (
    <section className={cn("card-galaxy", className)}>
      {(code || title || meta) && (
        <div className="card-head">
          {code && <CodeChip>{code}</CodeChip>}
          {title && <h3 className="card-title">{title}</h3>}
          {meta && <span className="card-action">{meta}</span>}
        </div>
      )}
      {children}
    </section>
  );
}
