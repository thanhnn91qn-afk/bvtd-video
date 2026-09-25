/**
 * Validates a scenes file before anything is rendered.
 *
 * A full build costs three to six minutes and calls the TTS server once per
 * scene, so a typo in a style name or a photo that is not on disk is worth
 * catching in the first second. Everything that has actually gone wrong on this
 * project at least once is checked here.
 *
 * Errors stop the build. Warnings are printed and the build continues, because
 * they are judgement calls rather than certainties.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ART, pickArt } from "./art.mjs";
import { XFADE_NAMES } from "./assemble.mjs";

/** Styles that draw a photograph and have nothing to show without one. */
const NEEDS_PHOTO = new Set(["cinematic", "split", "glass", "caption", "wipe", "card", "shot"]);

/** Styles that reveal a `lines` array. */
const USES_LINES = new Set(["lines"]);

export function checkScenes(cfg, { styles, root }) {
  const errors = [];
  const warns = [];
  const seenId = new Set();
  const seenPhoto = new Map();
  const seenArt = new Map();

  if (!Array.isArray(cfg.scenes) || cfg.scenes.length === 0) {
    return { errors: ["kich ban khong co canh nao"], warns };
  }

  for (const s of cfg.scenes) {
    const at = `canh ${s.id ?? "(thieu id)"}`;

    if (!s.id) errors.push(`${at}: thieu "id"`);
    else if (seenId.has(s.id)) errors.push(`${at}: trung "id" - cache giong doc se de len nhau`);
    else seenId.add(s.id);

    if (!s.style) errors.push(`${at}: thieu "style"`);
    else if (!styles.includes(s.style))
      errors.push(`${at}: khong co style "${s.style}". Co: ${styles.join(", ")}`);

    if (!s.voice || !String(s.voice).trim()) errors.push(`${at}: thieu "voice" (loi doc)`);

    // TTS reads text, not numerals: a digit left in `voice` comes out silent or
    // mangled. Digits in the on-screen fields are correct and expected.
    const digits = String(s.voice ?? "").match(/\d/g);
    if (digits) {
      const near = String(s.voice).match(/\S*\d\S*/g).slice(0, 3).join(" ");
      warns.push(`${at}: "voice" con chu so (${near}) - may doc tieng Viet khong doc duoc, phai viet thanh chu`);
    }

    if (s.photo) {
      if (!existsSync(join(root, "assets", "photos", s.photo)))
        errors.push(`${at}: khong tim thay anh assets/photos/${s.photo}`);
      if (seenPhoto.has(s.photo))
        errors.push(`${at}: anh "${s.photo}" da dung o canh ${seenPhoto.get(s.photo)} - khong lap anh trong cung mot clip`);
      else seenPhoto.set(s.photo, s.id);
    } else if (NEEDS_PHOTO.has(s.style)) {
      errors.push(`${at}: style "${s.style}" bat buoc phai co "photo"`);
    }

    if (USES_LINES.has(s.style) && !(s.lines || []).length)
      errors.push(`${at}: style "lines" can mang "lines"`);

    if (s.style === "chart") {
      const c = s.chart || [];
      if (c.length < 2) errors.push(`${at}: style "chart" can mang "chart" it nhat 2 muc`);
      c.forEach((x, k) => {
        if (!x || !x.label) errors.push(`${at}: chart[${k}] thieu "label"`);
        if (!Number.isFinite(Number(x?.value))) errors.push(`${at}: chart[${k}] "value" phai la so`);
      });
    }
    if (s.style === "stat" && !Number.isFinite(Number(s.value)))
      errors.push(`${at}: style "stat" can "value" la mot con so`);
    if (s.transition && s.transition !== "none" && !XFADE_NAMES.has(s.transition))
      errors.push(`${at}: khong co kieu chuyen canh "${s.transition}"`);

    let art = null;
    try {
      art = s.photo ? null : pickArt(s);
    } catch (e) {
      errors.push(`${at}: ${e.message}`);
    }
    if (art) {
      if (seenArt.has(art))
        warns.push(`${at}: hinh ve "${art}" da dung o canh ${seenArt.get(art)} - doc nhu anh bi lap`);
      else seenArt.set(art, s.id);
    }
    if (s.art && s.art === "auto" && !art && !s.photo)
      warns.push(`${at}: "auto" khong tim duoc hinh nao hop - canh nay se khong co hinh ve`);

    if (s.stat && !s.statLabel) warns.push(`${at}: co "stat" nhung thieu "statLabel"`);
    if ((s.headline ?? "").length > 110)
      warns.push(`${at}: "headline" dai ${s.headline.length} ky tu - de tran khung, nen xem --stills truoc`);
  }

  return { errors, warns };
}

/**
 * Prints the result and throws if the scene file cannot be rendered. Called at
 * the top of both builders, before the first TTS request.
 */
export function assertScenes(cfg, opts) {
  const { errors, warns } = checkScenes(cfg, opts);
  for (const w of warns) console.log(`[canh-bao] ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`[loi]      ${e}`);
    throw new Error(`kich ban co ${errors.length} loi - dung lai truoc khi dung`);
  }
  if (!warns.length) console.log("[kiem tra] kich ban hop le");
}

export { ART };
