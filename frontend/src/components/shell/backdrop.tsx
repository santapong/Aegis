"use client";

import { useAppStore } from "@/stores/app-store";
import { ConstellationLayer } from "./constellation-layer";
import { BlackHole } from "./black-hole";

/**
 * Backdrop — 4 stacked layers behind all app content:
 *   1. bd-base       gradient void surface (theme-scoped via CSS)
 *   2. middle layer  ConstellationLayer (Constellation) or BlackHole (Supernova)
 *   3. bd-stars      CSS-only 20-stop starfield, twinkle toggleable
 *   4. bd-grid       48px lattice, masked by radial fade
 *
 * Lives at z-index 0 fixed to viewport; pointer-events: none so it never
 * intercepts clicks. Mount once in the root layout.
 */
export function Backdrop({ twinkle = true }: { twinkle?: boolean }) {
  const theme = useAppStore((s) => s.theme);

  return (
    <div className="backdrop" aria-hidden>
      <div className="bd-base" />
      {theme === "constellation" && <ConstellationLayer />}
      {theme === "supernova" && <BlackHole />}
      <div className={`bd-stars${twinkle ? " twinkle" : ""}`} />
      <div className="bd-grid" />
    </div>
  );
}
