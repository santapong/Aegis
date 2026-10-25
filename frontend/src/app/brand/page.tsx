import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { AegisMark } from "@/components/brand";
import { ArrowDownToLine, ArrowUpRight } from "lucide-react";
import s from "./studio.module.css";

export const metadata: Metadata = {
  title: "Brand",
  description: "Union, the Aegis identity. Support, guidance and momentum in one mark, with light and dark logo downloads.",
};
const principles = [
  { name: "Support", text: "Interlocking curves create a steady foundation. A clear plan starts with understanding where you stand." },
  { name: "Guidance", text: "A rising A leaves an open space at its centre. A clear direction, with room for your own decisions." },
  { name: "Momentum", text: "One flowing path connects the form. Small, deliberate steps toward what comes next." },
];
export default function BrandStudio() {
  return <div className={s.page}>
    <MarketingHeader current="brand" />
    <main className={s.main}>
      <header className={s.intro}>
        <p>AEGIS / IDENTITY</p>
        <h1>Stronger together.<br /><em>Open to tomorrow.</em></h1>
        <span>Meet Union. Supportive curves, a clear direction, and a continuous path forward—brought together in the Aegis mark.</span>
      </header>
      <section className={s.identity} aria-labelledby="union-heading">
        <div className={s.story}>
          <p className={s.eyebrow}>ONE IDENTITY. ONE WAY FORWARD.</p>
          <h2 id="union-heading">Union.</h2>
          <p>A calm foundation for everyday money and the bigger things you are planning.</p>
          <div className={s.downloads}>
            <a href="/brand/aegis-union-light.svg" download><ArrowDownToLine size={15} /> Light mark · SVG</a>
            <a href="/brand/aegis-union-dark.svg" download><ArrowDownToLine size={15} /> Dark mark · SVG</a>
            <a href="/brand/aegis-union-icon.svg" download><ArrowDownToLine size={15} /> App icon · SVG</a>
            <a href="/icon.png" download="aegis-union-icon.png"><ArrowDownToLine size={15} /> App icon · PNG</a>
          </div>
        </div>
        <div className={s.signature} role="img" aria-label="Aegis Union logo"><AegisMark size={208} /><span aria-hidden="true">aegis.</span></div>
      </section>
      <section className={s.principles} aria-label="The ideas behind Union">
        {principles.map((principle, index) => <article key={principle.name}><span>0{index + 1}</span><h3>{principle.name}</h3><p>{principle.text}</p></article>)}
      </section>
      <section className={s.system} aria-labelledby="appearance-heading">
        <div className={s.sectionHeading}><p className={s.eyebrow}>ONE IDENTITY. TWO ATMOSPHERES.</p><h2 id="appearance-heading">Same clarity.<br /><em>Different light.</em></h2><p>Evergreen on warm ivory. Soft chartreuse on deep green. The same mark, with room to breathe.</p></div>
        <div className={s.appearances}>
          <div className={s.lightPanel}><span>LIGHT</span><div className={s.lockup} role="img" aria-label="Aegis logo in evergreen on ivory"><AegisMark size={72} /><b aria-hidden="true">aegis.</b></div></div>
          <div className={s.darkPanel}><span>DARK</span><div className={s.lockup} role="img" aria-label="Aegis logo in chartreuse on evergreen"><AegisMark size={72} /><b aria-hidden="true">aegis.</b></div></div>
        </div>
        <Link href="/docs/guides/appearance">Read the appearance guide <ArrowUpRight size={15} /></Link>
      </section>
      <section className={s.details} aria-label="Using the mark">
        <div><h2>Give it a little space.</h2><p>Use one colour, keep the proportions, and leave clear space around the mark. Keep the wordmark upright and the symbol still.</p></div>
        <div className={s.sizes} aria-label="Union mark at 16, 24, 32 and 48 pixels">{[16, 24, 32, 48].map(size => <div key={size}><AegisMark size={size} /><span>{size}px</span></div>)}</div>
      </section>
    </main>
  </div>;
}
