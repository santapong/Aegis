import type { DocArticle } from "./catalog";

/** Use the same task-word matching in the library filter and guide search. */
export function findDocArticles(pool: readonly DocArticle[], query: string): DocArticle[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return pool.filter((article) => {
    const content = `${article.title} ${article.description} ${article.keywords} ${article.sections.map((section) => section.title).join(" ")}`.toLowerCase();
    return words.every((word) => content.includes(word));
  });
}
