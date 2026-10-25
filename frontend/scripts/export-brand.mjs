/** Export the shared Union geometry; run from frontend with node scripts/export-brand.mjs. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../", import.meta.url);
const union = JSON.parse(await readFile(new URL("src/lib/brand-mark.json", root), "utf8"));
const paths = union.paths.map(d => `<path d="${d}"/>`).join("");
const svg = (body, viewBox = union.viewBox) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="Aegis Union"><title>Aegis Union</title>${body}</svg>\n`;
const mark = color => svg(`<g fill="${color}">${paths}</g>`);
const icon = (rounded = true) => svg(`<rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="${union.colors.evergreen}"/><g transform="translate(65 120) scale(.68)" fill="${union.colors.chartreuse}">${paths}</g>`, "0 0 512 512");
await mkdir(new URL("public/brand/", root), { recursive: true });
await writeFile(new URL("public/brand/aegis-union-light.svg", root), mark(union.colors.evergreen));
await writeFile(new URL("public/brand/aegis-union-dark.svg", root), mark(union.colors.chartreuse));
await writeFile(new URL("public/brand/aegis-union-icon.svg", root), icon());
await sharp(Buffer.from(icon(false))).resize(512, 512).png().toFile(fileURLToPath(new URL("src/app/icon.png", root)));
await sharp(Buffer.from(icon(false))).resize(180, 180).png().toFile(fileURLToPath(new URL("src/app/apple-icon.png", root)));

// ICO supports PNG payloads. Include actual small-size renders for desktop browsers.
const sizes = [16, 32, 48];
const buffers = [];
for (const size of sizes) buffers.push(await sharp(Buffer.from(icon())).resize(size, size).png().toBuffer());
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
for (let index = 0; index < sizes.length; index++) {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(buffers[index].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += buffers[index].length;
}
await writeFile(new URL("src/app/favicon.ico", root), Buffer.concat([header, ...buffers]));
console.log("Exported Union SVGs, 512px app icon, 180px Apple icon, and 16/32/48px favicon.");
