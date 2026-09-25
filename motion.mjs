/**
 * Data scenes driven by GSAP timelines, in the HyperFrames block format.
 *
 * Adapted from the HyperFrames catalog (heygen-com/hyperframes, Apache-2.0):
 * `data-chart` / `animated-bar-chart` for the bars and `mk-progress-stat` /
 * `conic-progress-ring` for the ring. Rewritten to read their data from the
 * scene, to lay out in either aspect, and to use the hospital's palette and a
 * font with full Vietnamese coverage (their blocks pull Latin-only web fonts).
 *
 * Block contract, same as HyperFrames: build `gsap.timeline({ paused: true })`
 * and register it in `window.__timelines`. The engine's GSAP_BRIDGE then seeks
 * every registered timeline to the frame's time. It must seek with
 * suppressEvents = false - count-ups write their text from `onUpdate`, and the
 * default seek skips callbacks, which leaves every number frozen at 0.
 */
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const gsapTag = (root) =>
  `<script src="${pathToFileURL(join(root, "node_modules", "gsap", "dist", "gsap.min.js")).href}"></script>`;

/** Spliced at the end of window.__frame. */
export const GSAP_BRIDGE = `
  if (window.__timelines) {
    for (const k in window.__timelines) window.__timelines[k].seek(tMs / 1000, false);
  }
`;

const fmt = (n) => Math.round(n).toLocaleString("vi-VN");

/**
 * Horizontal bars, one per item, revealed in reading order and paced across the
 * narration so each bar lands roughly when it is spoken. The largest bar keeps
 * a slow glow afterwards so a long sentence never sits on a frozen chart.
 *
 * scene.chart = [{ label, value, prefix?, suffix? }], optional scene.unit
 */
export function styleChart(s, ctx) {
  const { shell, esc, logoHtml, portrait } = ctx;
  const items = (s.chart || []).map((c) => ({ ...c, value: Number(c.value) }));
  const max = Math.max(...items.map((c) => c.value), 1);
  const rows = items
    .map(
      (c, i) => `<div class="row" data-i="${i}">
        <div class="lab">${esc(c.label)}</div>
        <div class="track"><div class="fill${c.value === max ? " top" : ""}"></div>
          <b class="val" data-v="${c.value}" data-p="${esc(c.prefix || "")}"
             data-s="${esc(c.suffix ?? (s.unit ? " " + s.unit : ""))}">0</b></div>
      </div>`,
    )
    .join("");
  const P = portrait;
  const data = { n: items.length, pct: items.map((c) => (c.value / max) * 100) };
  return shell(
    `
 .bg{position:absolute;inset:0;background:linear-gradient(${P ? 165 : 140}deg,#071e33 0%,#0e3557 58%,#071e33 100%)}
 .grid{position:absolute;inset:0;opacity:.07;
   background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);
   background-size:${P ? "90px 90px" : "96px 96px"}}
 .wrap{position:absolute;left:${P ? 64 : 120}px;right:${P ? 64 : 120}px;top:${P ? 170 : 110}px}
 #kicker{display:inline-block;font-size:${P ? 28 : 24}px;letter-spacing:4px;text-transform:uppercase;
   color:#071e33;background:#7ff0c8;padding:12px 26px;border-radius:10px;font-weight:800;opacity:0}
 #headline{font-size:${P ? 70 : 60}px;line-height:1.1;color:#fff;margin:26px 0 ${P ? 70 : 50}px;
   font-weight:800;letter-spacing:-1px;opacity:0;max-width:${P ? "100%" : "1400px"}}
 .row{margin-bottom:${P ? 54 : 34}px;opacity:0}
 .lab{font-size:${P ? 40 : 32}px;color:#cfe3ee;font-weight:600;margin-bottom:14px}
 .track{position:relative;height:${P ? 64 : 52}px;border-radius:12px;background:rgba(255,255,255,.07)}
 .fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:12px;
   background:linear-gradient(90deg,#0b6fb4,#12a37a)}
 .fill.top{background:linear-gradient(90deg,#12a37a,#7ff0c8);box-shadow:0 0 0 rgba(127,240,200,0)}
 .val{position:absolute;top:50%;transform:translateY(-50%);left:0;padding-left:22px;
   font-size:${P ? 46 : 38}px;color:#fff;font-weight:800;white-space:nowrap}
`,
    `<div class="bg"></div><div class="grid"></div>
     <div class="wrap"><div id="kicker">${esc(s.kicker)}</div>
       <h1 id="headline">${esc(s.headline)}</h1>
       <div id="chart">${rows}</div></div>
     ${logoHtml}`,
    s.__cfg,
    `
(function(){
  const D = ${JSON.stringify(data)};
  const dur = window.__CFG.clipDurMs / 1000;
  const start = 0.9;
  const step = Math.min(2.2, Math.max(0.45, (dur - 2.8) / Math.max(1, D.n)));
  const tl = gsap.timeline({ paused: true });
  document.querySelectorAll("#chart .row").forEach(function(row, i){
    const at = start + i * step;
    const fill = row.querySelector(".fill"), val = row.querySelector(".val");
    const st = { v: 0 };
    const target = Number(val.dataset.v);
    // The value rides the end of its bar. GSAP cannot interpolate min()/calc(),
    // so the landing point is measured in pixels once, with the final text in
    // place, and clamped so a long bar never pushes its number off the track.
    const w = row.querySelector(".track").clientWidth;
    val.textContent = val.dataset.p + target.toLocaleString("vi-VN") + val.dataset.s;
    const land = Math.max(0, Math.min(w * D.pct[i] / 100, w - val.offsetWidth - 12));
    val.textContent = "0";
    tl.fromTo(row, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: .45, ease: "power2.out" }, at);
    tl.to(fill, { width: D.pct[i] + "%", duration: 1.1, ease: "power3.out" }, at + .1);
    tl.to(val, { left: land, duration: 1.1, ease: "power3.out" }, at + .1);
    tl.to(st, { v: target, duration: 1.1, ease: "power3.out",
      onUpdate: function(){ val.textContent = val.dataset.p + Math.round(st.v).toLocaleString("vi-VN") + val.dataset.s; }
    }, at + .1);
  });
  const top = document.querySelector("#chart .fill.top");
  if (top) tl.to(top, { boxShadow: "0 0 34px rgba(127,240,200,.55)", duration: 1.4,
    ease: "sine.inOut", yoyo: true, repeat: -1 }, start + D.n * step + .6);
  window.__timelines = window.__timelines || {};
  window.__timelines.chart = tl;
})();`,
  );
}

