"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ChevronDown } from "lucide-react";
import { money, stories, summarize, type StoryId } from "../demo/scenarios";
import s from "./landing.module.css";
export function HorizonPreview() {
  const [storyId, setStory] = useState<StoryId>("personal");
  const [delayed, setDelayed] = useState(false);
  const story = stories[storyId];
  const summary = summarize(story, [], delayed);
  const gradient = `horizon-${useId().replace(/:/g, "")}`;
  const max = Math.max(...summary.points.map(p => p.amount)) * 1.16;
  const min = Math.min(0, ...summary.points.map(p => p.amount));
  const points = summary.points.map(p => ({ ...p, x: 14 + (p.day - 10) / 21 * 402, y: 174 - (p.amount - min) / (max - min) * 152 }));
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const plan = story.plans.find(p => p.type === "expense")!;
  return <div className={s.previewWrap}><div className={s.preview}>
    <div className={s.previewTop}><span><span className={s.previewDot} /> A LITTLE PERSPECTIVE</span><span>OCT 2026 · THB</span></div>
    <div className={s.previewTabs} aria-label="Choose a fictional example">{(["personal", "business"] as const).map(id => <button key={id} type="button" aria-pressed={storyId === id} onClick={() => { setStory(id); setDelayed(false); }}>{id === "personal" ? "Personal month" : "Business X"}</button>)}<span>FICTIONAL EXAMPLE</span></div>
    <div className={s.previewValue}><span>Room after planned reserves</span><strong aria-live="polite">{money(summary.remaining)}</strong><small>At the end of this sample month</small></div>
    <div className={s.chartLegend}><span><i /> Planned after 10 Oct</span><span>Reserves included</span></div>
    <svg className={s.chart} viewBox="0 0 430 202" role="img" aria-label={`Fictional month-end plan: ${money(summary.remaining)} after reserves. Exact values follow below.`}><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#c6df9b" stopOpacity=".2" /><stop offset="1" stopColor="#c6df9b" stopOpacity="0" /></linearGradient></defs>{[35, 81, 127, 174].map(y => <line key={y} x1="14" y1={y} x2="416" y2={y} stroke="#ffffff14" />)}<path d={`${path} L416,174 L14,174 Z`} fill={`url(#${gradient})`} /><path d={path} stroke="#dce9af" strokeWidth="2" strokeDasharray="5 5" fill="none" strokeLinejoin="round" />{points.map((p, i) => <circle key={`${p.day}-${i}`} cx={p.x} cy={p.y} r={i === 0 ? 4.5 : 3} fill={i === 0 ? "#dce9af" : "#123d32"} stroke="#dce9af"><title>{`${p.title}: ${money(p.amount)}`}</title></circle>)}{[10, 15, 20, 25, 31].map(day => <text key={day} x={14 + (day - 10) / 21 * 402} y="199" fill="#c0d3c5" fontSize="10" textAnchor={day === 31 ? "end" : "start"}>{day} Oct</text>)}</svg>
    <div className={s.upcoming}><span><CalendarDays size={19} /></span><div><small>NEXT PLANNED EXPENSE</small><b>{plan.title}</b></div><div><b>{money(plan.amount)}</b><small>{plan.day} October</small></div></div>
    <div className={s.previewScenario}><label><input type="checkbox" checked={delayed} onChange={e => setDelayed(e.target.checked)} /> What if income arrives next month?</label><span>Try it</span></div>
    <details className={s.assumptions}><summary>See the numbers behind the plan <ChevronDown size={13} /></summary><dl>{[["Opening cash", story.opening], ["Recorded income", summary.income], ["Recorded expenses", -summary.spent], ["Planned income", summary.plannedIncome], ["Planned expenses", -summary.plannedCosts], ["Planned reserves", -summary.reserved]].map(([label, amount]) => <div key={String(label)}><dt>{label}</dt><dd>{money(Number(amount))}</dd></div>)}</dl><p>Reserves are an allocation intention. This browser-only illustration is separate from real records and the production forecast.</p></details>
  </div><div className={s.previewCaption}><span>Understand the plan. Explore a possibility.</span><Link href="/demo">Open the full demo <ArrowUpRight size={13} /></Link></div></div>;
}
