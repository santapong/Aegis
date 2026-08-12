import { readFileSync } from "node:fs";
import path from "node:path";

export interface ChangelogGroup {
  heading: string; // "Added", "Fixed", "Changed", ...
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  date: string | null;
  groups: ChangelogGroup[];
}

const VERSION_HEADING = /^## \[([^\]]+)\](?:\s*-\s*(.+))?$/;
const GROUP_HEADING = /^### (.+)$/;

/**
 * Parses CHANGELOG.md's "Keep a Changelog" format into structured entries.
 * Intentionally minimal — this repo's changelog only uses version/date
 * headings, "### Category" subheadings, and "- " bullets that may wrap
 * onto indented continuation lines.
 */
export function getChangelogEntries(): ChangelogEntry[] {
  const raw = readFileSync(path.join(process.cwd(), "..", "CHANGELOG.md"), "utf8");
  const lines = raw.split("\n");

  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  let currentGroup: ChangelogGroup | null = null;
  let pendingItem: string[] | null = null;

  const flushItem = () => {
    if (pendingItem && currentGroup) {
      currentGroup.items.push(pendingItem.join(" ").trim());
    }
    pendingItem = null;
  };

  for (const line of lines) {
    const versionMatch = line.match(VERSION_HEADING);
    if (versionMatch) {
      flushItem();
      const [, version, date] = versionMatch;
      if (version.toLowerCase() !== "unreleased") {
        current = { version, date: date ?? null, groups: [] };
        entries.push(current);
      } else {
        current = null;
      }
      currentGroup = null;
      continue;
    }

    const groupMatch = line.match(GROUP_HEADING);
    if (groupMatch && current) {
      flushItem();
      currentGroup = { heading: groupMatch[1], items: [] };
      current.groups.push(currentGroup);
      continue;
    }

    if (!current || !currentGroup) continue;

    if (/^- /.test(line)) {
      flushItem();
      pendingItem = [line.slice(2).trim()];
    } else if (pendingItem && /^\s{2,}\S/.test(line)) {
      pendingItem.push(line.trim());
    } else if (line.trim() === "") {
      flushItem();
    }
  }
  flushItem();

  return entries;
}

/** Very small inline-markdown pass: `code` and **bold** only. */
export function renderInline(text: string): Array<{ type: "text" | "code" | "bold"; value: string }> {
  const parts: Array<{ type: "text" | "code" | "bold"; value: string }> = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    if (m.index > last) parts.push({ type: "text", value: text.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ type: "code", value: m[1] });
    else if (m[2] !== undefined) parts.push({ type: "bold", value: m[2] });
    last = pattern.lastIndex;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}
