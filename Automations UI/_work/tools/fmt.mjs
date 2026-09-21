#!/usr/bin/env node
// Format minified rolldown chunks so evidence can be cited as chunk.js:line.
//
//   node "Automations UI/_work/tools/fmt.mjs" <glob-or-name>...
//
// Reads from reference/web-2026-09-20/assets, writes to _work/formatted/<name>.
// Idempotent: skips files whose formatted copy is newer than the source.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WORK = resolve(here, "..");
const ASSETS = resolve(WORK, "../reference/web-2026-09-20/assets");
const OUT = join(WORK, "formatted");
const PRETTIER = join(here, "node_modules/.bin/prettier");
mkdirSync(OUT, { recursive: true });

const patterns = process.argv.slice(2);
if (!patterns.length) {
  console.error("usage: fmt.mjs <substring-or-exact-name>...");
  process.exit(1);
}
const all = readdirSync(ASSETS).filter((f) => f.endsWith(".js"));
const picked = new Set();
for (const p of patterns) {
  const exact = all.find((f) => f === p);
  if (exact) picked.add(exact);
  else for (const f of all) if (f.toLowerCase().includes(p.toLowerCase())) picked.add(f);
}
if (!picked.size) {
  console.error("no chunks matched", patterns);
  process.exit(1);
}
for (const f of picked) {
  const src = join(ASSETS, f);
  const dst = join(OUT, f);
  if (existsSync(dst) && statSync(dst).mtimeMs >= statSync(src).mtimeMs) {
    console.log(`[fmt] skip ${f}`);
    continue;
  }
  const out = execFileSync(PRETTIER, ["--parser", "babel", "--print-width", "100", src], {
    stdio: ["ignore", "pipe", "inherit"],
    maxBuffer: 1 << 30,
  });
  writeFileSync(dst, out);
  console.log(`[fmt] ${f} → formatted/${f} (${out.toString().split("\n").length} lines)`);
}
