import type { Metadata } from "next";
import { getChangelogEntries, renderInline } from "@/lib/changelog";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicPageHeader } from "@/components/shell/public-page-header";
import { AppPagePadding } from "@/components/shell/app-page-padding";
import { SITE_URL, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `Changelog — ${SITE_NAME}` },
  description: "Release history for Aegis — every version, what changed, and why.",
  alternates: { canonical: `${SITE_URL}/changelog` },
  robots: { index: true, follow: true },
};

const GROUP_BADGE: Record<string, "success" | "warning" | "danger" | "info"> = {
  Added: "success",
  Changed: "warning",
  Fixed: "danger",
  Removed: "info",
  Security: "danger",
  Deprecated: "warning",
};

function Inline({ text }: { text: string }) {
  return (
    <>
      {renderInline(text).map((part, i) => {
        if (part.type === "code") {
          return (
            <code key={i} className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
              {part.value}
            </code>
          );
        }
        if (part.type === "bold") {
          return (
            <strong key={i} className="font-semibold">
              {part.value}
            </strong>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </>
  );
}

export default function ChangelogPage() {
  const entries = getChangelogEntries();

  return (
    <>
      <PublicPageHeader />
      <AppPagePadding>
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader code="LOG" title="Changelog" subtitle="Every Aegis release, in order" />

        <div className="space-y-4">
          {entries.map((entry) => (
            <Card key={entry.version}>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold font-mono">v{entry.version}</h3>
                  {entry.date && (
                    <span className="text-xs text-muted-foreground">{entry.date}</span>
                  )}
                </div>
                <div className="space-y-4">
                  {entry.groups.map((group) => (
                    <div key={group.heading}>
                      <Badge variant={GROUP_BADGE[group.heading] ?? "info"}>{group.heading}</Badge>
                      <ul className="mt-2 space-y-1.5 list-disc list-inside">
                        {group.items.map((item, i) => (
                          <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                            <Inline text={item} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      </AppPagePadding>
    </>
  );
}
