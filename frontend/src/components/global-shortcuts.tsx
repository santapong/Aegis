"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHotkeys } from "react-hotkeys-hook";
import { CheatsheetDialog } from "@/components/ui/cheatsheet-dialog";
import { CommandPalette } from "@/components/search/command-palette";

/**
 * Mounts global keyboard shortcuts: N (new transaction), / (palette),
 * ? (cheatsheet), g+d / g+t / g+b / g+c / g+r (navigation).
 *
 * Scoped so input/textarea/contenteditable focus doesn't intercept
 * (except Esc, which always closes the open dialog).
 */
export function GlobalShortcuts() {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);

  const opts = { enableOnFormTags: false, preventDefault: true } as const;

  useHotkeys("/", () => setPaletteOpen(true), opts);
  useHotkeys("shift+/", () => setCheatsheetOpen(true), opts); // '?'
  useHotkeys("n", () => router.push("/transactions?new=1"), opts);
  useHotkeys("g>d", () => router.push("/"), opts);
  useHotkeys("g>t", () => router.push("/transactions"), opts);
  useHotkeys("g>b", () => router.push("/budgets"), opts);
  useHotkeys("g>c", () => router.push("/calendar"), opts);
  useHotkeys("g>r", () => router.push("/reports"), opts);
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
