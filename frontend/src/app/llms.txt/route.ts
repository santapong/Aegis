import { docsIndex, markdownHeaders } from "@/app/docs/markdown";
export const dynamic="force-static";
export function GET(){return new Response(docsIndex(),{headers:markdownHeaders});}
