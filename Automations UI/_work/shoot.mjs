// Headless Chrome CDP screenshot runner: node shoot.mjs scenes.json [outDir]
// scene: { name, url, width, height, wait, pre, steps:[{click|hover|eval|type|key|scroll, wait}] }
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333;
const [, , scenesPath, outDir = "_work/shots"] = process.argv;
const scenes = JSON.parse(readFileSync(scenesPath, "utf8"));
mkdirSync(outDir, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), "shoot-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--window-size=1280,900", "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForChrome() {
  for (let i = 0; i < 150; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) return; } catch {}
    await sleep(100);
  }
  throw new Error("Chrome did not start");
}

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = this.pending.get(msg.id); this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      } else if (msg.method) (this.listeners.get(msg.method) ?? []).forEach((fn) => fn(msg.params));
    });
  }
  send(method, params = {}) {
    const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(method, fn) { if (!this.listeners.has(method)) this.listeners.set(method, []); this.listeners.get(method).push(fn); }
  off(method, fn) { this.listeners.set(method, (this.listeners.get(method) ?? []).filter((f) => f !== fn)); }
  once(method) { return new Promise((resolve) => { const fn = (p) => { this.off(method, fn); resolve(p); }; this.on(method, fn); }); }
}

async function evalJs(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? JSON.stringify(r.exceptionDetails));
  return r.result?.value;
}

async function centerOf(cdp, selector) {
  const rect = await evalJs(cdp, `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: "nearest" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  if (!rect) throw new Error(`selector not found: ${selector}`);
  return rect;
}

async function mouse(cdp, type, x, y, extra = {}) {
  await cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1, ...extra });
}


// Text-targeted pointer steps: locate + act inside one CDP round trip so re-rendering menus cannot invalidate the target.
async function rectOfText(cdp, text, sel = "button,[role=menuitem],[role=option],[role=tab],a,div,span") {
  const rect = await evalJs(cdp, `(() => { const t = ${JSON.stringify(text)}; const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => e.textContent.trim() === t); const el = els.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0]; if (!el) return null; el.scrollIntoView({ block: "nearest" }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  if (!rect) throw new Error(`text not found: ${text}`);
  return rect;
}

const scene_size = { width: 1280, height: 900 };
async function runStep(cdp, step) {
  if (step.hoverText) { const { x, y } = await rectOfText(cdp, step.hoverText, step.sel); await mouse(cdp, "mouseMoved", x, y, { button: "none" }); }
  if (step.clickText) { const { x, y } = await rectOfText(cdp, step.clickText, step.sel); await mouse(cdp, "mouseMoved", x, y, { button: "none" }); await mouse(cdp, "mousePressed", x, y); await mouse(cdp, "mouseReleased", x, y); }
  if (step.click) { const { x, y } = await centerOf(cdp, step.click); await mouse(cdp, "mouseMoved", x, y, { button: "none" }); await mouse(cdp, "mousePressed", x, y); await mouse(cdp, "mouseReleased", x, y); }
  if (step.hover) { const { x, y } = await centerOf(cdp, step.hover); await mouse(cdp, "mouseMoved", x, y, { button: "none" }); }
  if (step.scroll) await evalJs(cdp, `document.querySelector(${JSON.stringify(step.scroll)})?.scrollIntoView({ block: ${JSON.stringify(step.block ?? "start")} })`);
  if (step.type) await cdp.send("Input.insertText", { text: step.type });
  if (step.key) {
    const base = { Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }, Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }, Tab: { key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 }, ArrowDown: { key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 } };
    const parts = String(step.key).split("+"); const name = parts.pop();
    const modifiers = parts.reduce((m, p) => m | ({ alt: 1, ctrl: 2, control: 2, meta: 4, cmd: 4, shift: 8 }[p.toLowerCase()] ?? 0), 0);
    const k = base[name] ?? { key: name, code: name.length === 1 ? `Key${name.toUpperCase()}` : name, windowsVirtualKeyCode: name.length === 1 ? name.toUpperCase().charCodeAt(0) : 0 };
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", modifiers, ...k }); await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", modifiers, ...k });
  }
  if (step.resize) { const [w, h] = step.resize; await cdp.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false }); scene_size.width = w; scene_size.height = h; }
  if (step.eval) { const v = await evalJs(cdp, step.eval); if (v !== undefined) console.log(`  eval: ${JSON.stringify(v)}`); }
  await sleep(step.wait ?? 500);
}

async function main() {
  await waitForChrome();
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  const cdp = new CDP(ws);
  await cdp.send("Page.enable");
  // Auto-accept beforeunload/confirm dialogs (the editor's dirty-state guard) so cross-page scenes cannot deadlock.
  cdp.on("Page.javascriptDialogOpening", () => { cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {}); }); await cdp.send("Runtime.enable");
  const consoleErrors = [];
  cdp.on("Runtime.exceptionThrown", (p) => consoleErrors.push(p.exceptionDetails?.exception?.description ?? "exception"));
  cdp.on("Runtime.consoleAPICalled", (p) => { if (p.type === "error") consoleErrors.push(p.args.map((a) => a.value ?? a.description).join(" ")); });
  for (const scene of scenes) {
    const { name, url, width = 1280, height = 900, wait = 2500, pre, steps = [] } = scene;
    try {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }); scene_size.width = width; scene_size.height = height;
      const navigate = async () => { const loaded = cdp.once("Page.loadEventFired"); await cdp.send("Page.navigate", { url }); await loaded; };
      await navigate();
      if (pre) { await evalJs(cdp, pre); await navigate(); }
      await sleep(wait);
      for (const step of steps) { try { await runStep(cdp, step); } catch (e) { console.error(`[${name}] step failed:`, e.message); } }
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: scene_size.width, height: scene_size.height, scale: 1 } });
      writeFileSync(join(outDir, `${name}.png`), Buffer.from(shot.data, "base64"));
      console.log(`${name} -> ${width}x${height}`);
    } catch (e) { console.error(`[${name}] failed:`, e.message); }
  }
  if (consoleErrors.length) console.log("CONSOLE ERRORS:\n" + [...new Set(consoleErrors)].slice(0, 20).join("\n")); else console.log("no console errors");
  await cdp.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
  ws.close(); chrome.kill(); await new Promise((r) => chrome.once("exit", r)); await sleep(300); try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
main().catch((e) => { console.error(e); chrome.kill(); rmSync(profile, { recursive: true, force: true }); process.exit(1); });
