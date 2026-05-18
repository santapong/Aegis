import type { NextConfig } from "next";

/**
 * Standalone output is needed for containerized deploys (Docker / ECS /
 * Cloud Run) but Vercel handles bundling natively and the standalone
 * output just slows the Vercel build. Vercel sets VERCEL=1 in its build
 * environment, so we gate the option on that.
 */
const isVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  output: isVercel ? undefined : "standalone",
  async rewrites() {
    // Two deploy topologies supported:
    //
    // 1. Vercel-direct multi-service (vercel.json with
    //    `experimentalServices` at repo root). Vercel routes `/api/*`
    //    to the Python backend service itself — no Next.js rewrite,
    //    AND a rewrite here would collide with Vercel's routing.
    //    Skip the rewrite when BACKEND_INTERNAL_URL is unset.
    //
    // 2. Vercel frontend + separate backend (Render / Fly / Cloud Run
    //    / Docker / etc.). Browser hits `/api/*`, Next.js rewrites
    //    server-side to BACKEND_INTERNAL_URL. Same-origin from the
    //    browser's POV; cookie + auth + CORS work cleanly.
    const explicitBackendUrl = process.env.BACKEND_INTERNAL_URL;
    if (explicitBackendUrl) {
      // Topology 2 (or local dev with the var set).
      return [
        {
          source: "/api/:path*",
          destination: `${explicitBackendUrl}/api/:path*`,
        },
      ];
    }
    if (isVercel) {
      // Topology 1 on Vercel — Vercel's experimentalServices handles
      // /api/* routing. A rewrite here would collide.
      return [];
    }
    // Local dev fallback — `npm run dev` against a uvicorn on :8000.
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