/**
 * One big figure counting up inside a ring. With `max` the ring fills to
 * value/max; without it the ring just draws itself closed, as a frame.
 *
 * scene.value, optional scene.max / scene.prefix / scene.suffix
 */
export function styleStat(s, ctx) {
  const { shell, esc, logoHtml, portrait } = ctx;
  const P = portrait;
  const value = Number(s.value);
  const frac = s.max ? Math.max(0, Math.min(1, value / Number(s.max))) : 1;
  const R = 300, C = 2 * Math.PI * R;
  return shell(
    `
 .bg{position:absolute;inset:0;background:radial-gradient(circle at 50% ${P ? 38 : 50}%,#0e3a60 0%,#071e33 62%)}
 .ringbox{position:absolute;${P ? "left:50%;top:230px;transform:translateX(-50%);width:760px;height:760px"
   : "left:150px;top:50%;transform:translateY(-50%);width:700px;height:700px"}}
 .ringbox svg{width:100%;height:100%;overflow:visible}
 .num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
   font-size:${P ? 150 : 130}px;font-weight:900;color:#fff;letter-spacing:-3px;opacity:0}
 .side{position:absolute;${P ? "left:70px;right:70px;top:1060px;text-align:center"
   : "left:960px;right:120px;top:50%;transform:translateY(-50%)"}}
 #kicker{display:inline-block;font-size:${P ? 28 : 24}px;letter-spacing:4px;text-transform:uppercase;
   color:#071e33;background:#7ff0c8;padding:12px 26px;border-radius:10px;font-weight:800;opacity:0}
 #headline{font-size:${P ? 64 : 58}px;line-height:1.12;color:#fff;margin:26px 0 22px;font-weight:800;opacity:0}
 #sub{font-size:${P ? 36 : 30}px;line-height:1.42;color:#bcd6e8;margin:0;opacity:0}
`,
    `<div class="bg"></div>
     <div class="ringbox"><svg viewBox="-360 -360 720 720">
       <circle r="${R}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="26"/>
       <circle class="arc" r="${R}" fill="none" stroke="url(#g)" stroke-width="26" stroke-linecap="round"
         transform="rotate(-90)" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/>
       <circle class="halo" r="${R + 34}" fill="none" stroke="rgba(127,240,200,.25)" stroke-width="2"
         stroke-dasharray="4 16" opacity="0"/>
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#0b6fb4"/><stop offset="1" stop-color="#7ff0c8"/></linearGradient></defs>
     </svg><div class="num" data-v="${value}" data-p="${esc(s.prefix || "")}" data-s="${esc(s.suffix || "")}">0</div></div>
     <div class="side"><div id="kicker">${esc(s.kicker)}</div>
       <h1 id="headline">${esc(s.headline)}</h1><p id="sub">${esc(s.sub)}</p></div>
     ${logoHtml}`,
    s.__cfg,
    `
(function(){
  const C = ${C.toFixed(3)}, F = ${frac};
  const num = document.querySelector(".ringbox .num");
  const st = { v: 0 }, target = Number(num.dataset.v);
  const tl = gsap.timeline({ paused: true });
  tl.to(num, { opacity: 1, duration: .5, ease: "power2.out" }, .3);
  tl.to(".ringbox .arc", { strokeDashoffset: C * (1 - F), duration: 2.2, ease: "power3.inOut" }, .4);
  tl.to(st, { v: target, duration: 2.2, ease: "power3.out",
    onUpdate: function(){ num.textContent = num.dataset.p + Math.round(st.v).toLocaleString("vi-VN") + num.dataset.s; }
  }, .4);
  tl.to(".ringbox .halo", { opacity: 1, duration: .8 }, 2.4);
  // idle: the dotted halo turns slowly for as long as the narration runs
  tl.to(".ringbox .halo", { rotation: 360, svgOrigin: "0 0", duration: 24, ease: "none", repeat: -1 }, 2.4);
  window.__timelines = window.__timelines || {};
  window.__timelines.stat = tl;
})();`,
  );
}

