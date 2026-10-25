import { articles } from "@/app/docs/catalog";
import { articleMarkdown, markdownHeaders } from "@/app/docs/markdown";
export const dynamic="force-static";
export const dynamicParams=false;
export function generateStaticParams(){return articles.map(a=>({audience:a.audience,topic:a.slug}));}
export async function GET(_request:Request,{params}:{params:Promise<{audience:string;topic:string}>}){const {audience,topic}=await params;const article=articles.find(a=>a.audience===audience&&a.slug===topic);if(!article)return new Response('Documentation topic not found.',{status:404});return new Response(articleMarkdown(article),{headers:markdownHeaders});}
