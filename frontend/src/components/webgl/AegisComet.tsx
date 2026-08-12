"use client";

import { useEffect, useRef } from "react";
import { Renderer } from "@/lib/webgl/core/Renderer";
import { DEFAULT_COMET_CONFIG } from "@/lib/webgl/comet/CometConfig";

/**
 * Manages the canvas element's lifecycle only — create it, hand it to
 * Renderer, start, and dispose on unmount. All WebGL2/GLSL/animation logic
 * lives in src/lib/webgl; nothing here touches a GL context.
 */
export function AegisComet({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    host.appendChild(canvas);

    let renderer: Renderer | null = null;
    try {
      renderer = new Renderer(canvas, DEFAULT_COMET_CONFIG);
      renderer.start();
    } catch (err) {
      // No WebGL2 support, or context creation failed — leave the
      // transparent canvas empty rather than crashing the page.
      console.error("[AegisComet] WebGL2 init failed:", err);
    }

    return () => {
      renderer?.dispose();
      host.removeChild(canvas);
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
