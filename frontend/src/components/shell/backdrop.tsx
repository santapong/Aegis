"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { ConstellationLayer } from "./constellation-layer";
import { BlackHole } from "./black-hole";

/**
 * Routes that keep the full decorative cosmic backdrop. Every other route is
 * a data screen and renders on the plain base surface only (body gets the
 * `route-app` class, which also zeroes the glow tokens — see globals.css).
 */
const MARKETING_ROUTES = ["/landing", "/welcome", "/login", "/register"];

/**
 * Backdrop — 4 stacked layers behind all app content:
 *   1. bd-base       gradient void surface (theme-scoped via CSS)
 *   2. middle layer  ConstellationLayer (Constellation) or BlackHole (Supernova)
 *   3. bd-stars      CSS-only 20-stop starfield with the twinkle animation
 *   4. bd-grid       48px lattice, masked by radial fade
 *
 * Layers 2–4 render on marketing routes only; data screens keep just the base.
 *
 * Lives at z-index 0 fixed to viewport; pointer-events: none so it never
 * intercepts clicks. Mount once in the root layout.
 */
export function Backdrop() {
  const theme = useAppStore((s) => s.theme);
  const pathname = usePathname();
  const decorated = MARKETING_ROUTES.some((r) => pathname?.startsWith(r));

  useEffect(() => {
    document.body.classList.toggle("route-app", !decorated);
  }, [decorated]);

  return (
    <div className="backdrop" aria-hidden>
      <div className="bd-base" />
      {decorated && theme === "constellation" && <ConstellationLayer />}
      {decorated && theme === "supernova" && <BlackHole />}
      {decorated && <div className="bd-stars twinkle" />}
      {decorated && <div className="bd-grid" />}
    </div>
  );
}
