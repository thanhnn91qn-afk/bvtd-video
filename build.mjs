import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

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
const PHOTO_H = 1200; // photo band height; the card panel overlaps its lower edge
const GAP_SEC = 0.45; // silence after each scene's narration
const FORCE = process.argv.includes("--force");

const dirs = {
  voice: join(ROOT, "build", "voice"),
  cards: join(ROOT, "build", "cards"),
  clips: join(ROOT, "build", "clips"),
  out: join(ROOT, "out"),
};

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Bright medical scene card, rendered to a transparent PNG overlaid on the moving photo. */
function cardHtml(scene, brand, withStat) {
  const stat =
    withStat && scene.stat
      ? `<div class="stat"><b>${esc(scene.stat)}</b><span>${esc(scene.statLabel)}</span></div>`
      : "";
  const contact =
    withStat && scene.contact
      ? `<div class="contact">
           <div class="row"><span class="lbl">Đăng ký khám</span><b>${esc(brand.hotline)}</b></div>
           <div class="row small">${esc(brand.address)}</div>
           <div class="row small">${esc(brand.web)}</div>
         </div>`
      : "";
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
 html,body{margin:0;padding:0;background:transparent}
 body{width:${W}px;height:${H}px;font-family:"Segoe UI",Arial,sans-serif;position:relative;overflow:hidden}
 .kicker{position:absolute;top:60px;left:60px;background:#0b6fb4;color:#fff;font-size:32px;
   font-weight:700;letter-spacing:2px;padding:16px 32px;border-radius:999px;text-transform:uppercase;
   box-shadow:0 10px 26px rgba(11,111,180,.38)}
 .panel{position:absolute;left:0;right:0;top:1020px;bottom:150px;background:#fff;
   border-radius:52px 52px 0 0;box-shadow:0 -16px 44px rgba(11,111,180,.16);
   padding:58px 64px 0;box-sizing:border-box}
 .bar{width:130px;height:10px;background:#12a37a;border-radius:5px;margin-bottom:30px}
 h1{font-size:76px;line-height:1.06;color:#0b6fb4;margin:0 0 24px;font-weight:800;letter-spacing:-1px}
 p{font-size:40px;line-height:1.34;color:#33586e;margin:0;font-weight:400}
 .stat{display:flex;align-items:baseline;gap:20px;margin-top:34px}
 .stat b{font-size:100px;color:#12a37a;font-weight:800;line-height:1}
 .stat span{font-size:34px;color:#5b7a8c;line-height:1.25;max-width:520px}
 .contact{margin-top:34px}
 .contact .row{display:flex;align-items:baseline;gap:18px;margin-bottom:10px}
 .contact .lbl{font-size:34px;color:#5b7a8c}
 .contact b{font-size:72px;color:#12a37a;font-weight:800;letter-spacing:1px}
 .contact .small{font-size:32px;color:#5b7a8c}
 .footer{position:absolute;left:0;right:0;bottom:0;height:150px;background:#f2f8fc;
   border-top:3px solid #dceaf4;display:flex;align-items:center;justify-content:center}
 .footer img{height:86px}
 .hero{position:absolute;left:0;right:0;top:0;height:1020px;display:flex;
   flex-direction:column;align-items:center;justify-content:center;gap:32px;
   padding:0 70px;box-sizing:border-box}
 .hero img{width:430px}
 .hero .vn{font-size:56px;font-weight:800;color:#0f9d4f;text-align:center;line-height:1.12;
   letter-spacing:-.5px}
 .hero .en{font-size:29px;color:#6b7f8c;letter-spacing:2px;text-align:center}
 .hero .slogan{font-size:30px;color:#5b7a8c;font-style:italic;text-align:center}
 body.logo .panel{bottom:0}
</style></head><body class="${scene.logoCard ? "logo" : ""}">
${scene.logoCard ? `<div class="hero">
  <img src="../emblem.png">
  <div class="vn">BỆNH VIỆN VIỆT NAM - THỤY ĐIỂN UÔNG BÍ</div>
  <div class="en">VIETNAM - SWEDEN GENERAL HOSPITAL UONGBI</div>
  <div class="slogan">Tất cả vì sự hài lòng của người bệnh</div>
</div>` : ""}
<div class="kicker">${esc(scene.kicker)}</div>
<div class="panel">
  <div class="bar"></div>
  <h1>${esc(scene.headline)}</h1>
  <p>${esc(scene.sub)}</p>
  ${stat}${contact}
</div>
${scene.logoCard ? "" : `<div class="footer"><img src="../logo.png"></div>`}
</body></html>`;
}

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

async function shoot(htmlPath, pngPath) {
  if (existsSync(pngPath) && !FORCE) return;
  // A private profile dir is required: headless Chrome blocks on the default
  // profile's lock when a normal Chrome is already running on this machine.
  const profile = join(tmpdir(), `bvtd-chrome-${process.pid}`);
  await exec(
    CHROME,
    [
      "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
      "--no-first-run", "--no-default-browser-check",
      "--disable-extensions", "--disable-background-networking", "--disable-sync",
      `--user-data-dir=${profile}`,
      "--default-background-color=00000000",
      "--force-device-scale-factor=1",
      `--window-size=${W},${H}`,
      "--virtual-time-budget=3000",
      `--screenshot=${pngPath}`,
      htmlPath,
    ],
    { timeout: 90000 },
  );
  if (!existsSync(pngPath)) throw new Error(`screenshot produced no file: ${pngPath}`);
}

/** zoompan expressions: a slow push-in or pull-out, anchored left / centre / right. */
function motion(scene, frames) {
  const z =
    scene.zoom === "out"
      ? `if(eq(on,1),1.14,max(zoom-0.00055,1.001))`
      : `min(zoom+0.00055,1.14)`;
  const x =
    scene.pan === "left" ? `0` : scene.pan === "right" ? `iw-iw/zoom` : `iw/2-(iw/zoom/2)`;
  return `zoompan=z='${z}':d=${frames}:x='${x}':y='ih/2-(ih/zoom/2)':s=${W}x${PHOTO_H}:fps=${FPS}`;
}

async function buildClip(scene, photo, cardA, cardB, clipDur, out) {
  if (existsSync(out) && !FORCE) return;
  const frames = Math.ceil(clipDur * FPS) + 2;
  const d = clipDur.toFixed(3);
  // The cards must be looped into real streams: a single still frame would be
  // sampled once at t=0, where the fade-in still has alpha 0, and overlay would
  // then repeat that fully transparent frame for the whole clip (invisible text).
  const loop = (png) => ["-loop", "1", "-framerate", String(FPS), "-t", d, "-i", png];
  // The opening card shows the hospital logo instead of a photograph: a slowly
  // drifting pastel gradient keeps the frame alive without a zoom, which would
  // otherwise soften the logo.
  const background = scene.logoCard
    ? ["-f", "lavfi", "-t", d, "-i",
       `gradients=s=${W}x${PHOTO_H}:c0=0xffffff:c1=0xe4f2fb:c2=0xe8f6ef:c3=0xf6fbff:` +
       `x0=140:y0=90:x1=940:y1=1110:speed=0.012:r=${FPS}`]
    : ["-i", photo];
  const inputs = [...background, ...loop(cardA)];
  if (cardB) inputs.push(...loop(cardB));

  // Photo fills the top band (cropped to cover, so there are no blurred bars),
  // the card fades in over it, and the stat/contact block fades in mid-narration
  // so the text lands with the voice-over instead of appearing all at once.
  const parts = [
    // Scale to exactly the photo band rather than with 1.2x headroom: several
    // source photos are only ~1024px wide, and the headroom cost another 20% of
    // enlargement. unsharp puts some bite back into the ones still upscaled.
    scene.logoCard
      ? `[0:v]setsar=1[ph]`
      : `[0:v]scale=${W}:${PHOTO_H}:force_original_aspect_ratio=increase,` +
        `crop=${W}:${PHOTO_H},setsar=1,unsharp=5:5:0.8:5:5:0.0,${motion(scene, frames)}[ph]`,
    `color=c=white:s=${W}x${H}:d=${clipDur.toFixed(3)}:r=${FPS}[bg]`,
    `[bg][ph]overlay=0:0[base]`,
    `[1:v]fade=t=in:st=0.20:d=0.55:alpha=1[ca]`,
    `[base][ca]overlay=0:0[o1]`,
  ];
  let last = "o1";
  if (cardB) {
    const st = Math.max(1.2, clipDur * 0.45);
    parts.push(`[2:v]fade=t=in:st=${st.toFixed(2)}:d=0.5:alpha=1[cb]`);
    parts.push(`[o1][cb]overlay=0:0[o2]`);
    last = "o2";
  }
  parts.push(`[${last}]fade=t=in:st=0:d=0.4:color=white,format=yuv420p[v]`);

  await exec(
    "ffmpeg",
    [
      "-y", "-hide_banner", "-loglevel", "error", "-threads", "2",
      ...inputs,
      "-filter_complex", parts.join(";"),
      "-map", "[v]",
      "-t", clipDur.toFixed(3),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
      "-r", String(FPS),
      out,
    ],
    { maxBuffer: 1 << 24 },
  );
}

async function main() {
  const cfg = JSON.parse(await readFile(join(ROOT, "scenes.json"), "utf8"));
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

  for (const s of scenes) {
    const aHtml = join(dirs.cards, `${s.id}-a.html`);
    const aPng = join(dirs.cards, `${s.id}-a.png`);
    await writeFile(aHtml, cardHtml(s, cfg.brand, false), "utf8");
    await shoot(aHtml, aPng);

    let bPng = null;
    if (s.stat || s.contact) {
      const bHtml = join(dirs.cards, `${s.id}-b.html`);
      bPng = join(dirs.cards, `${s.id}-b.png`);
      await writeFile(bHtml, cardHtml(s, cfg.brand, true), "utf8");
      await shoot(bHtml, bPng);
    }

    const photo = s.logoCard ? null : join(ROOT, "assets", "photos", s.photo);
    if (photo && !existsSync(photo)) throw new Error(`missing photo: ${photo}`);
    const clip = join(dirs.clips, `${s.id}.mp4`);
    process.stdout.write(`[clip] ${s.id} (${s.clipDur.toFixed(2)}s) ... `);
    await buildClip(s, photo, aPng, bPng, s.clipDur, clip);
    console.log("ok");
    s.clip = clip;
  }

  // Narration track: each scene followed by GAP_SEC of silence, so the audio
  // timeline matches the concatenated clips exactly.
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
  const voiceWav = join(dirs.out, "voice.wav");
  aArgs.push(
    "-filter_complex",
    `${aParts.join(";")};${aLabels.join("")}concat=n=${scenes.length}:v=0:a=1[out]`,
    "-map", "[out]", "-ar", "44100", "-ac", "1", voiceWav,
  );
  await exec("ffmpeg", aArgs, { maxBuffer: 1 << 24 });

  console.log("[video] concat clips");
  const listFile = join(ROOT, "build", "clips.txt");
  await writeFile(listFile, scenes.map((s) => `file '${s.clip.replace(/\\/g, "/")}'`).join("\n"), "utf8");
  const silent = join(ROOT, "build", "video-silent.mp4");
  await exec("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", silent,
  ], { maxBuffer: 1 << 24 });

  console.log("[mux] audio + video");
  const final = join(dirs.out, "video.mp4");
  await exec("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", silent, "-i", voiceWav,
    "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
    final,
  ], { maxBuffer: 1 << 24 });

  const total = await durationSec(final);
  await writeFile(
    join(dirs.out, "script.txt"),
    cfg.scenes.map((s) => s.voice).join("\n\n"),
    "utf8",
  );
  console.log(`\n=== Done ===\nVideo: ${final}\nTotal: ${total.toFixed(2)}s (${scenes.length} scenes)`);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
