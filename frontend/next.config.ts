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
    // Same-origin proxy: the browser hits `/api/*`, Next.js rewrites
    // server-side to the internal backend URL. Operators set
    // BACKEND_INTERNAL_URL per environment (Vercel env, ECS task def,
    // Cloud Run env). No build-time bake-in, so the same image deploys
    // anywhere.
    const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
