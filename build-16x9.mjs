import puppeteer from "puppeteer-core";
import { execFile, spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { ART_ENGINE, ART_CSS, IDLE_ENGINE, IDLE_WORD, IDLE_LINE, artBox, pickArt } from "./art.mjs";
import { assertScenes } from "./scene-check.mjs";
import { resolveOutDir, outBaseName } from "./out-dir.mjs";

const exec = promisify(execFile);
const ROOT = dirname(fileURLToPath(import.meta.url));

const TTS_ENDPOINT = process.env.TTS_ENDPOINT ?? "http://192.168.1.71:8000";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const FFMPEG_BIN =
  "C:/Users/Admin/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin";
process.env.PATH = `${FFMPEG_BIN};${process.env.PATH}`;

const FPS = 30;
const W = 1920;   // 16:9 landscape
const H = 1080;
const GAP_SEC = 0.45;
const STILLS = process.argv.includes("--stills");
const FORCE = process.argv.includes("--force");

const dirs = {
  voice: join(ROOT, "build", "voice-16x9"),
  clips: join(ROOT, "build", "clips-16x9"),
  stills: join(ROOT, "build", "stills16"),
  out: resolveOutDir(ROOT),
};

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fileUrl = (p) => pathToFileURL(p).href;
const photoUrl = (name) => fileUrl(join(ROOT, "assets", "photos", name));
const logoUrl = () => fileUrl(join(ROOT, "assets", "logo.png"));

/** Same frame-accurate engine as the 9:16 build: Node pushes the time in. */
const ENGINE = `
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
function easeOutExpo(x){ return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function prog(t, s, e){ return clamp((t - s) / (e - s), 0, 1); }
function reveal(el, s, e, t, dy){
  if (!el) return 0;
  const p = easeOutCubic(prog(t, s, e));
  el.style.opacity = String(p);
  el.style.transform = "translateY(" + ((1 - p) * (dy === undefined ? 24 : dy)) + "px)";
  return p;
}
window.__frame = function(tMs){
  const cfg = window.__CFG;
  const photo = document.getElementById("photo");
  if (photo) {
    const p = clamp(tMs / cfg.clipDurMs, 0, 1);
    const s = cfg.zoomOut ? (1.10 - 0.10 * p) : (1.0 + 0.10 * p);
    photo.style.transform = "scale(" + s.toFixed(4) + ")";
  }
  reveal(document.getElementById("kicker"), 0, 380, tMs, 22);
  reveal(document.getElementById("meta"), 80, 460, tMs, 14);
  reveal(document.getElementById("headline"), 260, 720, tMs, 30);
  reveal(document.getElementById("sub"), 460, 880, tMs, 20);
  reveal(document.getElementById("logo"), 200, 700, tMs, 14);
  reveal(document.getElementById("frame"), 120, 760, tMs, 26);

  const bar = document.getElementById("bar");
  if (bar) {
    const p = easeOutCubic(prog(tMs, 120, 520));
    bar.style.opacity = String(p);
    bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
  }
  const wipe = document.getElementById("wipe");
  if (wipe) {
    const p = easeOutExpo(prog(tMs, 240, 1150));
    wipe.style.clipPath = "inset(0 " + ((1 - p) * 100).toFixed(2) + "% 0 0)";
    wipe.style.opacity = "1";
  }
  const block = document.getElementById("block");
  if (block) {
    const p = easeOutExpo(prog(tMs, 60, 900));
    block.style.transform = "translateX(" + ((1 - p) * 100) + "%)";
  }
  const glass = document.getElementById("glass");
  if (glass) {
    const p = easeOutCubic(prog(tMs, 160, 820));
    glass.style.opacity = String(p);
    glass.style.transform = "translateY(-50%) translateX(" + ((1 - p) * -40) + "px)";
  }
  const words = document.querySelectorAll("#words .w");
  if (words.length) {
    const start = 260, per = cfg.wordMs || 190;
    for (let i = 0; i < words.length; i++) {
      const s = start + i * per;
      const p = easeOutCubic(prog(tMs, s, s + 240));
      const el = words[i];
      el.style.opacity = String(p);
      el.style.transform = "translateY(" + ((1 - p) * 18) + "px) scale(" + (0.88 + 0.12 * p) + ")";
      el.classList.toggle("hot", tMs >= s && tMs < s + per + 240 && p > 0.35);
${IDLE_WORD}    }
  }
  // stacked result lines, revealed one after another to follow the voice-over
  const lines = document.querySelectorAll("#lines .ln");
  if (lines.length) {
    const start = cfg.lineStartMs || 1000, step = cfg.lineMs || 1300;
    for (let i = 0; i < lines.length; i++) {
      const s = start + i * step;
      const p = easeOutCubic(prog(tMs, s, s + 440));
      lines[i].style.opacity = String(p);
      lines[i].style.transform = "translateX(" + ((1 - p) * -30) + "px)";
${IDLE_LINE}    }
  }
  const statEl = document.getElementById("stat");
  if (statEl) {
    const at = cfg.statRevealMs;
    reveal(statEl, at, at + 520, tMs, 20);
    if (cfg.statTarget != null) {
      const cp = easeOutCubic(prog(tMs, at + 60, at + 700));
      const n = document.getElementById("statNum");
      if (n) n.textContent =
        (cfg.statGrouped ? Math.round(cfg.statTarget * cp).toLocaleString("vi-VN")
                         : String(Math.round(cfg.statTarget * cp))) + cfg.statSuffix;
    }
  }
  const hero = document.getElementById("hero");
  if (hero) {
    const p = easeOutCubic(prog(tMs, 0, 620));
    hero.style.opacity = String(p);
    hero.style.transform = "scale(" + (0.92 + 0.08 * p) + ")";
  }
  reveal(document.getElementById("vn"), 400, 800, tMs, 20);
  reveal(document.getElementById("en"), 540, 900, tMs, 16);
${ART_ENGINE}
${IDLE_ENGINE}
};
`;

function parseStat(stat) {
  if (!stat) return null;
  if (/^(19|20)\d{2}$/.test(stat)) return null;
  const m = String(stat).match(/^([\d.]+)(.*)$/);
  if (!m) return null;
  const target = parseInt(m[1].replace(/\./g, ""), 10);
  if (!isFinite(target)) return null;
  return { target, suffix: m[2] ?? "", grouped: m[1].includes(".") };
}

const BASE = `
 html,body{margin:0;padding:0;background:#fff}
 body{width:${W}px;height:${H}px;position:relative;overflow:hidden;
   font-family:"Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased}
 .full{position:absolute;inset:0;overflow:hidden}
 .full img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
 .logobar{position:absolute;right:56px;bottom:40px;display:flex;align-items:center}
 .logobar img{height:56px;background:#fff;padding:9px 18px;border-radius:999px}
${ART_CSS}`;

function shell(css, body, cfg) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${BASE}${css}</style></head>
<body>${body}<script>window.__CFG=${JSON.stringify(cfg)};${ENGINE}</script></body></html>`;
}

// A year (or anything parseStat rejects) gets no count-up, so it must be printed
// as-is - otherwise the placeholder 0 is what stays on screen.
const statBlock = (s) =>
  s.stat
    ? `<div id="stat" style="opacity:0"><b id="statNum">${parseStat(s.stat) ? "0" : esc(s.stat)}</b>` +
      `<span>${esc(s.statLabel)}</span></div>`
    : "";

/** Full-bleed photo, scrim weighted to the left, serif headline. */
function styleCinematic(s) {
  return shell(
    `
 .scrim{position:absolute;inset:0;background:linear-gradient(90deg,rgba(4,18,28,.90) 0%,
   rgba(4,18,28,.66) 42%, rgba(4,18,28,.18) 72%, rgba(4,18,28,.42) 100%)}
 .wrap{position:absolute;left:110px;bottom:132px;width:1000px}
 #kicker{display:inline-block;font-size:24px;letter-spacing:5px;text-transform:uppercase;
   color:#8fe3c8;border-left:5px solid #12a37a;padding-left:16px;margin-bottom:26px;opacity:0}
 #headline{font-family:Cambria,Georgia,serif;font-size:78px;line-height:1.05;color:#fff;
   margin:0 0 20px;font-weight:700;letter-spacing:-1.5px;opacity:0;text-shadow:0 6px 36px rgba(0,0,0,.5)}
 #sub{font-size:31px;line-height:1.42;color:#cfe3ee;margin:0;font-weight:300;opacity:0}
 #stat{display:flex;align-items:baseline;gap:18px;margin-top:26px;opacity:0}
 #stat b{font-size:76px;color:#7ff0c8;font-weight:800;line-height:1}
 #stat span{font-size:26px;color:#cfe3ee}
