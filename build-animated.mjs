import puppeteer from "puppeteer-core";
import { execFile, spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const exec = promisify(execFile);
const ROOT = dirname(fileURLToPath(import.meta.url));

const TTS_ENDPOINT = process.env.TTS_ENDPOINT ?? "http://192.168.1.71:8000";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FFMPEG_BIN =
  "C:/Users/Admin/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin";
process.env.PATH = `${FFMPEG_BIN};${process.env.PATH}`;

const FPS = 30;
const W = 1080;
const H = 1920;
const PHOTO_H = 1200;
const GAP_SEC = 0.45;
const FORCE = process.argv.includes("--force");

const dirs = {
  voice: join(ROOT, "build", "voice"),
  clips: join(ROOT, "build", "clips-anim"),
  out: join(ROOT, "out"),
};

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function tts(text, outWav) {
  if (existsSync(outWav) && !FORCE) return;
  const res = await fetch(`${TTS_ENDPOINT}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status} for "${text.slice(0, 40)}..."`);
  await writeFile(outWav, Buffer.from(await res.arrayBuffer()));
}

async function durationSec(path) {
  const { stdout } = await exec("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  const d = parseFloat(stdout.trim());
  if (!isFinite(d)) throw new Error(`bad duration for ${path}`);
  return d;
}

/** Parse a display stat into a count-up target, or null if it should just appear statically (years). */
function parseStat(stat) {
  if (!stat) return null;
  if (/^(19|20)\d{2}$/.test(stat)) return null; // years read oddly when counted up
  const m = String(stat).match(/^([\d.]+)(.*)$/);
  if (!m) return null;
  const target = parseInt(m[1].replace(/\./g, ""), 10);
  if (!isFinite(target)) return null;
  const suffix = m[2] ?? "";
  const grouped = m[1].includes(".");
  return { target, suffix, grouped };
}

const fileUrl = (p) => pathToFileURL(p).href;

/** Shared per-frame timing engine, injected into every scene page. */
const TIMING_SCRIPT = `
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function reveal(el, start, end, t, distance){
  if (!el) return 0;
  const p = easeOutCubic(clamp((t - start) / (end - start), 0, 1));
  el.style.opacity = String(p);
  el.style.transform = (el.__baseTransform || "") + " translateY(" + ((1 - p) * (distance ?? 24)) + "px)";
  return p;
}
window.__frame = function(tMs){
  const cfg = window.__CFG;
  const photo = document.getElementById("photo");
  if (photo) {
    const p = clamp(tMs / cfg.clipDurMs, 0, 1);
    const scale = cfg.zoomOut ? (1.12 - 0.12 * p) : (1.0 + 0.12 * p);
    photo.style.transform = "scale(" + scale.toFixed(4) + ")";
  }
  reveal(document.getElementById("kicker"), 0, 360, tMs, 26);
  const bar = document.getElementById("bar");
  if (bar) {
    const p = easeOutCubic(clamp((tMs - 120) / (520 - 120), 0, 1));
    bar.style.opacity = String(p);
    bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
  }
  reveal(document.getElementById("headline"), 260, 680, tMs, 30);
  reveal(document.getElementById("sub"), 420, 800, tMs, 24);
  const statEl = document.getElementById("stat");
  if (statEl) {
    const revealAt = cfg.statRevealMs;
    const p = reveal(statEl, revealAt, revealAt + 520, tMs, 24);
    if (cfg.statTarget != null) {
      const cp = easeOutCubic(clamp((tMs - (revealAt + 60)) / (revealAt + 640 - (revealAt + 60)), 0, 1));
      const val = Math.round(cfg.statTarget * cp);
      const numEl = document.getElementById("statNum");
      if (numEl) numEl.textContent = (cfg.statGrouped ? val.toLocaleString("vi-VN") : String(val)) + cfg.statSuffix;
    }
  }
  const contactEl = document.getElementById("contact");
  if (contactEl) reveal(contactEl, cfg.statRevealMs, cfg.statRevealMs + 520, tMs, 24);
  const hero = document.getElementById("hero");
  if (hero) {
    const p = easeOutCubic(clamp(tMs / 560, 0, 1));
    hero.style.opacity = String(p);
    hero.style.transform = "scale(" + (0.9 + 0.1 * p).toFixed(4) + ")";
  }
  reveal(document.getElementById("vn"), 380, 760, tMs, 22);
  reveal(document.getElementById("en"), 520, 860, tMs, 18);
  reveal(document.getElementById("slogan"), 640, 980, tMs, 18);
};
`;

function sceneHtml(scene, brand, photoUrl, clipDurMs) {
  const parsed = parseStat(scene.stat);
  const statRevealMs = Math.max(1100, clipDurMs * 0.42);
  const originX = scene.pan === "left" ? "28%" : scene.pan === "right" ? "72%" : "50%";

  const statBlock = scene.contact
    ? `<div class="contact" id="contact">
         <div class="row"><span class="lbl">Đăng ký khám</span><b>${esc(brand.hotline)}</b></div>
         <div class="row small">${esc(brand.address)}</div>
         <div class="row small">${esc(brand.web)}</div>
       </div>`
    : scene.stat
      ? `<div class="stat" id="stat"><b id="statNum">${parsed ? "0" : esc(scene.stat)}</b><span>${esc(scene.statLabel)}</span></div>`
      : "";

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
 html,body{margin:0;padding:0;background:#fff}
 body{width:${W}px;height:${H}px;font-family:"Segoe UI",Arial,sans-serif;position:relative;overflow:hidden}
 .photoWrap{position:absolute;left:0;right:0;top:0;height:${PHOTO_H}px;overflow:hidden;background:#dbe7ee}
 .photoWrap img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
   transform-origin:${originX} center;transform:scale(1)}
 .kicker{position:absolute;top:60px;left:60px;background:#0b6fb4;color:#fff;font-size:32px;
   font-weight:700;letter-spacing:2px;padding:16px 32px;border-radius:999px;text-transform:uppercase;
   box-shadow:0 10px 26px rgba(11,111,180,.38);opacity:0}
 .panel{position:absolute;left:0;right:0;top:1020px;bottom:150px;background:#fff;
   border-radius:52px 52px 0 0;box-shadow:0 -16px 44px rgba(11,111,180,.16);
   padding:58px 64px 0;box-sizing:border-box;overflow:hidden}
 .bar{width:130px;height:10px;background:#12a37a;border-radius:5px;margin-bottom:30px;
   opacity:0;transform:scaleX(0);transform-origin:left center}
 h1{font-size:76px;line-height:1.06;color:#0b6fb4;margin:0 0 24px;font-weight:800;letter-spacing:-1px;opacity:0}
 p.sub{font-size:40px;line-height:1.34;color:#33586e;margin:0;font-weight:400;opacity:0}
 .stat{display:flex;align-items:baseline;gap:20px;margin-top:34px;opacity:0}
 .stat b{font-size:100px;color:#12a37a;font-weight:800;line-height:1}
 .stat span{font-size:34px;color:#5b7a8c;line-height:1.25;max-width:520px}
 .contact{margin-top:34px;opacity:0}
 .contact .row{display:flex;align-items:baseline;gap:18px;margin-bottom:10px}
 .contact .lbl{font-size:34px;color:#5b7a8c}
 .contact b{font-size:72px;color:#12a37a;font-weight:800;letter-spacing:1px}
 .contact .small{font-size:32px;color:#5b7a8c}
 .footer{position:absolute;left:0;right:0;bottom:0;height:150px;background:#f2f8fc;
   border-top:3px solid #dceaf4;display:flex;align-items:center;justify-content:center}
 .footer img{height:86px}
</style></head><body>
<div class="photoWrap"><img id="photo" src="${photoUrl}"></div>
<div class="kicker" id="kicker">${esc(scene.kicker)}</div>
<div class="panel">
  <div class="bar" id="bar"></div>
  <h1 id="headline">${esc(scene.headline)}</h1>
  <p class="sub" id="sub">${esc(scene.sub)}</p>
  ${statBlock}
</div>
<div class="footer"><img src="${fileUrl(join(ROOT, "assets", "logo.png"))}"></div>
<script>
window.__CFG = {
  clipDurMs: ${clipDurMs},
  zoomOut: ${scene.zoom === "out"},
  statRevealMs: ${statRevealMs},
  statTarget: ${parsed ? parsed.target : "null"},
  statSuffix: ${JSON.stringify(parsed ? parsed.suffix : "")},
  statGrouped: ${parsed ? !!parsed.grouped : false}
};
${TIMING_SCRIPT}
</script>
</body></html>`;
}

function logoHtml(scene, brand, clipDurMs) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
 html,body{margin:0;padding:0;background:#fff}
 body{width:${W}px;height:${H}px;font-family:"Segoe UI",Arial,sans-serif;position:relative;overflow:hidden}
 .bg{position:absolute;inset:0;height:${PHOTO_H}px;
   background:linear-gradient(160deg,#eaf6fb 0%,#ffffff 55%,#e8f6ef 100%)}
 .hero{position:absolute;left:0;right:0;top:0;height:${PHOTO_H}px;display:flex;
   flex-direction:column;align-items:center;justify-content:center;gap:32px;
   padding:0 70px;box-sizing:border-box;opacity:0;transform:scale(0.9)}
 .hero img{width:430px}
 .hero .vn{font-size:56px;font-weight:800;color:#0f9d4f;text-align:center;line-height:1.12;
   letter-spacing:-.5px;opacity:0}
 .hero .en{font-size:29px;color:#6b7f8c;letter-spacing:2px;text-align:center;opacity:0}
 .hero .slogan{font-size:30px;color:#5b7a8c;font-style:italic;text-align:center;opacity:0}
 .kicker{position:absolute;top:60px;left:60px;background:#0b6fb4;color:#fff;font-size:32px;
   font-weight:700;letter-spacing:2px;padding:16px 32px;border-radius:999px;text-transform:uppercase;
   box-shadow:0 10px 26px rgba(11,111,180,.38);opacity:0}
 .panel{position:absolute;left:0;right:0;top:1020px;bottom:150px;background:#fff;
   border-radius:52px 52px 0 0;box-shadow:0 -16px 44px rgba(11,111,180,.16);
   padding:58px 64px 0;box-sizing:border-box;overflow:hidden}
 .bar{width:130px;height:10px;background:#12a37a;border-radius:5px;margin-bottom:30px;
   opacity:0;transform:scaleX(0);transform-origin:left center}
 h1{font-size:76px;line-height:1.06;color:#0b6fb4;margin:0 0 24px;font-weight:800;letter-spacing:-1px;opacity:0}
 p.sub{font-size:40px;line-height:1.34;color:#33586e;margin:0;font-weight:400;opacity:0}
</style></head><body>
<div class="bg"></div>
<div class="hero" id="hero">
  <img src="${fileUrl(join(ROOT, "build", "emblem.png"))}">
  <div class="vn" id="vn">BỆNH VIỆN VIỆT NAM - THỤY ĐIỂN UÔNG BÍ</div>
  <div class="en" id="en">VIETNAM - SWEDEN GENERAL HOSPITAL UONGBI</div>
  <div class="slogan" id="slogan">Tất cả vì sự hài lòng của người bệnh</div>
</div>
<div class="kicker" id="kicker">${esc(scene.kicker)}</div>
<div class="panel">
  <div class="bar" id="bar"></div>
  <h1 id="headline">${esc(scene.headline)}</h1>
  <p class="sub" id="sub">${esc(scene.sub)}</p>
</div>
<script>
window.__CFG = { clipDurMs: ${clipDurMs}, zoomOut: false, statRevealMs: 999999, statTarget: null, statSuffix: "", statGrouped: false };
${TIMING_SCRIPT}
</script>
</body></html>`;
}

async function captureClip(page, html, frames, outPath) {
  const htmlPath = join(dirs.clips, "_scene.html");
  await writeFile(htmlPath, html, "utf8");
  await page.goto(fileUrl(htmlPath), { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);

  const ff = spawn("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    outPath,
  ]);
  const ffDone = new Promise((res, rej) => {
    ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exit ${code}`))));
    ff.on("error", rej);
  });

  for (let i = 0; i < frames; i++) {
    const tMs = (i / FPS) * 1000;
    await page.evaluate((t) => window.__frame(t), tMs);
    const buf = await page.screenshot({ type: "jpeg", quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await ffDone;
}

async function main() {
  const scenesArg = process.argv.find((a) => a.startsWith("--scenes="));
  const nameArg = process.argv.find((a) => a.startsWith("--name="));
  const scenesFile = scenesArg ? scenesArg.slice(9) : "scenes.json";
  // --name keeps a second video's clips and outputs from colliding with the first's
  const name = nameArg ? nameArg.slice(7) : "animated";
  dirs.clips = join(ROOT, "build", `clips-${name}`);
  // Scene ids repeat across scripts (every one starts at s01), so a shared
  // voice cache silently hands one video another video's narration.
  dirs.voice = join(ROOT, "build", `voice-${name}`);
  const cfg = JSON.parse(await readFile(join(ROOT, scenesFile), "utf8"));
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  if (onlyArg) {
    const ids = onlyArg.slice(7).split(",");
    cfg.scenes = cfg.scenes.filter((s) => ids.includes(s.id));
  }
  for (const d of Object.values(dirs)) await mkdir(d, { recursive: true });

  console.log(`TTS endpoint: ${TTS_ENDPOINT}`);
  const scenes = [];
  for (const s of cfg.scenes) {
    const wav = join(dirs.voice, `${s.id}.wav`);
    process.stdout.write(`[tts]  ${s.id} ... `);
    await tts(s.voice, wav);
    const narration = await durationSec(wav);
    console.log(`${narration.toFixed(2)}s`);
    scenes.push({ ...s, wav, narration, clipDur: narration + GAP_SEC });
  }

  const profile = join(tmpdir(), `bvtd-anim-${process.pid}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    userDataDir: profile,
    args: [
      "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
      "--no-first-run", "--no-default-browser-check",
      "--disable-extensions", "--disable-background-networking", "--disable-sync",
      "--force-device-scale-factor=1",
    ],
    defaultViewport: { width: W, height: H },
    protocolTimeout: 300000,
  });
  try {
    const page = await browser.newPage();
    for (const s of scenes) {
      const clipDurMs = s.clipDur * 1000;
      const frames = Math.round(s.clipDur * FPS);
      const clip = join(dirs.clips, `${s.id}.mp4`);
      if (existsSync(clip) && !FORCE) {
        console.log(`[clip] ${s.id}: REUSE`);
        s.clip = clip;
        continue;
      }
      const html = s.logoCard
        ? logoHtml(s, cfg.brand, clipDurMs)
        : sceneHtml(s, cfg.brand, fileUrl(join(ROOT, "assets", "photos", s.photo)), clipDurMs);
      process.stdout.write(`[clip] ${s.id} (${s.clipDur.toFixed(2)}s, ${frames}f) ... `);
      const t0 = Date.now();
      await captureClip(page, html, frames, clip);
      console.log(`ok (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      s.clip = clip;
    }
  } finally {
    await browser.close();
  }

  // Narration track: identical construction to build.mjs, so audio timing
  // matches the concatenated silent clips exactly.
  console.log("[audio] concat narration");
  const aArgs = ["-y", "-hide_banner", "-loglevel", "error"];
  const aParts = [];
  const aLabels = [];
  scenes.forEach((s, i) => {
    aArgs.push("-i", s.wav);
    aParts.push(
      `[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono,` +
        `apad=pad_dur=${GAP_SEC},atrim=0:${s.clipDur.toFixed(3)},asetpts=N/SR/TB[a${i}]`,
    );
    aLabels.push(`[a${i}]`);
  });
  const voiceWav = join(dirs.out, `voice-${name}.wav`);
  aArgs.push(
    "-filter_complex",
    `${aParts.join(";")};${aLabels.join("")}concat=n=${scenes.length}:v=0:a=1[out]`,
    "-map", "[out]", "-ar", "44100", "-ac", "1", voiceWav,
  );
  await exec("ffmpeg", aArgs, { maxBuffer: 1 << 24 });

  console.log("[video] concat clips (silent)");
  const listFile = join(ROOT, "build", `clips-${name}.txt`);
  await writeFile(listFile, scenes.map((s) => `file '${s.clip.replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const silentOut = join(dirs.out, `video-${name}-silent.mp4`);
  await exec("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", silentOut,
  ], { maxBuffer: 1 << 24 });

  console.log("[mux] audio + video");
  const withAudio = join(dirs.out, `video-${name}.mp4`);
  await exec("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", silentOut, "-i", voiceWav,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    withAudio,
  ], { maxBuffer: 1 << 24 });

  const total = await durationSec(withAudio);
  console.log(`\n=== Done ===`);
  console.log(`With audio : ${withAudio}`);
  console.log(`Silent     : ${silentOut}`);
  console.log(`Total: ${total.toFixed(2)}s (${scenes.length} scenes)`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
