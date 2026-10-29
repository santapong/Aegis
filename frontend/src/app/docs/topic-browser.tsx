"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { articles, articleCategory, docHref } from "./catalog";
import { docCategories } from "./taxonomy";
import { findDocArticles } from "./search";
import s from "./docs.module.css";
export function TopicBrowser(){
 const [category,setCategory]=useState('all'); const [query,setQuery]=useState('');
 const results=useMemo(()=>findDocArticles(articles,query).filter(a=>category==='all'||articleCategory(a)===category),[category,query]);
 return <section id="topics" className={s.topicBrowser} aria-labelledby="topics-heading"><div className={s.topicHeading}><div><p className={s.kicker}>A QUESTION. A USEFUL NEXT STEP.</p><h2 id="topics-heading">Find your next topic.</h2></div><label className={s.topicSearch}><Search size={17} aria-hidden="true" /><span className="sr-only">Filter topics</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search a topic or task…" onKeyDown={e=>{if(e.key==='Escape')setQuery('')}} /></label></div><div className={s.topicFilters} aria-label="Filter by documentation category"><button type="button" aria-pressed={category==='all'} onClick={()=>setCategory('all')}>All topics</button>{docCategories.map(c=><button key={c.id} type="button" aria-pressed={category===c.id} onClick={()=>setCategory(c.id)}>{c.label}</button>)}</div><p className={s.topicCount} role="status">{results.length} {results.length===1?'topic':'topics'} to explore</p><div className={s.topicList}>{results.map(a=><Link href={docHref(a)} key={a.slug}><span>{docCategories.find(c=>c.id===articleCategory(a))?.label}<small>{a.audience==='developers'?'Developer guide':'Everyday guide'}</small></span><div><h3>{a.title}</h3><p>{a.description}</p></div><ArrowUpRight size={17} aria-hidden="true" /></Link>)}</div>{!results.length&&<div className={s.topicEmpty}><h3>No topics match that combination.</h3><p>Try a shorter phrase, or return to all topics.</p><button type="button" onClick={()=>{setCategory('all');setQuery('')}}>Show all topics</button></div>}</section>;
}
