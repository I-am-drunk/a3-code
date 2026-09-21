// Recursively capture the app.devin.ai production bundle (rolldown/Vite chunks).
//
//   node "Automations UI/_work/crawl-webapp.mjs" <outDir>
//
// Starts from /index.html, then follows every `from"./x.js"`, `import("./x.js")`,
// import(`./x.js`) and "/assets/…" reference until the graph closes. Writes
// assets under <outDir>/assets and an index.json + sha256 manifest next to it.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ORIGIN = "https://app.devin.ai";
const outDir = process.argv[2];
if (!outDir) throw new Error("usage: crawl-webapp.mjs <outDir>");
const assetsDir = join(outDir, "assets");
mkdirSync(assetsDir, { recursive: true });

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

const seen = new Map(); // path -> { size, sha256, status }
const queue = [];
const REF_PATTERNS = [
  /from\s*["'`](\.\/[A-Za-z0-9_.$@-]+\.(?:js|css|json))["'`]/g,
  /import\(\s*["'`](\.\/[A-Za-z0-9_.$@-]+\.(?:js|css|json))["'`]\s*\)/g,
  /["'`](\/assets\/[A-Za-z0-9_.$@\/-]+\.(?:js|css|json|svg|png|woff2?|ttf|webp|mp3|wav|wasm))["'`]/g,
  /(?:src|href)=["'](\/assets\/[^"']+)["']/g,
];

function enqueue(p) {
  if (!seen.has(p)) {
    seen.set(p, null);
    queue.push(p);
  }
}

async function fetchAsset(p) {
  const url = ORIGIN + p;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Referer: ORIGIN + "/", Accept: "*/*" } });
      const buf = Buffer.from(await res.arrayBuffer());
      return { status: res.status, buf, type: res.headers.get("content-type") ?? "" };
    } catch (e) {
      if (attempt === 2) return { status: 0, buf: Buffer.alloc(0), type: "", error: String(e) };
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
}

function extractRefs(text) {
  const refs = new Set();
  for (const re of REF_PATTERNS) {
    for (const m of text.matchAll(re)) {
      let ref = m[1];
      if (ref.startsWith("./")) ref = "/assets/" + ref.slice(2);
      refs.add(ref);
    }
  }
  return refs;
}

async function worker() {
  while (queue.length) {
    const p = queue.shift();
    const { status, buf, type, error } = await fetchAsset(p);
    const rel = p.replace(/^\/assets\//, "").replace(/^\//, "");
    const dest = p === "/index.html" ? join(outDir, "index.html") : join(assetsDir, rel);
    mkdirSync(join(dest, ".."), { recursive: true });
    if (status === 200) writeFileSync(dest, buf);
    const sha = createHash("sha256").update(buf).digest("hex");
    seen.set(p, { status, size: buf.length, sha256: sha, type, error });
    if (status === 200 && /javascript|css|html|json/.test(type)) {
      for (const ref of extractRefs(buf.toString("utf8"))) enqueue(ref);
    }
    if (seen.size % 100 === 0) console.log(`[crawl] ${seen.size} discovered, ${queue.length} queued`);
  }
}

enqueue("/index.html");
// index.html is fetched at "/" — remap.
const first = await fetchAsset("/");
writeFileSync(join(outDir, "index.html"), first.buf);
seen.set("/index.html", { status: first.status, size: first.buf.length, sha256: createHash("sha256").update(first.buf).digest("hex"), type: first.type });
queue.length = 0;
for (const ref of extractRefs(first.buf.toString("utf8"))) enqueue(ref);

await Promise.all(Array.from({ length: 12 }, worker));

const entries = [...seen.entries()].sort(([a], [b]) => a.localeCompare(b));
writeFileSync(join(outDir, "index.json"), JSON.stringify({ origin: ORIGIN, capturedAt: new Date().toISOString(), count: entries.length, assets: Object.fromEntries(entries) }, null, 2));
writeFileSync(join(outDir, "all-assets.sha256"), entries.filter(([, v]) => v?.status === 200).map(([p, v]) => `${v.sha256}  ${p}`).join("\n") + "\n");
const ok = entries.filter(([, v]) => v?.status === 200).length;
const bad = entries.filter(([, v]) => v?.status !== 200);
console.log(`[crawl] done: ${ok} ok, ${bad.length} failed`);
for (const [p, v] of bad.slice(0, 20)) console.log(`  ${v?.status} ${p} ${v?.error ?? ""}`);
