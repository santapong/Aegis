import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Freeze only reviewed public surfaces. Do not copy app auth, backend, env,
// preview tools, or runtime databases into a landing-page release.
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const output = option('--output');
const siteUrl = option('--site-url');
const appUrl = option('--app-url');
if (!args.includes('--output') || !output || !isAbsolute(output)) throw new Error('--output must be a new absolute directory');
for (const [name, value] of [['--site-url', siteUrl], ['--app-url', appUrl]]) {
  if (!args.includes(name) || !value || new URL(value).protocol !== 'https:') throw new Error(`${name} must be an HTTPS origin`);
  if (new URL(value).origin !== value) throw new Error(`${name} must not include a path or trailing slash`);
}
await mkdir(output); // Fail closed if a previous frozen release exists.
const entries = [];
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
async function copyFile(path) {
  const source = await readFile(join(repo, 'frontend', path));
  const destination = join(output, path);
  await mkdir(dirname(destination), { recursive: true });
  let result = source;
  if (/\.(tsx?|css)$/.test(path)) {
    let text = source.toString();
    if (text.includes('import { Syne } from "next/font/google";')) {
      text = text.replace('import { Syne } from "next/font/google";', 'import { syne } from "@/lib/fonts";')
        .replace(/const syne = Syne\(\{[\s\S]*?\}\);\n/, '');
    }
    for (const route of ['login', 'register', 'changelog']) text = text.replaceAll(`href="/${route}"`, `href="${appUrl}/${route}"`);
    if (path === 'src/app/landing/page.tsx') {
      text = text.replaceAll('${SITE_URL}/landing', '${SITE_URL}')
        .replaceAll(`href="${appUrl}/register"`, 'href="/demo"')
        .replace('Create an account ', 'Try the demo ')
        .replace('Create your Aegis account', 'Explore the demo')
        .replace('<Link href="/demo" className={s.secondary}>', '<Link href="/docs" className={s.secondary}>')
        .replace('Try the interactive demo', 'Read the documentation');
    }
    if (path === 'src/components/marketing/marketing-header.tsx') {
      text = text.replaceAll(`href="${appUrl}/register"`, 'href="/demo"')
        .replaceAll('Sign in', 'Open app')
        .replace('Get started ', 'Try the demo ');
    }
    result = Buffer.from(text);
  }
  await writeFile(destination, result);
  entries.push({ source: `frontend/${path}`, destination: path, sourceSha256: hash(source), releaseSha256: hash(result), bytes: result.length });
}
async function copyDirectory(path) {
  for (const entry of await readdir(join(repo, 'frontend', path), { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) await copyDirectory(child);
    else if (child !== 'src/app/docs/error.tsx' && /\.(tsx?|css|csv)$/.test(child)) await copyFile(child);
  }
}
for (const path of ['src/app/landing', 'src/app/demo', 'src/app/docs', 'src/components/marketing', 'public/docs']) await copyDirectory(path);
for (const path of ['src/app/icon.png', 'src/app/globals.css', 'tsconfig.json', 'postcss.config.mjs']) await copyFile(path);
for (const filename of ['inter-latin.woff2', 'jetbrains-mono-latin.woff2', 'syne-latin.woff2']) {
  const sourcePath = `scripts/landing-assets/fonts/${filename}`;
  const destination = `src/assets/fonts/${filename}`;
  const buffer = await readFile(join(repo, sourcePath));
  await mkdir(dirname(join(output, destination)), { recursive: true });
  await writeFile(join(output, destination), buffer);
  entries.push({ source: sourcePath, destination, sourceSha256: hash(buffer), releaseSha256: hash(buffer), bytes: buffer.length });
}
for (const filename of ['Inter-OFL.txt', 'JetBrains-Mono-OFL.txt', 'Syne-OFL.txt']) {
  const sourcePath = `scripts/landing-assets/licenses/${filename}`;
  const destination = `public/licenses/${filename}`;
  const buffer = await readFile(join(repo, sourcePath));
  await mkdir(dirname(join(output, destination)), { recursive: true });
  await writeFile(join(output, destination), buffer);
  entries.push({ source: sourcePath, destination, sourceSha256: hash(buffer), releaseSha256: hash(buffer), bytes: buffer.length });
}
async function generated(path, content) {
  await mkdir(dirname(join(output, path)), { recursive: true });
  await writeFile(join(output, path), content);
  entries.push({ destination: path, generated: true, releaseSha256: hash(content), bytes: Buffer.byteLength(content) });
}
const versions = {};
for (const name of ['next', 'react', 'react-dom', 'lucide-react', 'typescript', '@types/node', '@types/react', '@types/react-dom', 'tailwindcss', '@tailwindcss/postcss', 'postcss']) {
  versions[name] = JSON.parse(await readFile(join(repo, 'frontend/node_modules', name, 'package.json'), 'utf8')).version;
}
await generated('package.json', JSON.stringify({ name: 'aegis-landing', version: '1.0.0', private: true, scripts: { build: 'next build' }, dependencies: Object.fromEntries(['next', 'react', 'react-dom', 'lucide-react'].map((n) => [n, versions[n]])), devDependencies: Object.fromEntries(Object.entries(versions).filter(([n]) => !['next', 'react', 'react-dom', 'lucide-react'].includes(n))) }, null, 2) + '\n');
await generated('next.config.ts', 'import type { NextConfig } from "next";\nconst config: NextConfig = { output: "export", trailingSlash: true, images: { unoptimized: true } };\nexport default config;\n');
await generated('src/lib/site.ts', `export const SITE_URL = ${JSON.stringify(siteUrl)};\nexport const SITE_NAME = "Aegis";\nexport const SITE_DESCRIPTION = "Aegis is an open-source personal finance app. Track income and expenses, plan upcoming costs, and follow budgets and savings goals.";\n`);
await generated('src/lib/fonts.ts', `import localFont from "next/font/local";
export const inter = localFont({ src: "../assets/fonts/inter-latin.woff2", weight: "100 900", display: "swap", variable: "--font-sans", fallback: ["Arial"] });
export const mono = localFont({ src: "../assets/fonts/jetbrains-mono-latin.woff2", weight: "100 800", display: "swap", variable: "--font-mono", fallback: ["Courier New"], adjustFontFallback: false });
export const syne = localFont({ src: "../assets/fonts/syne-latin.woff2", weight: "400 800", display: "swap", variable: "--font-syne", fallback: ["Arial"] });
`);
await generated('src/app/page.tsx', 'export { default, metadata } from "./landing/page";\n');
await generated('src/app/layout.tsx', `import type { Metadata } from "next";
import { inter, mono } from "@/lib/fonts";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import "./globals.css";
export const metadata: Metadata = { metadataBase: new URL(SITE_URL), title: { default: SITE_NAME, template: "%s — Aegis" }, description: SITE_DESCRIPTION, robots: { index: true, follow: true } };
export default function Layout({ children }: { children: React.ReactNode }) { return <html lang="en"><body className={inter.variable + " " + mono.variable + " antialiased font-sans theme-meridian"}>{children}</body></html>; }
`);
await generated('src/app/not-found.tsx', `import Link from "next/link";
export default function NotFound() { return <main style={{ maxWidth: 650, margin: "15vh auto", padding: 24, color: "#EDE7DC" }}><h1>That page is not here.</h1><p>This public site contains the Aegis overview, demo, and documentation.</p><Link href="/" style={{ display: "inline-block", marginTop: 24, color: "#E8913C" }}>Return to Aegis →</Link></main>; }
`);
await generated('src/app/docs/error.tsx', `"use client";
import Link from "next/link";
export default function DocsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <main id="docs-main" style={{ maxWidth: 650, margin: "10vh auto", padding: 24, color: "#EDE7DC" }}><h1>We couldn't show this guide.</h1><p role="alert">Try again, or return to the documentation overview.</p><button onClick={reset} style={{ minHeight: 44, margin: "24px 18px 0 0", padding: "10px 18px", background: "#E8913C", color: "#181D20", border: "1px solid #E8913C", borderRadius: 8 }}>Try again</button><Link href="/docs" style={{ display: "inline-block", padding: 12, color: "#8EB9AA" }}>Documentation overview →</Link></main>; }
`);
await generated('src/app/robots.ts', `import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
export const dynamic = "force-static";
export default function robots(): MetadataRoute.Robots { return { rules: { userAgent: "*", allow: "/" }, sitemap: SITE_URL + "/sitemap.xml" }; }
`);
await generated('src/app/sitemap.ts', `import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { articles, docHref } from "./docs/catalog";
export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap { return ["", "/demo", "/docs", "/docs/guides", "/docs/developers", ...articles.map(docHref)].map((path) => ({ url: SITE_URL + path, changeFrequency: "monthly", priority: path === "" ? 1 : 0.7 })); }
`);
await generated('.gitignore', 'node_modules/\n.next/\nout/\n.vercel/\n.env*\nnext-env.d.ts\ntsconfig.tsbuildinfo\n');
const manifest = { stage: 'frozen public source, not deployment evidence', created: new Date().toISOString(), sourceRepository: repo, baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), sourceBranch: execFileSync('git', ['branch', '--show-current'], { cwd: repo, encoding: 'utf8' }).trim(), siteUrl, appUrl, note: 'Includes reviewed uncommitted public files. No Git commit/push, theme-concept selection, API deployment, or database change.', files: entries };
await writeFile(join(output, 'source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output, files: entries.length, siteUrl, appUrl }));
