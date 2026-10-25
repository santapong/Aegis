import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/landing",
          "/welcome",
          "/login",
          "/register",
          "/docs",
          "/demo",
          "/changelog",
          "/brand",
          "/llms.txt",
          "/llms-full.txt",
          "/mcp-catalog.json",
        ],
        // Everything else is login-gated app/data — nothing for a
        // crawler to index, and letting it try just wastes crawl budget.
        disallow: ["/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
