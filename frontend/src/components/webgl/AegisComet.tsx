"use client";

import { useEffect, useRef } from "react";
import { Renderer } from "@/lib/webgl/core/Renderer";
import { DEFAULT_COMET_CONFIG } from "@/lib/webgl/comet/CometConfig";

/**
 * Manages the canvas element's lifecycle only — create it, hand it to
 * Renderer, start, and dispose on unmount. All WebGL2/GLSL/animation logic
 * lives in src/lib/webgl; nothing here touches a GL context.
 */
export function AegisComet({
  className,
  scrollSourceId,
}: {
  className?: string;
  scrollSourceId?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    host.appendChild(canvas);

    let renderer: Renderer | null = null;
    try {
      const scrollSource = scrollSourceId
        ? document.getElementById(scrollSourceId)
        : null;
      renderer = new Renderer(canvas, DEFAULT_COMET_CONFIG, scrollSource);
      const params = new URLSearchParams(window.location.search);
      const stillParam = params.get("comet-still");
      const stillProgress = stillParam === null ? Number.NaN : Number(stillParam);

      if (Number.isFinite(stillProgress)) {
        renderer.renderStill(
          stillProgress,
          params.get("comet-reduced-motion") === "1"
        );
      } else {
        renderer.start();
      }

      if (params.get("comet-context-test") === "1") {
        window.setTimeout(() => renderer?.testContextRestoration(), 500);
      }
    } catch (err) {
      // No WebGL2 support, or context creation failed — leave the
      // transparent canvas empty rather than crashing the page.
      console.error("[AegisComet] WebGL2 init failed:", err);
    }

    return () => {
      renderer?.dispose();
      host.removeChild(canvas);
    };
  }, [scrollSourceId]);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
