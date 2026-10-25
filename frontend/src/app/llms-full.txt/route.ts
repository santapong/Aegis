import { articles } from "@/app/docs/catalog";
import { articleMarkdown, markdownHeaders } from "@/app/docs/markdown";
export const dynamic="force-static";
export function GET(){return new Response('# Aegis — public documentation\n\nReviewed 25 October 2026. Product and integration guidance only; no private financial records.\n\n'+articles.map(articleMarkdown).join('\n\n---\n\n'),{headers:markdownHeaders});}
