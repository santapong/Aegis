import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronDown } from "lucide-react";
import {
  articles,
  audienceLabel,
  docHref,
  articleCategory,
  type Audience,
  type DocArticle,
} from "./catalog";
import s from "./docs.module.css";
import { docCategories, type DocCategoryId } from "./taxonomy";
import { DocPageActions } from "./docs-controls";

export function GuideCards({ audience, category }: { audience?: Audience; category?: DocCategoryId }) {
  return (
    <div className={s.guideGrid}>
      {articles
        .filter((article) => (!audience || article.audience === audience) && (!category || articleCategory(article) === category))
        .map((article) => (
          <Link
            href={docHref(article)}
            key={article.slug}
            className={s.guideCard}
          >
            <span className={s.kicker}>{article.kind}</span>
            <h2>{article.title}</h2>
            <p>{article.description}</p>
            <span className={s.readLink}>
              Read guide <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
        ))}
    </div>
  );
}
export function Notice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <aside className={s.notice}>
      <strong>{title}</strong>
      <div>{children}</div>
    </aside>
  );
}
export function Result({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.result}>
      <Check size={18} aria-hidden="true" />
      <div>
        <strong>What you should see</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}
export function FieldTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className={s.tableWrap}>
      <table>
        <caption>Example values to enter</caption>
        <thead>
          <tr>
            <th scope="col">Field in Aegis</th>
            <th scope="col">Example</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([field, value]) => (
            <tr key={field}>
              <th scope="row">{field}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function SourceLink({
  path,
  directory = false,
  children,
}: {
  path: string;
  directory?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      className={s.inlineLink}
      href={`https://github.com/santapong/Aegis/${directory ? "tree" : "blob"}/HEAD/${path}`}
    >
      {children}
      <ArrowUpRight size={14} aria-hidden="true" />
    </a>
  );
}
export function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={s.docSection}>
      <h2>
        <a href={`#${id}`}>{title}</a>
      </h2>
      {children}
    </section>
  );
}
function SidebarLinks({ article }: { article: DocArticle }) {
  return (
    <>
      <Link href="/docs" className={s.sidebarHome}>
        Documentation home
      </Link>
      <nav aria-label="Documentation topics">
        {docCategories.map(category => {
          const topics = articles.filter(a => articleCategory(a) === category.id);
          return <details key={category.id} className={s.navGroup} open={articleCategory(article) === category.id}><summary>{category.label}</summary><Link href={`/docs/topics/${category.id}`} className={s.categoryOverview}>Category overview</Link>{topics.map(a=><Link href={docHref(a)} key={a.slug} aria-current={article.slug===a.slug ? "page" : undefined}>{a.title}</Link>)}</details>;
        })}
      </nav>
      <div className={s.switchPath}>
        <span>
          {article.audience === "guides"
            ? "Building an integration?"
            : "Just want to use the app?"}
        </span>
        <Link
          href={
            article.audience === "guides" ? "/docs/developers" : "/docs/guides"
          }
        >
          {article.audience === "guides"
            ? "Go to developer docs"
            : "Go to the user guide"}
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
export function ArticleShell({
  article,
  children,
}: {
  article: DocArticle;
  children: React.ReactNode;
}) {
  const collection = articles.filter((a) => a.audience === article.audience);
  const index = collection.findIndex((a) => a.slug === article.slug);
  const next = collection[index + 1];
  return (
    <div className={s.articleLayout}>
      <aside className={s.sidebar}>
        <SidebarLinks article={article} />
      </aside>
      <main id="docs-main" className={s.article}>
        <div className={s.breadcrumb}>
          <Link href="/docs">Docs</Link>
          <span>/</span>
          <Link href={`/docs/${article.audience}`}>
            {audienceLabel(article.audience)}
          </Link>
        </div>
        <header className={s.articleHeader}>
          <div className={s.articleMeta}><p className={s.kicker}>{docCategories.find(c=>c.id===articleCategory(article))?.label} / {article.kind}</p><DocPageActions href={`${docHref(article)}.md`} /></div>
          <h1>{article.title}</h1>
          <p>{article.description}</p>
          <div className={s.outcome}>
            <span>YOU&apos;LL LEARN</span>
            {article.outcome}
          </div>
        </header>
        <details className={s.mobileContents}>
          <summary>
            Browse this guide <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <nav aria-label="On this page on mobile">
            {article.sections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                {section.title}
              </a>
            ))}
            <Link href={`/docs/${article.audience}`}>
              All {audienceLabel(article.audience).toLowerCase()} articles{" "}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </nav>
        </details>
        {['first-steps','transactions'].includes(article.slug) && <Notice title="Choose the record workflow you use">These steps cover Unassigned records where that entry path is enabled. For verified tracked-account movements, start with <Link href="/docs/guides/accounts">Accounts</Link> and <Link href="/docs/guides/review">Review & activity</Link>. Do not record the same movement in both places.</Notice>}
        <div className={s.articleBody}>{children}</div>
        <nav className={s.articleNext} aria-label="Continue reading">
          <Link href={`/docs/${article.audience}`}>
            <span>BACK TO COLLECTION</span>
            {audienceLabel(article.audience)}
          </Link>
          {next && (
            <Link href={docHref(next)}>
              <span>NEXT GUIDE</span>
              {next.title}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          )}
        </nav>
      </main>
      <aside className={s.onThisPage}>
        <p>ON THIS PAGE</p>
        <nav aria-label="On this page">
          {article.sections.map((section) => (
            <a href={`#${section.id}`} key={section.id}>
              {section.title}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  );
}
