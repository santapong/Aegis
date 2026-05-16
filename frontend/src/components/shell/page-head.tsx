import { cn } from "@/lib/utils";

interface PageHeadProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  crumb?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * PageHead — galaxy-themed page header: eyebrow (mono + pip) → display title
 * → optional crumb trail → action slot. Uses the theme's display ramp
 * automatically (sans for Observatory, italic serif for Supernova, roman
 * serif for Constellation).
 */
export function PageHead({ eyebrow, title, crumb, actions, className }: PageHeadProps) {
  return (
    <header className={cn("page-head", className)}>
      <div className="flex flex-col">
        {eyebrow && (
          <div className="eyebrow">
            <span className="pip" />
            {eyebrow}
          </div>
        )}
        <h1>{title}</h1>
        {crumb && <div className="crumb mt-2 font-mono text-[11px]">{crumb}</div>}
      </div>
      {actions && <div className="head-actions">{actions}</div>}
    </header>
  );
}
