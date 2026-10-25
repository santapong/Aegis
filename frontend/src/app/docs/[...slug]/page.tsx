import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articles, audienceLabel, type Audience } from "../catalog";
import { ArticleShell, GuideCards } from "../docs-components";
import { articleContent } from "../content";
import { SITE_URL } from "@/lib/site";
import s from "../docs.module.css";
import { docCategories } from "../taxonomy";
import { articleCategory } from "../catalog";

export const dynamicParams = false;
export function generateStaticParams() {
  return [
    { slug: ["guides"] },
    { slug: ["developers"] },
    ...docCategories.map(c=>({slug:["topics",c.id]})),
    ...articles.map((a) => ({ slug: [a.audience, a.slug] })),
  ];
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find(
    (a) => a.audience === slug[0] && a.slug === slug[1],
  );
  const title =
    article?.title || docCategories.find(c=>slug[0]==="topics"&&c.id===slug[1])?.label ||
    (slug[0] === "guides" ? "User guide" : "Developer documentation");
  return {
    title: { absolute: `${title} — Aegis Docs` },
    description:
      article?.description ||
      (slug[0] === "guides"
        ? "Practical guides for recording money, setting budgets, planning ahead and exporting your data."
        : "Local setup, authenticated API requests and the Aegis codebase."),
    alternates: { canonical: `${SITE_URL}/docs/${slug.join("/")}`, ...(article ? {types:{"text/markdown":`${SITE_URL}/docs/${article.audience}/${article.slug}.md`}} : {}) },
  };
}
export default async function DocRoute({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  if (slug[0] === "topics") {
    const category = docCategories.find(c=>c.id===slug[1]);
    if(!category || slug.length!==2)notFound();
    const topics=articles.filter(a=>articleCategory(a)===category.id);
    return <main id="docs-main" className={s.home}><div className={s.breadcrumb}><Link href="/docs">Library</Link><span>/</span><span>{category.label}</span></div><header className={s.collectionIntro}><p className={s.kicker}>EXPLORE A TOPIC CATEGORY · {topics.length} GUIDES</p><h1>{category.label}</h1><p>{category.description}</p></header><GuideCards category={category.id} /></main>;
  }
  if (!["guides", "developers"].includes(slug[0])) notFound();
  if (slug.length === 1) {
    const audience = slug[0] as Audience;
    return (
      <main id="docs-main" className={s.home}>
        <div className={s.breadcrumb}>
          <Link href="/docs">Docs</Link>
          <span>/</span>
          <span>{audienceLabel(audience)}</span>
        </div>
        <header className={s.collectionIntro}>
          <p className={s.kicker}>
            {audience === "guides"
              ? "EVERYDAY MONEY, STEP BY STEP"
              : "BUILD & SELF-HOST"}
          </p>
          <h1>
            {audience === "guides"
              ? "Get comfortable with Aegis."
              : "Make Aegis work with your tools."}
          </h1>
          <p>
            {audience === "guides"
              ? "Start with your first record, then choose a guide for the next thing you want to do. Each one explains what to enter and how to check the result."
              : "Start a local environment, make an authenticated request, or understand the code before extending it."}
          </p>
        </header>
        <GuideCards audience={audience} />
      </main>
    );
  }
  const article = articles.find(
    (a) => a.audience === slug[0] && a.slug === slug[1],
  );
  if (!article || slug.length !== 2) notFound();
  return (
    <ArticleShell article={article}>
      {articleContent[article.slug]}
    </ArticleShell>
  );
}
