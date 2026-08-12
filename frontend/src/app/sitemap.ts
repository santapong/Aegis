import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/landing`,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/welcome`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/docs`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/changelog`,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];
}
