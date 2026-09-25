/**
 * The "director": picks a scene style, a motif and a transition for every
 * scene that leaves them out or sets them to "auto", so a scenes file can carry
 * just the content and still come out as a varied, fitting mix.
 *
 * Anything set by hand is never touched. The rules below encode what has held
 * up on this project so far:
 *   - the data decides first: numbers become a chart or a counting ring
 *   - posters, infographics and screenshots are shown whole, never cropped
 *   - photo styles rotate so no two neighbouring scenes share a look
 *   - text-only scenes alternate between word-by-word and plain type
 *   - a motif is only drawn when the scene's own words point to one, and never
 *     twice in one clip - a repeated drawing reads like a repeated photo
 *   - transitions stay calm and vary; the close fades through white
 */
import { artCandidates } from "./art.mjs";
import { TRANSITIONS } from "./assemble.mjs";

const POSTERISH = /screenshot|poster|infographic|banner|chup-man-hinh/i;

const PHOTO_POOL = {
  portrait: ["cinematic", "glass", "split", "card", "caption", "wipe"],
  landscape: ["cinematic", "split", "glass", "card", "wipe", "caption"],
};

const words = (t) => String(t || "").trim().split(/\s+/).filter(Boolean).length;
const isAuto = (v) => v === undefined || v === null || v === "" || v === "auto";

function chooseStyle(s, i, n, prev, prev2, portrait) {
  if (Array.isArray(s.chart) && s.chart.length >= 2) return "chart";
  if (!s.photo && Number.isFinite(Number(s.value)) && s.value !== "") return "stat";

  if (s.photo) {
    if (s.poster === true || POSTERISH.test(s.photo)) return "shot";
    // a list beside its photo only has room on the wide frame
    if (!portrait && (s.lines || []).length) return "lines";
    const pool = PHOTO_POOL[portrait ? "portrait" : "landscape"]
      // word-by-word across a photo gets messy once the line is long
      .filter((st) => st !== "caption" || words(s.headline) <= 10);
    if (i === 0 && pool.includes("cinematic")) return "cinematic";
    return pool.find((st) => st !== prev && st !== prev2) || pool[0];
  }

  if ((s.lines || []).length) return "lines";
  if (i === n - 1 && !s.contact) return "logo";
  if (s.contact) return "plain";
  if (words(s.headline) <= 12 && prev !== "kinetic") return "kinetic";
  return prev === "plain" ? "kinetic" : "plain";
}

/** Styles that have room for a motif when the scene has no photo. */
function takesArt(style, portrait) {
  return style === "plain" || style === "kinetic" || (!portrait && style === "lines");
}

function chooseTransition(s, i, scenes, prevTrans) {
  const cur = s.style, before = scenes[i - 1].style;
  let want;
  if (i === scenes.length - 1 && cur === "logo") want = "fadewhite";
  else if (cur === "chart" || cur === "stat") want = "fade";
  else if (cur === "shot") want = "circleopen";
  else if (scenes[i].photo && scenes[i - 1].photo) want = i % 2 ? "smoothleft" : "smoothright";
  else if (scenes[i].photo) want = "wipeleft";
  else if (before === "kinetic" || cur === "kinetic") want = "smoothup";
  else want = "dissolve";
  if (want === prevTrans) want = TRANSITIONS.find((t) => t !== prevTrans && t !== want) || want;
  return want;
}

/**
 * Fills in the blanks in place and returns a log of what was decided, one line
 * per scene, so a build shows its choices instead of making them silently.
 */
export function direct(cfg, { portrait }) {
  const scenes = cfg.scenes || [];
  const n = scenes.length;
  const log = [];
  const usedArt = new Set(scenes.map((s) => s.art).filter((a) => a && !isAuto(a) && a !== "none"));

  scenes.forEach((s, i) => {
    const notes = [];
    if (isAuto(s.style)) {
      s.style = chooseStyle(s, i, n, scenes[i - 1]?.style, scenes[i - 2]?.style, portrait);
      notes.push(`kieu ${s.style}`);
    }
    if (!s.photo && takesArt(s.style, portrait) && isAuto(s.art)) {
      const pick = artCandidates(s).find((a) => !usedArt.has(a));
      if (pick) { s.art = pick; usedArt.add(pick); notes.push(`hinh ${pick}`); }
      else if (s.art === "auto") s.art = "none";
    }
    if (notes.length) log.push(`${s.id}: ${notes.join(", ")}`);
  });

  // second pass: transitions need both neighbours' final styles
  let prevTrans = null;
  scenes.forEach((s, i) => {
    if (i === 0) return;
    if (isAuto(s.transition)) {
      s.transition = chooseTransition(s, i, scenes, prevTrans);
      const line = log.findIndex((l) => l.startsWith(`${s.id}:`));
      const note = `vao canh bang ${s.transition}`;
      if (line >= 0) log[line] += `, ${note}`; else log.push(`${s.id}: ${note}`);
    }
    prevTrans = s.transition === "none" ? null : s.transition;
  });
  return log;
}