`,
    `<div class="full"><img id="photo" src="${photoUrl(s.photo)}"></div><div class="scrim"></div>
     <div class="wrap"><div id="kicker">${esc(s.kicker)}</div>
       <h1 id="headline">${esc(s.headline)}</h1><p id="sub">${esc(s.sub)}</p>${statBlock(s)}</div>
     <div class="logobar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** Photo left, brand colour block sliding in from the right. */
function styleSplit(s) {
  return shell(
    `
 .ph{position:absolute;left:0;top:0;width:1120px;height:100%;overflow:hidden}
 .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
 #block{position:absolute;right:0;top:0;width:900px;height:100%;background:#0b6fb4;
   padding:0 84px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;
   clip-path:polygon(90px 0, 100% 0, 100% 100%, 0 100%)}
 #kicker{display:inline-block;align-self:flex-start;font-size:22px;letter-spacing:4px;
   text-transform:uppercase;color:#0b6fb4;background:#7ff0c8;padding:10px 22px;border-radius:6px;
   margin-bottom:26px;font-weight:800;opacity:0}
 #headline{font-size:66px;line-height:1.08;color:#fff;margin:0 0 20px;font-weight:800;
   letter-spacing:-1px;opacity:0}
 #sub{font-size:30px;line-height:1.4;color:#cfe6f6;margin:0;opacity:0}
 #stat{display:flex;align-items:baseline;gap:16px;margin-top:28px;opacity:0}
 #stat b{font-size:80px;color:#7ff0c8;font-weight:800;line-height:1}
 #stat span{font-size:25px;color:#cfe6f6;max-width:420px}
`,
    `<div class="ph"><img id="photo" src="${photoUrl(s.photo)}"></div>
     <div id="block"><div id="kicker">${esc(s.kicker)}</div>
       <h1 id="headline">${esc(s.headline)}</h1><p id="sub">${esc(s.sub)}</p>${statBlock(s)}</div>
     <div class="logobar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** Frosted panel over the photo, on the left. */
function styleGlass(s) {
  return shell(
    `
 .tint{position:absolute;inset:0;background:linear-gradient(90deg,rgba(6,40,64,.55),rgba(6,40,64,.28))}
 #glass{position:absolute;left:92px;top:50%;transform:translateY(-50%);width:820px;padding:56px 54px;
   background:linear-gradient(150deg,rgba(255,255,255,.32),rgba(255,255,255,.15));
   backdrop-filter:blur(26px) saturate(170%);-webkit-backdrop-filter:blur(26px) saturate(170%);
   border:1.5px solid rgba(255,255,255,.55);border-radius:38px;
   box-shadow:0 26px 70px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.6);opacity:0}
 #kicker{display:inline-block;font-size:22px;letter-spacing:4px;text-transform:uppercase;color:#fff;
   background:rgba(18,163,122,.92);padding:10px 22px;border-radius:999px;margin-bottom:24px;
   font-weight:700;opacity:0}
 #headline{font-size:62px;line-height:1.1;color:#fff;margin:0 0 18px;font-weight:800;
   letter-spacing:-1px;opacity:0;text-shadow:0 3px 16px rgba(0,0,0,.45)}
 #sub{font-size:29px;line-height:1.4;color:#fff;margin:0;font-weight:600;opacity:0;
   text-shadow:0 2px 12px rgba(0,0,0,.4)}
 #stat{display:flex;align-items:baseline;gap:16px;margin-top:26px;opacity:0}
 #stat b{font-size:74px;color:#7ff0c8;font-weight:800;line-height:1}
 #stat span{font-size:25px;color:#eaf6fb;font-weight:600}
