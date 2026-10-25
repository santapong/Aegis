import { isValidElement, type ReactNode } from "react";
import { articles, articleCategory, docHref, type DocArticle } from "./catalog";
import { articleContent } from "./content";
import { docCategories } from "./taxonomy";
import { mcpTools } from "./mcp-tools";

type Props = {children?:ReactNode; id?:string; title?:string; href?:string; path?:string; directory?:boolean; className?:string; label?:string; code?:string; rows?:[string,string][]};
function walk(node:ReactNode):string {
  if(node===null || node===undefined || typeof node==='boolean')return '';
  if(typeof node==='string' || typeof node==='number')return String(node);
  if(Array.isArray(node))return node.map(walk).join('');
  if(!isValidElement<Props>(node))return '';
  const p=node.props; if(p.className==='aegis-mcp-reference')return ''; const tag=typeof node.type==='string'?node.type:'';
  const content=walk(p.children);
  if(p.code!==undefined && p.label!==undefined)return `\n\n${p.label}\n\n\`\`\`\n${p.code}\n\`\`\`\n\n`;
  if(p.rows)return '\n\n| Field | Example |\n| --- | --- |\n'+p.rows.map(r=>`| ${r[0].replaceAll('|','\\|')} | ${r[1].replaceAll('|','\\|')} |`).join('\n')+'\n\n';
  if(p.href)return `[${content}](${p.href})`;
  if(p.path)return `[${content}](https://github.com/santapong/Aegis/${p.directory?'tree':'blob'}/HEAD/${p.path})`;
  if(p.title&&p.id)return `\n\n## ${p.title}\n\n${content}\n\n`;
  if(p.title)return `\n\n**${p.title}**\n\n${content}\n\n`;
  if(/^h[1-6]$/.test(tag))return '\n\n'+'#'.repeat(Number(tag.slice(1)))+' '+content+'\n\n';
  if(tag==='p')return content+'\n\n';
  if(tag==='li')return '- '+content.trim()+'\n';
  if(tag==='ol'||tag==='ul')return '\n'+content+'\n';
  if(tag==='strong'||tag==='b')return `**${content}**`;
  if(tag==='em'||tag==='i')return `*${content}*`;
  if(tag==='code')return '`'+content+'`';
  if(tag==='pre')return '\n\n```\n'+content+'\n```\n\n';
  if(tag==='br')return '\n';
  if(tag==='td'||tag==='th')return content+' | ';
  if(tag==='tr')return '| '+content+'\n';
  if(tag==='section'||tag==='article'||tag==='aside'||tag==='details')return '\n\n'+content+'\n\n';
  return content;
}
export const markdownHref=(a:DocArticle)=>`${docHref(a)}.md`;
export function articleMarkdown(article:DocArticle):string {
 const category=docCategories.find(c=>c.id===articleCategory(article))!;
 let body=walk(articleContent[article.slug]);
 // A tool row's label is a separate span in HTML: make the reference explicit in Markdown too.
 if(article.slug==='mcp')body+='\n\n## Tool effects at a glance\n\n'+mcpTools.map(t=>`- **${t.name}** — ${t.effect==='write'?'changes records':t.effect==='provider'?'provider request; possible charges and persisted recommendations':'reads records'}: ${t.description}`).join('\n');
 return `# ${article.title}\n\n> ${article.description}\n\nCategory: ${category.label}\nAudience: ${article.audience==='guides'?'Everyday users':'Developers and self-hosters'}\nReviewed: 2026-10-25\nHTML: ${docHref(article)}\n\nOutcome: ${article.outcome}\n\n${body}`.replace(/\n{3,}/g,'\n\n').trim()+'\n';
}
export function docsIndex():string {
 return '# Aegis\n\n> A clearer today. A bigger tomorrow. Public guides for understanding records, planning money, and using supported integrations.\n\nThis index contains public documentation only. It grants no account access. Features depend on the installed version; fictional demo arithmetic is separate from the production forecast.\n\n'+docCategories.map(c=>`## ${c.label}\n\n${articles.filter(a=>articleCategory(a)===c.id).map(a=>`- [${a.title}](${markdownHref(a)}): ${a.description}`).join('\n')}`).join('\n\n')+'\n\n## Optional\n\n- [Combined public documentation](/llms-full.txt)\n- [Existing local MCP tool catalog](/mcp-catalog.json): Documentation of the stdio server; not a remote MCP endpoint.\n';
}
export const markdownHeaders = {'Content-Type':'text/markdown; charset=utf-8','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=3600','Link':'</llms.txt>; rel="describedby"'};
