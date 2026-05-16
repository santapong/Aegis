"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";
import { CheatsheetDialog } from "@/components/ui/cheatsheet-dialog";
import { CommandPalette } from "@/components/search/command-palette";

/**
 * Mounts global keyboard shortcuts:
 *  - `/` palette, `?` cheatsheet, `n` new transaction, `esc` close
 *  - `g>d/t/b/c/r/y/v/x/i/p/s/o` g-prefix navigation (existing g-mode)
 *  - `meta+1..8` cosmic-galaxy cluster navigation (handoff spec)
 *  - `shift+C/G/T/P/W` Plan cluster shortcuts (handoff spec)
 *  - `meta+,` Settings
 */
export function GlobalShortcuts() {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);

  const opts = { enableOnFormTags: false, preventDefault: true } as const;

  useHotkeys("/", () => setPaletteOpen(true), opts);
  useHotkeys("shift+/", () => setCheatsheetOpen(true), opts); // '?'
  useHotkeys("n", () => router.push("/transactions?new=1"), opts);

  // Legacy g-mode (kept for muscle memory)
  useHotkeys("g>d", () => router.push("/"), opts);
  useHotkeys("g>t", () => router.push("/transactions"), opts);
  useHotkeys("g>b", () => router.push("/budgets"), opts);
  useHotkeys("g>c", () => router.push("/calendar"), opts);
  useHotkeys("g>r", () => router.push("/reports"), opts);
  useHotkeys("g>s", () => router.push("/savings"), opts);
  useHotkeys("g>v", () => router.push("/investments"), opts);
  useHotkeys("g>x", () => router.push("/debts"), opts);
  useHotkeys("g>y", () => router.push("/payments"), opts);
  useHotkeys("g>g", () => router.push("/gantt"), opts);
  useHotkeys("g>p", () => router.push("/plans"), opts);
  useHotkeys("g>i", () => router.push("/trips"), opts);
  useHotkeys("g>o", () => router.push("/docs"), opts);

  // Galaxy cluster shortcuts (handoff spec — sidebar kbd chips)
  useHotkeys("meta+1, ctrl+1", () => router.push("/"), opts);
  useHotkeys("meta+2, ctrl+2", () => router.push("/transactions"), opts);
  useHotkeys("meta+3, ctrl+3", () => router.push("/reports"), opts);
  useHotkeys("meta+4, ctrl+4", () => router.push("/budgets"), opts);
  useHotkeys("meta+5, ctrl+5", () => router.push("/savings"), opts);
  useHotkeys("meta+6, ctrl+6", () => router.push("/investments"), opts);
  useHotkeys("meta+7, ctrl+7", () => router.push("/debts"), opts);
  useHotkeys("meta+8, ctrl+8", () => router.push("/payments"), opts);
  useHotkeys("meta+comma, ctrl+comma", () => router.push("/settings"), opts);
  useHotkeys("shift+c", () => router.push("/calendar"), opts);
  useHotkeys("shift+g", () => router.push("/gantt"), opts);
  useHotkeys("shift+t", () => router.push("/trips"), opts);
  useHotkeys("shift+p", () => router.push("/plans"), opts);
  useHotkeys("shift+w", () => router.push("/welcome"), opts);

  useHotkeys(
    "esc",
    () => {
      setPaletteOpen(false);
      setCheatsheetOpen(false);
    },
    { enableOnFormTags: true }
  );

  return (
    <>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <CheatsheetDialog open={cheatsheetOpen} onClose={() => setCheatsheetOpen(false)} />
    </>
  );
}