export { fmt };

/* ---------------------------------------------------------------------------
 * Text motion, after the HyperFrames typography primitives `per-word-rise`
 * (words come up out of a blur) and `marker-highlight` (a marker stroke sweeps
 * behind the words that carry the point). These run in our own engine rather
 * than through GSAP: the word and line loops already own those elements'
 * transforms, and two writers on one transform is how the photo frame once
 * dropped out of centre.
 * ------------------------------------------------------------------------- */

/** Folded into the word loop, before the idle wave. */
export const WORD_FX = `
      el.style.filter = p < 1 ? "blur(" + ((1 - p) * 9).toFixed(2) + "px)" : "none";
      const mk = el.querySelector(".mk");
      if (mk) {
        const mp = easeOutCubic(prog(tMs, s + 220, s + 720));
        mk.style.transform = "scaleX(" + mp.toFixed(4) + ")";
        // the word turns dark as the marker passes under it, like real ink on a highlighter
        const inked = mp > 0.5;
        el.style.color = inked ? "#071e33" : "";
        el.style.textShadow = inked ? "none" : "";
      }
`;

/** Folded into the line loop, before the idle wave. */
export const LINE_FX = `
      lines[i].style.filter = p < 1 ? "blur(" + ((1 - p) * 7).toFixed(2) + "px)" : "none";
`;

export const MARK_CSS = `
 .w.mark{position:relative;isolation:isolate}
 .w .mk{position:absolute;left:0;right:0;top:12%;bottom:6%;border-radius:10px;z-index:-1;
   background:#7ff0c8;transform:scaleX(0);transform-origin:left center}
`;

/**
 * Splits a headline into word spans for the kinetic styles, marking every word
 * that appears in `highlight` (a list of words or short phrases).
 */
export function markWords(text, highlight, esc) {
  // Phrases are matched as whole runs of words. Matching single words would
  // also mark every other occurrence - "không" in "không lây nhiễm" lit up
  // when only "không thể chủ quan" was meant.
  const norm = (w) => w.toLowerCase().replace(/[.,!?;:"“”'()\-–]/g, "");
  const toks = esc(text).split(/\s+/).filter(Boolean);
  const keys = toks.map(norm);
  const mark = toks.map(() => false);
  for (const h of highlight || []) {
    const ph = String(h).split(/\s+/).map(norm).filter(Boolean);
    if (!ph.length) continue;
    for (let i = 0; i + ph.length <= keys.length; i++)
      if (ph.every((w, k) => keys[i + k] === w)) for (let k = 0; k < ph.length; k++) mark[i + k] = true;
  }
  return toks
    .map((w, i) => (mark[i]
      ? `<span class="w mark">${w}<i class="mk"></i></span>`
      : `<span class="w">${w}</span>`))
    .join("");
}
