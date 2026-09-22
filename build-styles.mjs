import puppeteer from "puppeteer-core";
import { execFile, spawn } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { ART_ENGINE, ART_CSS, artBox, pickArt } from "./art.mjs";

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
const GAP_SEC = 0.45;
const STILLS = process.argv.includes("--stills");
const FORCE = process.argv.includes("--force");

const dirs = {
  voice: join(ROOT, "build", "voice-styles"),
  clips: join(ROOT, "build", "clips-styles"),
  stills: join(ROOT, "build", "stills"),
  out: join(ROOT, "out"),
};

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fileUrl = (p) => pathToFileURL(p).href;
const photoUrl = (name) => fileUrl(join(ROOT, "assets", "photos", name));
const logoUrl = () => fileUrl(join(ROOT, "assets", "logo.png"));

/**
 * One timing engine for every style. Each style's markup opts in simply by
 * using the ids the engine knows; missing ids are skipped. Time is pushed in
 * from Node per frame, so nothing depends on the browser's own clock.
 */
const ENGINE = `
function easeOutCubic(x){ return 1 - Math.pow(1 - x, 3); }
function easeOutExpo(x){ return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
function prog(t, start, end){ return clamp((t - start) / (end - start), 0, 1); }
function reveal(el, start, end, t, dy){
  if (!el) return 0;
  const p = easeOutCubic(prog(t, start, end));
  el.style.opacity = String(p);
  el.style.transform = "translateY(" + ((1 - p) * (dy === undefined ? 26 : dy)) + "px)";
  return p;
}
window.__frame = function(tMs){
  const cfg = window.__CFG;

  // Ken Burns: a plain continuous scale, sampled exactly at frame times.
  const photo = document.getElementById("photo");
  if (photo) {
    const p = clamp(tMs / cfg.clipDurMs, 0, 1);
    const s = cfg.zoomOut ? (1.12 - 0.12 * p) : (1.0 + 0.12 * p);
    photo.style.transform = "scale(" + s.toFixed(4) + ")";
  }

  reveal(document.getElementById("kicker"), 0, 380, tMs, 24);
  reveal(document.getElementById("meta"), 80, 460, tMs, 16);
  reveal(document.getElementById("headline"), 260, 720, tMs, 34);
  reveal(document.getElementById("sub"), 460, 880, tMs, 22);
  reveal(document.getElementById("logo"), 200, 700, tMs, 16);
  reveal(document.getElementById("frame"), 120, 760, tMs, 26);

  // clip-path wipe reveal
  const wipe = document.getElementById("wipe");
  if (wipe) {
    const p = easeOutExpo(prog(tMs, 240, 1150));
    wipe.style.clipPath = "inset(0 " + ((1 - p) * 100).toFixed(2) + "% 0 0)";
    wipe.style.opacity = "1";
  }

  // colour block sliding in from the edge
  const block = document.getElementById("block");
  if (block) {
    const p = easeOutExpo(prog(tMs, 60, 900));
    block.style.transform = "translateY(" + ((1 - p) * 100) + "%)";
  }

  // frosted panel rising
  const glass = document.getElementById("glass");
  if (glass) {
    const p = easeOutCubic(prog(tMs, 160, 820));
    glass.style.opacity = String(p);
    glass.style.transform = "translateY(" + ((1 - p) * 48) + "px)";
  }

  // word-by-word caption: each word pops, the active one is highlighted
  const words = document.querySelectorAll("#words .w");
  if (words.length) {
    const start = 260, per = cfg.wordMs || 190;
    for (let i = 0; i < words.length; i++) {
      const s = start + i * per;
      const p = easeOutCubic(prog(tMs, s, s + 240));
      const el = words[i];
      el.style.opacity = String(p);
      el.style.transform = "translateY(" + ((1 - p) * 22) + "px) scale(" + (0.86 + 0.14 * p) + ")";
      const active = tMs >= s && tMs < s + per + 240;
      el.classList.toggle("hot", active && p > 0.35);
    }
  }

  // stacked lines, revealed one after another to follow the voice-over
  const lines = document.querySelectorAll("#lines .ln");
  if (lines.length) {
    const start = cfg.lineStartMs || 1000, step = cfg.lineMs || 1300;
    for (let i = 0; i < lines.length; i++) {
      const s = start + i * step;
      const p = easeOutCubic(prog(tMs, s, s + 440));
      lines[i].style.opacity = String(p);
      lines[i].style.transform = "translateX(" + ((1 - p) * -34) + "px)";
    }
  }

  // stat block + count-up
  const statEl = document.getElementById("stat");
  if (statEl) {
    const at = cfg.statRevealMs;
    reveal(statEl, at, at + 520, tMs, 22);
    if (cfg.statTarget != null) {
      const cp = easeOutCubic(prog(tMs, at + 60, at + 700));
      const n = document.getElementById("statNum");
      if (n) n.textContent =
        (cfg.statGrouped ? Math.round(cfg.statTarget * cp).toLocaleString("vi-VN")
                         : String(Math.round(cfg.statTarget * cp))) + cfg.statSuffix;
    }
  }
${ART_ENGINE}
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

const BASE_CSS = `
 html,body{margin:0;padding:0;background:#fff}
 body{width:${W}px;height:${H}px;position:relative;overflow:hidden;
   font-family:"Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased}
 .full{position:absolute;inset:0;overflow:hidden}
 .full img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
 .brandbar{position:absolute;left:0;right:0;bottom:0;height:132px;display:flex;
   align-items:center;justify-content:center;gap:20px}
 .brandbar img{height:76px}
${ART_CSS}`;

function shell(styleCss, body, cfg) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${BASE_CSS}${styleCss}</style></head>
<body>${body}<script>window.__CFG=${JSON.stringify(cfg)};${ENGINE}</script></body></html>`;
}

/** 1. Cinematic editorial - full-bleed photo, dark scrim, oversized serif headline. */
function styleCinematic(s) {
  const stat = s.stat
    ? `<div id="stat" style="opacity:0"><b id="statNum">0</b><span>${esc(s.statLabel)}</span></div>`
    : "";
  return shell(
    `
 .scrim{position:absolute;inset:0;background:linear-gradient(180deg,
   rgba(4,18,28,.55) 0%, rgba(4,18,28,.05) 28%, rgba(4,18,28,.72) 66%, rgba(4,18,28,.94) 100%)}
 .wrap{position:absolute;left:72px;right:72px;bottom:200px}
 #kicker{display:inline-block;font-size:28px;letter-spacing:6px;text-transform:uppercase;
   color:#8fe3c8;border-left:5px solid #12a37a;padding-left:18px;margin-bottom:30px;opacity:0}
 #headline{font-family:Cambria,Georgia,serif;font-size:98px;line-height:1.03;color:#fff;
   margin:0 0 24px;font-weight:700;letter-spacing:-2px;opacity:0;text-shadow:0 6px 40px rgba(0,0,0,.5)}
 #sub{font-size:37px;line-height:1.4;color:#cfe3ee;margin:0;font-weight:300;opacity:0;max-width:880px}
 #stat{display:flex;align-items:baseline;gap:18px;margin-top:30px}
 #stat b{font-size:92px;color:#7ff0c8;font-weight:800;line-height:1;
   text-shadow:0 4px 26px rgba(0,0,0,.5)}
 #stat span{font-size:30px;color:#cfe3ee;font-weight:400;max-width:520px}
 .brandbar{color:#eaf6fb;font-size:26px;letter-spacing:2px}
`,
    `<div class="full"><img id="photo" src="${photoUrl(s.photo)}"></div>
     <div class="scrim"></div>
     <div class="wrap">
       <div id="kicker">${esc(s.kicker)}</div>
       <h1 id="headline">${esc(s.headline)}</h1>
       <p id="sub">${esc(s.sub)}</p>
       ${stat}
     </div>
     <div class="brandbar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** 2. Glass 2.0 - frosted panel over the photo; bold pure-white type for contrast. */
function styleGlass(s) {
  const stat = s.contact
    ? `<div id="stat" style="opacity:0" class="contact">
         <div class="crow"><span class="clbl">Đăng ký khám</span><b>${esc(s.hotline || "")}</b></div>
         <div class="crow small">${esc(s.address || "")}</div>
       </div>`
    : s.stat
      ? `<div id="stat" style="opacity:0"><b id="statNum">0</b><span>${esc(s.statLabel)}</span></div>`
      : "";
  return shell(
    `
 .tint{position:absolute;inset:0;background:linear-gradient(160deg,rgba(6,40,64,.34),rgba(6,40,64,.52))}
 /* The gradient base keeps this reading as frosted glass even when headless
    Chrome skips backdrop-filter compositing (it does with --disable-gpu). */
 #glass{position:absolute;left:52px;right:52px;bottom:176px;padding:66px 58px;
   background:linear-gradient(150deg,rgba(255,255,255,.32),rgba(255,255,255,.15));
   backdrop-filter:blur(28px) saturate(170%);
   -webkit-backdrop-filter:blur(28px) saturate(170%);
   border:1.5px solid rgba(255,255,255,.55);border-radius:44px;
   box-shadow:0 30px 80px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.6);opacity:0}
 #kicker{display:inline-block;font-size:26px;letter-spacing:4px;text-transform:uppercase;
   color:#fff;background:rgba(18,163,122,.92);padding:12px 26px;border-radius:999px;
   margin-bottom:28px;font-weight:700;opacity:0}
 #headline{font-size:82px;line-height:1.08;color:#fff;margin:0 0 22px;font-weight:800;
   letter-spacing:-1px;opacity:0;text-shadow:0 3px 18px rgba(0,0,0,.45)}
 #sub{font-size:37px;line-height:1.38;color:#fff;margin:0;font-weight:600;opacity:0;
   text-shadow:0 2px 12px rgba(0,0,0,.4)}
 #stat{display:flex;align-items:baseline;gap:18px;margin-top:34px}
 #stat b{font-size:96px;color:#7ff0c8;font-weight:800;line-height:1;text-shadow:0 3px 20px rgba(0,0,0,.4)}
 #stat span{font-size:30px;color:#eaf6fb;font-weight:600}
 #stat.contact{display:block}
 .crow{display:flex;align-items:baseline;gap:16px;margin-bottom:10px}
 .clbl{font-size:30px;color:#eaf6fb;font-weight:600}
 .contact b{font-size:66px;color:#7ff0c8;font-weight:800;letter-spacing:1px;line-height:1.1;
   text-shadow:0 3px 20px rgba(0,0,0,.4)}
 .crow.small{font-size:27px;color:#eaf6fb;font-weight:500}
 .brandbar{filter:drop-shadow(0 3px 12px rgba(0,0,0,.5))}
`,
    `<div class="full"><img id="photo" src="${photoUrl(s.photo)}"></div>
     <div class="tint"></div>
     <div id="glass">
       <div id="kicker">${esc(s.kicker)}</div>
       <h1 id="headline">${esc(s.headline)}</h1>
       <p id="sub">${esc(s.sub)}</p>
       ${stat}
     </div>
     <div class="brandbar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** 3. Kinetic caption - words pop in one by one, the spoken one highlighted. */
function styleCaption(s) {
  const words = esc(s.headline)
    .split(/\s+/)
    .map((w) => `<span class="w">${w}</span>`)
    .join("");
  return shell(
    `
 .tint{position:absolute;inset:0;background:linear-gradient(180deg,rgba(3,20,32,.30) 0%,
   rgba(3,20,32,.20) 45%, rgba(3,20,32,.82) 100%)}
 #kicker{position:absolute;top:78px;left:60px;font-size:28px;letter-spacing:4px;
   text-transform:uppercase;color:#fff;background:#0b6fb4;padding:14px 30px;
   border-radius:14px;font-weight:800;opacity:0}
 #words{position:absolute;left:60px;right:60px;bottom:300px;display:flex;flex-wrap:wrap;
   gap:6px 4px;align-items:flex-start;justify-content:flex-start}
 #words .w{display:inline-block;font-size:86px;line-height:1.1;font-weight:900;color:#fff;
   letter-spacing:-1.5px;opacity:0;padding:0 12px;border-radius:12px;
   text-shadow:0 4px 22px rgba(0,0,0,.55);transition:none}
 #words .w.hot{background:#12a37a;color:#fff;text-shadow:none}
 #sub{position:absolute;left:60px;right:60px;bottom:196px;font-size:34px;color:#d8ebf6;
   margin:0;font-weight:500;opacity:0}
 .brandbar{filter:drop-shadow(0 3px 12px rgba(0,0,0,.5))}
`,
    `<div class="full"><img id="photo" src="${photoUrl(s.photo)}"></div>
     <div class="tint"></div>
     <div id="kicker">${esc(s.kicker)}</div>
     <div id="words">${words}</div>
     <p id="sub">${esc(s.sub)}</p>
     <div class="brandbar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** 4. Split editorial - photo up top, a brand colour block carrying the type. */
function styleSplit(s) {
  const stat = s.stat
    ? `<div id="stat" style="opacity:0"><b id="statNum">0</b><span>${esc(s.statLabel)}</span></div>`
    : "";
  return shell(
    `
 .photo{position:absolute;left:0;right:0;top:0;height:940px;overflow:hidden}
 .photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
 #block{position:absolute;left:0;right:0;top:880px;bottom:0;background:#0b6fb4;
   padding:84px 64px 0;box-sizing:border-box;transform:translateY(100%);
   clip-path:polygon(0 68px, 100% 0, 100% 100%, 0 100%)}
 #kicker{display:inline-block;font-size:26px;letter-spacing:5px;text-transform:uppercase;
   color:#0b6fb4;background:#7ff0c8;padding:12px 26px;border-radius:6px;margin-bottom:30px;
   font-weight:800;opacity:0}
 #headline{font-size:84px;line-height:1.05;color:#fff;margin:0 0 24px;font-weight:800;
   letter-spacing:-1.5px;opacity:0}
 #sub{font-size:36px;line-height:1.38;color:#cfe6f6;margin:0;font-weight:400;opacity:0}
 #stat{display:flex;align-items:baseline;gap:18px;margin-top:32px}
 #stat b{font-size:98px;color:#7ff0c8;font-weight:800;line-height:1}
 #stat span{font-size:30px;color:#cfe6f6}
 .brandbar img{background:#fff;padding:12px 24px;border-radius:999px}
`,
    `<div class="photo"><img id="photo" src="${photoUrl(s.photo)}"></div>
     <div id="block">
       <div id="kicker">${esc(s.kicker)}</div>
       <h1 id="headline">${esc(s.headline)}</h1>
       <p id="sub">${esc(s.sub)}</p>
       ${stat}
     </div>
     <div class="brandbar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** 5. Wipe reveal - headline uncovered by a clip-path sweep, monospace meta line. */
function styleWipe(s) {
  return shell(
    `
 .photo{position:absolute;left:0;right:0;top:0;height:1120px;overflow:hidden}
 .photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
 .photo:after{content:"";position:absolute;inset:0;
   background:linear-gradient(180deg,rgba(2,22,36,.25),rgba(2,22,36,.06) 40%,rgba(255,255,255,1) 99%)}
 #meta{position:absolute;top:70px;left:60px;font-family:Consolas,"Courier New",monospace;
   font-size:26px;letter-spacing:3px;color:#eaf6fb;background:rgba(4,26,42,.6);
   padding:12px 22px;border-radius:8px;opacity:0}
 .panel{position:absolute;left:64px;right:64px;top:1060px}
 .rule{width:100%;height:3px;background:#dbe9f2;margin-bottom:38px}
 #wipe{clip-path:inset(0 100% 0 0)}
 #headline{font-size:88px;line-height:1.05;color:#0b3d5c;margin:0 0 26px;font-weight:800;
   letter-spacing:-1.5px}
 #sub{font-size:37px;line-height:1.4;color:#42687f;margin:0;font-weight:400;opacity:0}
 #kicker{display:inline-block;font-size:26px;letter-spacing:5px;text-transform:uppercase;
   color:#12a37a;font-weight:800;margin-bottom:22px;opacity:0}
 #stat{display:flex;align-items:baseline;gap:18px;margin-top:30px}
 #stat b{font-size:94px;color:#12a37a;font-weight:800;line-height:1}
 #stat span{font-size:30px;color:#5b7a8c;max-width:520px}
`,
    `<div class="photo"><img id="photo" src="${photoUrl(s.photo)}"></div>
     <div id="meta">${esc(s.meta || "BENH VIEN VIET NAM - THUY DIEN // VSH.ORG.VN")}</div>
     <div class="panel">
       <div class="rule"></div>
       <div id="kicker">${esc(s.kicker)}</div>
       <div id="wipe"><h1 id="headline">${esc(s.headline)}</h1></div>
       <p id="sub">${esc(s.sub)}</p>
       ${s.stat ? `<div id="stat" style="opacity:0"><b id="statNum">0</b><span>${esc(s.statLabel)}</span></div>` : ""}
     </div>
     <div class="brandbar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** 6. The current bright card, kept in the line-up for comparison. */
function styleCard(s) {
  const stat = s.stat
    ? `<div id="stat" style="opacity:0"><b id="statNum">0</b><span>${esc(s.statLabel)}</span></div>`
    : "";
  return shell(
    `
 .photo{position:absolute;left:0;right:0;top:0;height:1200px;overflow:hidden}
 .photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
 #kicker{position:absolute;top:60px;left:60px;background:#0b6fb4;color:#fff;font-size:32px;
   font-weight:700;letter-spacing:2px;padding:16px 32px;border-radius:999px;
   text-transform:uppercase;opacity:0}
 .panel{position:absolute;left:0;right:0;top:1020px;bottom:132px;background:#fff;
   border-radius:52px 52px 0 0;padding:58px 64px 0;box-sizing:border-box;
   box-shadow:0 -16px 44px rgba(11,111,180,.16)}
 #headline{font-size:76px;line-height:1.06;color:#0b6fb4;margin:0 0 24px;font-weight:800;
   letter-spacing:-1px;opacity:0}
 #sub{font-size:40px;line-height:1.34;color:#33586e;margin:0;opacity:0}
 #stat{display:flex;align-items:baseline;gap:20px;margin-top:34px}
 #stat b{font-size:100px;color:#12a37a;font-weight:800;line-height:1}
 #stat span{font-size:34px;color:#5b7a8c}
 .brandbar{background:#f2f8fc;border-top:3px solid #dceaf4}
`,
    `<div class="photo"><img id="photo" src="${photoUrl(s.photo)}"></div>
     <div id="kicker">${esc(s.kicker)}</div>
     <div class="panel">
       <h1 id="headline">${esc(s.headline)}</h1>
       <p id="sub">${esc(s.sub)}</p>
       ${stat}
     </div>
     <div class="brandbar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** 7. Logo opener - emblem and wordmark on a soft gradient, no photograph. */
function styleLogo(s) {
  return shell(
    `
 .bg{position:absolute;inset:0;background:linear-gradient(160deg,#eaf6fb 0%,#ffffff 52%,#e8f6ef 100%)}
 .hero{position:absolute;left:0;right:0;top:0;height:1180px;display:flex;flex-direction:column;
   align-items:center;justify-content:center;gap:30px;padding:0 70px;box-sizing:border-box}
 .hero img{width:420px}
 .vn{font-size:54px;font-weight:800;color:#0f9d4f;text-align:center;line-height:1.12;letter-spacing:-.5px}
 .en{font-size:28px;color:#6b7f8c;letter-spacing:2px;text-align:center}
 #kicker{position:absolute;top:60px;left:60px;background:#0b6fb4;color:#fff;font-size:30px;
   font-weight:700;letter-spacing:2px;padding:15px 30px;border-radius:999px;
   text-transform:uppercase;opacity:0}
 .panel{position:absolute;left:64px;right:64px;top:1210px}
 #headline{font-size:78px;line-height:1.06;color:#0b6fb4;margin:0 0 22px;font-weight:800;
   letter-spacing:-1px;opacity:0}
 #sub{font-size:38px;line-height:1.36;color:#33586e;margin:0;opacity:0}
 .brandbar{background:#f2f8fc;border-top:3px solid #dceaf4}
`,
    `<div class="bg"></div>
     <div class="hero">
       <img src="${fileUrl(join(ROOT, "assets", "emblem.png"))}">
       <div class="vn">BỆNH VIỆN VIỆT NAM - THỤY ĐIỂN UÔNG BÍ</div>
       <div class="en">VIETNAM - SWEDEN GENERAL HOSPITAL UONGBI</div>
     </div>
     <div id="kicker">${esc(s.kicker)}</div>
     <div class="panel">
       <h1 id="headline">${esc(s.headline)}</h1>
       <p id="sub">${esc(s.sub)}</p>
     </div>
     <div class="brandbar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** 8. Plain card - deliberately no photograph: soft gradient and large type,
 *  for scenes where no on-topic picture exists and a wrong one would mislead. */
function stylePlain(s) {
  const block = s.contact
    ? `<div id="stat" style="opacity:0" class="contact">
         <div class="crow"><span class="clbl">Đăng ký khám</span><b>${esc(s.hotline || "")}</b></div>
         <div class="crow small">${esc(s.address || "")}</div>
       </div>`
    : s.stat
      ? `<div id="stat" style="opacity:0"><b id="statNum">0</b><span>${esc(s.statLabel)}</span></div>`
      : "";
  const art = pickArt(s);
  return shell(
    `
 .bg{position:absolute;inset:0;background:linear-gradient(160deg,#eaf6fb 0%,#ffffff 52%,#e8f6ef 100%)}
 .artbox{position:absolute;right:76px;top:150px;width:420px;height:420px;color:#0b6fb4;opacity:.8}
 .deco{position:absolute;right:-190px;top:-160px;width:780px;height:780px;border-radius:50%;
   background:radial-gradient(circle,rgba(18,163,122,.18),rgba(18,163,122,0) 70%)}
 .deco2{position:absolute;left:-230px;bottom:200px;width:720px;height:720px;border-radius:50%;
   background:radial-gradient(circle,rgba(11,111,180,.15),rgba(11,111,180,0) 70%)}
 #kicker{position:absolute;top:60px;left:60px;background:#0b6fb4;color:#fff;font-size:32px;
   font-weight:700;letter-spacing:2px;padding:16px 32px;border-radius:999px;
   text-transform:uppercase;opacity:0}
 .wrap{position:absolute;left:72px;right:72px;top:540px}
 .bar{width:150px;height:12px;background:#12a37a;border-radius:6px;margin-bottom:44px;
   opacity:0;transform:scaleX(0);transform-origin:left center}
 #headline{font-size:92px;line-height:1.06;color:#0b6fb4;margin:0 0 30px;font-weight:800;
   letter-spacing:-1.5px;opacity:0}
 #sub{font-size:44px;line-height:1.36;color:#33586e;margin:0;opacity:0}
 #stat{display:flex;align-items:baseline;gap:20px;margin-top:44px}
 #stat b{font-size:104px;color:#12a37a;font-weight:800;line-height:1}
 #stat span{font-size:34px;color:#5b7a8c;max-width:520px}
 #stat.contact{display:block}
 .crow{display:flex;align-items:baseline;gap:18px;margin-bottom:12px}
 .clbl{font-size:34px;color:#5b7a8c}
 .contact b{font-size:78px;color:#12a37a;font-weight:800;letter-spacing:1px;line-height:1.1}
 .crow.small{font-size:32px;color:#5b7a8c}
 .brandbar{background:#f2f8fc;border-top:3px solid #dceaf4}
`,
    `<div class="bg"></div><div class="deco"></div><div class="deco2"></div>
     <div id="kicker">${esc(s.kicker)}</div>
     <div class="wrap">
       <div class="bar" id="bar"></div>
       <h1 id="headline">${esc(s.headline)}</h1>
       <p id="sub">${esc(s.sub)}</p>
       ${block}
     </div>
     ${artBox(art)}
     <div class="brandbar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** 9. Kinetic type, no photo - words pop in one by one on a bright medical ground. */
function styleKinetic(s) {
  const words = esc(s.headline)
    .split(/\s+/)
    .map((w) => `<span class="w">${w}</span>`)
    .join("");
  const art = pickArt(s);
  return shell(
    `
 .bg{position:absolute;inset:0;background:linear-gradient(160deg,#0b6fb4 0%,#12a37a 100%)}
 .artbox{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
   width:820px;height:820px;color:#fff;opacity:.17}
 .deco{position:absolute;right:-220px;top:-180px;width:840px;height:840px;border-radius:50%;
   background:radial-gradient(circle,rgba(255,255,255,.22),rgba(255,255,255,0) 68%)}
 .deco2{position:absolute;left:-260px;bottom:260px;width:760px;height:760px;border-radius:50%;
   background:radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,0) 68%)}
 #kicker{position:absolute;top:78px;left:60px;font-size:28px;letter-spacing:4px;
   text-transform:uppercase;color:#0b3a55;background:#7ff0c8;padding:14px 30px;
   border-radius:14px;font-weight:800;opacity:0}
 #words{position:absolute;left:60px;right:60px;top:50%;transform:translateY(-50%);
   display:flex;flex-wrap:wrap;gap:8px 4px;align-items:flex-start}
 #words .w{display:inline-block;font-size:92px;line-height:1.1;font-weight:900;color:#fff;
   letter-spacing:-1.5px;opacity:0;padding:0 12px;border-radius:12px;
   text-shadow:0 4px 22px rgba(0,0,0,.28)}
 #words .w.hot{background:#fff;color:#0b6fb4;text-shadow:none}
 #sub{position:absolute;left:72px;right:72px;bottom:230px;font-size:38px;line-height:1.36;
   color:#eaf6fb;margin:0;font-weight:500;opacity:0}
 .brandbar img{background:rgba(255,255,255,.94);border-radius:999px;padding:8px 20px}
`,
    `<div class="bg"></div><div class="deco"></div><div class="deco2"></div>
     ${artBox(art)}
     <div id="kicker">${esc(s.kicker)}</div>
     <div id="words">${words}</div>
     <p id="sub">${esc(s.sub)}</p>
     <div class="brandbar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** 10. Checklist, no photo - lines slide in one at a time under a fixed headline. */
function styleLines(s) {
  const items = (s.lines || []).map((t) => `<div class="ln">${esc(t)}</div>`).join("");
  return shell(
    `
 .bg{position:absolute;inset:0;background:linear-gradient(165deg,#eaf6fb 0%,#ffffff 55%,#e8f6ef 100%)}
 .deco{position:absolute;left:-240px;top:-200px;width:820px;height:820px;border-radius:50%;
   background:radial-gradient(circle,rgba(11,111,180,.16),rgba(11,111,180,0) 70%)}
 #kicker{position:absolute;top:60px;left:60px;background:#0b6fb4;color:#fff;font-size:30px;
   font-weight:700;letter-spacing:2px;padding:16px 32px;border-radius:999px;
   text-transform:uppercase;opacity:0}
 .wrap{position:absolute;left:66px;right:66px;top:300px}
 #headline{font-size:76px;line-height:1.08;color:#0b6fb4;margin:0 0 48px;font-weight:800;
   letter-spacing:-1.2px;opacity:0}
 #lines .ln{font-size:46px;line-height:1.28;color:#14405c;font-weight:700;opacity:0;
   padding:24px 24px 24px 34px;border-left:8px solid #12a37a;margin-bottom:24px;
   background:linear-gradient(90deg,rgba(18,163,122,.14),rgba(18,163,122,0) 92%);
   border-radius:0 14px 14px 0}
 .brandbar{background:#f2f8fc;border-top:3px solid #dceaf4}
`,
    `<div class="bg"></div><div class="deco"></div>
     <div id="kicker">${esc(s.kicker)}</div>
     <div class="wrap">
       <h1 id="headline">${esc(s.headline)}</h1>
       <div id="lines">${items}</div>
     </div>
     <div class="brandbar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

/** 11. Poster or screenshot shown WHOLE (contain, never cropped), text below. */
function styleShot(s) {
  return shell(
    `
 .bg{position:absolute;inset:0;background:linear-gradient(165deg,#071e33 0%,#0e3557 58%,#071e33 100%)}
 .fwrap{position:absolute;left:60px;right:60px;top:210px;height:680px;display:flex;align-items:center}
 #frame{width:100%;background:#fff;border-radius:20px;padding:14px;box-sizing:border-box;
   box-shadow:0 30px 80px rgba(0,0,0,.5);opacity:0}
 #frame img{display:block;width:100%;height:auto;max-height:652px;object-fit:contain;
   border-radius:12px;background:#f4f8fb}
 #kicker{position:absolute;top:84px;left:60px;font-size:28px;letter-spacing:5px;
   text-transform:uppercase;color:#071e33;background:#7ff0c8;padding:14px 30px;
   border-radius:12px;font-weight:800;opacity:0}
 .wrap{position:absolute;left:64px;right:64px;top:980px}
 #headline{font-size:78px;line-height:1.08;color:#fff;margin:0 0 26px;font-weight:800;
   letter-spacing:-1.5px;opacity:0}
 #sub{font-size:38px;line-height:1.38;color:#bcd6e8;margin:0;opacity:0}
 .brandbar img{background:rgba(255,255,255,.94);border-radius:999px;padding:8px 22px}
`,
    `<div class="bg"></div>
     <div id="kicker">${esc(s.kicker)}</div>
     <div class="fwrap"><div id="frame"><img src="${photoUrl(s.photo)}"></div></div>
     <div class="wrap"><h1 id="headline">${esc(s.headline)}</h1><p id="sub">${esc(s.sub)}</p></div>
     <div class="brandbar" id="logo"><img src="${logoUrl()}"></div>`,
    s.__cfg,
  );
}

const STYLES = {
  cinematic: styleCinematic,
  shot: styleShot,
  kinetic: styleKinetic,
  lines: styleLines,
  glass: styleGlass,
  caption: styleCaption,
  split: styleSplit,
  wipe: styleWipe,
  card: styleCard,
  logo: styleLogo,
  plain: stylePlain,
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

async function durationSec(path) {
  const { stdout } = await exec("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", path,
  ]);
  const d = parseFloat(stdout.trim());
  if (!isFinite(d)) throw new Error(`bad duration for ${path}`);
  return d;
}

async function main() {
  const scenesArg = process.argv.find((a) => a.startsWith("--scenes="));
  const nameArg = process.argv.find((a) => a.startsWith("--name="));
  const scenesFile = scenesArg ? scenesArg.slice(9) : "scenes-styles.json";
  const name = nameArg ? nameArg.slice(7) : "styles";
  // Per-name dirs: scene ids repeat across scripts, and a shared voice cache
  // silently hands one video another video's narration.
  dirs.voice = join(ROOT, "build", `voice-${name}`);
  dirs.clips = join(ROOT, "build", `clips-${name}`);
  const cfg = JSON.parse(await readFile(join(ROOT, scenesFile), "utf8"));
  for (const d of Object.values(dirs)) await mkdir(d, { recursive: true });

  const scenes = [];
  for (const s of cfg.scenes) {
    let clipDur = 6.5;
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
        statRevealMs: Math.max(1100, clipDur * 1000 * 0.42),
        statTarget: parsed ? parsed.target : null,
        statSuffix: parsed ? parsed.suffix : "",
        statGrouped: parsed ? parsed.grouped : false,
        wordMs: s.wordMs || 190,
        artStartMs: s.artStartMs || 300,
        artStepMs: s.artStepMs || 210,
        artDrawMs: s.artDrawMs || 620,
        lineStartMs: s.lineStartMs || 1000,
        // spread the lines across the narration so each lands with its sentence
        lineMs: s.lineMs || (nLines ? Math.max(900, (clipDur * 1000 - 2200) / nLines) : 1300),
      },
    });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    userDataDir: join(tmpdir(), `bvtd-styles-${process.pid}`),
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
      "--no-default-browser-check", "--disable-extensions",
      "--disable-background-networking", "--disable-sync", "--force-device-scale-factor=1"],
    defaultViewport: { width: W, height: H },
    protocolTimeout: 300000,
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
        // Late enough that every reveal has settled - including the stat block,
        // which only starts at 42% of the clip and then counts up for ~0.7s.
        await page.evaluate((t) => window.__frame(t), 4200);
        // Keyed by scene id, not style: several scenes share a style and would
        // otherwise overwrite each other, hiding the variants worth checking.
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

  if (STILLS) {
    console.log(`\nStills in ${dirs.stills}`);
    return;
  }

  console.log("[audio] concat narration");
  const aArgs = ["-y", "-hide_banner", "-loglevel", "error"];
  const parts = [], labels = [];
  scenes.forEach((s, i) => {
    aArgs.push("-i", s.wav);
    parts.push(`[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono,` +
      `apad=pad_dur=${GAP_SEC},atrim=0:${s.clipDur.toFixed(3)},asetpts=N/SR/TB[a${i}]`);
    labels.push(`[a${i}]`);
  });
  const voiceWav = join(dirs.out, `voice-${name}.wav`);
  aArgs.push("-filter_complex",
    `${parts.join(";")};${labels.join("")}concat=n=${scenes.length}:v=0:a=1[out]`,
    "-map", "[out]", "-ar", "44100", "-ac", "1", voiceWav);
  await exec("ffmpeg", aArgs, { maxBuffer: 1 << 24 });

  console.log("[video] concat + mux");
  const listFile = join(ROOT, "build", `clips-${name}.txt`);
  await writeFile(listFile, scenes.map((s) => `file '${s.clip.replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const silent = join(dirs.out, `video-${name}-silent.mp4`);
  await exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error",
    "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", silent], { maxBuffer: 1 << 24 });
  const withAudio = join(dirs.out, `video-${name}.mp4`);
  await exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error",
    "-i", silent, "-i", voiceWav, "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", withAudio], { maxBuffer: 1 << 24 });

  console.log(`\n=== Done ===\nWith audio : ${withAudio}\nSilent     : ${silent}`);
  console.log(`Total: ${(await durationSec(withAudio)).toFixed(2)}s (${scenes.length} styles)`);
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