`,
    `<div class="full"><img id="photo" src="${photoUrl(s.photo)}"></div><div class="tint"></div>
     <div id="glass"><div id="kicker">${esc(s.kicker)}</div>
       <h1 id="headline">${esc(s.headline)}</h1><p id="sub">${esc(s.sub)}</p>${statBlock(s)}</div>
     <div class="logobar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** Word-by-word caption across the bottom, Reels style. */
function styleCaption(s) {
  const words = esc(s.headline).split(/\s+/).map((w) => `<span class="w">${w}</span>`).join("");
  return shell(
    `
 .tint{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,20,32,.34) 0%,
   rgba(3,20,32,.12) 40%, rgba(3,20,32,.86) 100%)}
 #kicker{position:absolute;top:56px;left:72px;font-size:24px;letter-spacing:4px;text-transform:uppercase;
   color:#fff;background:#0b6fb4;padding:12px 26px;border-radius:12px;font-weight:800;opacity:0}
 #words{position:absolute;left:110px;right:110px;bottom:190px;display:flex;flex-wrap:wrap;
   gap:6px 4px;justify-content:center}
 #words .w{display:inline-block;font-size:64px;line-height:1.14;font-weight:900;color:#fff;
   letter-spacing:-1px;opacity:0;padding:0 11px;border-radius:12px;
   text-shadow:0 4px 20px rgba(0,0,0,.6)}
 #words .w.hot{background:#12a37a;text-shadow:none}
 #sub{position:absolute;left:160px;right:160px;bottom:122px;text-align:center;font-size:28px;
   color:#d8ebf6;margin:0;font-weight:500;opacity:0}
`,
    `<div class="full"><img id="photo" src="${photoUrl(s.photo)}"></div><div class="tint"></div>
     <div id="kicker">${esc(s.kicker)}</div><div id="words">${words}</div>
     <p id="sub">${esc(s.sub)}</p>
     <div class="logobar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** Photo with a white band across the bottom; headline wiped in. */
function styleWipe(s) {
  return shell(
    `
 .ph{position:absolute;left:0;top:0;right:0;height:660px;overflow:hidden}
 .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
 .ph:after{content:"";position:absolute;inset:0;
   background:linear-gradient(180deg,rgba(2,22,36,.28),rgba(2,22,36,.05) 45%,#fff 99%)}
 #meta{position:absolute;top:52px;left:72px;font-family:Consolas,"Courier New",monospace;
   font-size:22px;letter-spacing:3px;color:#eaf6fb;background:rgba(4,26,42,.6);
   padding:10px 20px;border-radius:8px;opacity:0}
 .panel{position:absolute;left:110px;right:110px;top:628px}
 .rule{width:100%;height:3px;background:#dbe9f2;margin-bottom:28px}
 #wipe{clip-path:inset(0 100% 0 0)}
 #kicker{display:inline-block;font-size:22px;letter-spacing:5px;text-transform:uppercase;
   color:#12a37a;font-weight:800;margin-bottom:16px;opacity:0}
 #headline{font-size:66px;line-height:1.08;color:#0b3d5c;margin:0 0 18px;font-weight:800;
   letter-spacing:-1px}
 #sub{font-size:29px;line-height:1.42;color:#42687f;margin:0;opacity:0}
 #stat{display:flex;align-items:baseline;gap:16px;margin-top:22px;opacity:0}
 #stat b{font-size:72px;color:#12a37a;font-weight:800;line-height:1}
 #stat span{font-size:25px;color:#5b7a8c}
`,
    `<div class="ph"><img id="photo" src="${photoUrl(s.photo)}"></div>
     <div id="meta">${esc(s.meta || "BENH VIEN VIET NAM - THUY DIEN UONG BI")}</div>
     <div class="panel"><div class="rule"></div><div id="kicker">${esc(s.kicker)}</div>
       <div id="wipe"><h1 id="headline">${esc(s.headline)}</h1></div>
       <p id="sub">${esc(s.sub)}</p>${statBlock(s)}</div>
     <div class="logobar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** Photo full-bleed with a white card floating on the left. */
function styleCard(s) {
  return shell(
    `
 .tint{position:absolute;inset:0;background:linear-gradient(90deg,rgba(6,30,48,.35),rgba(6,30,48,.08))}
 .card{position:absolute;left:96px;top:50%;transform:translateY(-50%);width:800px;
   background:#fff;border-radius:34px;padding:56px 54px;box-shadow:0 26px 70px rgba(4,30,50,.32)}
 #kicker{display:inline-block;font-size:22px;letter-spacing:4px;text-transform:uppercase;
   background:#0b6fb4;color:#fff;padding:11px 24px;border-radius:999px;margin-bottom:24px;
   font-weight:700;opacity:0}
 #headline{font-size:62px;line-height:1.1;color:#0b6fb4;margin:0 0 18px;font-weight:800;
   letter-spacing:-1px;opacity:0}
 #sub{font-size:29px;line-height:1.4;color:#33586e;margin:0;opacity:0}
 #stat{display:flex;align-items:baseline;gap:16px;margin-top:26px;opacity:0}
 #stat b{font-size:76px;color:#12a37a;font-weight:800;line-height:1}
 #stat span{font-size:25px;color:#5b7a8c;max-width:400px}
`,
    `<div class="full"><img id="photo" src="${photoUrl(s.photo)}"></div><div class="tint"></div>
     <div class="card"><div id="kicker">${esc(s.kicker)}</div>
       <h1 id="headline">${esc(s.headline)}</h1><p id="sub">${esc(s.sub)}</p>${statBlock(s)}</div>
     <div class="logobar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** Screenshot shown WHOLE (contain, never cropped) with text beside it. */
function styleShot(s) {
  return shell(
    `
 .bg{position:absolute;inset:0;background:linear-gradient(140deg,#0b2740 0%,#123a5c 55%,#0b2740 100%)}
 .fwrap{position:absolute;left:78px;top:0;bottom:0;width:1080px;display:flex;align-items:center}
 #frame{width:100%;background:#fff;border-radius:18px;padding:14px;box-sizing:border-box;
   box-shadow:0 30px 80px rgba(0,0,0,.45);opacity:0}
 #frame img{display:block;width:100%;height:auto;max-height:830px;object-fit:contain;
   border-radius:10px;background:#f4f8fb}
 .side{position:absolute;right:76px;top:50%;transform:translateY(-50%);width:600px}
 #kicker{display:inline-block;font-size:22px;letter-spacing:4px;text-transform:uppercase;color:#0b2740;
   background:#7ff0c8;padding:10px 22px;border-radius:6px;margin-bottom:24px;font-weight:800;opacity:0}
 #headline{font-size:56px;line-height:1.12;color:#fff;margin:0 0 18px;font-weight:800;
   letter-spacing:-.5px;opacity:0}
 #sub{font-size:27px;line-height:1.45;color:#bcd6e8;margin:0;opacity:0}
 #stat{display:flex;align-items:baseline;gap:14px;margin-top:26px;opacity:0}
 #stat b{font-size:70px;color:#7ff0c8;font-weight:800;line-height:1}
 #stat span{font-size:24px;color:#bcd6e8}
 .logobar img{background:rgba(255,255,255,.92)}
`,
    `<div class="bg"></div>
     <div class="fwrap"><div id="frame"><img src="${photoUrl(s.photo)}"></div></div>
     <div class="side"><div id="kicker">${esc(s.kicker)}</div>
       <h1 id="headline">${esc(s.headline)}</h1><p id="sub">${esc(s.sub)}</p>${statBlock(s)}</div>
     <div class="logobar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** Result lines revealed one by one, next to a screenshot or photo. */
function styleLines(s) {
  const items = (s.lines || []).map((t) => `<div class="ln">${esc(t)}</div>`).join("");
  // A motif can stand in for the photo and keep the two-column layout; with
  // neither, the panel would sit lopsided on the right, so centre it instead.
  const art = s.photo ? null : pickArt(s);
  const media = s.photo
    ? `<div class="fwrap"><div id="frame"><img src="${photoUrl(s.photo)}"></div></div>`
    : artBox(art);
  const wide = s.photo || art ? "" : " wide";
  return shell(
    `
 .bg{position:absolute;inset:0;background:linear-gradient(140deg,#071e33 0%,#0e3557 60%,#071e33 100%)}
 .fwrap{position:absolute;left:70px;top:0;bottom:0;width:880px;display:flex;align-items:center}
 .artbox{position:absolute;left:180px;top:50%;transform:translateY(-50%);
   width:600px;height:600px;color:#7ff0c8;opacity:.9}
 #frame{width:100%;background:#fff;border-radius:16px;padding:12px;box-sizing:border-box;
   box-shadow:0 26px 70px rgba(0,0,0,.45);opacity:0}
 #frame img{display:block;width:100%;height:auto;max-height:760px;object-fit:contain;
   border-radius:8px;background:#f4f8fb}
 .side{position:absolute;right:72px;top:50%;transform:translateY(-50%);width:840px}
 .side.wide{right:auto;left:50%;transform:translate(-50%,-50%);width:1180px}
 .side.wide #headline{font-size:62px}
 .side.wide #lines .ln{font-size:42px;padding:20px 0 20px 40px;
   background:linear-gradient(90deg,rgba(18,163,122,.22),rgba(18,163,122,0) 88%)}
 #kicker{display:inline-block;font-size:22px;letter-spacing:4px;text-transform:uppercase;color:#071e33;
   background:#7ff0c8;padding:10px 22px;border-radius:6px;margin-bottom:22px;font-weight:800;opacity:0}
 #headline{font-size:52px;line-height:1.12;color:#fff;margin:0 0 30px;font-weight:800;opacity:0}
 #lines .ln{font-size:36px;line-height:1.3;color:#eaf6fb;font-weight:700;opacity:0;
   padding:16px 0 16px 34px;border-left:6px solid #12a37a;margin-bottom:16px;
   background:linear-gradient(90deg,rgba(18,163,122,.16),rgba(18,163,122,0))}
`,
    `<div class="bg"></div>${media}
     <div class="side${wide}"><div id="kicker">${esc(s.kicker)}</div>
       <h1 id="headline">${esc(s.headline)}</h1><div id="lines">${items}</div></div>
     <div class="logobar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** No photograph - words pop in one by one, the spoken one highlighted. */
function styleKinetic(s) {
  const words = esc(s.headline)
    .split(/\s+/)
    .map((w) => `<span class="w">${w}</span>`)
    .join("");
  const art = pickArt(s);
  return shell(
    `
 .bg{position:absolute;inset:0;background:linear-gradient(140deg,#0b6fb4 0%,#12a37a 55%,#0b6fb4 100%);background-size:220% 220%}
 .artbox{position:absolute;right:96px;top:50%;transform:translateY(-50%);
   width:560px;height:560px;color:#fff;opacity:.34}
 .artbox.icon{width:420px;height:420px;opacity:.72}
 .deco{position:absolute;right:-200px;top:-240px;width:880px;height:880px;border-radius:50%;
   background:radial-gradient(circle,rgba(255,255,255,.20),rgba(255,255,255,0) 68%)}
 .deco2{position:absolute;left:-240px;bottom:-260px;width:800px;height:800px;border-radius:50%;
   background:radial-gradient(circle,rgba(255,255,255,.14),rgba(255,255,255,0) 68%)}
 #kicker{position:absolute;top:78px;left:110px;font-size:24px;letter-spacing:4px;
   text-transform:uppercase;color:#07304a;background:#7ff0c8;padding:12px 26px;
   border-radius:999px;font-weight:800;opacity:0}
 #words{position:absolute;left:110px;right:${art ? "700px" : "110px"};top:50%;
   transform:translateY(-50%);display:flex;flex-wrap:wrap;gap:10px 4px;align-items:flex-start}
 #words .w{display:inline-block;font-size:82px;line-height:1.12;font-weight:900;color:#fff;
   letter-spacing:-1.5px;opacity:0;padding:0 12px;border-radius:12px;
   text-shadow:0 4px 22px rgba(0,0,0,.28)}
 #words .w.hot{background:#fff;color:#0b6fb4;text-shadow:none}
 #sub{position:absolute;left:122px;right:${art ? "700px" : "300px"};bottom:150px;
   font-size:32px;line-height:1.45;color:#eaf6fb;margin:0;opacity:0}
 .logobar img{background:rgba(255,255,255,.94)}
`,
    `<div class="bg" data-pan></div><div class="deco"></div><div class="deco2"></div>
     <div id="kicker">${esc(s.kicker)}</div>
     <div id="words">${words}</div>
     <p id="sub">${esc(s.sub)}</p>
     ${artBox(art)}
     <div class="logobar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** No photograph at all - gradient and large type. */
function stylePlain(s) {
  const contact = s.contact
    ? `<div id="stat" style="opacity:0" class="contact">
         <div class="crow"><b>${esc(s.hotline || "")}</b></div>
         <div class="crow small">${esc(s.address || "")}</div></div>`
    : statBlock(s);
  const art = pickArt(s);
  return shell(
    `
 .bg{position:absolute;inset:0;background:linear-gradient(140deg,#eaf6fb 0%,#ffffff 52%,#e8f6ef 100%)}
 .artbox{position:absolute;right:112px;top:50%;transform:translateY(-50%);
   width:520px;height:520px;color:#0b6fb4;opacity:.82}
 .deco{position:absolute;right:-160px;top:-200px;width:820px;height:820px;border-radius:50%;
   background:radial-gradient(circle,rgba(18,163,122,.20),rgba(18,163,122,0) 70%)}
 .deco2{position:absolute;left:-200px;bottom:-240px;width:760px;height:760px;border-radius:50%;
   background:radial-gradient(circle,rgba(11,111,180,.17),rgba(11,111,180,0) 70%)}
 .wrap{position:absolute;left:130px;top:50%;transform:translateY(-50%);
   width:${art ? "1080px" : "1350px"}}
 #kicker{display:inline-block;font-size:24px;letter-spacing:4px;text-transform:uppercase;
   background:#0b6fb4;color:#fff;padding:12px 26px;border-radius:999px;margin-bottom:30px;
   font-weight:700;opacity:0}
 .bar{width:140px;height:11px;background:#12a37a;border-radius:6px;margin-bottom:34px;
   opacity:0;transform:scaleX(0);transform-origin:left center}
 #headline{font-size:82px;line-height:1.08;color:#0b6fb4;margin:0 0 24px;font-weight:800;
   letter-spacing:-1.5px;opacity:0}
 #sub{font-size:34px;line-height:1.4;color:#33586e;margin:0;opacity:0;
   max-width:${art ? "1020px" : "1150px"}}
 #stat{display:flex;align-items:baseline;gap:18px;margin-top:34px;opacity:0}
 #stat b{font-size:96px;color:#12a37a;font-weight:800;line-height:1}
 #stat span{font-size:28px;color:#5b7a8c}
 #stat.contact{display:block}
 .contact b{font-size:68px;color:#12a37a;font-weight:800}
 .crow.small{font-size:26px;color:#5b7a8c;margin-top:6px}
`,
    `<div class="bg"></div><div class="deco"></div><div class="deco2"></div>
     <div class="wrap"><div id="kicker">${esc(s.kicker)}</div><div class="bar" id="bar"></div>
       <h1 id="headline">${esc(s.headline)}</h1><p id="sub">${esc(s.sub)}</p>${contact}</div>
     ${artBox(art)}
     <div class="logobar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** Closing / opening logo card. */
function styleLogo(s) {
  const extra = (s.lines || []).map((t) => `<div class="ln">${esc(t)}</div>`).join("");
  return shell(
    `
 .bg{position:absolute;inset:0;background:linear-gradient(140deg,#eaf6fb 0%,#ffffff 52%,#e8f6ef 100%)}
 #hero{position:absolute;left:0;right:0;top:118px;display:flex;flex-direction:column;
   align-items:center;gap:18px;opacity:0}
 #hero img{width:250px}
 #vn{font-size:42px;font-weight:800;color:#0f9d4f;text-align:center;opacity:0}
 #en{font-size:22px;color:#6b7f8c;letter-spacing:2px;text-align:center;opacity:0}
 .wrap{position:absolute;left:0;right:0;top:600px;text-align:center;padding:0 160px}
 #headline{font-size:62px;line-height:1.1;color:#0b6fb4;margin:0 0 18px;font-weight:800;opacity:0}
 #sub{font-size:30px;color:#33586e;margin:0;opacity:0}
 #lines{margin-top:26px}
 #lines .ln{font-size:26px;color:#5b7a8c;opacity:0;margin-bottom:8px}
`,
    `<div class="bg"></div>
     <div id="hero"><img src="${fileUrl(join(ROOT, "assets", "emblem.png"))}">
       <div id="vn">BỆNH VIỆN VIỆT NAM - THỤY ĐIỂN UÔNG BÍ</div>
       <div id="en">VIETNAM - SWEDEN GENERAL HOSPITAL UONGBI</div></div>
     <div class="wrap"><h1 id="headline">${esc(s.headline)}</h1><p id="sub">${esc(s.sub)}</p>
       <div id="lines">${extra}</div></div>`,
    s.__cfg,
  );
}

const STYLES = {
  cinematic: styleCinematic, split: styleSplit, glass: styleGlass, caption: styleCaption,
  wipe: styleWipe, card: styleCard, shot: styleShot, lines: styleLines,
  kinetic: styleKinetic,
  plain: stylePlain, logo: styleLogo,
};

async function tts(text, outWav) {
  if (existsSync(outWav) && !FORCE) return;
  const res = await fetch(`${TTS_ENDPOINT}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}`);
  await writeFile(outWav, Buffer.from(await res.arrayBuffer()));
}

async function durationSec(p) {
  const { stdout } = await exec("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", p,
  ]);
  const d = parseFloat(stdout.trim());
  if (!isFinite(d)) throw new Error(`bad duration for ${p}`);
  return d;
}

async function main() {
  const scenesArg = process.argv.find((a) => a.startsWith("--scenes="));
  const nameArg = process.argv.find((a) => a.startsWith("--name="));
  const scenesFile = scenesArg ? scenesArg.slice(9) : "scenes-duthi.json";
  const name = nameArg ? nameArg.slice(7) : "duthi";
  dirs.voice = join(ROOT, "build", `voice-${name}`);
  dirs.clips = join(ROOT, "build", `clips-${name}`);
  const cfg = JSON.parse(await readFile(join(ROOT, scenesFile), "utf8"));
  // Before the first TTS call: a bad style name or a missing photo is not
  // worth finding out about five minutes into a render.
  assertScenes(cfg, { styles: Object.keys(STYLES), root: ROOT });
  for (const d of Object.values(dirs)) await mkdir(d, { recursive: true });

  const scenes = [];
  for (const s of cfg.scenes) {
    let clipDur = 8;
    let wav = null;
    if (!STILLS) {
      wav = join(dirs.voice, `${s.id}.wav`);
      process.stdout.write(`[tts]  ${s.id} ... `);
      await tts(s.voice, wav);
      const n = await durationSec(wav);
      clipDur = n + GAP_SEC;
      console.log(`${n.toFixed(2)}s`);
    }
    const parsed = parseStat(s.stat);
    const nLines = (s.lines || []).length;
    scenes.push({
      ...s, wav, clipDur,
      __cfg: {
        clipDurMs: clipDur * 1000,
        zoomOut: s.zoom === "out",
        statRevealMs: Math.max(1000, clipDur * 1000 * 0.42),
        statTarget: parsed ? parsed.target : null,
        statSuffix: parsed ? parsed.suffix : "",
        statGrouped: parsed ? parsed.grouped : false,
        wordMs: s.wordMs || 190,
        lineStartMs: s.lineStartMs || 1000,
        // spread the lines across the narration so each lands with its sentence
        lineMs: s.lineMs || (nLines ? Math.max(900, (clipDur * 1000 - 2200) / nLines) : 1300),
        artStartMs: s.artStartMs || 300,
        artStepMs: s.artStepMs || 210,
        artDrawMs: s.artDrawMs || 620,
      },
    });
  }

  // A motif seen twice reads as a repeated picture, which is the one thing the
  // photo mapping is careful to avoid - so say so rather than shipping it quietly.
  const usedArt = new Map();
  for (const s of scenes) {
    const a = s.photo ? null : pickArt(s);
    if (!a) continue;
    if (usedArt.has(a)) console.log(`[warn] hinh ve "${a}" lap lai: ${usedArt.get(a)} va ${s.id}`);
    else usedArt.set(a, s.id);
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: "new",
    userDataDir: join(tmpdir(), `bvtd-16x9-${process.pid}`),
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
      "--no-default-browser-check", "--disable-extensions",
      "--disable-background-networking", "--disable-sync", "--force-device-scale-factor=1"],
    defaultViewport: { width: W, height: H }, protocolTimeout: 300000,
  });
  try {
    const page = await browser.newPage();
    for (const s of scenes) {
      const render = STYLES[s.style];
      if (!render) throw new Error(`unknown style: ${s.style}`);
      const htmlPath = join(dirs.clips, `_${s.id}.html`);
      await writeFile(htmlPath, render(s), "utf8");
      await page.goto(fileUrl(htmlPath), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);

      if (STILLS) {
        await page.evaluate((t) => window.__frame(t), 5200);
        await page.screenshot({ path: join(dirs.stills, `${s.id}-${s.style}.png`), type: "png" });
        console.log(`[still] ${s.id} ${s.style}`);
        continue;
      }
      const frames = Math.round(s.clipDur * FPS);
      const out = join(dirs.clips, `${s.id}.mp4`);
      process.stdout.write(`[clip] ${s.id} (${s.style}, ${frames}f) ... `);
      const ff = spawn("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-r", String(FPS), out,
      ]);
      const done = new Promise((res, rej) => {
        ff.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`))));
        ff.on("error", rej);
      });
      for (let i = 0; i < frames; i++) {
        await page.evaluate((t) => window.__frame(t), (i / FPS) * 1000);
        const buf = await page.screenshot({ type: "jpeg", quality: 92 });
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
      }
      ff.stdin.end();
      await done;
      s.clip = out;
      console.log("ok");
    }
  } finally {
    await browser.close();
  }
  if (STILLS) { console.log(`\nStills in ${dirs.stills}`); return; }

  console.log("[audio] concat narration");
  const aArgs = ["-y", "-hide_banner", "-loglevel", "error"];
  const parts = [], labels = [];
  scenes.forEach((s, i) => {
    aArgs.push("-i", s.wav);
    parts.push(`[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono,` +
      `apad=pad_dur=${GAP_SEC},atrim=0:${s.clipDur.toFixed(3)},asetpts=N/SR/TB[a${i}]`);
    labels.push(`[a${i}]`);
  });
  const voiceWav = join(ROOT, "build", `voice-${name}.wav`);
  aArgs.push("-filter_complex",
    `${parts.join(";")};${labels.join("")}concat=n=${scenes.length}:v=0:a=1[out]`,
    "-map", "[out]", "-ar", "44100", "-ac", "1", voiceWav);
  await exec("ffmpeg", aArgs, { maxBuffer: 1 << 24 });

  console.log("[video] concat + mux");
  const listFile = join(ROOT, "build", `clips-${name}.txt`);
  await writeFile(listFile, scenes.map((s) => `file '${s.clip.replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const base = outBaseName(cfg, name);
  const silent = join(dirs.out, `${base}-silent.mp4`);
  await exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error",
    "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", silent], { maxBuffer: 1 << 24 });
  const withAudio = join(dirs.out, `${base}.mp4`);
  await exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error",
    "-i", silent, "-i", voiceWav, "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", withAudio], { maxBuffer: 1 << 24 });

  console.log(`\n=== Done ===\nWith audio : ${withAudio}\nSilent     : ${silent}`);
  console.log(`Total: ${(await durationSec(withAudio)).toFixed(2)}s (${scenes.length} scenes, ${W}x${H})`);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
