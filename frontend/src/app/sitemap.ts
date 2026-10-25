import type { MetadataRoute } from "next";
import { articles, docHref } from "./docs/catalog";
import { docCategories } from "./docs/taxonomy";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...articles.map(a=>({url:`${SITE_URL}${docHref(a)}`, changeFrequency:"monthly" as const, priority:0.6})),
    ...docCategories.map(c=>({url:`${SITE_URL}/docs/topics/${c.id}`, changeFrequency:"monthly" as const, priority:0.7})),
    {url:`${SITE_URL}/brand`, changeFrequency:"monthly" as const, priority:0.4},
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
      url: `${SITE_URL}/demo`,
      changeFrequency: "monthly",
      priority: 0.8,
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
