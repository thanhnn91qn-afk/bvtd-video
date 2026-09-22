/**
 * Contact sheet of every motif in art.mjs, drawn at a chosen timestamp.
 *
 *   node tools/art-sheet.mjs [tMs]
 *
 * Writes build/art-sheet.png. Run it after touching art.mjs: a motif that reads
 * as the wrong object is only visible by looking at it.
 */
import puppeteer from "puppeteer-core";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { ART, ART_ENGINE, ART_CSS, IDLE_ENGINE, healthIcon } from "../art.mjs";
import { createRequire } from "node:module";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const T = Number(process.argv[2] ?? 6000);

// `node tools/art-sheet.mjs [tMs] [icons|icons:<loc>]` - the second family is
// large, so it is filtered by a search word rather than dumped whole.
const mode = process.argv[3] ?? "";
let names, draw;
if (mode.startsWith("icons")) {
  const req = createRequire(import.meta.url);
  const all = Object.keys(req("@iconify-json/healthicons/icons.json").icons);
  const q = mode.includes(":") ? mode.split(":")[1] : "";
  names = all
    .filter((n) => n.endsWith("-outline") && !n.includes("24px") &&
      n.replace(/-outline$/, "").includes(q))
    .slice(0, 72);
  draw = (n) => healthIcon(n);
} else {
  names = Object.keys(ART);
  draw = (n) => ART[n];
}

const COLS = 6;
const CELL = 300;
const rows = Math.ceil(names.length / COLS);

const cells = names
  .map(
    (n) => `<div class="cell">
      <div class="artbox">${draw(n)}</div>
      <div class="cap">${n.replace(/-outline$/, "")}</div>
    </div>`,
  )
  .join("");

// The engine drives one #art at a time, so each cell gets its own id swapped in
// before the frame call - simpler here to just run the engine per cell.
const html = `<!doctype html><meta charset="utf-8"><style>
 html,body{margin:0;background:#0d2d48;font-family:"Segoe UI",Arial,sans-serif}
 .grid{display:grid;grid-template-columns:repeat(${COLS},${CELL}px)}
 .cell{width:${CELL}px;height:${CELL + 46}px;display:flex;flex-direction:column;
   align-items:center;justify-content:center;color:#7ff0c8;
   border:1px solid rgba(255,255,255,.08);box-sizing:border-box}
 .artbox{width:${CELL - 60}px;height:${CELL - 60}px;display:flex;
   align-items:center;justify-content:center}
 .artbox svg{width:100%;height:100%;overflow:visible}
 .artbox [data-seq]{opacity:0;transform-box:fill-box;transform-origin:center}
 .artbox [data-art="grow"]{transform-origin:bottom}
 .cap{font-size:20px;color:#cfe3ee;margin-top:10px;letter-spacing:1px}
${ART_CSS}</style>
<div class="grid">${cells}</div>
<script>
window.__CFG = { artStartMs:300, artStepMs:210, artDrawMs:620, clipDurMs:20000 };
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function prog(t,s,e){ return clamp((t-s)/(e-s),0,1); }
window.__frame = function(tMs){
  const cfg = window.__CFG;
  for (const box of document.querySelectorAll(".artbox")) {
    box.id = "art";
${ART_ENGINE}
    box.removeAttribute("id");
  }
${IDLE_ENGINE}
};
</script>`;

await mkdir(join(ROOT, "build"), { recursive: true });
const page404 = join(ROOT, "build", "_art-sheet.html");
await writeFile(page404, html, "utf8");

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  userDataDir: join(tmpdir(), `bvtd-artsheet-${process.pid}`),
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  defaultViewport: { width: COLS * CELL, height: rows * (CELL + 46) },
});
const page = await browser.newPage();
await page.goto(pathToFileURL(page404).href, { waitUntil: "load" });
await page.evaluate((t) => window.__frame(t), T);
const outName = mode.startsWith("icons") ? "art-sheet-icons.png" : "art-sheet.png";
await page.screenshot({ path: join(ROOT, "build", outName) });
await browser.close();
console.log(`${names.length} hinh -> build/${outName} (t=${T}ms)`);
