import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const source = option('--export');
const output = option('--output');
const projectId = option('--project-id');
const orgId = option('--team-id');
for (const [name, path] of [['--export', source], ['--output', output]]) {
  if (!args.includes(name) || !path || !isAbsolute(path)) throw new Error(`${name} must be an absolute path`);
}
if (!args.includes('--project-id') || !projectId?.startsWith('prj_') || !args.includes('--team-id') || !orgId?.startsWith('team_')) throw new Error('Explicit project/team IDs are required');
for (const file of ['index.html', 'demo/index.html', 'docs/index.html', '404.html', 'robots.txt', 'sitemap.xml']) await readFile(join(source, file));
await mkdir(output); // Never overwrite a frozen deploy package.
const target = join(output, '.vercel/output/static');
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true, dereference: false });
const files = [];
async function walk(path = '') {
  for (const entry of await readdir(join(target, path), { withFileTypes: true })) {
    const relativePath = path ? `${path}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in export: ${relativePath}`);
    if (entry.isDirectory()) await walk(relativePath);
    else {
      if (/(^|\/)(\.env[^/]*|node_modules|backend|\.git)(\/|$)|\.(db|sqlite|map)$/.test(relativePath)) throw new Error(`Non-public artifact in export: ${relativePath}`);
      const buffer = await readFile(join(target, relativePath));
      files.push({ path: relativePath, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') });
    }
  }
}
await walk();
const pages = files.filter((f) => f.path.endsWith('/index.html') || f.path === 'index.html');
const escaped = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const routes = [
  { src: '/(.*)', headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'DENY' }, continue: true },
  { src: '/_next/static/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
  ...pages.map((f) => ({ src: f.path === 'index.html' ? '^/$' : `^/${escaped(f.path.slice(0, -'/index.html'.length))}/?$`, dest: `/${f.path}` })),
  { handle: 'filesystem' },
  { src: '/(.*)', status: 404, dest: '/404.html' },
];
await writeFile(join(output, '.vercel/output/config.json'), JSON.stringify({ version: 3, routes }, null, 2) + '\n');
await writeFile(join(output, '.vercel/project.json'), JSON.stringify({ projectId, orgId, projectName: 'draveniq-aegis-landing' }, null, 2) + '\n');
await writeFile(join(output, 'vercel.json'), JSON.stringify({ framework: null, buildCommand: null, installCommand: null }, null, 2) + '\n');
await writeFile(join(output, 'artifact-manifest.json'), JSON.stringify({ stage: 'static package, not deployment evidence', created: new Date().toISOString(), source, projectId, orgId, files }, null, 2) + '\n');
console.log(JSON.stringify({ output, staticFiles: files.length, pages: pages.length, bytes: files.reduce((total, f) => total + f.bytes, 0), functions: 0 }));
